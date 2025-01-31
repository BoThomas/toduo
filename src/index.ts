import { Elysia } from 'elysia';
import siriRoutes from './routes/siri';
import apiRoutes from './routes/api';
import { staticPlugin } from '@elysiajs/static';
import { swagger } from '@elysiajs/swagger';
import { cors } from '@elysiajs/cors';
import { Logestic } from 'logestic';
import { seedDatabase } from './database/seed';
import { startActiveCronJobs } from './utils/startActiveCronJobs';
import CronJobManager from './timer';
import type { BunFile } from 'bun';

// initialize the cron timer handler
export const timer = new CronJobManager();

// seed the database
await seedDatabase();

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
  .use(apiRoutes)
  .use(siriRoutes);

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

// start the server
app.listen(process.env.PORT || 3000);
console.log(
  `\x1b[32m➜ \x1b[36mToDuo Backend running at \x1b[1mhttp://${app.server?.hostname}:${app.server?.port}\x1b[0m`,
);

// start cron jobs
await startActiveCronJobs(timer);

// test auto assign
// await new AssignmentService('beto').assignTasksForWeek({ dryRun: true });
