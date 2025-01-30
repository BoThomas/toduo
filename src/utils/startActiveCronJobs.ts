import { readdir } from 'node:fs/promises';
import { AssignmentService } from '../autoAssign';
import { getDbConnection } from '../database/db';
import { and, eq } from 'drizzle-orm';
import { cronjobs } from '../database/schema';
import type CronJobManager from '../timer';

/**
 * Starts all active cron jobs by parsing database file names in the specified directory,
 * retrieving active cron jobs from each database group, and adding them to the provided timer.
 *
 * @param {CronJobManager} timer - The CronJobManager instance to which active cron jobs will be added.
 * @returns {Promise<void>} A promise that resolves when all active cron jobs have been started.
 *
 * @example
 * ```typescript
 * import { CronJobManager } from 'cron-job-manager';
 * import { startActiveCronJobs } from './utils/startActiveCronJobs';
 *
 * const timer = new CronJobManager();
 * startActiveCronJobs(timer).then(() => {
 *   console.log('All active cron jobs have been started.');
 * });
 * ```
 */
export const startActiveCronJobs = async (
  timer: CronJobManager,
): Promise<void> => {
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
      where: and(eq(cronjobs.active, true)),
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
      console.log(
        `Autoassign cron job enabled for group ${group}: ${activeCronJobs.cron_time}`,
      );
    }
  }
};
