import cors from "cors";
import express, { Express } from "express";
import flash from "connect-flash";
import compression from "compression";
import { Server } from "http";
import { AddressInfo } from "net";

import { appConfig } from "./config";
import { type AppContext } from "./context";
import { createMiddleware } from "./routes/middleware";
import { createMainRouter } from "./routes/routes";
import { renderTemplate, layoutMiddleware } from "./utils/template";
import { expressTemplatesReload as reload } from "@wajeht/express-templates-reload";

export interface ServerInfo {
  app: Express;
  server: Server;
  context: AppContext;
}

export async function createApp(
  context: AppContext,
): Promise<{ app: Express; context: AppContext }> {
  const middleware = createMiddleware(context.knex, context.logger);

  const app = express();

  app
    .set("trust proxy", 1)
    .use(middleware.sessionMiddleware())
    .use(flash())
    .use(compression())
    .use(cors())
    .use(middleware.helmetMiddleware)
    .use(middleware.rateLimitMiddleware)
    .use(express.json({ limit: "100kb" }))
    .use(express.urlencoded({ extended: true, limit: "100kb" }))
    .use(express.static("./public", { maxAge: "30d", etag: true, lastModified: true }))
    .engine("html", renderTemplate)
    .set("view engine", "html")
    .set("view cache", appConfig.env === "production")
    .set("views", "./src/routes")
    .use(layoutMiddleware)
    .use(middleware.appLocalStateMiddleware);

  if (appConfig.env === "development") {
    reload({
      app,
      watch: [{ path: "./public/style.css" }, { path: "./src/routes", extensions: [".html"] }],
    });
  }

  app
    .use(createMainRouter(context))
    .use(middleware.notFoundMiddleware())
    .use(middleware.errorMiddleware());

  return { app, context };
}

export async function createServer(context: AppContext): Promise<ServerInfo> {
  const { app } = await createApp(context);

  const server: Server = app.listen(appConfig.port);

  server.on("listening", async () => {
    const addr = server.address();
    const bind = typeof addr === "string" ? `pipe ${addr}` : `port ${(addr as AddressInfo).port}`;

    context.logger.info(`Server is listening on ${bind}`);

    try {
      await context.database.init();
    } catch (error) {
      context.logger.error((error as Error).message);
    }
  });

  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.syscall !== "listen") {
      throw error;
    }

    const bind =
      typeof appConfig.port === "string" ? `Pipe ${appConfig.port}` : `Port ${appConfig.port}`;

    if (error.code === "EACCES") {
      context.logger.error(`${bind} requires elevated privileges`);
      process.exit(1);
    } else if (error.code === "EADDRINUSE") {
      context.logger.error(`${bind} is already in use`);
      process.exit(1);
    } else {
      throw error;
    }
  });

  return { app, server, context };
}

export async function closeServer({ server, context }: ServerInfo): Promise<void> {
  context.logger.info("Shutting down server gracefully");

  try {
    await context.database.stop();
    context.logger.info("Database connection closed");
  } catch (error) {
    context.logger.error("Error closing database connection", error);
  }

  await new Promise<void>((resolve, reject) => {
    const shutdownTimeout = setTimeout(() => {
      context.logger.error("Could not close connections in time, forcefully shutting down");
      reject(new Error("Server close timeout"));
    }, 10000);

    server.close((error) => {
      clearTimeout(shutdownTimeout);
      if (error) {
        context.logger.error("Error closing HTTP server", error);
        reject(error);
      } else {
        context.logger.info("HTTP server closed");
        resolve();
      }
    });
  });

  context.logger.info("Server shutdown complete");
}
