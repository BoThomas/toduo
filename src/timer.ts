import { Cron } from 'croner';

/**
 * Manages cron jobs.
 */
class CronJobManager {
  private jobs: Map<string, Cron>;

  constructor() {
    this.jobs = new Map();
  }

  /**
   * Adds a new cron job. If a job with the same name already exists, it will be replaced.
   * @param {string} name - The name of the job.
   * @param {string} cronTime - The cron expression for the job.
   * @param {() => void} callback - The callback function to execute.
   * @param {Object} [options] - Additional options for the job.
   * @param {boolean} [options.autoStart=true] - Whether the job should start automatically.
   * @param {number} [options.maxRuns] - The maximum number of times the job should run.
   */
  public addJob(
    name: string,
    cronTime: string,
    callback: () => void,
    options: { autoStart?: boolean; maxRuns?: number } = { autoStart: true },
  ) {
    if (this.jobs.has(name)) {
      this.cancelJob(name);
    }

    const job = new Cron(
      cronTime,
      { name, paused: !options.autoStart, maxRuns: options.maxRuns },
      callback,
    );
    this.jobs.set(name, job);
  }

  /**
   * Pauses a cron job.
   * @param {string} name - The name of the job to pause.
   */
  public pauseJob(name: string) {
    const job = this.jobs.get(name);
    if (job) {
      job.pause();
    }
  }

  /**
   * Resumes a paused cron job.
   * @param {string} name - The name of the job to resume.
   */
  public resumeJob(name: string) {
    const job = this.jobs.get(name);
    if (job) {
      job.resume();
    }
  }

  /**
   * Cancels a cron job.
   * @param {string} name - The name of the job to cancel.
   */
  public cancelJob(name: string) {
    const job = this.jobs.get(name);
    if (job) {
      job.stop();
      this.jobs.delete(name);
    }
  }
}

export default CronJobManager;
