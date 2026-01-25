import * as cron from "node-cron";
import { processPendingJobs, cleanupOldJobs } from "./queue";
import { logger } from "./logger";

export interface CronType {
  start: () => void;
  stop: () => void;
  getStatus: () => { isRunning: boolean; jobCount: number };
  tasks: {
    processJobQueue: () => Promise<void>;
    cleanupJobQueue: () => Promise<void>;
  };
}

export function createCron(): CronType {
  const cronJobs: cron.ScheduledTask[] = [];
  let isRunning = false;

  async function processJobQueue(): Promise<void> {
    try {
      await processPendingJobs();
    } catch (error) {
      logger.error("[cron:processJobQueue] Job failed", error);
    }
  }

  async function cleanupJobQueue(): Promise<void> {
    logger.info("[cron:cleanupJobQueue] Starting");
    try {
      const deleted = await cleanupOldJobs(7);
      logger.info("[cron:cleanupJobQueue] Completed", { deleted });
    } catch (error) {
      logger.error("[cron:cleanupJobQueue] Job failed", error);
    }
  }

  function start(): void {
    if (isRunning) {
      logger.warn("[cron] Already running");
      return;
    }

    // Every minute: process pending jobs in queue
    cronJobs.push(
      cron.schedule("* * * * *", async () => {
        await processJobQueue();
      }),
    );

    // Daily at 1am: cleanup old completed jobs
    cronJobs.push(
      cron.schedule("0 1 * * *", async () => {
        logger.info("[cron] Running cleanupJobQueue");
        await cleanupJobQueue();
      }),
    );

    isRunning = true;
    logger.info("[cron] Started", { jobCount: cronJobs.length });
  }

  function stop(): void {
    for (const job of cronJobs) {
      job.stop();
    }
    cronJobs.length = 0;
    isRunning = false;
    logger.info("[cron] Stopped");
  }

  function getStatus(): { isRunning: boolean; jobCount: number } {
    return { isRunning, jobCount: cronJobs.length };
  }

  return {
    start,
    stop,
    getStatus,
    tasks: {
      processJobQueue,
      cleanupJobQueue,
    },
  };
}
