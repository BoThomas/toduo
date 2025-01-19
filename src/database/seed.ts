import { getDbConnection } from './db';
import * as schema from './schema';

const ENABLE_SEEDING = process.env.SEED_DATABASE === 'true';

export async function seedDatabase() {
  if (!ENABLE_SEEDING) {
    console.log('Database Seeding is disabled.');
    return;
  }

  console.log('Database Seeding started for "default" database.');

  const db = getDbConnection('default');

  if (!(await db.query.users.findFirst())) {
    await db.insert(schema.users).values([
      {
        username: 'john_doe',
        auth0_id: 'auth0|123456789',
        participation_percent: 50,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        username: 'jane_doe',
        auth0_id: 'auth0|987654321',
        participation_percent: 50,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  }

  if (!(await db.query.doings.findFirst())) {
    await db.insert(schema.doings).values([
      {
        name: 'Do the dishes',
        description: 'Clean all the dishes in the sink',
        interval_unit: 'weekly',
        interval_value: 1,
        repeats_per_week: 1,
        effort_in_minutes: 30,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        name: 'Take out the trash',
        description: 'Take the trash out to the curb',
        interval_unit: 'weekly',
        interval_value: 1,
        repeats_per_week: 3,
        effort_in_minutes: 5,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  }

  if (!(await db.query.shitty_points.findFirst())) {
    await db.insert(schema.shitty_points).values([
      {
        doing_id: 1,
        user_id: 1,
        points: 1,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        doing_id: 2,
        user_id: 2,
        points: 2,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  }

  if (!(await db.query.assignments.findFirst())) {
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
      {
        doing_id: 2,
        user_id: 2,
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        doing_id: 2,
        user_id: 2,
        status: 'waiting',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  }

  if (!(await db.query.history.findFirst())) {
    await db.insert(schema.history).values([
      {
        doing_id: 1,
        user_id: 2,
        interval_unit: 'weekly',
        interval_value: 1,
        repeats_per_week: 1,
        effort_in_minutes: 30,
        status: 'completed',
        created_at: new Date(),
        updated_at: new Date(),
        history_date: new Date(),
      },
      {
        doing_id: 2,
        user_id: 1,
        interval_unit: 'weekly',
        interval_value: 1,
        repeats_per_week: 3,
        effort_in_minutes: 10,
        status: 'completed',
        created_at: new Date(),
        updated_at: new Date(),
        history_date: new Date(),
      },
      {
        doing_id: 2,
        user_id: 1,
        interval_unit: 'weekly',
        interval_value: 1,
        repeats_per_week: 3,
        effort_in_minutes: 10,
        status: 'completed',
        created_at: new Date(),
        updated_at: new Date(),
        history_date: new Date(),
      },
      {
        doing_id: 2,
        user_id: 1,
        interval_unit: 'weekly',
        interval_value: 1,
        repeats_per_week: 3,
        effort_in_minutes: 10,
        status: 'completed',
        created_at: new Date(),
        updated_at: new Date(),
        history_date: new Date(),
      },
    ]);
  }

  console.log('Database Seeding complete.');
}
