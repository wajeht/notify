import { app } from "./app";
import { Server } from "http";
import { AddressInfo } from "net";
import { appConfig } from "./config";
import { createDatabase } from "./db/db";
import { logger } from "./logger";

const database = createDatabase(logger);

const server: Server = app.listen(appConfig.port);

process.title = "notify";

server.on("listening", async () => {
  const addr = server.address();
  const bind = typeof addr === "string" ? `pipe ${addr}` : `port ${(addr as AddressInfo).port}`;

  logger.info(`Server is listening on ${bind}`);
  await database.init();
});

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.syscall !== "listen") {
    throw error;
  }

  const bind =
    typeof appConfig.port === "string" ? `Pipe ${appConfig.port}` : `Port ${appConfig.port}`;

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

    try {
      await database.stop();
    } catch (err) {
      logger.error("Error closing database connection", err);
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

process.on("uncaughtException", (error: Error) => {
  logger.error("Uncaught Exception", error);
});

process.on("warning", (warning: Error) => {
  logger.warn("Process warning", warning);
});

process.on("unhandledRejection", (reason: unknown) => {
  logger.error("Unhandled Rejection", reason);
});
