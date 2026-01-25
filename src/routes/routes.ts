import express from "express";
import { generalRouter } from "./general/general";
import { apiRouter } from "./api/api";
import { authRouter } from "./auth/auth";
import { adminRouter } from "./admin/admin";
import { settingsRouter } from "./settings/settings";
import { notificationsRouter } from "./notifications/notifications";
import { appsRouter } from "./apps/apps";

const router = express.Router();

// General routes (/, /healthz, /terms-of-service, /logout)
router.use("/", generalRouter);

// API routes (POST /)
router.use("/", apiRouter);

// Auth routes (/login, /oauth/*)
router.use("/", authRouter);

// Admin routes (/admin/*)
router.use("/admin", adminRouter);

// Settings routes (/settings/*)
router.use("/settings", settingsRouter);

// Notifications routes (/notifications/*)
router.use("/notifications", notificationsRouter);

// Apps routes (/apps/*)
router.use("/apps", appsRouter);

export { router };
