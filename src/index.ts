import { Elysia } from 'elysia';
import { staticPlugin } from '@elysiajs/static';
import { cors } from '@elysiajs/cors';
import { Logestic } from 'logestic';
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

app.group('/api', (app) =>
  app.get('/todos/weekly', () => {
    return [
      {
        id: 1,
        name: 'Clean the kitchen',
        description: 'Clean all surfaces and mop the floor',
        repetition: 'weekly',
        effort: 60,
        notice: '',
        active: true,
        shittyPoints: 5,
      },
    ];
  }),
);

// Start the server
app.listen(process.env.PORT || 3000);
console.log(
  `\x1b[32m➜ \x1b[36mToDuo Backend running at \x1b[1mhttps://${app.server?.hostname}:${app.server?.port}\x1b[0m`,
);
