import express, { Request, Response } from "express";
import { apiKeyAuthenticationMiddleware } from "../middleware";
import { sendNotification } from "../../notification";
import { logger } from "../../logger";

const router = express.Router();

// POST /
router.post(
  "/",
  apiKeyAuthenticationMiddleware,
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

    try {
      await sendNotification({
        appId: String(appId),
        userId: Number(userId),
        message: message.trim(),
        details: details && typeof details === "object" ? details : {},
      });

      res.status(200).json({ message: "notification queued" });
    } catch (error) {
      logger.error("[postNotificationHandler] failed", { error, appId });
      res.status(500).json({ error: "failed to queue notification" });
    }
  },
);

export { router as apiRouter };
