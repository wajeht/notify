import * as cron from "node-cron";
import type { Knex } from "knex";
import { DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { backBlaze, s3Client } from "./config";
import { formatDateLong, startOfNextMonth, sendGeneralEmail } from "./utils";
import { processPendingJobs, cleanupOldJobs } from "./queue";
import { logger } from "./logger";

export interface CronType {
  start: () => void;
  stop: () => void;
  getStatus: () => { isRunning: boolean; jobCount: number };
  tasks: {
    resetUserMonthlyAlertLimit: () => Promise<void>;
    deleteExpiredExport: () => Promise<void>;
    processJobQueue: () => Promise<void>;
    cleanupJobQueue: () => Promise<void>;
  };
}

export function createCron(db: Knex): CronType {
  const cronJobs: cron.ScheduledTask[] = [];
  let isRunning = false;

  async function resetUserMonthlyAlertLimit(): Promise<void> {
    logger.info("[cron:resetUserMonthlyAlertLimit] Starting");

    try {
      const appsToReset = await db
        .select(
          "apps.id",
          "apps.name",
          "apps.alerts_reset_date",
          "users.timezone",
          "users.email",
          "users.username",
        )
        .from("apps")
        .innerJoin("users", "users.id", "apps.user_id")
        .where("apps.alerts_reset_date", "<=", new Date());

      if (appsToReset.length === 0) {
        logger.info("[cron:resetUserMonthlyAlertLimit] No apps to reset today");
        return;
      }

      logger.info("[cron:resetUserMonthlyAlertLimit] Resetting apps", {
        count: appsToReset.length,
      });

      for (const app of appsToReset) {
        const now = new Date();
        const nextResetDate = startOfNextMonth(now, app.timezone);

        try {
          await db.transaction(async (trx) => {
            await trx("apps").where("id", app.id).update({
              alerts_sent_this_month: 0,
              alerts_reset_date: nextResetDate,
            });
          });

          // Send email outside transaction (fire-and-forget)
          sendGeneralEmail({
            email: app.email,
            subject: "Monthly Alert Limit Reset",
            username: app.username,
            message: `Your monthly alert limit for the app "${app.name}" has been reset on ${formatDateLong(now, app.timezone)}.
                            Your alert count has been set back to 0, and you can now send new alerts for this month.
                            The next reset will occur on ${formatDateLong(nextResetDate, app.timezone)}.`,
          }).catch((err) =>
            logger.error("[cron:resetUserMonthlyAlertLimit] Failed to send email", err),
          );

          logger.info("[cron:resetUserMonthlyAlertLimit] Reset alert count for app", {
            appId: app.id,
          });
        } catch (error) {
          logger.error("[cron:resetUserMonthlyAlertLimit] Failed to reset app", {
            error,
            appId: app.id,
          });
        }
      }

      logger.info("[cron:resetUserMonthlyAlertLimit] Completed");
    } catch (error) {
      logger.error("[cron:resetUserMonthlyAlertLimit] Job failed", error);
    }
  }

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

    // Daily at midnight: reset user monthly alert limits
    cronJobs.push(
      cron.schedule("0 0 * * *", async () => {
        logger.info("[cron] Running resetUserMonthlyAlertLimit");
        await resetUserMonthlyAlertLimit();
      }),
    );

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
      resetUserMonthlyAlertLimit,
      deleteExpiredExport,
      processJobQueue,
      cleanupJobQueue,
    },
  };
}
