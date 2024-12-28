import { getCalendarWeekFromDateOfCurrentYear } from '../helper';
import { db } from './db';
import * as schema from './schema';

const ENABLE_SEEDING = true;

export async function seedDatabase() {
  if (!ENABLE_SEEDING) {
    console.log('Database Seeding is disabled.');
    return;
  }

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
        effort_in_minutes: 5,
        days_per_week: 3,
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
  }

  if (!(await db.query.assignments.findFirst())) {
    const currentWeek = getCalendarWeekFromDateOfCurrentYear(new Date());
    await db.insert(schema.assignments).values([
      {
        doing_id: 1,
        user_id: 1,
        status: 'pending',
        due_week: currentWeek,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        doing_id: 2,
        user_id: 2,
        status: 'completed',
        due_week: currentWeek,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        doing_id: 2,
        user_id: 2,
        status: 'pending',
        due_week: currentWeek,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        doing_id: 2,
        user_id: 2,
        status: 'waiting',
        due_week: currentWeek,
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
        repetition: 'weekly',
        effort_in_minutes: 30,
        status: 'completed',
        created_at: new Date(),
        updated_at: new Date(),
        history_date: new Date(),
      },
      {
        doing_id: 2,
        user_id: 1,
        repetition: 'daily',
        days_per_week: 3,
        effort_in_minutes: 10,
        status: 'completed',
        created_at: new Date(),
        updated_at: new Date(),
        history_date: new Date(),
      },
      {
        doing_id: 2,
        user_id: 1,
        repetition: 'daily',
        days_per_week: 3,
        effort_in_minutes: 10,
        status: 'completed',
        created_at: new Date(),
        updated_at: new Date(),
        history_date: new Date(),
      },
      {
        doing_id: 2,
        user_id: 1,
        repetition: 'daily',
        days_per_week: 3,
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
