import { Elysia, t } from 'elysia';
import { staticPlugin } from '@elysiajs/static';
import { swagger } from '@elysiajs/swagger';
import { cors } from '@elysiajs/cors';
import { Logestic } from 'logestic';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import {
  getDbConnection,
  getDbPath,
  removeDbConnectionFromCache,
} from './database/db';
import * as schema from './database/schema';
import { seedDatabase } from './database/seed';
import {
  sql,
  and,
  eq,
  asc,
  inArray,
  sum,
  count,
  isNull,
  gte,
  type SQL,
} from 'drizzle-orm';
import { AssignmentService } from './autoAssign';
import Timer from './timer';
import { readdir } from 'node:fs/promises';
import type { BunFile } from 'bun';

// initialize the cron timer handler
const timer = new Timer();

// seed the database
await seedDatabase();

let tlsConfig: { cert: BunFile; key: BunFile } | undefined = undefined;
if (process.env.LOCAL_TLS_CERT === 'true') {
  tlsConfig = {
    cert: Bun.file('./tls/cert.pem'),
    key: Bun.file('./tls/key.pem'),
  };
}

// Auth service
let JWKS: any = undefined;
if (process.env.AUTH0_DISABLED === 'true') {
  console.log('** Auth0 disabled, auth running in development mode **');
} else {
  const JWKS_URI = process.env.AUTH0_JWKS_URI || '';
  JWKS = createRemoteJWKSet(new URL(JWKS_URI));
}
// create elysia auth service to use in the elysia app
// use derive to add a scoped function to the Context for usage in route handlers
type AuthInfo = { id: string; group: string; name: string };
const AuthService = new Elysia({ name: 'Service.Auth' }).derive(
  { as: 'scoped' },
  async ({ headers }) => ({
    authenticatedUserInfo: async (): Promise<AuthInfo> => {
      if (process.env.AUTH0_DISABLED === 'true') {
        return { id: 'auth0|123456789', group: 'default', name: 'Testuser' };
      }

      const authHeader = headers?.['authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { id: '', group: '', name: '' };
      }
      const token = authHeader.split(' ')[1];
      const { payload } = await jwtVerify(token, JWKS, {
        issuer: process.env.AUTH0_ISSUER,
        audience: process.env.AUTH0_AUDIENCE,
      });

      // extract user id
      const id = payload.sub ?? '';

      // extract user name
      const name = headers?.['x-user-name'] || '';

      // extract group permission
      const group = Array.isArray(payload.permissions)
        ? payload.permissions
            .find((p: string) => p.startsWith('group:'))
            ?.split(':')[1] || ''
        : '';

      return { id, group, name };
    },
  }),
);

const app = new Elysia({
  serve: {
    tls: tlsConfig,
  },
})
  // Workaround from https://github.com/elysiajs/elysia/issues/771#issuecomment-2282254317
  // TODO: remove this once the issue is fixed
  .onParse(async ({ request, contentType }) => {
    try {
      if (contentType === 'application/json') {
        return await request.json();
      }
    } catch (error) {
      return request.text();
    }
  })
  .use(Logestic.preset('common')) // Log all requests
  .use(AuthService); // Add the auth service

