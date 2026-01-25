import express, { Request, Response } from "express";
import type { AppContext } from "../../context";
import { createMiddleware } from "../middleware";

export function createApiRouter(context: AppContext) {
  const router = express.Router();
  const middleware = createMiddleware(context.knex, context.logger);

  router.post(
    "/",
    middleware.apiKeyAuthenticationMiddleware,
    async (req: Request, res: Response): Promise<void> => {
      if (!req.body || typeof req.body !== "object") {
        res.status(400).json({ error: "invalid request body" });
        return;
      }

      const { message, details } = req.body;

      if (!message || typeof message !== "string" || !message.trim()) {
        res.status(400).json({ error: "message is required" });
        return;
      }

      const { userId, appId } = req.apiKeyPayload ?? {};

      if (!userId || !appId) {
        res.status(401).json({ error: "invalid api key" });
        return;
      }

      res.status(200).json({ message: "notification queued" });

      const payload = {
        appId: String(appId),
        userId: Number(userId),
        message: message.trim(),
        details: details && typeof details === "object" ? details : {},
      };

      setImmediate(() => {
        void context.notification.sendNotification(payload).catch((error) => {
          context.logger.error("[postNotificationHandler] failed", { error, appId });
        });
      });
    },
  );

  return router;
}
