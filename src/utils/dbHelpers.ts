import { eq } from 'drizzle-orm';
import * as schema from '../database/schema';
import type { Database } from 'bun:sqlite';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';

/**
 * Retrieves the user ID from the database using the provided Auth0 user ID.
 *
 * @param {string} auth0UserId - The Auth0 user ID to search for in the database.
 * @param {BunSQLiteDatabase<typeof schema> & { $client: Database }} db - The database instance to query.
 * @returns {Promise<number | undefined>} - A promise that resolves to the user ID if found, otherwise undefined.
 */
export const getUserIdFromAuth0UserId = async (
  auth0UserId: string,
  db: BunSQLiteDatabase<typeof schema> & { $client: Database },
): Promise<number | undefined> => {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.auth0_id, auth0UserId),
    columns: { id: true },
  });
  return user?.id;
};
