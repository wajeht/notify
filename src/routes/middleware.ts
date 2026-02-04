import helmet from "helmet";
import { csrfSync } from "csrf-sync";
import session from "express-session";
import { verifyApiKey } from "../utils/helpers";
import { UnauthorizedError } from "../error";
import rateLimit from "express-rate-limit";
import { ConnectSessionKnexStore } from "connect-session-knex";
import { sessionConfig, appConfig } from "../config";
import { validationResult } from "express-validator";
import { NextFunction, Request, Response } from "express";
import type { Knex } from "knex";
import type { LoggerType } from "../utils/logger";
import { asset } from "../utils/assets";

export interface MiddlewareType {
  helmetMiddleware: ReturnType<typeof helmet>;
  sessionMiddleware: () => ReturnType<typeof session>;
  rateLimitMiddleware: ReturnType<typeof rateLimit>;
  csrfMiddleware: ((req: Request, res: Response, next: NextFunction) => void)[];
  notFoundMiddleware: () => (req: Request, res: Response, next: NextFunction) => void;
  errorMiddleware: () => (
    error: Error & { statusCode?: number },
    req: Request,
    res: Response,
    next: NextFunction,
  ) => Promise<void>;
  authenticationMiddleware: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  adminOnlyMiddleware: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  apiKeyAuthenticationMiddleware: (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => Promise<void>;
  appLocalStateMiddleware: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  validateRequestMiddleware: (
    schemas: any,
  ) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
}

export function createMiddleware(knex: Knex, logger: LoggerType): MiddlewareType {
  const helmetMiddleware = helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "default-src": ["'self'", "notify.jaw.dev"],
        "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'", "notify.jaw.dev"],
        "script-src-attr": ["'unsafe-inline'"],
      },
    },
    referrerPolicy: {
      policy: "strict-origin-when-cross-origin",
    },
  });

  function sessionMiddleware() {
    return session({
      secret: sessionConfig.secret,
      resave: false,
      saveUninitialized: false,
      store: new ConnectSessionKnexStore({
        knex,
        tableName: "sessions",
        createTable: true, // auto-create sessions table if not exists
        cleanupInterval: 600000, // 10 minutes
      }),
      proxy: appConfig.env === "production",
      cookie: {
        path: "/",
        domain: `.${sessionConfig.domain}`,
        maxAge: 1000 * 60 * 60 * 24,
        httpOnly: appConfig.env === "production",
        sameSite: "lax",
        secure: appConfig.env === "production",
      },
    });
  }

  const rateLimitMiddleware = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      if (req.get("Content-Type") === "application/json") {
        return res.json({ message: "Too many requests from this IP, please try again later." });
      }
      return res.status(429).render("general/rate-limit.html");
    },
    skip: () => appConfig.env !== "production",
  });

  const { csrfSynchronisedProtection } = csrfSync({
    getTokenFromRequest: (req: Request) => req.body.csrfToken || req.query.csrfToken,
  });

  const csrfMiddleware = [
    csrfSynchronisedProtection,
    (req: Request, res: Response, next: NextFunction) => {
      // @ts-expect-error - trust me bro
      res.locals.csrfToken = req.csrfToken();
      next();
    },
  ];

  function notFoundMiddleware() {
    return (_req: Request, res: Response, _next: NextFunction) => {
      return res.status(404).render("general/error.html", {
        statusCode: 404,
        message: "not found",
      });
    };
  }

  function errorMiddleware() {
    return async (
      error: Error & { statusCode?: number },
      _req: Request,
      res: Response,
      _next: NextFunction,
    ) => {
      if (appConfig.env !== "production") {
        logger.error(error);
      }

      return res.status(500).render("general/error.html", {
        statusCode: 500,
        message: appConfig.env !== "production" ? error.stack : "internal server error",
      });
    };
  }

  async function authenticationMiddleware(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.session?.user) {
        return res.redirect("/login");
      }

      const user = await knex.select("*").from("users").where("id", req.session.user.id).first();

      if (!user) {
        req.session.destroy((err) => {
          if (err) {
            logger.error("Error destroying session", err);
          }
          return res.redirect("/login");
        });
        return;
      }

      req.session.user = user;
      req.session.save();

      next();
    } catch (error) {
      next(error);
    }
  }

  async function adminOnlyMiddleware(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.session?.user) {
        return res.redirect("/login");
      }

      if (!req.session.user.is_admin) {
        throw UnauthorizedError();
      }

      next();
    } catch (error) {
      next(error);
    }
  }

  async function apiKeyAuthenticationMiddleware(req: Request, res: Response, next: NextFunction) {
    try {
      const apiKey = req.header("X-API-KEY");

      if (!apiKey) {
        res.status(401).json({ message: "api key is missing" });
        return;
      }

      const apiKeyPayload = await verifyApiKey(apiKey, knex, logger);

      if (!apiKeyPayload) {
        res.status(401).json({ message: "invalid api key" });
        return;
      }

      req.apiKeyPayload = apiKeyPayload;

      next();
    } catch (error) {
      logger.error("failed to auth api key", error);
      res.status(500).json({ message: "internal server error" });
      return;
    }
  }

  async function appLocalStateMiddleware(req: Request, res: Response, next: NextFunction) {
    try {
      const isProd = appConfig.env === "production";
      const randomVersion = () => String(Math.random()).slice(2, 10);
      const assetVersions = isProd ? asset.getAssetVersions() : null;
      const user = req.session?.user || null;

      res.locals.state = {
        user,
        copyRightYear: new Date().getFullYear(),
        input: req.session?.input || {},
        errors: req.session?.errors || {},
        version: {
          style: assetVersions?.style ?? randomVersion(),
          script: assetVersions?.script ?? randomVersion(),
        },
        flash: {
          success: req.flash("success"),
          error: req.flash("error"),
          info: req.flash("info"),
          warning: req.flash("warning"),
        },
        unread_apps_notification_count: 0,
        unread_app_notification_count: 0,
        active_channel_count: 0,
      };

      if (user) {
        const appIdMatch = req.path.match(/^\/apps\/(\d+)/);
        const appId = appIdMatch?.[1] ? parseInt(appIdMatch[1]) : null;

        const counts = (await knex.raw(
          `
          SELECT
            (SELECT COUNT(*) FROM notifications n
             JOIN apps a ON n.app_id = a.id
             WHERE a.user_id = ? AND n.read_at IS NULL) as unread_apps_notification_count,
            (SELECT COUNT(*) FROM notifications n
             JOIN apps a ON n.app_id = a.id
             WHERE a.user_id = ? AND a.id = ? AND n.read_at IS NULL) as unread_app_notification_count,
            (SELECT COUNT(*) FROM app_channels
             WHERE app_id = ? AND is_active = 1) as active_channel_count
        `,
          [user.id, user.id, appId, appId],
        )) as any;

        const row = Array.isArray(counts) ? counts[0] : counts;
        res.locals.state.unread_apps_notification_count = row?.unread_apps_notification_count || 0;
        res.locals.state.unread_app_notification_count = row?.unread_app_notification_count || 0;
        res.locals.state.active_channel_count = row?.active_channel_count || 0;
      }

      if (req.session) {
        delete req.session.input;
        delete req.session.errors;
      }

      next();
    } catch (error) {
      next(error);
    }
  }

  function validateRequestMiddleware(schemas: any) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        await Promise.all(schemas.map((schema: any) => schema.run(req)));
        const result = validationResult(req) as any;

        if (["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) {
          req.session.input = req.body;
        }

        if (result.isEmpty()) {
          delete req.session.errors;
          return next();
        }

        const { errors } = result;
        const reshapedErrors = errors.reduce((acc: { [key: string]: string }, error: any) => {
          acc[error.path] = error.msg;
          return acc;
        }, {});

        req.session.errors = reshapedErrors;

        return res.redirect("back");
      } catch (error) {
        next(error);
      }
    };
  }

  return {
    helmetMiddleware,
    sessionMiddleware,
    rateLimitMiddleware,
    csrfMiddleware,
    notFoundMiddleware,
    errorMiddleware,
    authenticationMiddleware,
    adminOnlyMiddleware,
    apiKeyAuthenticationMiddleware,
    appLocalStateMiddleware,
    validateRequestMiddleware,
  };
}
