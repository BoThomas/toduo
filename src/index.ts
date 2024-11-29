import { Elysia } from 'elysia';
import { staticPlugin } from '@elysiajs/static';
import { cors } from '@elysiajs/cors';
import { Logestic } from 'logestic';
import { ApiMock } from './apiMock';
import { authMiddleware } from './authMiddleware';
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

const app = new Elysia({
  serve: {
    tls: tlsConfig,
  },
}).use(Logestic.preset('common'));

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
      beforeHandle: authMiddleware,
    })
    .get('/todos/due-this-week', (ctx) => {
      // @ts-ignore (authMiddleware sets the userId)
      const userId = ctx.userId;
      return { success: true, message: ApiMock.todos };
    })
    .put('/todos/:id', ({ params, body }) => {
      const todoId = parseInt(params.id, 10);
      const updatedTodo = body;

      const index = ApiMock.todos.findIndex((todo) => todo.id === todoId);
      if (index !== -1) {
        if (typeof updatedTodo === 'object' && updatedTodo !== null) {
          ApiMock.todos[index] = { ...ApiMock.todos[index], ...updatedTodo };
        } else {
          return { success: false, message: 'Invalid update data' };
        }
        return { success: true, message: ApiMock.todos[index] };
      } else {
        return { success: false, message: 'Todo not found' };
      }
    }),
);

// seed the database
await seedDatabase();

// tmp query
const result = await db.query.movies.findMany();
console.log(result);

// Start the server
app.listen(process.env.PORT || 3000);
console.log(
  `\x1b[32m➜ \x1b[36mToDuo Backend running at \x1b[1mhttps://${app.server?.hostname}:${app.server?.port}\x1b[0m`,
);