app.group('/api', (apiGroup) =>
  apiGroup
    .guard({
      // use auth service to guard the route
      beforeHandle: async ({
        authenticatedUserInfo,
        error,
      }: {
        authenticatedUserInfo: () => Promise<AuthInfo>;
        error: (status: number) => void;
      }) => {
        const userInfo = await authenticatedUserInfo();
        if (!userInfo.id || !userInfo.group || !userInfo.name)
          return error(401);

        // check if user needs to be added to the db
        addUserToDbIfNotExists(userInfo);
      },
    })

    // get all users
    .get(
      '/users',
      async (ctx: any) => {
        const { group: auth0Group } =
          (await ctx.authenticatedUserInfo()) as AuthInfo;
        const db = getDbConnection(auth0Group);
        const users = await db.query.users.findMany({
          columns: {
            id: true,
            username: true,
            participation_percent: true,
          },
        });
        return { success: true, message: 'Users selected', data: users };
      },
      {
        response: t.Object({
          success: t.Boolean(),
          message: t.String(),
          data: t.Array(
            t.Object({
              id: t.Number(),
              username: t.String(),
              participation_percent: t.Number(),
            }),
          ),
        }),
      },
    )
    // update participation percent
    .put(
      '/users/participation/',
      async (ctx: any) => {
        const userArray = ctx.body;

        const { group: auth0Group } =
          (await ctx.authenticatedUserInfo()) as AuthInfo;
        const db = getDbConnection(auth0Group);

        // check userArray for valid participation_percent
        const sum = userArray.reduce(
          (acc: number, user: any) => acc + user.participation_percent,
          0,
        );
        if (sum !== 100) {
          return {
            success: false,
            message: 'Sum of participation_percent must be 100',
          };
        }

        // update participation_percent
        await db.transaction(async (db) => {
          for (const user of userArray) {
            await db
              .update(schema.users)
              .set({
                participation_percent: user.participation_percent,
                updated_at: new Date(),
              })
              .where(eq(schema.users.id, user.id));
          }
        });

        return { success: true, message: 'Participation percent updated' };
      },
      {
        body: t.Array(
          t.Object({
            id: t.Number(),
            participation_percent: t.Number(),
          }),
        ),
        response: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
      },
    )

    // Create a new doing
    .post(
      '/doings',
      async (ctx: any) => {
        const {
          name,
          description,
          notice,
          interval_unit,
          interval_value,
          repeats_per_week,
          effort_in_minutes,
          is_active,
        } = ctx.body;

        const { group: auth0Group } =
          (await ctx.authenticatedUserInfo()) as AuthInfo;
        const db = getDbConnection(auth0Group);

        await db.insert(schema.doings).values({
          name,
          description,
          notice,
          interval_unit: interval_unit as 'once' | 'weekly' | 'monthly',
          interval_value: interval_value || 1,
          repeats_per_week: repeats_per_week || 1,
          effort_in_minutes,
          is_active,
          created_at: new Date(),
          updated_at: new Date(),
        });
        return { success: true, message: 'Doing created' };
      },
      {
        body: t.Object({
          name: t.String({
            minLength: 1,
          }),
          description: t.Optional(t.String()),
          notice: t.Optional(t.String()),
          interval_unit: t.Union([
            t.Literal('once'),
            t.Literal('weekly'),
            t.Literal('monthly'),
          ]),
          interval_value: t.Optional(t.Number({ minimum: 1 })),
          repeats_per_week: t.Optional(t.Number({ minimum: 1, maximum: 7 })),
          effort_in_minutes: t.Number(),
          is_active: t.Boolean(),
        }),
        response: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
      },
    )
    // Get all doings or a doing by id
    .get(
      '/doings/:id?',
      async (ctx: any) => {
        const { id } = ctx.params;

        const { group: auth0Group } =
          (await ctx.authenticatedUserInfo()) as AuthInfo;
        const db = getDbConnection(auth0Group);

        if (id) {
          // Logic to get a doing by id
          const doing = await db.query.doings.findFirst({
            where: eq(schema.doings.id, Number(id)),
          });
          return { success: true, message: 'Doing selected', data: doing };
        } else {
          // Logic to get all doings
          const doings = await db.query.doings.findMany({
            where: isNull(schema.doings.deleted_at),
            orderBy: [asc(schema.doings.id)],
          });
          return { success: true, message: 'Doings selected', data: doings };
        }
      },
      {
        params: t.Object({
          id: t.Optional(t.Number()),
        }),
        response: t.Object({
          success: t.Boolean(),
          message: t.String(),
          data: t.Any(),
        }),
      },
    )
    // Update a doing by id
    .put(
      '/doings/:id',
      async (ctx: any) => {
        const { id } = ctx.params;
        const {
          name,
          description,
          notice,
          interval_unit,
          interval_value,
          repeats_per_week,
          effort_in_minutes,
          is_active,
        } = ctx.body;

        const { group: auth0Group } =
          (await ctx.authenticatedUserInfo()) as AuthInfo;
        const db = getDbConnection(auth0Group);

        await db
          .update(schema.doings)
          .set({
            name,
            description,
            notice,
            interval_unit: interval_unit as 'once' | 'weekly' | 'monthly',
            interval_value: interval_value || 1,
            repeats_per_week: repeats_per_week || 1,
            effort_in_minutes,
            is_active,
            updated_at: new Date(),
          })
          .where(eq(schema.doings.id, Number(id)));
        return { success: true, message: 'Doing updated' };
      },
      {
        params: t.Object({
          id: t.Number(),
        }),
        body: t.Object({
          name: t.String({
            minLength: 1,
          }),
          description: t.Optional(t.String()),
          notice: t.Optional(t.String()),
          interval_unit: t.Union([
            t.Literal('once'),
            t.Literal('weekly'),
            t.Literal('monthly'),
          ]),
          interval_value: t.Optional(t.Number({ minimum: 1 })),
          repeats_per_week: t.Optional(t.Number({ minimum: 1, maximum: 7 })),
          effort_in_minutes: t.Number(),
          is_active: t.Boolean(),
        }),
        response: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
      },
    )
    // Delete a doing by id
    .delete(
      '/doings/:id',
      async (ctx: any) => {
        const { id } = ctx.params;

        const { group: auth0Group } =
          (await ctx.authenticatedUserInfo()) as AuthInfo;
        const db = getDbConnection(auth0Group);

        // remove all assignments for this doing
        await db
          .delete(schema.assignments)
          .where(eq(schema.assignments.doing_id, Number(id)));

        // remove all shitty points for this doing
        await db
          .delete(schema.shitty_points)
          .where(eq(schema.shitty_points.doing_id, Number(id)));

        const currentDate = new Date();
        const doing = await db.query.doings.findFirst({
          where: eq(schema.doings.id, Number(id)),
          columns: { name: true },
        });

        if (doing) {
          const newName = `${doing.name}___deleted_${currentDate.getTime()}`;
          await db
            .update(schema.doings)
            .set({
              deleted_at: currentDate,
              name: newName,
              is_active: false,
              updated_at: currentDate,
            })
            .where(eq(schema.doings.id, Number(id)));
        }
        return { success: true, message: 'Doing deleted' };
      },
      {
        params: t.Object({
          id: t.Number(),
        }),
        response: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
      },
    )

    // Assign doing to user
    .post(
      '/doings/assign',
      async (ctx: any) => {
        const { doing_id, user_id } = ctx.body;

        const { group: auth0Group } =
          (await ctx.authenticatedUserInfo()) as AuthInfo;
        const db = getDbConnection(auth0Group);

        const assignmentExists = await db.query.assignments.findFirst({
          where: eq(schema.assignments.doing_id, doing_id),
        });

        if (assignmentExists) {
          return {
            success: false,
            message: 'Assignment already exists for this doing',
          };
        }

        const doing = await db.query.doings.findFirst({
          where: eq(schema.doings.id, doing_id),
        });

        if (!doing) {
          return { success: false, message: 'Doing not found' };
        }

        const now = new Date();

        // if repeats_per_week is greater than 1, create multiple assignments
        const assignments = Array.from(
          { length: doing.repeats_per_week },
          (_, i) => ({
            doing_id,
            user_id,
            status: i === 0 ? ('pending' as const) : ('waiting' as const),
            created_at: now,
            updated_at: now,
          }),
        );

        console.log(assignments);

        await db.insert(schema.assignments).values(assignments);

        return { success: true, message: 'Assignment created' };
      },
      {
        body: t.Object({
          doing_id: t.Number(),
          user_id: t.Number(),
        }),
        response: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
      },
    )

    // Trigger Autoassign
    .post(
      '/doings/autoassign',
      async (ctx: any) => {
        const { reassign } = ctx.body;
        const { group: auth0Group } =
          (await ctx.authenticatedUserInfo()) as AuthInfo;
        try {
          await new AssignmentService(auth0Group).assignTasksForWeek({
            dryRun: false,
            clearAndReassign: reassign,
            groupByRepetition:
              process.env.ENABLE_REPETITION_GROUPING === 'true',
          });
        } catch (error) {
          console.log(error);
          return {
            success: false,
            message: `Failed during autoassign,
          ${error}`,
          };
        }
        return { success: true, message: 'Autoassign successful' };
      },
      {
        body: t.Object({
          reassign: t.Optional(t.Boolean()),
        }),
        response: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
      },
    )
    // get autoassign cron info
    .get(
      '/doings/autoassign/cron',
      async (ctx: any) => {
        const { group: auth0Group } =
          (await ctx.authenticatedUserInfo()) as AuthInfo;
        const db = getDbConnection(auth0Group);

        const activeAutoAssignCron = await db.query.cronjobs.findFirst({
          where: and(
            eq(schema.cronjobs.name, 'autoassign'),
            eq(schema.cronjobs.active, true),
          ),
        });

        if (!activeAutoAssignCron) {
          return {
            success: true,
            message: 'No autoassign cron job found',
            data: {},
          };
        }

        return {
          success: true,
          message: 'Autoassign cron info',
          data: timer.getJobInfo(`autoassign_${auth0Group}`),
        };
      },
      {
        response: t.Object({
          success: t.Boolean(),
          message: t.String(),
          data: t.Any(),
        }),
      },
    )
    // enable or disable autoassign cron job
    .put(
      '/doings/autoassign/cron',
      async (ctx: any) => {
        const { enable, cronTime = '0 23 * * 0' } = ctx.body;

        const { group: auth0Group } =
          (await ctx.authenticatedUserInfo()) as AuthInfo;
        const db = getDbConnection(auth0Group);

        if (enable) {
          // check if job already exists in db
          const jobExistsInDb = await db.query.cronjobs.findFirst({
            where: and(eq(schema.cronjobs.name, 'autoassign')),
          });

          if (jobExistsInDb) {
            // update existing job
            await db
              .update(schema.cronjobs)
              .set({
                cron_time: cronTime,
                active: true,
                updated_at: new Date(),
              })
              .where(eq(schema.cronjobs.name, 'autoassign'));
          } else {
            // insert new job
            await db.insert(schema.cronjobs).values({
              name: 'autoassign',
              cron_time: cronTime,
              action: 'autoassign',
              active: true,
              created_at: new Date(),
              updated_at: new Date(),
            });
          }

          // add job to timer (or replace existing job)
          timer.addJob(
            `autoassign_${auth0Group}`,
            cronTime,
            async () => {
              await new AssignmentService(auth0Group).assignTasksForWeek({
                dryRun: false,
                groupByRepetition:
                  process.env.ENABLE_REPETITION_GROUPING === 'true',
              });
            },
            { autoStart: true },
          );
        } else {
          // deactivate job in db
          await db
            .update(schema.cronjobs)
            .set({
              active: false,
              updated_at: new Date(),
            })
            .where(eq(schema.cronjobs.name, 'autoassign'));

          // pause job in timer
          timer.pauseJob(`autoassign_${auth0Group}`);
        }

        return {
          success: true,
          message: `Autoassign cron job ${enable ? 'enabled' : 'disabled'}`,
        };
      },
      {
        body: t.Object({
          enable: t.Boolean(),
          cronTime: t.Optional(t.String()),
        }),
        response: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
      },
    )

    // Update assignment status or user
    .put(
      '/assignments/:id',
      async (ctx: any) => {
        const { id } = ctx.params;
        const { assignedUserId, status } = ctx.body;

        const { group: auth0Group } =
          (await ctx.authenticatedUserInfo()) as AuthInfo;
        const db = getDbConnection(auth0Group);

        const updateData: {
          status:
            | 'waiting'
            | 'pending'
            | 'completed'
            | 'skipped'
            | 'postponed'
            | 'failed';
          updated_at: Date;
          user_id?: number;
        } = {
          status: status,
          updated_at: new Date(),
        };

        if (assignedUserId !== undefined) {
          updateData.user_id = assignedUserId;
        }

        // enforce status restrictions for certain interval_units
        const intervalInfo = await db
          .select({
            interval_unit: schema.doings.interval_unit,
            repeats_per_week: schema.doings.repeats_per_week,
          })
          .from(schema.doings)
          .innerJoin(
            schema.assignments,
            eq(schema.doings.id, schema.assignments.doing_id),
          )
          .where(eq(schema.assignments.id, Number(id)))
          .then((res) => res[0]);

        const availableStatusOptions = getStatusOptions(
          intervalInfo.interval_unit,
          intervalInfo.repeats_per_week,
        );
        if (!availableStatusOptions.includes(updateData.status)) {
          return {
            success: false,
            message:
              'Invalid status for the given interval unit and repeats per week',
          };
        }
        const currentDoingId = await db
          .update(schema.assignments)
          .set(updateData)
          .where(eq(schema.assignments.id, Number(id)))
          .returning({ doing_id: schema.assignments.doing_id });

        if (currentDoingId.length === 0) {
          return { success: false, message: 'Assignment not found' };
        }

        // auto handling of repeated assignment states for same doing
        await autoHandleRepeatedAssignments(
          db,
          currentDoingId[0].doing_id,
          updateData.status,
        );

        return { success: true, message: 'Assignment updated' };
      },
      {
        params: t.Object({
          id: t.Number(),
        }),
        body: t.Object({
          assignedUserId: t.Optional(t.Number()),
          status: t.Union([
            t.Literal('waiting'),
            t.Literal('pending'),
            t.Literal('completed'),
            t.Literal('skipped'),
            t.Literal('postponed'),
            t.Literal('failed'),
          ]),
        }),
        response: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
      },
    )
    // delete assignment
    .delete(
      '/assignments/:id',
      async (ctx: any) => {
        const { id } = ctx.params;

        const { group: auth0Group } =
          (await ctx.authenticatedUserInfo()) as AuthInfo;
        const db = getDbConnection(auth0Group);

        // check if assignment exists
        const assignmentExists = await db.query.assignments.findFirst({
          where: eq(schema.assignments.id, Number(id)),
        });

        if (!assignmentExists) {
          return { success: false, message: 'Assignment not found' };
        }

        await db
          .delete(schema.assignments)
          .where(eq(schema.assignments.id, Number(id)));

        return { success: true, message: 'Assignment deleted' };
      },
      {
        params: t.Object({
          id: t.Number(),
        }),
        response: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
      },
    )

    // Get todos (= assigned doings) to the current user
    .get(
      '/todos',
      async (ctx: any) => {
        const { allUsers, status } = ctx.query;

        const { id: auth0UserId, group: auth0Group } =
          (await ctx.authenticatedUserInfo()) as AuthInfo;
        const db = getDbConnection(auth0Group);

        // Optional filter by user
        let userFilter: SQL;
        if (allUsers === 'true') {
          userFilter = sql`1 = 1`;
        } else {
          userFilter = eq(schema.users.auth0_id, auth0UserId);
        }

        // Optional filter by status (comma separated list)
        let statusFilter: SQL;
        if (status) {
          const statusArray = status.split(',').map((s: string) => s.trim());
          if (
            statusArray.some(
              (s: string) =>
                ![
                  'waiting',
                  'pending',
                  'completed',
                  'skipped',
                  'postponed',
                  'failed',
                ].includes(s),
            )
          ) {
            return { success: false, message: 'Invalid status', data: [] };
          }
          statusFilter = inArray(
            schema.assignments.status,
            statusArray as (
              | 'waiting'
              | 'pending'
              | 'completed'
              | 'skipped'
              | 'postponed'
              | 'failed'
            )[],
          );
        } else {
          statusFilter = sql`1 = 1`;
        }

        const assignmentsQuery = db
          .select({
            assignmentId: schema.assignments.id,
            status: schema.assignments.status,
            doingId: schema.doings.id,
            doingName: schema.doings.name,
            doingDescription: schema.doings.description,
            doingEffort: schema.doings.effort_in_minutes,
            doingIntervalUnit: schema.doings.interval_unit,
            doingIntervalValue: schema.doings.interval_value,
            doingRepeatsPerWeek: schema.doings.repeats_per_week,
            userId: schema.users.id,
            username: schema.users.username,
          })
          .from(schema.assignments)
          .innerJoin(
            schema.doings,
            eq(schema.assignments.doing_id, schema.doings.id),
          )
          .innerJoin(
            schema.users,
            eq(schema.assignments.user_id, schema.users.id),
          )
          .where(and(userFilter, statusFilter));

        const assignments = await assignmentsQuery;

        // Fetch all assignments for the same doing regardless of the filter
        const allAssignmentsQuery = db
          .select({
            assignmentId: schema.assignments.id,
            doingId: schema.assignments.doing_id,
          })
          .from(schema.assignments);

        const allAssignments = await allAssignmentsQuery;

        // Add calcCounterCurrent and calcCounterTotal fields to the assignments
        const assignmentsWithCounters = assignments.map((assignment) => {
          const sameDoingAssignments = allAssignments.filter(
            (a) => a.doingId === assignment.doingId,
          );
          if (sameDoingAssignments.length > 0) {
            const calcCounterTotal = sameDoingAssignments.length;
            const calcCounterCurrent =
              sameDoingAssignments.findIndex(
                (a) => a.assignmentId === assignment.assignmentId,
              ) + 1;

            return {
              ...assignment,
              calcCounterCurrent,
              calcCounterTotal,
            };
          }
          return assignment;
        });

        return {
          success: true,
          message: 'Assignments selected',
          data: assignmentsWithCounters,
        };
      },
      {
        query: t.Object({
          allUsers: t.Optional(t.String()),
          status: t.Optional(t.String()),
        }),
        response: t.Object({
          success: t.Boolean(),
          message: t.String(),
          data: t.Array(t.Any()),
        }),
      },
    )

    // Create shitty points
    .post(
      '/shittypoints',
      async (ctx: any) => {
        const { doing_id, points } = ctx.body;

        const { id: auth0UserId, group: auth0Group } =
          (await ctx.authenticatedUserInfo()) as AuthInfo;
        const db = getDbConnection(auth0Group);

        const user_id = await getUserIdFromAuth0UserId(auth0UserId, db);
        if (!user_id) {
          return { success: false, message: 'User not found' };
        }

        // Check if an entry already exists for the user and doing
        const existingEntry = await db.query.shitty_points.findFirst({
          where: and(
            eq(schema.shitty_points.user_id, user_id),
            eq(schema.shitty_points.doing_id, doing_id),
          ),
        });

        if (existingEntry) {
          return {
            success: false,
            message: 'Shitty points already exists for this user and doing',
          };
        }

        if (await maxShittyPointsExceeded(db, 0, points, user_id)) {
          return { success: false, message: 'Max shitty points reached' };
        }

        let idObject;

        try {
          idObject = await db
            .insert(schema.shitty_points)
            .values({
              doing_id,
              user_id,
              points,
              created_at: new Date(),
              updated_at: new Date(),
            })
            .returning({ insertedId: schema.shitty_points.id });
        } catch (error) {
          console.log(error);
          return {
            success: false,
            message: `Failed to create shitty points, ${error}`,
          };
        }
        return {
          success: true,
          message: 'Shitty points created',
          data: idObject[0].insertedId,
        };
      },
      {
        body: t.Object({
          doing_id: t.Number(),
          points: t.Number({ minimum: 0 }),
        }),
        response: t.Object({
          success: t.Boolean(),
          message: t.String(),
          data: t.Optional(t.Union([t.Number(), t.String()])),
        }),
      },
    )
    // Get shitty points
    .get(
      '/shittypoints',
      async (ctx: any) => {
        const { id: auth0UserId, group: auth0Group } =
          (await ctx.authenticatedUserInfo()) as AuthInfo;
        const db = getDbConnection(auth0Group);

        const user_id = await getUserIdFromAuth0UserId(auth0UserId, db);
        if (!user_id) {
          return { success: false, message: 'User not found' };
        }

        const result = await db
          .select({
            id: schema.doings.id,
            name: schema.doings.name,
            points: schema.shitty_points.points,
            shitty_points_id: schema.shitty_points.id,
          })
          .from(schema.doings)
          .where(isNull(schema.doings.deleted_at))
          .leftJoin(
            schema.shitty_points,
            and(
              eq(schema.shitty_points.doing_id, schema.doings.id),
              eq(schema.shitty_points.user_id, user_id),
            ),
          )
          .orderBy(asc(schema.doings.id));

        const formattedResult = result.map((row) => ({
          id: row.shitty_points_id,
          doing_id: row.id,
          name: row.name,
          points: row.points || 0,
        }));

        return {
          success: true,
          message: 'Shitty points selected',
          data: formattedResult,
        };
      },
      {
        response: t.Object({
          success: t.Boolean(),
          message: t.String(),
          data: t.Optional(
            t.Array(
              t.Object({
                id: t.Union([t.Number(), t.Null()]),
                doing_id: t.Number(),
                name: t.String(),
                points: t.Number(),
              }),
            ),
          ),
        }),
      },
    )
    // Get available shitty points for a user
    .get(
      '/shittypoints/available',
      async (ctx: any) => {
        const { id: auth0UserId, group: auth0Group } =
          (await ctx.authenticatedUserInfo()) as AuthInfo;
        const db = getDbConnection(auth0Group);

        const user_id = await getUserIdFromAuth0UserId(auth0UserId, db);
        if (!user_id) {
          return { success: false, message: 'User not found' };
        }

        const totalNumberOfDoingsArray = await db
          .select({
            totalDoings: count(),
          })
          .from(schema.doings)
          .where(isNull(schema.doings.deleted_at));

        const totalNumberOfDoings =
          totalNumberOfDoingsArray[0].totalDoings ?? 0;

        const totalPointsArray = await db
          .select({
            totalPoints: sum(schema.shitty_points.points),
          })
          .from(schema.shitty_points)
          .where(eq(schema.shitty_points.user_id, user_id));

        const totalPoints = Number(totalPointsArray[0].totalPoints ?? 0);
        const availablePoints = totalNumberOfDoings - totalPoints;

        return {
          success: true,
          message: 'Available shitty points selected',
          data: availablePoints,
        };
      },
      {
        response: t.Object({
          success: t.Boolean(),
          message: t.String(),
          data: t.Number(),
        }),
      },
    )
    // Update shitty points
    .put(
      '/shittypoints/:id',
      async (ctx: any) => {
        const { id } = ctx.params;
        const { points } = ctx.body;

        const { id: auth0UserId, group: auth0Group } =
          (await ctx.authenticatedUserInfo()) as AuthInfo;
        const db = getDbConnection(auth0Group);

        const user_id = await getUserIdFromAuth0UserId(auth0UserId, db);
        if (!user_id) {
          return { success: false, message: 'User not found' };
        }

        const currentPoints = await db.query.shitty_points.findFirst({
          where: and(
            eq(schema.shitty_points.id, Number(id)),
            eq(schema.shitty_points.user_id, user_id),
          ),
          columns: { points: true },
        });

        if (!currentPoints) {
          return { success: false, message: 'Shitty points not found' };
        }

        if (
          await maxShittyPointsExceeded(
            db,
            currentPoints.points,
            points,
            user_id,
          )
        ) {
          return { success: false, message: 'Max shitty points reached' };
        }

        const updatedRows = await db
          .update(schema.shitty_points)
          .set({
            points,
            updated_at: new Date(),
          })
          .where(
            and(
              eq(schema.shitty_points.id, Number(id)),
              eq(schema.shitty_points.user_id, user_id),
            ),
          )
          .returning({
            id: schema.shitty_points.id,
          });

        if (updatedRows.length > 0) {
          return { success: true, message: 'Shitty points updated' };
        } else {
          return { success: false, message: 'Nothing to update' };
        }
      },
      {
        params: t.Object({
          id: t.Number(),
        }),
        body: t.Object({
          points: t.Number({ minimum: 0 }),
        }),
        response: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
      },
    )

    // Get count of completed doings per user and calendar week for the last 6 weeks
    .get(
      '/statistics/completed',
      async (ctx: any) => {
        const { weeksToShow = 6, dataColumn = 'assignments' } = ctx.query;

        const { group: auth0Group } =
          (await ctx.authenticatedUserInfo()) as AuthInfo;
        const db = getDbConnection(auth0Group);

        try {
          const xWeeksAgo = new Date();
          xWeeksAgo.setDate(xWeeksAgo.getDate() - weeksToShow * 7); // x weeks * 7 days

          // Helper functions to get the correct data for the y-axis of the current assignments
          const getYAxisAssignments = (
            dataColumn: 'effort_in_minutes' | 'assignments',
          ) => {
            return dataColumn === 'effort_in_minutes'
              ? sql`sum(${schema.doings.effort_in_minutes})`.as('data')
              : sql`count(${schema.assignments.id})`.as('data');
          };

          // Helper functions to get the correct data for the y-axis of the history assignments
          const getYAxisHistory = (
            dataColumn: 'effort_in_minutes' | 'assignments',
          ) => {
            return dataColumn === 'effort_in_minutes'
              ? sql`sum(${schema.history.effort_in_minutes})`.as('data')
              : sql`count(${schema.history.id})`.as('data');
          };

          const completedAssignments = await db
            .select({
              username: schema.users.username,
              week: sql`strftime('%W', datetime(${schema.assignments.updated_at}, 'unixepoch'))`.as(
                'week',
              ),
              data: getYAxisAssignments(dataColumn),
            })
            .from(schema.assignments)
            .innerJoin(
              schema.users,
              eq(schema.assignments.user_id, schema.users.id),
            )
            .leftJoin(
              schema.doings,
              eq(schema.assignments.doing_id, schema.doings.id),
            )
            .where(eq(schema.assignments.status, 'completed'))
            .groupBy(
              schema.users.username,
              sql`strftime('%W', datetime(${schema.assignments.updated_at}, 'unixepoch'))`,
            )
            .union(
              db
                .select({
                  username: schema.users.username,
                  week: sql`strftime('%W', datetime(${schema.history.updated_at}, 'unixepoch'))`.as(
                    'week',
                  ),
                  data: getYAxisHistory(dataColumn),
                })
                .from(schema.history)
                .innerJoin(
                  schema.users,
                  eq(schema.history.user_id, schema.users.id),
                )
                .where(
                  and(
                    eq(schema.history.status, 'completed'),
                    gte(schema.history.created_at, xWeeksAgo),
                  ),
                )
                .groupBy(
                  schema.users.username,
                  sql`strftime('%W', datetime(${schema.history.updated_at}, 'unixepoch'))`,
                ),
            )
            .orderBy(schema.users.username);

          /**
           * Aggregate the data points for the chart
           * @param assignments - array of assignment data from the database
           * @returns - array of data points with label and data per user
           */
          function aggregateDataset(assignments: any[]) {
            const dataPointsObject = assignments.reduce<
              Record<string, { label: string; data: number[] }>
            >((acc, { username, week, data }) => {
              if (!acc[username]) {
                acc[username] = {
                  label: username,
                  data: Array(weeksToShow).fill(0),
                };
              }
              const weekIndex = parseInt(week as string) % weeksToShow; // spread over weeksToShow data points
              acc[username].data[weekIndex] = data as number;
              return acc;
            }, {});
            return Object.values(dataPointsObject);
          }

          /**
           * Aggregate the labels for the charts x-axis
           * @param assignments - array of assignment data from the database
           * @returns - array of labels for the charts x-axis
           */
          function aggregateLables(assignments: any[]) {
            return assignments.reduce<string[]>((acc, { week }) => {
              const weekIndex = parseInt(week as string) % weeksToShow; // spread over weeksToShow data points
              acc[weekIndex] = `KW ${week}`;
              return acc;
            }, Array(weeksToShow).fill('')); // fill with empty strings to ensure weeksToShow labels even if some weeks are missing
          }

          return {
            success: true,
            message: `Completed doings per user and calendar week for the last ${weeksToShow} weeks`,
            data: {
              labels: aggregateLables(completedAssignments),
              datasets: aggregateDataset(completedAssignments),
            },
          };
        } catch (error) {
          console.error(error);
          return {
            success: false,
            message: `Failed to get statistics, ${error}`,
            data: {},
          };
        }
      },
      {
        query: t.Object({
          weeksToShow: t.Optional(t.Number({ minimum: 1, maximum: 52 })),
          dataColumn: t.Optional(
            t.Union([t.Literal('effort_in_minutes'), t.Literal('assignments')]),
          ),
        }),
        response: t.Object({
          success: t.Boolean(),
          message: t.String(),
          data: t.Object({
            labels: t.Array(t.String()),
            datasets: t.Array(
              t.Object({
                label: t.String(),
                data: t.Array(t.Number()),
              }),
            ),
          }),
        }),
      },
    )
    // Download the database
    .get(
      '/database/download',
      async (ctx: any) => {
        const { group: auth0Group } =
          (await ctx.authenticatedUserInfo()) as AuthInfo;

        const dbPath = getDbPath(auth0Group);
        if (!dbPath) {
          return {
            success: false,
            message: 'Database path not set',
          };
        }
        const dbAsArrayBuffer = await Bun.file('./' + dbPath).arrayBuffer();
        const dbAsBase64 = Buffer.from(dbAsArrayBuffer).toString('base64');
        return {
          success: true,
          message: 'Database downloaded',
          data: dbAsBase64,
        };
      },
      {
        response: t.Object({
          success: t.Boolean(),
          message: t.String(),
          data: t.Optional(t.String()),
        }),
      },
    )
    // Upload the database
    .put(
      '/database/upload',
      async (ctx: any) => {
        const { group: auth0Group } =
          (await ctx.authenticatedUserInfo()) as AuthInfo;

        const dbPath = getDbPath(auth0Group);
        if (!dbPath) {
          return {
            success: false,
            message: 'Database path not set',
          };
        }
        const dbAsBase64 = ctx.body;
        const dbAsArrayBuffer = Buffer.from(dbAsBase64, 'base64').buffer;
        await Bun.write(dbPath, dbAsArrayBuffer);
        removeDbConnectionFromCache(auth0Group);
        return {
          success: true,
          message: 'Database uploaded',
        };
      },
      {
        body: t.String(),
        response: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
      },
    )

    // create or roll API key
    .get(
      '/apikey',
      async (ctx: any) => {
        const { group: auth0Group } =
          (await ctx.authenticatedUserInfo()) as AuthInfo;
        const db = getDbConnection(auth0Group);

        const apiKey = `${auth0Group}__${crypto.randomUUID()}`;
        // delete old api keys
        await db.delete(schema.apikeys);
        await db.insert(schema.apikeys).values({
          key: apiKey,
          created_at: new Date(),
        });
        return { success: true, message: 'API key created', data: apiKey };
      },
      {
        response: t.Object({
          success: t.Boolean(),
          message: t.String(),
          data: t.String(),
        }),
      },
    ),
);

