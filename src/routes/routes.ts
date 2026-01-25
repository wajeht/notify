import express from "express";
import { apiRouter } from "./api/api";
import { authRouter } from "./auth/auth";
import { appsRouter } from "./apps/apps";
import { adminRouter } from "./admin/admin";
import { generalRouter } from "./general/general";
import { settingsRouter } from "./settings/settings";
import { notificationsRouter } from "./notifications/notifications";

const router = express.Router();

router.use("/", generalRouter);

router.use("/", apiRouter);

router.use("/", authRouter);

router.use("/admin", adminRouter);

router.use("/settings", settingsRouter);

router.use("/notifications", notificationsRouter);

router.use("/apps", appsRouter);

export { router };
