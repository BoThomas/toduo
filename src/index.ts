import { Elysia, t } from 'elysia';
import { staticPlugin } from '@elysiajs/static';
import { swagger } from '@elysiajs/swagger';
import { cors } from '@elysiajs/cors';
import { Logestic } from 'logestic';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { db } from './database/db';
import * as schema from './database/schema';
import { seedDatabase } from './database/seed';
import { sql, and, or, eq, gt, lt, asc, inArray, type SQL } from 'drizzle-orm';
import { AssignmentService } from './autoAssign';
import { getCalendarWeekFromDateOfCurrentYear } from './helper';
import Timer from './timer';
import type { BunFile } from 'bun';

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

  // DEV: serve a simple message
  app.get('/', ({ redirect }) => {
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
    .get('/', () => {
      return Bun.file('./frontend/dist/index.html');
    });
}

app.group('/api', (apiGroup) =>
  apiGroup
    .guard({
      // use auth service to guard the route
      beforeHandle: async ({ authenticatedUserId, error }) => {
        const userId = await authenticatedUserId();
        if (!userId) return error(401);
      },
    })
    // User joins via invitation
    .post(
      '/users/join',
      async (ctx) => {
        const { username } = ctx.body;
        const auth0UserId = (await ctx.authenticatedUserId()) as string;
        // TODO: validate invitation code

        // check sum of all participation_percent
        const users = await db.query.users.findMany({
          columns: { participation_percent: true },
        });
        const sum = users.reduce(
          (acc, user) => acc + user.participation_percent,
          0,
        );
        const newParticipationPercent = 100 - sum;

        await db.insert(schema.users).values({
          username: username,
          auth0_id: auth0UserId,
          participation_percent: newParticipationPercent,
          created_at: new Date(),
          updated_at: new Date(),
        });
        return { success: true, message: 'User joined via invitation' };
      },
      {
        body: t.Object({
          username: t.String(),
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
      async (ctx) => {
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
      async (ctx) => {
        const {
          name,
          description,
          notice,
          repetition,
          days_per_week,
          effort_in_minutes,
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
          is_active: true,
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
      async (ctx) => {
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
      async (ctx) => {
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
      async (ctx) => {
        const { id } = ctx.params;

        // remove all assignments for this doing
        await db
          .delete(schema.assignments)
          .where(eq(schema.assignments.doing_id, Number(id)));

        // remove all shitty points for this doing
        await db
          .delete(schema.shitty_points)
          .where(eq(schema.shitty_points.doing_id, Number(id)));

        await db.delete(schema.doings).where(eq(schema.doings.id, Number(id)));
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

    // Autoassign
    .post(
      '/doings/:id/autoassign',
      async (ctx) => {
        const { id } = ctx.params;
        // Logic to autoassign a doing

        // Example: Insert assignment into the database
        await db.insert(schema.assignments).values({
          doing_id: id,
          user_id: 1, // Example user_id
          status: 'pending',
          created_at: new Date(),
          updated_at: new Date(),
        });
        return { success: true, message: 'Doings autoassigned' };
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

    // Update assignment status or user
    .put(
      '/assignments/:id',
      async (ctx) => {
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

        if (updateData.status === 'completed') {
          // If there is no further pending assignment for the current doing, set the next waiting assignment to pending
          const pendingAssignment = await db
            .select({
              id: schema.assignments.id,
            })
            .from(schema.assignments)
            .where(
              and(
                eq(schema.assignments.doing_id, currentDoingId[0].doing_id),
                eq(schema.assignments.status, 'pending'),
              ),
            )
            .limit(1);

          if (pendingAssignment.length === 0) {
            await db
              .update(schema.assignments)
              .set({
                status: 'pending',
                updated_at: new Date(),
              })
              .where(
                and(
                  eq(schema.assignments.doing_id, currentDoingId[0].doing_id),
                  eq(schema.assignments.status, 'waiting'),
                ),
              )
              .orderBy(asc(schema.assignments.id))
              .limit(1);
          }
        } else if (updateData.status === 'pending') {
          // If there are more than one pending assignments for the current doing, set the others to waiting
          const pendingAssignments = await db
            .select({
              id: schema.assignments.id,
            })
            .from(schema.assignments)
            .where(
              and(
                eq(schema.assignments.doing_id, currentDoingId[0].doing_id),
                eq(schema.assignments.status, 'pending'),
              ),
            )
            .orderBy(asc(schema.assignments.id));

          if (pendingAssignments.length > 1) {
            await db
              .update(schema.assignments)
              .set({
                status: 'waiting',
                updated_at: new Date(),
              })
              .where(
                inArray(
                  schema.assignments.id,
                  pendingAssignments.slice(1).map((a) => a.id),
                ),
              );
          }
        }

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

    // Get todos (= assigned doings) to the current user for the current week
    .get(
      '/todos/this-week',
      async (ctx) => {
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
        const now = new Date();
        const dayOfWeek = now.getDay();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(
          now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1),
        ); // Adjust to Monday
        startOfWeek.setHours(0, 0, 0, 0); // Set to 0 AM
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6); // Set to Sunday
        endOfWeek.setHours(23, 59, 59, 999); // Set to end of the day
        const currentWeekNumber = getCalendarWeekFromDateOfCurrentYear(now);

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
              or(
                eq(schema.assignments.due_week, currentWeekNumber),
                and(
                  gt(schema.assignments.due_date, startOfWeek),
                  lt(schema.assignments.due_date, endOfWeek),
                ),
              ),
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
      async (ctx) => {
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
          points: t.Number(),
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
      async (ctx) => {
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
    // shitty points
    .put(
      '/shittypoints/:id',
      async (ctx) => {
        const { id } = ctx.params;
        const { points } = ctx.body;
        const updatedRows = await db
          .update(schema.shitty_points)
          .set({
            points,
            updated_at: new Date(),
          })
          .where(eq(schema.shitty_points.id, Number(id)))
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
          points: t.Number(),
        }),
        response: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
      },
    ),
);

// helper function to get user from context auth0 id
const getUserIdFromContext = async (ctx: any) => {
  const auth0UserId = (await ctx.authenticatedUserId()) as string;
  const user = await db.query.users.findFirst({
    where: eq(schema.users.auth0_id, auth0UserId),
    columns: { id: true },
  });
  return user?.id;
};

// Start the server
app.listen(process.env.PORT || 3000);
console.log(
  `\x1b[32m➜ \x1b[36mToDuo Backend running at \x1b[1mhttps://${app.server?.hostname}:${app.server?.port}\x1b[0m`,
);

// Auto assign tasks for the week
const assignmentService = new AssignmentService();
const timer = new Timer();
if (process.env.CRON_ENABLED === 'true') {
  timer.addJob(
    'assignTasksForWeek',
    '0 23 * * 0', // every Sunday at 11 PM
    async () => {
      await assignmentService.assignTasksForWeek();
    },
    { autoStart: true },
  );
  console.log('Cron job for auto assigning tasks enabled');
} else {
  console.log('Cron job for auto assigning tasks disabled');
}

// test, TODO: remove
await assignmentService.assignTasksForWeek({
  dryRun: true,
  groupByRepetition: process.env.ENABLE_REPETITION_GROUPING === 'true',
});