app.group('/siri', (siriGroup) =>
  siriGroup.get(
    '/todos',
    async (ctx: any) => {
      const apiKey = ctx.headers['x-api-key'];

      try {
        const { userName } = ctx.query;

        const db = getDbConnection(
          await getAndValidateDbGroupFromApiKey(apiKey),
        );

        // Optional filter by userName
        let userNameFilter: SQL;
        if (userName) {
          userNameFilter = eq(schema.users.username, userName);
        } else {
          userNameFilter = sql`1 = 1`;
        }

        const assignmentsQuery = db
          .select({
            doingName: schema.doings.name,
            //username: schema.users.username,
          })
          .from(schema.assignments)
          .innerJoin(
            schema.doings,
            eq(schema.assignments.doing_id, schema.doings.id),
          )
          .innerJoin(
            schema.users,
            eq(schema.assignments.user_id, schema.users.id),
          )
          .where(and(userNameFilter, eq(schema.assignments.status, 'pending')));

        const assignments = await assignmentsQuery;

        if (assignments.length === 0) {
          if (userName) {
            return `Hallo ${userName}. Du hast alles erledigt. Gute Arbeit!`;
          }
          return 'Es sind keine Aufgaben mehr offen. Gute Arbeit!';
        }

        if (userName) {
          return `Hallo ${userName}. Du hast diese Woche noch ${assignments.length} offene Aufgaben. ${assignments.map((assignment) => assignment.doingName).join(', ')}.`;
        }
        return `Diese Woche sind noch ${assignments.length} Aufgaben offen. ${assignments.map((assignment) => assignment.doingName).join(', ')}.`;
      } catch (error) {
        console.error(error);
        return 'Leider ist ein Fehler beim Abrufen der Aufgaben aufgetreten.';
      }
    },
    {
      headers: t.Object({
        'x-api-key': t.String(),
      }),
      query: t.Object({
        userName: t.Optional(t.String()),
      }),
      response: t.String(),
    },
  ),
);

