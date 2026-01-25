import { db } from "./db/db";
import { logger } from "./logger";
import { sendSms } from "./jobs/sms";
import { sendEmail } from "./jobs/email";
import { sendDiscord } from "./jobs/discord";

export type JobType = "discord" | "email" | "sms";

export interface JobPayload {
  config: any;
  username?: string;
  message: string;
  details: any;
}

// Add job to queue
export async function enqueue(type: JobType, payload: JobPayload): Promise<number> {
  try {
    const [id] = await db("jobs").insert({
      type,
      payload: JSON.stringify(payload),
      status: "pending",
      attempts: 0,
      max_attempts: 5,
    });
    logger.info({ jobId: id, type }, "[queue] job enqueued");
    return id as number;
  } catch (error) {
    logger.error({ err: error, type }, "[queue] failed to enqueue job");
    throw error;
  }
}

// Process a single job
async function processJob(job: any): Promise<boolean> {
  const payload: JobPayload = JSON.parse(job.payload);

  try {
    switch (job.type as JobType) {
      case "discord":
        await sendDiscord({
          config: payload.config,
          message: payload.message,
          details: payload.details,
        });
        break;
      case "email":
        await sendEmail({
          config: payload.config,
          username: payload.username!,
          message: payload.message,
          details: payload.details,
        });
        break;
      case "sms":
        await sendSms({
          config: payload.config,
          message: payload.message,
          details: payload.details,
        });
        break;
      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }

    // Success
    await db("jobs").where({ id: job.id }).update({
      status: "completed",
      completed_at: db.fn.now(),
      updated_at: db.fn.now(),
    });
    logger.info({ jobId: job.id, type: job.type }, "[queue] job completed");
    return true;
  } catch (error: any) {
    const attempts = job.attempts + 1;
    const failed = attempts >= job.max_attempts;

    // Exponential backoff: 1min, 5min, 15min, 30min, 60min
    const backoffArr = [1, 5, 15, 30, 60];
    const backoffMinutes = backoffArr[Math.min(attempts - 1, 4)] ?? 60;
    const runAt = new Date(Date.now() + backoffMinutes * 60 * 1000);

    await db("jobs")
      .where({ id: job.id })
      .update({
        status: failed ? "failed" : "pending",
        attempts,
        error: error.message || String(error),
        run_at: failed ? job.run_at : runAt,
        updated_at: db.fn.now(),
      });

    logger.error(
      {
        jobId: job.id,
        type: job.type,
        attempts,
        maxAttempts: job.max_attempts,
        error: error.message,
      },
      `[queue] job ${failed ? "failed permanently" : "will retry"}`,
    );
    return false;
  }
}

// Recover jobs stuck in "processing" (server crashed)
async function recoverStuckJobs(): Promise<number> {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const stuck = await db("jobs")
    .where("status", "processing")
    .where("updated_at", "<", fiveMinutesAgo)
    .update({ status: "pending", updated_at: db.fn.now() });

  if (stuck > 0) {
    logger.warn({ count: stuck }, "[queue] recovered stuck jobs");
  }
  return stuck;
}

// Process all pending jobs (called by cron)
export async function processPendingJobs(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  // First recover any stuck jobs
  await recoverStuckJobs();

  const now = new Date();
  const jobs = await db("jobs")
    .where("status", "pending")
    .where("run_at", "<=", now)
    .orderBy("created_at", "asc")
    .limit(100);

  if (jobs.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  let succeeded = 0;
  let failed = 0;

  for (const job of jobs) {
    // Mark as processing
    await db("jobs")
      .where({ id: job.id })
      .update({ status: "processing", updated_at: db.fn.now() });

    const success = await processJob(job);
    if (success) succeeded++;
    else failed++;
  }

  logger.info({ processed: jobs.length, succeeded, failed }, "[queue] batch processed");

  return { processed: jobs.length, succeeded, failed };
}

// Cleanup old completed jobs (called by cron)
export async function cleanupOldJobs(daysOld = 7): Promise<number> {
  const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  const deleted = await db("jobs")
    .where("status", "completed")
    .where("completed_at", "<", cutoff)
    .delete();

  if (deleted > 0) {
    logger.info({ deleted, daysOld }, "[queue] cleaned up old jobs");
  }
  return deleted;
}
