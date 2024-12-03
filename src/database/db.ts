import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { Database } from 'bun:sqlite';
import * as schema from './schema';

if (!process.env.SQLITE_PATH) {
  throw new Error('SQLITE_PATH environment variable is not set');
}

const sqlite = new Database(process.env.SQLITE_PATH);
const db = drizzle(sqlite, { schema });
migrate(db, {
  migrationsFolder: 'src/database/migrations',
});

// Enable foreign key constraints
db.run('PRAGMA foreign_keys = ON');

export { db };
