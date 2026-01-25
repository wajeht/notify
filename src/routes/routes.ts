import express from "express";
import type { AppContext } from "../context";
import { createApiRouter } from "./api/api";
import { createAuthRouter } from "./auth/auth";
import { createAppsRouter } from "./apps/apps";
import { createAdminRouter } from "./admin/admin";
import { createGeneralRouter } from "./general/general";
import { createSettingsRouter } from "./settings/settings";
import { createNotificationsRouter } from "./notifications/notifications";

export function createMainRouter(context: AppContext) {
  const router = express.Router();

  router.use("/", createGeneralRouter(context));
  router.use("/", createApiRouter(context));
  router.use("/", createAuthRouter(context));
  router.use("/admin", createAdminRouter(context));
  router.use("/settings", createSettingsRouter(context));
  router.use("/notifications", createNotificationsRouter(context));
  router.use("/apps", createAppsRouter(context));

  return router;
}