// serve frontend
if (process.env.NODE_ENV === 'development') {
  app
    .use(
      cors({
        origin: [/^http:\/\/localhost:\d+$/, /^https:\/\/localhost:\d+$/],
      }),
    ) // DEV: enable CORS for the frontend
    .use(
      swagger({
        provider: 'scalar',
        scalarVersion: '1.25.72',
        path: 'api-docs',
        exclude: ['/'],
      }),
    ); // DEV: add swagger ui

  // DEV: redirect root to swagger ui
  app.get('/', ({ redirect }: { redirect: (url: string) => void }) => {
    return redirect('/api-docs');
  });
} else {
  // PROD: serve the frontend statically from the dist folder
  app
    .use(
      staticPlugin({
        assets: 'frontend/dist',
        prefix: '',
        alwaysStatic: true,
      }),
    )
    .get('/*', () => {
      return Bun.file('./frontend/dist/index.html');
    });
}

// helper function to get user from context auth0 id
const getUserIdFromAuth0UserId = async (auth0UserId: string, db: any) => {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.auth0_id, auth0UserId),
    columns: { id: true },
  });
  return user?.id;
};

// helper function to check if max shitty points is reached
const maxShittyPoints = Number(process.env.MAX_SHITTY_POINTS_PER_DOING || 3);
const maxShittyPointsExceeded = async (
  db: any,
  currentPoints: number,
  targetPoints: number,
  user_id: number,
) => {
  if (targetPoints > maxShittyPoints) {
    return true;
  }

  const totalNumberOfDoingsArray = await db
    .select({
      totalDoings: count(),
    })
    .from(schema.doings)
    .where(isNull(schema.doings.deleted_at));

  const totalNumberOfDoings = totalNumberOfDoingsArray[0].totalDoings ?? 0;

  const totalPointsArray = await db
    .select({
      totalPoints: sum(schema.shitty_points.points),
    })
    .from(schema.shitty_points)
    .where(eq(schema.shitty_points.user_id, user_id));

  const totalPoints = Number(totalPointsArray[0].totalPoints ?? 0);
  return totalPoints + targetPoints - currentPoints > totalNumberOfDoings;
};

