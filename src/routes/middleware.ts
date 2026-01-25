import helmet from "helmet";
import { csrfSync } from "csrf-sync";
import session from "express-session";
import { verifyApiKey } from "../utils";
import { UnauthorizedError } from "../error";
import rateLimit from "express-rate-limit";
import { ConnectSessionKnexStore } from "connect-session-knex";
import { sessionConfig, appConfig } from "../config";
import { validationResult } from "express-validator";
import { NextFunction, Request, Response } from "express";
import type { Knex } from "knex";
import type { LoggerType } from "../logger";

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
        "default-src": ["'self'", "plausible.jaw.dev", "notify.jaw.dev", "jaw.lol"],
        "script-src": [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "plausible.jaw.dev",
          "jaw.lol",
          "notify.jaw.dev",
        ],
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
        createTable: false,
        cleanupInterval: 3600000,
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
      const randomNumber = Math.random();

      res.locals.state = {
        user: req.session?.user
          ? await knex.select("*").from("users").where("id", req.session.user.id).first()
          : null,
        copyRightYear: new Date().getFullYear(),
        input: req.session?.input || {},
        errors: req.session?.errors || {},
        version: {
          style: isProd ? "0.2" : randomNumber,
          script: isProd ? "0.1" : randomNumber,
          plausible: isProd ? "0.1" : randomNumber,
        },
        flash: {
          success: req.flash("success"),
          error: req.flash("error"),
          info: req.flash("info"),
          warning: req.flash("warning"),
        },
      };

      if (req.session?.user) {
        const { unread_apps_notification_count } = (await knex("notifications")
          .count("* as unread_apps_notification_count")
          .leftJoin("apps", "notifications.app_id", "apps.id")
          .where("apps.user_id", req.session?.user.id)
          .whereNull("notifications.read_at")
          .first()) as any;

        res.locals.state["unread_apps_notification_count"] = unread_apps_notification_count;

        const appIdMatch = req.path.match(/^\/apps\/(\d+)/) as any;
        if (appIdMatch && req.method === "GET") {
          const appId = parseInt(appIdMatch[1]);

          const { unread_app_notification_count } = (await knex("notifications")
            .count("* as unread_app_notification_count")
            .leftJoin("apps", "notifications.app_id", "apps.id")
            .where("apps.user_id", req.session?.user?.id)
            .andWhere({ "apps.id": appId })
            .whereNull("notifications.read_at")
            .first()) as any;

          const { active_channel_count } = (await knex("app_channels")
            .where({
              app_id: appId,
              is_active: true,
            })
            .count("* as active_channel_count")
            .first()) as any;

          res.locals.state["unread_app_notification_count"] = unread_app_notification_count;
          res.locals.state["active_channel_count"] = active_channel_count;
        }
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
