import { db } from './db';
import * as schema from './schema';

export async function seedDatabase() {
  const firstMovie = await db.query.movies.findFirst();

  if (!firstMovie) {
    await db.insert(schema.movies).values([
      {
        title: 'The Matrix',
        releaseYear: 1999,
      },
      {
        title: 'The Matrix Reloaded',
        releaseYear: 2003,
      },
      {
        title: 'The Matrix Revolutions',
        releaseYear: 2003,
      },
    ]);

    console.log('Database Seeding complete.');
  }
}
