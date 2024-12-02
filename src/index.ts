import { Elysia } from 'elysia';
import { staticPlugin } from '@elysiajs/static';
import { cors } from '@elysiajs/cors';
import { Logestic } from 'logestic';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { db } from './database/db';
import { seedDatabase } from './database/seed';
import type { BunFile } from 'bun';

let tlsConfig: { cert: BunFile; key: BunFile } | undefined = undefined;
if (process.env.LOCAL_TLS_CERT === 'true') {
  tlsConfig = {
    cert: Bun.file('./tls/cert.pem'),
    key: Bun.file('./tls/key.pem'),
  };
}

const JWKS_URI = process.env.AUTH0_JWKS_URI;
if (!JWKS_URI) {
  throw new Error('AUTH0_JWKS_URI is not defined');
}

// Auth service
const JWKS = createRemoteJWKSet(new URL(JWKS_URI));
// create elysia auth service to use in the elysia app
// use derive to add a scoped function to the Context for usage in route handlers
const AuthService = new Elysia({ name: 'Service.Auth' }).derive(
  { as: 'scoped' },
  async ({ headers }) => ({
    authenticatedUserId: async () => {
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
  .use(Logestic.preset('common')) // Log all requests
  .use(AuthService); // Add the auth service

if (process.env.NODE_ENV === 'development') {
  // DEV: enable CORS for the frontend
  app.use(
    cors({
      origin: /^https:\/\/localhost:\d+$/,
    }),
  );

  // DEV: serve a simple message
  app.get('/', () => {
    return 'App running in development mode, frontend is served separately.';
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
    .get('/todos/due-this-week', async (ctx) => {
      const userId = await ctx.authenticatedUserId();
      return { success: true, message: userId };
    }),
);

// seed the database
await seedDatabase();

// tmp query
// const result = await db.query.doings.findMany();
// console.log(result);

// Start the server
app.listen(process.env.PORT || 3000);
console.log(
  `\x1b[32m➜ \x1b[36mToDuo Backend running at \x1b[1mhttps://${app.server?.hostname}:${app.server?.port}\x1b[0m`,
);
