import { Elysia, t } from 'elysia';
import { staticPlugin } from '@elysiajs/static';
import { swagger } from '@elysiajs/swagger';
import { cors } from '@elysiajs/cors';
import { Logestic } from 'logestic';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { db } from './database/db';
import * as schema from './database/schema';
import { seedDatabase } from './database/seed';
import type { BunFile } from 'bun';
import { and, or, eq, gt, lt } from 'drizzle-orm';

// seed the database
await seedDatabase();

// tmp query
// const result = await db.query.doings.findMany();
// console.log(result);

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
        origin: /^https:\/\/localhost:\d+$/,
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

        await db.insert(schema.users).values({
          username: username,
          auth0_id: auth0UserId,
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
            username: true,
            auth0_id: true,
          },
        });
        return { success: true, users };
      },
      {
        response: t.Object({
          success: t.Boolean(),
          users: t.Array(
            t.Object({ username: t.String(), auth0_id: t.String() }),
          ),
        }),
      },
    )
    // Create a new doing
    .post(
      '/doings',
      async (ctx) => {
        const { name, description, notice, repetition, effort_in_minutes } =
          ctx.body;

        // Logic to create a new doing
        await db.insert(schema.doings).values({
          name,
          description,
          notice,
          repetition: repetition as 'once' | 'daily' | 'weekly' | 'monthly',
          effort_in_minutes,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        });
        return { success: true, message: 'Doing created' };
      },
      {
        body: t.Object({
          name: t.String(),
          description: t.Optional(t.String()),
          notice: t.Optional(t.String()),
          repetition: t.Union([
            t.Literal('once'),
            t.Literal('daily'),
            t.Literal('weekly'),
            t.Literal('monthly'),
          ]),
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
          return { success: true, doing };
        } else {
          // Logic to get all doings
          const doings = await db.query.doings.findMany();
          return { success: true, doings };
        }
      },
      {
        params: t.Object({
          id: t.Optional(t.Number()),
        }),
        response: t.Object({
          success: t.Boolean(),
          doing: t.Optional(t.Any()),
          doings: t.Optional(t.Array(t.Any())),
        }),
      },
    )
    // Update a doing by id
    .put(
      '/doings/:id',
      async (ctx) => {
        const { id } = ctx.params;
        const { name, description, notice, repetition, effort_in_minutes } =
          ctx.body;
        // Logic to update a doing by id
        await db
          .update(schema.doings)
          .set({
            name,
            description,
            notice,
            repetition: repetition as 'once' | 'daily' | 'weekly' | 'monthly',
            effort_in_minutes,
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
          name: t.Optional(t.String()),
          description: t.Optional(t.String()),
          notice: t.Optional(t.String()),
          repetition: t.Optional(
            t.Union([
              t.Literal('once'),
              t.Literal('daily'),
              t.Literal('weekly'),
              t.Literal('monthly'),
            ]),
          ),
          effort_in_minutes: t.Optional(t.Number()),
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
        // Logic to delete a doing by id
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
        const { status, user_id } = ctx.body;
        // Logic to update assignment status or user
        await db
          .update(schema.assignments)
          .set({
            status: status as
              | 'pending'
              | 'completed'
              | 'skipped'
              | 'postponed'
              | 'failed',
            user_id,
            updated_at: new Date(),
          })
          .where(eq(schema.assignments.id, Number(id)));
        return { success: true, message: 'Assignment updated' };
      },
      {
        params: t.Object({
          id: t.Number(),
        }),
        body: t.Object({
          status: t.Union([
            t.Literal('pending'),
            t.Literal('completed'),
            t.Literal('skipped'),
            t.Literal('postponed'),
            t.Literal('failed'),
          ]),
          user_id: t.Number(),
        }),
        response: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
      },
    )
    // Get assignments
    .get(
      '/assignments',
      async (ctx) => {
        const assignmentsList = await db.query.assignments.findMany();
        return { success: true, message: assignmentsList };
      },
      {
        response: t.Object({
          success: t.Boolean(),
          message: t.Array(t.Any()),
        }),
      },
    )

    // Get todos assigned to the current user for the current week
    .get(
      '/todos/this-week',
      async (ctx) => {
        const auth0UserId = (await ctx.authenticatedUserId()) as string;
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

        const getCalendarWeek = (date: Date) => {
          let now = new Date();
          let firstOfJanuary = new Date(now.getFullYear(), 0, 1);
          return Math.ceil(
            ((now.getTime() - firstOfJanuary.getTime()) / 86400000 +
              firstOfJanuary.getDay() +
              1) /
              7,
          );
        };
        const currentWeekNumber = getCalendarWeek(now);

        const assignments = await db
          .select({
            assignmentId: schema.assignments.id,
            status: schema.assignments.status,
            doingName: schema.doings.name,
            doingDescription: schema.doings.description,
            doingEffort: schema.doings.effort_in_minutes,
            dueDate: schema.assignments.due_date,
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
              eq(schema.users.auth0_id, auth0UserId),
              or(
                eq(schema.assignments.due_week, currentWeekNumber),
                and(
                  gt(schema.assignments.due_date, startOfWeek),
                  lt(schema.assignments.due_date, endOfWeek),
                ),
              ),
            ),
          );

        return { success: true, message: assignments };
      },
      {
        response: t.Object({
          success: t.Boolean(),
          message: t.Array(t.Any()),
        }),
      },
    )

    // Create shitty points
    .post(
      '/shittypoints',
      async (ctx) => {
        const { doing_id, points } = ctx.body;

        const auth0UserId = (await ctx.authenticatedUserId()) as string;
        const user_id = await db.query.users
          .findFirst({
            where: eq(schema.users.auth0_id, auth0UserId),
            columns: { id: true },
          })
          .then((user) => user?.id);

        if (!user_id) {
          return { success: false, message: 'User not found' };
        }

        // Check if an entry already exists for the user and doing
        const existingEntry = await db.query.shitty_points.findFirst({
          where:
            eq(schema.shitty_points.user_id, user_id) &&
            eq(schema.shitty_points.doing_id, doing_id),
        });

        if (existingEntry) {
          return {
            success: false,
            message: 'Shitty points already exists for this user and doing',
          };
        }

        try {
          await db.insert(schema.shitty_points).values({
            doing_id,
            user_id,
            points,
            created_at: new Date(),
            updated_at: new Date(),
          });
        } catch (error) {
          console.log(error);
          return {
            success: false,
            message: `Failed to create shitty points, ${error}`,
          };
        }
        return { success: true, message: 'Shitty points created' };
      },
      {
        body: t.Object({
          doing_id: t.Number(),
          points: t.Number(),
        }),
        response: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
      },
    )
    // Get shitty points
    .get(
      '/shittypoints',
      async (ctx) => {
        const auth0UserId = (await ctx.authenticatedUserId()) as string;
        const user_id = await db.query.users
          .findFirst({
            where: eq(schema.users.auth0_id, auth0UserId),
            columns: { id: true },
          })
          .then((user) => user?.id);

        if (!user_id) {
          return { success: false, shittyPoints: [] };
        }

        const pointsList = await db.query.shitty_points.findMany({
          where: eq(schema.shitty_points.user_id, user_id),
          columns: {
            id: true,
            doing_id: true,
            points: true,
          },
        });
        return { success: true, shittyPoints: pointsList };
      },
      {
        response: t.Object({
          success: t.Boolean(),
          shittyPoints: t.Array(
            t.Object({
              id: t.Number(),
              doing_id: t.Number(),
              points: t.Number(),
            }),
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

// Start the server
app.listen(process.env.PORT || 3000);
console.log(
  `\x1b[32m➜ \x1b[36mToDuo Backend running at \x1b[1mhttps://${app.server?.hostname}:${app.server?.port}\x1b[0m`,
);