// helper function to auto handle status of next repeated assignment
const autoHandleRepeatedAssignments = async (
  db: any,
  parentDoingId: number,
  parentStatus: string,
) => {
  try {
    if (['completed', 'skipped', 'postponed'].includes(parentStatus)) {
      // check if there is a pending assignment for the current doing
      const pendingAssignment = await db
        .select({
          id: schema.assignments.id,
        })
        .from(schema.assignments)
        .where(
          and(
            eq(schema.assignments.doing_id, parentDoingId),
            eq(schema.assignments.status, 'pending'),
          ),
        )
        .limit(1);

      // If there is a pending assignment, do not change the status of the next waiting assignment
      if (pendingAssignment.length > 0) {
        return;
      }

      // get the next waiting assignment for the current doing
      const nextWaitingAssignment = await db
        .select({
          id: schema.assignments.id,
        })
        .from(schema.assignments)
        .where(
          and(
            eq(schema.assignments.doing_id, parentDoingId),
            eq(schema.assignments.status, 'waiting'),
          ),
        )
        .orderBy(asc(schema.assignments.id))
        .limit(1);

      // If there is no next waiting assignment, do nothing
      if (nextWaitingAssignment.length === 0) {
        return;
      }

      // Set the status of the next waiting assignment to pending
      await db
        .update(schema.assignments)
        .set({
          status: 'pending',
          updated_at: new Date(),
        })
        .where(eq(schema.assignments.id, nextWaitingAssignment[0].id));
    } else if (parentStatus === 'pending') {
      // Get all pending assignments for the current doing
      const pendingAssignments = await db
        .select({
          id: schema.assignments.id,
        })
        .from(schema.assignments)
        .where(
          and(
            eq(schema.assignments.doing_id, parentDoingId),
            eq(schema.assignments.status, 'pending'),
          ),
        )
        .orderBy(asc(schema.assignments.id));

      // If there are no pending assignments, do nothing
      if (pendingAssignments.length === 0) {
        return;
      }

      // Set the status of every pending assignment except the first one to waiting
      await db
        .update(schema.assignments)
        .set({
          status: 'waiting',
          updated_at: new Date(),
        })
        .where(
          inArray(
            schema.assignments.id,
            pendingAssignments.slice(1).map((a: any) => a.id), // Skip the first pending assignment
          ),
        );
    }
  } catch (error) {
    console.log(
      'Error during auto handling of repeated assignments states for same doing. Skipping this step.',
      error,
    );
  }
};

