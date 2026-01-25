import {
  errorMiddleware,
  helmetMiddleware,
  sessionMiddleware,
  notFoundMiddleware,
  rateLimitMiddleware,
  appLocalStateMiddleware,
} from "./middleware";
import cors from "cors";
import express from "express";
import flash from "connect-flash";
import { router } from "./routes/routes";
import { appConfig } from "./config";
import compression from "compression";
import { renderTemplate, layoutMiddleware } from "./utils/template";
import { expressTemplatesReload as reload } from "@wajeht/express-templates-reload";

const app = express();

app
  .set("trust proxy", 1)
  .use(sessionMiddleware())
  .use(flash())
  .use(compression())
  .use(cors())
  .use(helmetMiddleware())
  .use(rateLimitMiddleware())
  .use(express.json({ limit: "100kb" }))
  .use(express.urlencoded({ extended: true, limit: "100kb" }))
  .use(express.static("./public", { maxAge: "30d", etag: true, lastModified: true }))
  .engine("html", renderTemplate)
  .set("view engine", "html")
  .set("view cache", appConfig.env === "production")
  .set("views", "./src/routes")
  .use(layoutMiddleware)
  .use(appLocalStateMiddleware);

if (appConfig.env === "development") {
  reload({
    app,
    watch: [{ path: "./public/style.css" }, { path: "./src/routes", extensions: [".html"] }],
  });
}

app.use(router).use(notFoundMiddleware()).use(errorMiddleware());

export { app };
