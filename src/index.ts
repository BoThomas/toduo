import { Elysia, t } from 'elysia';
import { staticPlugin } from '@elysiajs/static';
import { swagger } from '@elysiajs/swagger';
import { cors } from '@elysiajs/cors';
import { Logestic } from 'logestic';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { db } from './database/db';
import * as schema from './database/schema';
import { seedDatabase } from './database/seed';
import {
  sql,
  and,
  or,
  eq,
  gt,
  lt,
  asc,
  inArray,
  sum,
  count,
  type SQL,
  is,
  isNull,
} from 'drizzle-orm';
import { AssignmentService } from './autoAssign';
import { getCalendarWeekFromDateOfCurrentYear } from './helper';
import Timer from './timer';
import type { BunFile } from 'bun';

const AUTO_ASSIGN_CRON_NAME = 'autoAssignCron';

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
const AuthService = new Elysia({ name: 'Service.Auth' }).derive(
  { as: 'scoped' },
  async ({ headers }) => ({
    authenticatedUserId: async () => {
      if (process.env.AUTH0_DISABLED === 'true') {
        return 'auth0|123456789';
      }

      const authHeader = headers?.['authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return '';
      }
      const token = authHeader.split(' ')[1];
      const { payload } = await jwtVerify(token, JWKS, {
        issuer: process.env.AUTH0_ISSUER,
        audience: process.env.AUTH0_AUDIENCE,
      });
      return payload.sub;
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

const INVITATION_CODE = process.env.USER_INVITATION_CODE || crypto.randomUUID();

app.group('/api', (apiGroup) =>
  apiGroup
    .guard({
      // use auth service to guard the route
      beforeHandle: async ({
        authenticatedUserId,
        error,
      }: {
        authenticatedUserId: () => Promise<string>;
        error: (status: number) => void;
      }) => {
        const userId = await authenticatedUserId();
        if (!userId) return error(401);
      },
    })
    // User joins via invitation
    .post(
      '/users/join',
      async (ctx: any) => {
        const { username, invitation_code } = ctx.body;
        const auth0UserId = (await ctx.authenticatedUserId()) as string;

        // validate invitation code
        if (invitation_code !== INVITATION_CODE) {
          return { success: false, message: 'Invalid invitation code' };
        }

        // check sum of all participation_percent
        const users = await db.query.users.findMany({
          columns: { participation_percent: true },
        });
        const sum = users.reduce(
          (acc, user) => acc + user.participation_percent,
          0,
        );
        const newParticipationPercent = 100 - sum;

        try {
          await db.insert(schema.users).values({
            username: username,
            auth0_id: auth0UserId,
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
        return {
          success: true,
          message: 'User joined successfully',
        };
      },
      {
        body: t.Object({
          username: t.String({ minLength: 3, maxLength: 15 }),
          invitation_code: t.String(),
        }),
        response: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
      },
    )
    // get all users
    .get(
      '/users',
      async () => {
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
          repetition,
          days_per_week,
          effort_in_minutes,
          is_active,
        } = ctx.body;

        // prevent setting days_per_week for non-daily repetitions
        let dpw = null;
        if (repetition === 'daily') {
          dpw = days_per_week;
        }

        await db.insert(schema.doings).values({
          name,
          description,
          notice,
          repetition: repetition as
            | 'once'
            | 'daily'
            | 'weekly'
            | 'monthly'
            | 'yearly',
          days_per_week: dpw,
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
          repetition: t.Union([
            t.Literal('once'),
            t.Literal('daily'),
            t.Literal('weekly'),
            t.Literal('monthly'),
            t.Literal('yearly'),
          ]),
          days_per_week: t.Optional(t.Number({ minimum: 1, maximum: 7 })),
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
          repetition,
          days_per_week,
          effort_in_minutes,
          is_active,
        } = ctx.body;

        // prevent setting days_per_week for non-daily repetitions
        let dpw = null;
        if (repetition === 'daily') {
          dpw = days_per_week;
        }

        await db
          .update(schema.doings)
          .set({
            name,
            description,
            notice,
            repetition: repetition as
              | 'once'
              | 'daily'
              | 'weekly'
              | 'monthly'
              | 'yearly',
            days_per_week: dpw,
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
          description: t.Optional(t.Union([t.String(), t.Null()])),
          notice: t.Optional(t.Union([t.String(), t.Null()])),
          repetition: t.Union([
            t.Literal('once'),
            t.Literal('daily'),
            t.Literal('weekly'),
            t.Literal('monthly'),
            t.Literal('yearly'),
          ]),
          days_per_week: t.Optional(t.Number({ minimum: 1, maximum: 7 })),
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

    // Trigger Autoassign
    .post(
      '/doings/autoassign',
      async (ctx: any) => {
        const { reassign } = ctx.body;
        try {
          await new AssignmentService().assignTasksForWeek({
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
      async () => {
        return {
          success: true,
          message: 'Autoassign cron info',
          data: timer.getJobInfo(AUTO_ASSIGN_CRON_NAME),
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
        const { enable, cronTime } = ctx.body;
        controlAssignmentCronJob(enable, cronTime);
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

        const currentDoingId = await db
          .update(schema.assignments)
          .set(updateData)
          .where(eq(schema.assignments.id, Number(id)))
          .returning({ doing_id: schema.assignments.doing_id });

        if (currentDoingId.length === 0) {
          return { success: false, message: 'Assignment not found' };
        }

        // auto handling of daily assignments states for same doing
        await autoHandleDailyAssignments(
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

    // Get todos (= assigned doings) to the current user
    .get(
      '/todos',
      async (ctx: any) => {
        const { allUsers, status } = ctx.query;

        // Optional filter by user
        let userFilter: SQL;
        if (allUsers === 'true') {
          userFilter = sql`1 = 1`;
        } else {
          const auth0UserId = (await ctx.authenticatedUserId()) as string;
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

        // Get the start and end of the current week and the current calendar week
        // const now = new Date();
        // const dayOfWeek = now.getDay();
        // const startOfWeek = new Date(now);
        // startOfWeek.setDate(
        //   now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1),
        // ); // Adjust to Monday
        // startOfWeek.setHours(0, 0, 0, 0); // Set to 0 AM
        // const endOfWeek = new Date(startOfWeek);
        // endOfWeek.setDate(startOfWeek.getDate() + 6); // Set to Sunday
        // endOfWeek.setHours(23, 59, 59, 999); // Set to end of the day
        // const currentWeekNumber = getCalendarWeekFromDateOfCurrentYear(now);

        const assignmentsQuery = db
          .select({
            assignmentId: schema.assignments.id,
            status: schema.assignments.status,
            doingId: schema.doings.id,
            doingName: schema.doings.name,
            doingDescription: schema.doings.description,
            doingEffort: schema.doings.effort_in_minutes,
            doingRepetition: schema.doings.repetition,
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
          .where(
            and(
              userFilter,
              // or(
              //   eq(schema.assignments.due_week, currentWeekNumber),
              //   and(
              //     gt(schema.assignments.due_date, startOfWeek),
              //     lt(schema.assignments.due_date, endOfWeek),
              //   ),
              // ),
              statusFilter,
            ),
          );

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

        const user_id = await getUserIdFromContext(ctx);
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

        if (await maxShittyPointsExceeded(0, points, user_id)) {
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
        const user_id = await getUserIdFromContext(ctx);
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
        const user_id = await getUserIdFromContext(ctx);
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

        const user_id = await getUserIdFromContext(ctx);
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
          await maxShittyPointsExceeded(currentPoints.points, points, user_id)
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
    ),
);

app.group('/siri', (siriGroup) =>
  siriGroup.get(
    '/todos',
    async (ctx: any) => {
      const apiKey = ctx.headers['x-api-key'];
      const validApiKey = process.env.SIRI_API_KEY || crypto.randomUUID();

      if (!apiKey || apiKey !== validApiKey) {
        return 'Du bist leider nicht berechtigt, diese Funktion zu nutzen.';
      }
      try {
        const { userName } = ctx.query;

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
            return `Hallo ${userName}, du hast alles erledigt. Gute Arbeit!`;
          }
          return 'Es sind keine Aufgaben mehr offen. Gute Arbeit!';
        }

        if (userName) {
          return `Hallo ${userName}, du hast diese Woche noch folgende offene Aufgaben: ${assignments.map((assignment) => assignment.doingName).join(', ')}.`;
        }
        return `Diese Woche sind noch folgende Aufgaben offen: ${assignments.map((assignment) => assignment.doingName).join(', ')}.`;
      } catch (error) {
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
const getUserIdFromContext = async (ctx: any) => {
  const auth0UserId = (await ctx.authenticatedUserId()) as string;
  const user = await db.query.users.findFirst({
    where: eq(schema.users.auth0_id, auth0UserId),
    columns: { id: true },
  });
  return user?.id;
};

// helper function to check if max shitty points is reached
const maxShittyPoints = Number(process.env.MAX_SHITTY_POINTS_PER_DOING || 3);
const maxShittyPointsExceeded = async (
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

// helper function to auto handle status of next daily assignment
const autoHandleDailyAssignments = async (
  parentDoingId: number,
  parentStatus: string,
) => {
  try {
    if (parentStatus === 'completed') {
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
            pendingAssignments.slice(1).map((a) => a.id), // Skip the first pending assignment
          ),
        );
    }
  } catch (error) {
    console.log(
      'Error during auto handling of daily assignments states for same doing. Skipping this step.',
      error,
    );
  }
};

// helper function to enable or disable assignemnt cron job
const assignmentService = new AssignmentService();
const timer = new Timer();
let assignmentCronTime: string = '';
/**
 * Enable or disable the cron job for auto assigning tasks
 * @param enable true to enable, false to disable the cron job
 * @param cronTime cron time string, default is '0 23 * * 0' (every sunday at 23:00)
 */
const controlAssignmentCronJob = async (
  enable: boolean,
  cronTime: string = '0 23 * * 0',
) => {
  if (enable) {
    assignmentCronTime = cronTime;
    timer.addJob(
      AUTO_ASSIGN_CRON_NAME,
      cronTime,
      async () => {
        await assignmentService.assignTasksForWeek({
          dryRun: false,
          groupByRepetition: process.env.ENABLE_REPETITION_GROUPING === 'true',
        });
      },
      { autoStart: true },
    );
    console.log('Cron job for auto assigning tasks enabled');
  } else {
    timer.cancelJob(AUTO_ASSIGN_CRON_NAME);
    console.log('Cron job for auto assigning tasks disabled');
  }
};

if (process.env.CRON_ENABLED === 'true') {
  controlAssignmentCronJob(true);
}

// Start the server
app.listen(process.env.PORT || 3000);
console.log(
  `\x1b[32m➜ \x1b[36mToDuo Backend running at \x1b[1mhttp://${app.server?.hostname}:${app.server?.port}\x1b[0m`,
);

// test, TODO: remove
// await assignmentService.assignTasksForWeek({
//   dryRun: true,
//   groupByRepetition: process.env.ENABLE_REPETITION_GROUPING === 'true',
// });
