import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

export const apikeys = sqliteTable('apikeys', {
  id: integer({ mode: 'number' }).primaryKey({ autoIncrement: true }),
  key: text().unique().notNull(),
  created_at: integer({ mode: 'timestamp' }).notNull(),
});

export const cronjobs = sqliteTable('cronjobs', {
  id: integer({ mode: 'number' }).primaryKey({ autoIncrement: true }),
  name: text().unique().notNull(),
  cron_time: text().notNull(),
  action: text().notNull(),
  active: integer({ mode: 'boolean' }).notNull().default(true),
  created_at: integer({ mode: 'timestamp' }).notNull(),
  updated_at: integer({ mode: 'timestamp' }).notNull(),
});

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
  interval_unit: text({
    enum: ['once', 'weekly', 'monthly'],
  }).notNull(),
  interval_value: integer({ mode: 'number' }).notNull(),
  repeats_per_week: integer({ mode: 'number' }).notNull(),
  effort_in_minutes: integer({ mode: 'number' }).notNull(),
  static_user_id: integer({ mode: 'number' }).references(() => users.id),
  autoassignable_from: integer({ mode: 'timestamp' }),
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

export const history = sqliteTable('history', {
  id: integer({ mode: 'number' }).primaryKey({ autoIncrement: true }),
  doing_id: integer({ mode: 'number' })
    .notNull()
    .references(() => doings.id),
  user_id: integer({ mode: 'number' })
    .notNull()
    .references(() => users.id),
  interval_unit: text(),
  interval_value: integer({ mode: 'number' }),
  repeats_per_week: integer({ mode: 'number' }),
  effort_in_minutes: integer({ mode: 'number' }),
  status: text(),
  created_at: integer({ mode: 'timestamp' }),
  updated_at: integer({ mode: 'timestamp' }),
  history_date: integer({ mode: 'timestamp' }),
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