// start active cron jobs on server start
const startActiveCronJobs = async () => {
  // get all db groups from parsing the db file names in the db folder
  const dbFiles = await readdir(process.env.SQLITE_PATH ?? './databases');
  console.log('Found db files:', dbFiles);

  // parse group from db file name
  // e.g. "database-default.sqlite", "database-beto.sqlite"
  const dbGroups = dbFiles.map((file) => file.split('-')[1].split('.')[0]);
  console.log('Found db groups:', dbGroups);

  // get all active cron jobs from the db groups
  for (const group of dbGroups) {
    const db = getDbConnection(group);
    const activeCronJobs = await db.query.cronjobs.findFirst({
      where: and(eq(schema.cronjobs.active, true)),
    });

    if (activeCronJobs) {
      // add job to timer
      timer.addJob(
        `autoassign_${group}`,
        activeCronJobs.cron_time,
        async () => {
          await new AssignmentService(group).assignTasksForWeek({
            dryRun: false,
            groupByRepetition:
              process.env.ENABLE_REPETITION_GROUPING === 'true',
          });
        },
        { autoStart: true },
      );
      console.log(`Autoassign cron job enabled for group ${group}`);
    }
  }
};

// Start the server
app.listen(process.env.PORT || 3000);
console.log(
  `\x1b[32m➜ \x1b[36mToDuo Backend running at \x1b[1mhttp://${app.server?.hostname}:${app.server?.port}\x1b[0m`,
);

