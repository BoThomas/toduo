import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: integer({ mode: 'number' }).primaryKey({ autoIncrement: true }),
  username: text().unique().notNull(),
  auth0_id: text().unique().notNull(),
  participation_percent: integer({ mode: 'number' }).notNull().default(0),
  deleted_at: integer({ mode: 'timestamp' }),
  created_at: integer({ mode: 'timestamp' }).notNull(),
  updated_at: integer({ mode: 'timestamp' }).notNull(),
});

export const doings = sqliteTable('doings', {
  id: integer({ mode: 'number' }).primaryKey({ autoIncrement: true }),
  name: text().unique().notNull(),
  description: text(),
  notice: text(),
  repetition: text({
    enum: ['once', 'daily', 'weekly', 'monthly', 'yearly'],
  }).notNull(),
  days_per_week: integer({ mode: 'number' }),
  effort_in_minutes: integer({ mode: 'number' }).notNull(),
  is_active: integer({ mode: 'boolean' }), // TODO change to boolean when drizzle-orm supports it
  deleted_at: integer({ mode: 'timestamp' }),
  created_at: integer({ mode: 'timestamp' }).notNull(),
  updated_at: integer({ mode: 'timestamp' }).notNull(),
});

export const assignments = sqliteTable('assignments', {
  id: integer({ mode: 'number' }).primaryKey({ autoIncrement: true }),
  doing_id: integer({ mode: 'number' })
    .notNull()
    .references(() => doings.id),
  user_id: integer({ mode: 'number' })
    .notNull()
    .references(() => users.id),
  due_date: integer({ mode: 'timestamp' }), // not needed for now
  due_week: integer({ mode: 'number' }),
  status: text({
    enum: ['waiting', 'pending', 'completed', 'skipped', 'postponed', 'failed'],
  }).notNull(),
  created_at: integer({ mode: 'timestamp' }).notNull(),
  updated_at: integer({ mode: 'timestamp' }).notNull(),
});

export const shitty_points = sqliteTable('shitty_points', {
  id: integer({ mode: 'number' }).primaryKey({ autoIncrement: true }),
  doing_id: integer({ mode: 'number' })
    .notNull()
    .references(() => doings.id),
  user_id: integer({ mode: 'number' })
    .notNull()
    .references(() => users.id),
  points: integer({ mode: 'number' }).notNull(),
  created_at: integer({ mode: 'timestamp' }).notNull(),
  updated_at: integer({ mode: 'timestamp' }).notNull(),
});

// TODO: male history independent from doings and other tables + use it on the server side
export const history = sqliteTable('history', {
  id: integer({ mode: 'number' }).primaryKey({ autoIncrement: true }),
  doing_id: integer({ mode: 'number' })
    .notNull()
    .references(() => doings.id),
  user_id: integer({ mode: 'number' })
    .notNull()
    .references(() => users.id),
  repetition: text(),
  days_per_week: integer({ mode: 'number' }),
  //due_date: integer({ mode: 'timestamp' }),
  //due_week: integer({ mode: 'number' }),
  effort_in_minutes: integer({ mode: 'number' }),
  status: text(),
  created_at: integer({ mode: 'timestamp' }),
  updated_at: integer({ mode: 'timestamp' }),
});

export const usersRelations = relations(users, ({ many }) => ({
  doings: many(doings),
  assignments: many(assignments),
  shitty_points: many(shitty_points),
  history: many(history),
}));

export const doingsRelations = relations(doings, ({ one, many }) => ({
  user: one(users, {
    fields: [doings.id],
    references: [users.id],
  }),
  assignments: many(assignments),
  shitty_points: many(shitty_points),
  history: many(history),
}));

export const assignmentsRelations = relations(assignments, ({ one }) => ({
  doing: one(doings, {
    fields: [assignments.doing_id],
    references: [doings.id],
  }),
  user: one(users, {
    fields: [assignments.user_id],
    references: [users.id],
  }),
}));

export const shittyPointsRelations = relations(shitty_points, ({ one }) => ({
  doing: one(doings, {
    fields: [shitty_points.doing_id],
    references: [doings.id],
  }),
  user: one(users, {
    fields: [shitty_points.user_id],
    references: [users.id],
  }),
}));

export const historyRelations = relations(history, ({ one }) => ({
  doing: one(doings, {
    fields: [history.doing_id],
    references: [doings.id],
  }),
  user: one(users, {
    fields: [history.user_id],
    references: [users.id],
  }),
}));
