import * as cron from "node-cron";
import type { Knex } from "knex";
import { DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { backBlaze, s3Client } from "./config";
import { processPendingJobs, cleanupOldJobs } from "./queue";
import { logger } from "./logger";

export interface CronType {
  start: () => void;
  stop: () => void;
  getStatus: () => { isRunning: boolean; jobCount: number };
  tasks: {
    deleteExpiredExport: () => Promise<void>;
    processJobQueue: () => Promise<void>;
    cleanupJobQueue: () => Promise<void>;
  };
}

export function createCron(db: Knex): CronType {
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

  async function deleteExpiredExport(): Promise<void> {
    logger.info("[cron:deleteExpiredExport] Starting");

    try {
      const now = new Date();
      const expirationTime = 24 * 60 * 60 * 1000; // 24 hours

      const listCommand = new ListObjectsV2Command({
        Bucket: backBlaze.bucket,
        Prefix: "exports/",
      });

      const listResponse = await s3Client.send(listCommand);

      if (listResponse.Contents) {
        logger.info("[cron:deleteExpiredExport] Processing objects", {
          count: listResponse.Contents.length,
        });

        for (const object of listResponse.Contents) {
          if (object.Key && object.LastModified) {
            const fileAge = now.getTime() - object.LastModified.getTime();

            if (fileAge > expirationTime) {
              logger.info("[cron:deleteExpiredExport] Deleting expired file", { key: object.Key });

              const deleteCommand = new DeleteObjectCommand({
                Bucket: backBlaze.bucket,
                Key: object.Key,
              });

              await s3Client.send(deleteCommand);

              // Extract user ID from filename and decrement export_count
              const match = object.Key.match(/user_data_(\d+)_/);
              if (match && match[1]) {
                const userId = match[1];
                await db("users")
                  .where("id", userId)
                  .where("export_count", ">", 0)
                  .decrement("export_count", 1);
                logger.info("[cron:deleteExpiredExport] Decremented export_count", { userId });
              }
            }
          }
        }
      } else {
        logger.info("[cron:deleteExpiredExport] No objects found");
      }

      logger.info("[cron:deleteExpiredExport] Completed");
    } catch (error) {
      logger.error("[cron:deleteExpiredExport] Job failed", error);
    }
  }

  function start(): void {
    if (isRunning) {
      logger.warn("[cron] Already running");
      return;
    }

    // Daily at midnight: delete expired exports
    cronJobs.push(
      cron.schedule("0 0 * * *", async () => {
        logger.info("[cron] Running deleteExpiredExport");
        await deleteExpiredExport();
      }),
    );

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
      deleteExpiredExport,
      processJobQueue,
      cleanupJobQueue,
    },
  };
}
