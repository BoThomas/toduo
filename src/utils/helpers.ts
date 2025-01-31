import { eq, count, sum, and, isNull } from 'drizzle-orm';
import * as schema from '../database/schema';
import { getDbConnection } from '../database/db';
import type { Database } from 'bun:sqlite';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';

// types
type DB = BunSQLiteDatabase<typeof schema> & { $client: Database };
type AuthInfo = { id: string; group: string; name: string };

// constants
const MAX_SHITTY_POINTS_PER_DOING = Number(
  process.env.MAX_SHITTY_POINTS_PER_DOING || 3,
);
const STATUS_OPTIONS = [
  'waiting',
  'pending',
  'completed',
  'skipped',
  'postponed',
];

// helper functions

/**
 * Retrieves the user ID from the database using the provided Auth0 user ID.
 *
 * @param {string} auth0UserId - The Auth0 user ID to search for in the database.
 * @param {DB} db - The database instance to query.
 * @returns {Promise<number | undefined>} - A promise that resolves to the user ID if found, otherwise undefined.
 */
export const getUserIdFromAuth0UserId = async (
  auth0UserId: string,
  db: DB,
): Promise<number | undefined> => {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.auth0_id, auth0UserId),
    columns: { id: true },
  });
  return user?.id;
};

/**
 * Checks if the maximum number of "shitty points" would be exceeded if "shitty points" for a specific doing were updated.
 *
 * @param db - The database connection object.
 * @param currentPoints - The current number of points for a specific doing.
 * @param targetPoints - The target number of points for a specific doing.
 * @param user_id - The ID of the user.
 * @returns A promise that resolves to a string indicating the error message if the maximum is exceeded, otherwise an empty string.
 */
export const maxShittyPointsExceeded = async (
  db: DB,
  currentPoints: number,
  targetPoints: number,
  user_id: number,
): Promise<string> => {
  if (targetPoints > MAX_SHITTY_POINTS_PER_DOING) {
    return 'Max shitty points for this doing reached';
  }

  const totalNumberOfDoingsArray = await db
    .select({
      totalDoings: count(),
    })
    .from(schema.doings)
    .where(
      and(
        isNull(schema.doings.deleted_at),
        isNull(schema.doings.static_user_id),
      ),
    );

  const totalNumberOfDoings = totalNumberOfDoingsArray[0].totalDoings ?? 0;

  const usersTotalShittyPointsArray = await db
    .select({
      totalPoints: sum(schema.shitty_points.points),
    })
    .from(schema.shitty_points)
    .where(eq(schema.shitty_points.user_id, user_id));

  const usersTotalShittyPoints = Number(
    usersTotalShittyPointsArray[0].totalPoints ?? 0,
  );

  if (
    usersTotalShittyPoints + (targetPoints - currentPoints) >
    totalNumberOfDoings
  ) {
    return 'Max sum of shitty points reached';
  }

  return '';
};

/**
 * Adds a user to the database if they do not already exist.
 *
 * @param {AuthInfo} userInfo - The authentication information of the user.
 * @returns {Promise<void>} A promise that resolves when the operation is complete.
 *
 * @remarks
 * This function checks if a user with the given authentication ID already exists in the database.
 * If the user does not exist, it calculates the new user's participation percentage based on the
 * sum of all existing users' participation percentages. If an error occurs during this calculation,
 * the new user's participation percentage defaults to 0. Finally, the new user is inserted into the database.
 */
export const addUserToDbIfNotExists = async (
  userInfo: AuthInfo,
): Promise<void> => {
  const db = getDbConnection(userInfo.group);

  // check if user already exists
  const userExists = await db.query.users.findFirst({
    where: eq(schema.users.auth0_id, userInfo.id),
  });

  if (userExists) {
    return;
  }

  let newParticipationPercent;
  try {
    // check sum of all participation_percent
    const users = await db.query.users.findMany({
      columns: { participation_percent: true },
    });
    const sum = users.reduce(
      (acc: any, user: any) => acc + user.participation_percent,
      0,
    );
    // calculate new participation_percent
    newParticipationPercent = 100 - sum;
  } catch (e) {
    // default to 0
    newParticipationPercent = 0;
  }

  // insert new user
  await db.insert(schema.users).values({
    username: userInfo.name,
    auth0_id: userInfo.id,
    participation_percent: newParticipationPercent,
    created_at: new Date(),
    updated_at: new Date(),
  });

  console.log(
    `User ${userInfo.name} added to database ${userInfo.group} with ${newParticipationPercent}% participation`,
  );
};

/**
 * Retrieves and validates the database group from the provided API key.
 *
 * @param {string} apiKey - The API key to validate and extract the group from.
 * @returns {Promise<string>} - A promise that resolves to the group extracted from the API key.
 * @throws {Error} - Throws an error if the API key is invalid or does not exist in the database.
 */
export const getAndValidateDbGroupFromApiKey = async (
  apiKey: string,
): Promise<string> => {
  if (!apiKey) {
    throw new Error('Invalid API key');
  }

  // parse group from api key (e.g. 'group__api_key')
  const group = apiKey.split('__')[0];

  if (!group) {
    throw new Error('Invalid API key');
  }

  const db = getDbConnection(group, false);
  const apiKeyExists = await db
    .select({ key: schema.apikeys.key })
    .from(schema.apikeys)
    .where(eq(schema.apikeys.key, apiKey));

  if (apiKeyExists.length === 0) {
    throw new Error('Invalid API key');
  }

  return group;
};

/**
 * Filters the status options based on the interval unit and the number of repeats per week.
 *
 * Also see '/frontend/src/Components/TheDoings.vue' for the corresponding frontend implementation.
 *
 * @param {string} interval_unit - The unit of the interval (e.g., 'weekly', 'once').
 * @param {number} repeats_per_week - The number of times the task repeats per week.
 * @returns {string[]} The filtered list of status options.
 *
 * The function performs the following filtering:
 * - For 'weekly' interval unit, it removes the 'postponed' status option.
 * - For 'once' interval unit, it removes the 'skipped' status option.
 * - For tasks that repeat once or less per week, it removes the 'waiting' status option.
 */
export const filterStatusOptions = (
  interval_unit: string,
  repeats_per_week: number,
): string[] => {
  let options = [...STATUS_OPTIONS];

  // for weekly todos, we don't want to show postponed status
  // as it doesn't make sense because the todo will be reassigned the next day/week anyway
  if (interval_unit === 'weekly') {
    options = options.filter((option) => option !== 'postponed');
  }

  // for once todos, we don't want to show skipped status
  if (interval_unit === 'once') {
    options = options.filter((option) => option !== 'skipped');
  }

  // only for repeated todos is waiting status allowed
  if (repeats_per_week <= 1) {
    options = options.filter((option) => option !== 'waiting');
  }
  return options;
};
