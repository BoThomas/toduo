import { eq, count, sum, and, isNull } from 'drizzle-orm';
import * as schema from '../database/schema';
import type { Database } from 'bun:sqlite';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';

// types
type DB = BunSQLiteDatabase<typeof schema> & { $client: Database };

// constants
const MAX_SHITTY_POINTS_PER_DOING = Number(
  process.env.MAX_SHITTY_POINTS_PER_DOING || 3,
);

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
