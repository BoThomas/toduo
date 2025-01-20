import { drizzle, type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { Database } from 'bun:sqlite';
import * as schema from './schema';
import { mkdirSync, existsSync } from 'fs';

const LOG_ENABLED = true;

if (!process.env.SQLITE_PATH) {
  throw new Error('SQLITE_PATH environment variable is not set');
}

const SQLITE_PATH = process.env.SQLITE_PATH;
const MAX_CACHE_SIZE = 5;

// Create the folder specified by the SQLITE_PATH if it doesn't exist
if (!existsSync(SQLITE_PATH)) {
  mkdirSync(SQLITE_PATH, { recursive: true });
}

interface CachedDb {
  db: BunSQLiteDatabase<typeof schema> & { $client: Database };
  lastAccessed: number;
}

const dbConnectionCache: Map<string, CachedDb> = new Map();

/**
 * Get the database connection for the given group.
 * If the connection is already cached, return the cached connection.
 * If the connection is not cached, create a new connection and cache it.
 * If the cache exceeds the max size, remove the least recently used item.
 * @param group - The group name of the user to get the database connection
 * @returns - The database connection
 */
const getDbConnection = (
  group: string,
): BunSQLiteDatabase<typeof schema> & { $client: Database } => {
  // check if group is given and valid
  if (!group || typeof group !== 'string' || group.length === 0) {
    throw new Error('Invalid group name');
  }

  // check if connection is already cached and return it
  if (dbConnectionCache.has(group)) {
    const cachedDb = dbConnectionCache.get(group);
    if (cachedDb) {
      // Update the last accessed time
      cachedDb.lastAccessed = Date.now();
      if (LOG_ENABLED)
        console.log(`Reusing cached database connection: ${group}`);
      return cachedDb.db;
    }

    // If the cached connection is null, remove it from the cache
    dbConnectionCache.delete(group);
  }

  const dbPath = getDbPath(group);
  if (LOG_ENABLED) console.log(`Connecting to database: ${dbPath}`);

  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite, { schema });
  migrate(db, {
    migrationsFolder: 'src/database/migrations',
  });

  // Enable foreign key constraints
  db.run('PRAGMA foreign_keys = ON');

  // Add the new connection to the cache
  dbConnectionCache.set(group, { db, lastAccessed: Date.now() });

  // If the cache exceeds the max size, remove the least recently used item
  if (dbConnectionCache.size > MAX_CACHE_SIZE) {
    const oldestKey = [...dbConnectionCache.entries()].sort(
      (a, b) => a[1].lastAccessed - b[1].lastAccessed,
    )[0][0];
    const oldestDb = dbConnectionCache.get(oldestKey);
    if (oldestDb) {
      oldestDb.db.$client.close();
    }
    dbConnectionCache.delete(oldestKey);
    if (LOG_ENABLED)
      console.log(
        `Removed least recently used database connection: ${oldestKey}`,
      );
  }

  return db;
};

const getDbPath = (group: string): string => {
  return `${SQLITE_PATH}/database-${group}.sqlite`;
};

const removeDbConnectionFromCache = (group: string): void => {
  const cachedDb = dbConnectionCache.get(group);
  if (cachedDb) {
    cachedDb.db.$client.close();
    dbConnectionCache.delete(group);
  }
};

export { getDbConnection, getDbPath, removeDbConnectionFromCache };
