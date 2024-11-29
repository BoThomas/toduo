import { db } from './db';
import * as schema from './schema';

export async function seedDatabase() {
  const firstUser = await db.query.users.findFirst();

  if (!firstUser) {
    await db.insert(schema.users).values([
      {
        username: 'john_doe',
        auth0_id: 'auth0|123456789',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        username: 'jane_doe',
        auth0_id: 'auth0|987654321',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    await db.insert(schema.doings).values([
      {
        name: 'Do the dishes',
        description: 'Clean all the dishes in the sink',
        repetition: 'daily',
        effort_in_minutes: 30,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        name: 'Take out the trash',
        description: 'Take the trash out to the curb',
        repetition: 'weekly',
        effort_in_minutes: 10,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    await db.insert(schema.assignments).values([
      {
        doing_id: 1,
        user_id: 1,
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        doing_id: 2,
        user_id: 2,
        status: 'completed',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    await db.insert(schema.shitty_points).values([
      {
        doing_id: 1,
        user_id: 1,
        points: 5,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        doing_id: 2,
        user_id: 2,
        points: 10,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    await db.insert(schema.history).values([
      {
        doing_id: 1,
        user_id: 1,
        effort_in_minutes: 30,
        status: 'completed',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        doing_id: 2,
        user_id: 2,
        effort_in_minutes: 10,
        status: 'completed',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    console.log('Database Seeding complete.');
  }
}
