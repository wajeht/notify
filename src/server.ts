import { app } from "./app";
import { Server } from "http";
import { AddressInfo } from "net";
import { appConfig } from "./config";
import { db } from "./db/db";
import { runMigrations } from "./utils";
import { logger } from "./logger";
import { createCron, CronType } from "./cron";

const server: Server = app.listen(appConfig.port);
let cron: CronType;

process.title = "notify";

server.on("listening", async () => {
  const addr = server.address();
  const bind = typeof addr === "string" ? `pipe ${addr}` : `port ${(addr as AddressInfo).port}`;

  logger.info(`Server is listening on ${bind}`);

  if (appConfig.env === "production") {
    await runMigrations();
  }

  // Start cron jobs
  cron = createCron(db);
  cron.start();
});

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.syscall !== "listen") {
    throw error;
  }

  const bind = typeof appConfig.port === "string" ? `Pipe ${appConfig.port}` : `Port ${appConfig.port}`;

  if (error.code === "EACCES") {
    logger.error(`${bind} requires elevated privileges`);
    process.exit(1);
  } else if (error.code === "EADDRINUSE") {
    logger.error(`${bind} is already in use`);
    process.exit(1);
  } else {
    throw error;
  }
});

function gracefulShutdown(signal: string): void {
  logger.info(`Received ${signal}, shutting down gracefully.`);

  server.close(async () => {
    logger.info("HTTP server closed.");

    // Stop cron jobs
    if (cron) {
      cron.stop();
    }

    try {
      await db.destroy();
      logger.info("Database connection closed.");
    } catch (error) {
      logger.error("Error closing database connection");
    }

    logger.info("All connections closed successfully.");
    process.exit(0);
  });

  setTimeout(() => {
    logger.error("Could not close connections in time, forcefully shutting down");
    process.exit(1);
  }, 10000);
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGQUIT", () => gracefulShutdown("SIGQUIT"));

process.on("uncaughtException", async (error: Error, origin: string) => {
  logger.error("Uncaught Exception");
});

process.on("warning", (warning: Error) => {
  logger.warn("Process warning");
});

process.on("unhandledRejection", async (reason: unknown, _promise: Promise<unknown>) => {
  logger.error("Unhandled Rejection");
});