await startActiveCronJobs();

// helper function to add the user to the db if not already present
const addUserToDbIfNotExists = async (userInfo: AuthInfo) => {
  // get db connection
  const db = getDbConnection(userInfo.group);

  // check if user already exists
  const userExists = await db.query.users.findFirst({
    where: eq(schema.users.auth0_id, userInfo.id),
  });
  if (userExists) {
    return;
  }

  // check sum of all participation_percent
  const users = await db.query.users.findMany({
    columns: { participation_percent: true },
  });
  const sum = users.reduce(
    (acc: any, user: any) => acc + user.participation_percent,
    0,
  );
  const newParticipationPercent = 100 - sum;

  try {
    await db.insert(schema.users).values({
      username: userInfo.name,
      auth0_id: userInfo.id,
      participation_percent: newParticipationPercent,
      created_at: new Date(),
      updated_at: new Date(),
    });
  } catch (error) {
    console.log(error);
    return {
      success: false,
      message: `Failed to create user, ${error}`,
    };
  }
};

// helper function to get the db group from the api key
const getAndValidateDbGroupFromApiKey = async (apiKey: string) => {
  if (!apiKey) {
    throw new Error('Invalid API key');
  }

  // parse group from api key (e.g. 'group__api_key')
  const group = apiKey.split('__')[0];

  if (!group) {
    throw new Error('Invalid API key');
  }

  const db = getDbConnection(group, false);
  const apiKeyExists = await db
    .select({ key: schema.apikeys.key })
    .from(schema.apikeys)
    .where(eq(schema.apikeys.key, apiKey));

  if (apiKeyExists.length === 0) {
    throw new Error('Invalid API key');
  }

  return group;
};

// helper function to get the available status options based on the interval unit and repeats per week
// TODO: this is also used in client, move to shared module
const STATUS_OPTIONS = [
  'waiting',
  'pending',
  'completed',
  'skipped',
  'postponed',
]; //TODO: move to type model
const getStatusOptions = (interval_unit: string, repeats_per_week: number) => {
  let options = [...STATUS_OPTIONS];

  // for weekly todos, we don't want to show postponed status
  // as it doesn't make sense because the todo will be reassigned the next day/week anyway
  if (interval_unit === 'weekly') {
    options = options.filter((option) => option !== 'postponed');
  }

  // for once todos, we don't want to show skipped status
  if (interval_unit === 'once') {
    options = options.filter((option) => option !== 'skipped');
  }

  // only for repeated todos is waiting status allowed
  if (repeats_per_week <= 1) {
    options = options.filter((option) => option !== 'waiting');
  }
  return options;
};
