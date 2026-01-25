import express, { Request, Response } from "express";
import { Knex } from "knex";
import { db } from "./db/db";
import jwt from "jsonwebtoken";
import { body } from "express-validator";
import axios, { AxiosError } from "axios";
import { logger } from "./logger";
import { appConfig, oauthConfig } from "./config";
import {
  csrfMiddleware,
  adminOnlyMiddleware,
  authenticationMiddleware,
  apiKeyAuthenticationMiddleware,
  validateRequestMiddleware,
} from "./middleware";
import { sendNotification } from "./jobs/notification";
import { exportUserData } from "./jobs/export-user-data";
import { ApiKeyPayload, DiscordConfig, EmailConfig, SmsConfig, User } from "./types";
import { HttpError, NotFoundError, UnauthorizedError, ValidationError } from "./error";
import {
  dayjs,
  secret,
  extractDomain,
  getGithubOauthToken,
  getGithubUserEmails,
  sendGeneralEmail,
  formatDate,
} from "./utils";

const router = express.Router();

// GET /
router.get("/", (req: Request, res: Response) => {
  if (req.session?.user) {
    res.redirect("/apps");
    return;
  }

  res.render("home.html", {
    path: "/",
    title: "web 2.0 style notification systems for discord, email, and sms",
  });
});

// GET /healthz
router.get("/healthz", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/html").status(200).send("<p>ok</p>");
});

// GET /terms-of-service
router.get("/terms-of-service", (_req: Request, res: Response) => {
  res.render("terms-of-service.html", {
    path: "/terms-of-service",
    title: "Terms of Service",
  });
});

// GET /logout
router.get("/logout", (req: Request, res: Response) => {
  if (req.session && req.session?.user) {
    req.session.user = undefined;
    req.session.destroy((error) => {
      if (error) {
        throw HttpError(error);
      }
    });
  }

  return res.redirect("/");
});

// POST /
router.post("/", apiKeyAuthenticationMiddleware, async (req: Request, res: Response) => {
  if (!req.body || typeof req.body !== "object") {
    return res.status(400).json({ error: "invalid request body" });
  }

  const { message, details } = req.body;

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "message is required" });
  }

  const { userId, appId } = req.apiKeyPayload ?? {};

  if (!userId || !appId) {
    return res.status(401).json({ error: "invalid api key" });
  }

  try {
    await sendNotification({
      appId: String(appId),
      userId: Number(userId),
      message: message.trim(),
      details: details && typeof details === "object" ? details : {},
    });

    return res.status(200).json({ message: "notification queued" });
  } catch (error) {
    logger.error({ err: error, appId }, "[postNotificationHandler] failed");
    return res.status(500).json({ error: "failed to queue notification" });
  }
});

// GET /settings
router.get(
  "/settings",
  authenticationMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    return res.render("settings-account.html", {
      title: "Settings",
      user: req.session?.user,
      path: "/settings",
      layout: "../layouts/settings.html",
    });
  },
);

// GET /admin
router.get(
  "/admin",
  authenticationMiddleware,
  adminOnlyMiddleware,
  csrfMiddleware,
  async (_req: Request, res: Response) => {
    return res.redirect("/admin/users");
  },
);

// GET /admin/users
router.get(
  "/admin/users",
  authenticationMiddleware,
  adminOnlyMiddleware,
  csrfMiddleware,
  async (_req: Request, res: Response) => {
    const usersRaw = await db.select("*").from("users");

    const users = await Promise.all(
      usersRaw.map(async (user) => {
        const apps = await db.select("*").from("apps").where("user_id", user.id);

        return {
          ...user,
          created_at: formatDate(user.created_at, user.timezone),
          updated_at: formatDate(user.updated_at, user.timezone),
          apps: apps.map((app) => ({
            ...app,
            created_at: formatDate(app.created_at, user.timezone),
            updated_at: formatDate(app.updated_at, user.timezone),
          })),
        };
      }),
    );

    return res.render("admin-users.html", {
      title: "Admin Users",
      users,
      path: "/admin/users",
      layout: "../layouts/admin.html",
    });
  },
);

// POST /admin/users/:id
router.post(
  "/admin/users/:id",
  authenticationMiddleware,
  adminOnlyMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    await db("users")
      .update({
        username: req.body.username,
        email: req.body.email,
        timezone: req.body.timezone,
        max_apps_allowed: parseInt(req.body.max_apps_allowed),
        export_count: parseInt(req.body.export_count),
        max_export_count_allowed: parseInt(req.body.max_export_count_allowed),
      })
      .where({ id: parseInt(req.body.userId) });

    req.flash("info", "🎉 updated!");

    return res.redirect(req.headers["referer"] ?? "back");
  },
);

// POST /admin/users/:uid/apps/:aid
router.post(
  "/admin/users/:uid/apps/:aid",
  authenticationMiddleware,
  adminOnlyMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    await db("apps")
      .update({
        name: req.body.name,
        url: req.body.url,
        description: req.body.description,
        user_monthly_limit_threshold: parseInt(req.body.user_monthly_limit_threshold),
        max_monthly_alerts_allowed: parseInt(req.body.max_monthly_alerts_allowed),
        alerts_sent_this_month: parseInt(req.body.alerts_sent_this_month),
      })
      .where({ id: parseInt(req.body.appId) });

    req.flash("info", "🎉 updated!");

    return res.redirect(req.headers["referer"] ?? "back");
  },
);

// GET /admin/jobs
router.get(
  "/admin/jobs",
  authenticationMiddleware,
  adminOnlyMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    const filter = req.query.filter as string | undefined;
    const userTimezone = req.session?.user?.timezone || "UTC";

    let query = db.select("*").from("jobs").orderBy("created_at", "desc").limit(100);

    if (filter) {
      query = query.where("status", filter);
    }

    const jobs = await query;

    const stats = {
      pending: await db("jobs").where("status", "pending").count("* as count").first(),
      processing: await db("jobs").where("status", "processing").count("* as count").first(),
      completed: await db("jobs").where("status", "completed").count("* as count").first(),
      failed: await db("jobs").where("status", "failed").count("* as count").first(),
    };

    return res.render("admin-jobs.html", {
      title: "Admin Jobs",
      jobs: jobs.map((j: any) => ({
        ...j,
        run_at: j.run_at ? formatDate(j.run_at, userTimezone) : null,
        created_at: formatDate(j.created_at, userTimezone),
        completed_at: j.completed_at ? formatDate(j.completed_at, userTimezone) : null,
      })),
      stats: {
        pending: (stats.pending as any)?.count || 0,
        processing: (stats.processing as any)?.count || 0,
        completed: (stats.completed as any)?.count || 0,
        failed: (stats.failed as any)?.count || 0,
      },
      filter,
      path: "/admin/jobs",
      layout: "../layouts/admin.html",
    });
  },
);

// POST /admin/jobs/:id/retry
router.post(
  "/admin/jobs/:id/retry",
  authenticationMiddleware,
  adminOnlyMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    const jobId = parseInt(req.params.id as string);

    await db("jobs").where({ id: jobId }).update({
      status: "pending",
      attempts: 0,
      error: null,
      run_at: db.fn.now(),
      updated_at: db.fn.now(),
    });

    req.flash("info", "🔄 Job queued for retry");
    return res.redirect("/admin/jobs?filter=pending");
  },
);

// POST /admin/jobs/:id/delete
router.post(
  "/admin/jobs/:id/delete",
  authenticationMiddleware,
  adminOnlyMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    const jobId = parseInt(req.params.id as string);

    await db("jobs").where({ id: jobId }).delete();

    req.flash("info", "🗑️ Job deleted");
    return res.redirect((req.headers["referer"] as string) ?? "/admin/jobs");
  },
);

// GET /settings/account
router.get(
  "/settings/account",
  authenticationMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    return res.render("settings-account.html", {
      title: "Account",
      user: req.session?.user,
      path: "/settings/account",
      layout: "../layouts/settings.html",
    });
  },
);

// GET /settings/data
router.get(
  "/settings/data",
  authenticationMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    return res.render("settings-data.html", {
      title: "Data",
      user: req.session?.user,
      path: "/settings/data",
      layout: "../layouts/settings.html",
    });
  },
);

// POST /settings/data
router.post(
  "/settings/data",
  authenticationMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    const user = req.session?.user as User;

    if (user.export_count >= user.max_export_count_allowed) {
      return res.redirect(
        "/settings/data?toast=‼️ you have reached your limit. try again tomorrow!",
      );
    }

    const apps = await db.select("*").from("apps").where("user_id", user.id);

    if (!apps.length) {
      return res.redirect("/settings/data?toast=🤷 nothing to export!");
    }

    await exportUserData({ userId: user.id as unknown as string });

    return res.redirect("/settings/data?toast=🎉 we will send you an email very shortly");
  },
);

// POST /settings/account
router.post(
  "/settings/account",
  authenticationMiddleware,
  csrfMiddleware,
  validateRequestMiddleware([
    body("username")
      .notEmpty()
      .custom(async (username, { req }) => {
        const userId = req.session?.user?.id;

        const existingUser = await db
          .select("*")
          .from("users")
          .where("username", username)
          .whereNot("id", userId)
          .first();

        if (existingUser) {
          throw ValidationError("Username is already taken");
        }

        return true;
      }),
    body("email")
      .notEmpty()
      .isEmail()
      .custom(async (email, { req }) => {
        const userId = req.session?.user?.id;

        const existingUser = await db
          .select("*")
          .from("users")
          .where("email", email)
          .whereNot("id", userId)
          .first();

        if (existingUser) {
          throw ValidationError("Email is already in use");
        }

        return true;
      }),
  ]),
  async (req: Request, res: Response) => {
    const { email, username, timezone } = req.body;

    await db("users").update({ email, username, timezone }).where({ id: req.session?.user?.id });

    return res.redirect("/settings/account?toast=🔄 updated!");
  },
);

// GET /settings/danger-zone
router.get(
  "/settings/danger-zone",
  authenticationMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    return res.render("settings-danger-zone.html", {
      title: "Danger Zone",
      user: req.session?.user,
      path: "/settings/danger-zone",
      layout: "../layouts/settings.html",
    });
  },
);

// POST /settings/danger-zone/delete
router.post(
  "/settings/danger-zone/delete",
  authenticationMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    const user = req.session?.user;

    await db("users").where({ id: user?.id }).delete();

    await sendGeneralEmail({
      email: user?.email as string,
      subject: "🔔 Notify!",
      username: user?.username as string,
      message: "Sorry to see you go. Let us know if we can help you with anything!",
    });

    if (req.session && req.session?.user) {
      req.session.user = undefined;
      req.session.destroy((error) => {
        if (error) {
          throw HttpError(error);
        }
      });
    }

    return res.redirect("/?toast=🗑️ deleted");
  },
);

// GET /notifications
router.get(
  "/notifications",
  authenticationMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    const filter = req.query.filter as string;
    const perPage = parseInt(req.query.perPage as string) || 10;
    const currentPage = parseInt(req.query.page as string) || 1;
    const userTimezone = req.session?.user?.timezone || "UTC";

    let query = db
      .select(
        "notifications.id",
        "notifications.app_id",
        "apps.name as app_name",
        "notifications.message",
        "notifications.details",
        "notifications.read_at",
        "notifications.created_at",
        "notifications.updated_at",
      )
      .from("notifications")
      .leftJoin("apps", "apps.id", "notifications.app_id")
      .leftJoin("users", "users.id", "apps.user_id")
      .where("users.id", req.session?.user?.id)
      .orderBy("notifications.created_at", "desc");

    if (filter === "unread") {
      query = query.whereNull("notifications.read_at");
    } else if (filter === "read") {
      query = query.whereNotNull("notifications.read_at");
    }

    const { data: notificationsRaw, pagination } = await query.paginate({
      perPage,
      currentPage: currentPage,
      isLengthAware: true,
    });

    const notifications = notificationsRaw.map((n: any) => ({
      ...n,
      read_at: n.read_at ? formatDate(n.read_at, userTimezone) : null,
      created_at: formatDate(n.created_at, userTimezone),
      updated_at: formatDate(n.updated_at, userTimezone),
    }));

    const basePath = "/notifications";

    const queryParams = new URLSearchParams();

    if (filter) {
      queryParams.set("filter", filter);
    }

    const path = `${basePath}?${queryParams.toString()}`;

    return res.render("notifications.html", {
      title: "Notifications",
      notifications,
      pagination,
      path,
      filter,
      layout: "../layouts/auth.html",
    });
  },
);

// POST /notifications/read
router.post(
  "/notifications/read",
  authenticationMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    const uid = req.session?.user?.id;

    await db("notifications")
      .whereIn("app_id", function (query: Knex.QueryBuilder) {
        query.select("id").from("apps").where("user_id", uid);
      })
      .update({ read_at: db.fn.now() });

    return res.redirect(
      `/notifications?toast=${encodeURIComponent(`🎉 marked all notifications as read!`)}`,
    );
  },
);

// GET /apps
router.get(
  "/apps",
  authenticationMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    const filter = req.query.filter as string;
    const page = parseInt(req.query.page as string) || 1;
    const perPage = parseInt(req.query.perPage as string) || 10;

    let query = db
      .select(
        "apps.*",
        db.raw(
          "(SELECT COUNT(*) FROM app_channels WHERE app_channels.app_id = apps.id AND app_channels.is_active = true ) as channel_count",
        ),
        db.raw(
          "(SELECT COUNT(*) FROM notifications WHERE notifications.app_id = apps.id AND notifications.read_at IS NULL) as unread_notification_count",
        ),
      )
      .from("apps")
      .where({ user_id: req.session?.user?.id })
      .orderBy("apps.created_at", "desc");

    if (filter === "active") {
      query = query.where("apps.is_active", true);
    } else if (filter === "inactive") {
      query = query.where("apps.is_active", false);
    }

    const { data: apps, pagination } = await query.paginate({
      perPage,
      currentPage: page,
      isLengthAware: true,
    });

    const basePath = "/apps";

    const queryParams = new URLSearchParams();

    if (filter) {
      queryParams.set("filter", filter);
    }

    const path = `${basePath}?${queryParams.toString()}`;

    return res.render("apps.html", {
      title: "Apps",
      apps,
      filter,
      path,
      pagination,
      layout: "../layouts/auth.html",
    });
  },
);

// POST /apps
router.post(
  "/apps",
  authenticationMiddleware,
  csrfMiddleware,
  validateRequestMiddleware([body("name").trim().notEmpty().withMessage("name is required")]),
  async (req: Request, res: Response) => {
    const { name, is_active, description, url } = req.body;
    const user = req.session?.user;

    const now = dayjs().tz(user?.timezone);
    const alertsResetDate = now.add(1, "month").startOf("month").toDate();

    const [app] = await db("apps")
      .insert({
        user_id: user?.id,
        name,
        url,
        description,
        is_active: is_active === "on",
        alerts_sent_this_month: 0,
        alerts_reset_date: alertsResetDate,
      })
      .returning("*");

    return res.redirect(`/apps/${app.id}?toast=🎉 created`);
  },
);

// GET /apps/create
router.get(
  "/apps/create",
  authenticationMiddleware,
  csrfMiddleware,
  async (_req: Request, res: Response) => {
    return res.render("apps-create.html", {
      title: "App Create",
      layout: "../layouts/auth.html",
      path: "/apps/create",
    });
  },
);

// GET /apps/:id
router.get(
  "/apps/:id",
  authenticationMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    const user = req.session?.user;
    const userTimezone = user?.timezone || "UTC";

    const appRaw = await db
      .select("*")
      .from("apps")
      .where({
        id: req.params.id,
        user_id: user?.id,
      })
      .first();

    if (!appRaw) {
      throw NotFoundError();
    }

    const app = {
      ...appRaw,
      alerts_reset_date: dayjs(appRaw.alerts_reset_date)
        .tz(userTimezone)
        .format("YYYY-MM-DD HH:mm:ss"),
      created_at: dayjs(appRaw.created_at).tz(userTimezone).format("YYYY-MM-DD HH:mm:ss"),
      updated_at: dayjs(appRaw.updated_at).tz(userTimezone).format("YYYY-MM-DD HH:mm:ss"),
    };

    return res.render("apps-id.html", {
      title: "App",
      app,
      layout: "../layouts/app.html",
      path: `/apps/${app.id}`,
    });
  },
);

// GET /apps/:id/edit
router.get(
  "/apps/:id/edit",
  authenticationMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    const app = await db
      .select("*")
      .from("apps")
      .where({ id: req.params.id, user_id: req.session?.user?.id })
      .first();

    return res.render("apps-id-edit.html", {
      title: "App Edit",
      app,
      layout: "../layouts/app.html",
      path: `/apps/${app.id}`,
    });
  },
);

// POST /apps/:id
router.post(
  "/apps/:id",
  authenticationMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    const { name, url, description, user_monthly_limit_threshold } = req.body;

    const id = parseInt(req.params.id as string);

    const is_active = req.body.is_active === "on" ? true : false;

    await db("apps")
      .where({ id, user_id: req.session?.user?.id })
      .update({
        is_active,
        name,
        user_monthly_limit_threshold: parseInt(user_monthly_limit_threshold) || null,
        url,
        description,
        updated_at: db.fn.now(),
      });

    return res.redirect(`/apps/${id}?toast=🔄 updated`);
  },
);

// POST /apps/:id/delete
router.post(
  "/apps/:id/delete",
  authenticationMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    await db("apps").where({ id: req.params.id, user_id: req.session?.user?.id }).del();

    return res.redirect("/apps?toast=🗑️ deleted");
  },
);

// GET /apps/:id/channels
router.get(
  "/apps/:id/channels",
  authenticationMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    const userTimezone = req.session?.user?.timezone || "UTC";

    const appRaw = await db
      .select("*")
      .from("apps")
      .where({ id: req.params.id, user_id: req.session?.user?.id })
      .first();

    if (!appRaw) {
      throw NotFoundError();
    }

    const channelsRaw = await db
      .select("app_channels.*", "channel_types.name as channel_type")
      .from("app_channels")
      .leftJoin("channel_types", "app_channels.channel_type_id", "channel_types.id")
      .where("app_channels.app_id", appRaw.id)
      .orderBy("app_channels.created_at", "desc");

    const channels = await Promise.all(
      channelsRaw.map(async (channel) => {
        let config = null;

        if (channel.channel_type === "email") {
          config = await db("email_configs").where("app_channel_id", channel.id).first();
        } else if (channel.channel_type === "sms") {
          config = await db("sms_configs").where("app_channel_id", channel.id).first();
        } else if (channel.channel_type === "discord") {
          config = await db("discord_configs").where("app_channel_id", channel.id).first();
        }

        return {
          id: channel.id,
          app_id: channel.app_id,
          channel_type: channel.channel_type,
          created_at: formatDate(channel.created_at, userTimezone),
          updated_at: formatDate(channel.updated_at, userTimezone),
          config: config
            ? {
                ...config,
                is_active: channel.is_active,
                created_at: formatDate(config.created_at, userTimezone),
                updated_at: formatDate(config.updated_at, userTimezone),
              }
            : null,
        };
      }),
    );

    const app = {
      ...appRaw,
      created_at: formatDate(appRaw.created_at, userTimezone),
      updated_at: formatDate(appRaw.updated_at, userTimezone),
      channels,
    };

    return res.render("apps-id-channels.html", {
      title: "App Channels",
      app,
      layout: "../layouts/app.html",
      path: `/apps/${app.id}/channels`,
    });
  },
);

// GET /apps/:id/channels/import
router.get(
  "/apps/:id/channels/import",
  authenticationMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    const app = await db
      .select("*")
      .from("apps")
      .where({ id: req.params.id, user_id: req.session?.user?.id })
      .first();

    if (!app) {
      throw NotFoundError();
    }

    return res.render("apps-id-channels-import.html", {
      title: "App Channel Import",
      app,
      layout: "../layouts/app.html",
      path: `/apps/${app.id}/channels`,
    });
  },
);

// POST /apps/:id/channels/import
router.post(
  "/apps/:id/channels/import",
  authenticationMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    const appId = req.params.id;
    const userId = req.session?.user?.id;

    const { config } = req.body;

    const app = await db.select("*").from("apps").where({ id: appId, user_id: userId }).first();

    if (!app) {
      throw NotFoundError();
    }

    const channelsToImport = JSON.parse(config);

    await db.transaction(async (trx) => {
      for (const channel of channelsToImport) {
        const { channel_type_name, config } = channel;

        const channelType = await trx("channel_types").where({ name: channel_type_name }).first();

        if (!channelType) {
          throw new Error(`Invalid channel type: ${channel_type_name}`);
        }

        const [appChannel] = await trx("app_channels")
          .insert({
            app_id: appId,
            channel_type_id: channelType.id,
          })
          .returning("*");

        const encryptedConfig = Object.entries(config).reduce((acc, [key, value]) => {
          if (key !== "name" && typeof value === "string") {
            acc[key] = secret().encrypt(value);
          } else {
            acc[key] = value;
          }
          return acc;
        }, {} as any);

        await trx(`${channel_type_name}_configs`).insert({
          app_channel_id: appChannel.id,
          ...encryptedConfig,
        });
      }
    });

    return res.redirect(`/apps/${app.id}/channels?toast=imported`);
  },
);

// POST /apps/:id/channels/export
router.post(
  "/apps/:id/channels/export",
  authenticationMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    const appId = req.params.id;
    const userId = req.session?.user?.id;

    const channels = await db
      .select("channel_types.name as channel_type_name", "app_channels.id as app_channel_id")
      .from("app_channels")
      .leftJoin("channel_types", "channel_types.id", "app_channels.channel_type_id")
      .leftJoin("apps", "apps.id", "app_channels.app_id")
      .where({ app_id: appId, "apps.user_id": userId });

    if (channels.length === 0) {
      res.redirect(`/apps/${appId}/settings?toast=${encodeURIComponent("there are no configs!")}`);
      return;
    }

    const configs = await Promise.all(
      channels.map(async (channel) => {
        const { channel_type_name, app_channel_id } = channel;
        if (["discord", "sms", "email"].includes(channel_type_name)) {
          const config = await db
            .select("*")
            .from(`${channel_type_name}_configs`)
            .where({ app_channel_id })
            .first();

          if (config) {
            const {
              created_at: _created_at,
              updated_at: _updated_at,
              app_channel_id: _app_channel_id,
              id: _id,
              name,
              ...cleanedConfig
            } = config;

            const decryptedConfig = Object.entries(cleanedConfig).reduce((acc, [key, value]) => {
              if (typeof value === "string") {
                acc[key] = secret().decrypt(value);
              } else {
                acc[key] = value;
              }
              return acc;
            }, {} as any);

            decryptedConfig.name = name;
            return { channel_type_name, config: decryptedConfig };
          }
        }
        return { channel_type_name, app_channel_id };
      }),
    );

    const app = await db.select("name").from("apps").where({ id: appId, user_id: userId }).first();

    const filename = `${app.name.replace(/\s+/g, "-").toLowerCase()}-channels-export.json`;

    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

    res.setHeader("Content-Type", "application/json");

    res.send(JSON.stringify(configs, null, 2));
  },
);

// GET /apps/:id/channels/create
router.get(
  "/apps/:id/channels/create",
  authenticationMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    const app = await db
      .select("*")
      .from("apps")
      .where({ id: req.params.id, user_id: req.session?.user?.id })
      .first();

    if (!app) {
      throw NotFoundError();
    }

    return res.render("apps-id-channels-create.html", {
      title: "App Channels Create",
      app,
      layout: "../layouts/app.html",
      path: `/apps/${app.id}/channels/create`,
    });
  },
);

// POST /apps/:id/channels/discord
router.post(
  "/apps/:id/channels/discord",
  authenticationMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, is_active, webhook_url } = req.body;

    await db.transaction(async (trx) => {
      const channel_type = await trx
        .select("id")
        .from("channel_types")
        .where({ name: "discord" })
        .first();

      const [app_channel] = await trx("app_channels")
        .insert({
          app_id: id,
          channel_type_id: channel_type.id,
          is_active: is_active === "on",
        })
        .returning("*");

      const hashedWebhookUrl = secret().encrypt(webhook_url);

      await trx("discord_configs").insert({
        app_channel_id: app_channel.id,
        webhook_url: hashedWebhookUrl,
        name,
      });
    });

    return res.redirect(`/apps/${id}/channels?toast=🎉 created`);
  },
);

// POST /apps/:id/create-api-key
router.post(
  "/apps/:id/create-api-key",
  authenticationMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const app = await db("apps").where({ id, user_id: req.session?.user?.id }).first();

    if (!app) {
      throw NotFoundError();
    }

    const newKeyVersion = (app.api_key_version || 0) + 1;

    const payload: ApiKeyPayload = {
      appId: app.id,
      userId: app.user_id,
      apiKeyVersion: newKeyVersion,
    };

    const apiKey = jwt.sign(payload, appConfig.apiKeySecret, { expiresIn: "1y" });

    await db("apps").where({ id, user_id: req.session?.user?.id }).update({
      api_key: apiKey,
      api_key_version: newKeyVersion,
      api_key_created_at: db.fn.now(),
    });

    return res.redirect(`/apps/${id}?toast=🎉 created`);
  },
);

// POST /apps/:id/channels/sms
router.post(
  "/apps/:id/channels/sms",
  authenticationMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, is_active, account_sid, auth_token, from_phone_number, phone_number } = req.body;

    await db.transaction(async (trx) => {
      const channel_type = await trx
        .select("id")
        .from("channel_types")
        .where({ name: "sms" })
        .first();

      const [app_channel] = await trx("app_channels")
        .insert({
          app_id: id,
          channel_type_id: channel_type.id,
          is_active: is_active === "on",
        })
        .returning("*");

      await trx("sms_configs").insert({
        app_channel_id: app_channel.id,
        name,
        account_sid: secret().encrypt(account_sid),
        auth_token: secret().encrypt(auth_token),
        from_phone_number: secret().encrypt(from_phone_number),
        phone_number: secret().encrypt(phone_number),
      });
    });

    return res.redirect(`/apps/${id}/channels?toast=🎉 created`);
  },
);

// POST /apps/:id/channels/email
router.post(
  "/apps/:id/channels/email",
  authenticationMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    const { id } = req.params;

    // eslint-disable-next-line prefer-const
    let { name, is_active, host, port, alias, auth_email, auth_pass } = req.body;

    await db.transaction(async (trx) => {
      const channel_type = await trx
        .select("id")
        .from("channel_types")
        .where({ name: "email" })
        .first();

      const [app_channel] = await trx("app_channels")
        .insert({
          app_id: id,
          channel_type_id: channel_type.id,
          is_active: is_active === "on",
        })
        .returning("*");

      host = secret().encrypt(host);
      port = secret().encrypt(port);
      alias = secret().encrypt(alias);
      auth_email = secret().encrypt(auth_email);
      auth_pass = secret().encrypt(auth_pass);

      await trx("email_configs").insert({
        app_channel_id: app_channel.id,
        name,
        host,
        port,
        alias,
        auth_email,
        auth_pass,
      });
    });

    return res.redirect(`/apps/${id}/channels?toast=🎉 created`);
  },
);

// POST /apps/:aid/channels/:cid/delete
router.post(
  "/apps/:aid/channels/:cid/delete",
  authenticationMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    const { aid, cid } = req.params;

    await db("app_channels")
      .where("app_channels.id", cid)
      .andWhere(function () {
        this.whereExists(function () {
          this.select("apps.id")
            .from("apps")
            .where("apps.id", aid)
            .andWhere("apps.user_id", req.session?.user?.id);
        });
      })
      .delete();

    return res.redirect(`/apps/${aid}/channels?toast=🗑️ deleted`);
  },
);

// GET /apps/:id/channels/:cid/configs/:cfid/edit
router.get(
  "/apps/:id/channels/:cid/configs/:cfid/edit",
  authenticationMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    const { id, cid, cfid } = req.params;

    const app = await db
      .select("*")
      .from("apps")
      .where({ id, user_id: req.session?.user?.id })
      .first();

    if (!app) {
      throw NotFoundError();
    }

    const channel = await db("app_channels")
      .select("app_channels.*", "channel_types.name as channel_type_name")
      .leftJoin("channel_types", "app_channels.channel_type_id", "channel_types.id")
      .leftJoin("apps", "apps.id", "app_channels.app_id")
      .where({
        "app_channels.id": cid,
        "app_channels.app_id": id,
        "apps.user_id": req.session?.user?.id,
      })
      .first();

    if (!channel) {
      throw NotFoundError();
    }

    let config = await db
      .select("*")
      .from(`${channel.channel_type_name}_configs`)
      .where({ id: cfid })
      .first();

    if (!config) {
      throw NotFoundError();
    }

    if (channel.channel_type_name === "discord") {
      const webhook_url = secret().decrypt((config as DiscordConfig).webhook_url);
      config = {
        ...config,
        webhook_url,
      } as DiscordConfig;
    }

    if (channel.channel_type_name === "sms") {
      const account_sid = secret().decrypt((config as SmsConfig).account_sid);
      const auth_token = secret().decrypt((config as SmsConfig).auth_token);
      const from_phone_number = secret().decrypt((config as SmsConfig).from_phone_number);
      const phone_number = secret().decrypt((config as SmsConfig).phone_number);
      config = {
        ...config,
        account_sid,
        auth_token,
        from_phone_number,
        phone_number,
      } as SmsConfig;
    }

    if (channel.channel_type_name === "email") {
      const host = secret().decrypt((config as EmailConfig).host);
      const port = secret().decrypt((config as EmailConfig).port);
      const alias = secret().decrypt((config as EmailConfig).alias);
      const auth_email = secret().decrypt((config as EmailConfig).auth_email);
      const auth_pass = secret().decrypt((config as EmailConfig).auth_pass);
      config = {
        ...config,
        host,
        port,
        alias,
        auth_email,
        auth_pass,
      } as DiscordConfig;
    }

    return res.render("apps-id-channels-id-edit.html", {
      title: "App Channel",
      app,
      channel,
      config,
      layout: "../layouts/app.html",
      path: `/apps/${id}/channels/${cid}/edit`,
    });
  },
);

// POST /apps/:id/channels/:cid/configs/:cfid/sms
router.post(
  "/apps/:id/channels/:cid/configs/:cfid/sms",
  authenticationMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    const { id, cfid, cid } = req.params;

    // eslint-disable-next-line prefer-const
    let { name, is_active, account_sid, auth_token, from_phone_number, phone_number } = req.body;

    const app = await db
      .select("*")
      .from("apps")
      .where({ id, user_id: req.session?.user?.id })
      .first();

    if (!app) {
      throw NotFoundError();
    }

    account_sid = secret().encrypt(account_sid);
    auth_token = secret().encrypt(auth_token);
    from_phone_number = secret().encrypt(from_phone_number);
    phone_number = secret().encrypt(phone_number);

    await db.transaction(async (trx) => {
      await trx("sms_configs").where({ id: cfid }).update({
        name,
        account_sid,
        auth_token,
        from_phone_number,
        phone_number,
        updated_at: db.fn.now(),
      });

      await trx("app_channels")
        .where({ id: cid })
        .update({
          is_active: is_active === "on",
          updated_at: trx.fn.now(),
        });
    });

    return res.redirect(`/apps/${id}/channels?toast=🔄 updated`);
  },
);

// POST /apps/:id/channels/:cid/configs/:cfid/discord
router.post(
  "/apps/:id/channels/:cid/configs/:cfid/discord",
  authenticationMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    const { id, cfid, cid } = req.params;
    const { name, is_active, webhook_url } = req.body;

    const app = await db
      .select("*")
      .from("apps")
      .where({ id, user_id: req.session?.user?.id })
      .first();

    if (!app) {
      throw NotFoundError();
    }

    const hashedWebhookUrl = secret().encrypt(webhook_url);

    await db.transaction(async (trx) => {
      await trx("discord_configs").where({ id: cfid }).update({
        webhook_url: hashedWebhookUrl,
        name,
        updated_at: trx.fn.now(),
      });

      await trx("app_channels")
        .where({ id: cid })
        .update({
          is_active: is_active === "on",
          updated_at: trx.fn.now(),
        });
    });

    return res.redirect(`/apps/${id}/channels?toast=🔄 updated`);
  },
);

// POST /apps/:id/channels/:cid/configs/:cfid/email
router.post(
  "/apps/:id/channels/:cid/configs/:cfid/email",
  authenticationMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    const { id, cfid, cid } = req.params;

    // eslint-disable-next-line prefer-const
    let { name, is_active, host, port, alias, auth_email, auth_pass } = req.body;

    const app = await db
      .select("*")
      .from("apps")
      .where({ id, user_id: req.session?.user?.id })
      .first();

    if (!app) {
      throw NotFoundError();
    }

    host = secret().encrypt(host);
    port = secret().encrypt(port);
    alias = secret().encrypt(alias);
    auth_email = secret().encrypt(auth_email);
    auth_pass = secret().encrypt(auth_pass);

    await db.transaction(async (trx) => {
      await trx("email_configs").where({ id: cfid }).update({
        name,
        host,
        port,
        alias,
        auth_email,
        auth_pass,
        updated_at: db.fn.now(),
      });

      await trx("app_channels")
        .where({ id: cid })
        .update({
          is_active: is_active === "on",
          updated_at: trx.fn.now(),
        });
    });

    return res.redirect(`/apps/${id}/channels?toast=🔄 updated`);
  },
);

// GET /apps/:id/notifications
router.get(
  "/apps/:id/notifications",
  authenticationMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    const appId = req.params.id;
    const perPage = parseInt(req.query.perPage as string) || 10;
    const currentPage = parseInt(req.query.page as string) || 1;

    const app = await db
      .select("apps.*")
      .from("apps")
      .where({
        "apps.id": appId,
        user_id: req.session?.user?.id,
      })
      .first();

    if (!app) {
      throw NotFoundError();
    }

    const userTimezone = req.session?.user?.timezone || "UTC";

    const result = await db("notifications")
      .select("*")
      .where("app_id", appId)
      .orderBy("notifications.created_at", "desc")
      .paginate({ perPage, currentPage, isLengthAware: true });

    const notifications = result.data.map((n: any) => ({
      ...n,
      read_at: n.read_at ? formatDate(n.read_at, userTimezone) : null,
      created_at: formatDate(n.created_at, userTimezone),
      updated_at: formatDate(n.updated_at, userTimezone),
    }));

    return res.render("apps-id-notifications.html", {
      title: "App Notifications",
      app: {
        ...app,
        notifications,
      },
      pagination: result.pagination,
      layout: "../layouts/app.html",
      path: `/apps/${appId}/notifications`,
    });
  },
);

// GET /apps/:id/settings
router.get(
  "/apps/:id/settings",
  authenticationMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    const app = await db
      .select("*")
      .from("apps")
      .where({ id: req.params.id, user_id: req.session?.user?.id })
      .first();

    if (!app) {
      throw NotFoundError();
    }

    return res.render("apps-id-settings.html", {
      title: "App Settings",
      app,
      layout: "../layouts/app.html",
      path: `/apps/${app.id}/settings`,
    });
  },
);

// POST /apps/:id/notifications/:nid/delete
router.post(
  "/apps/:id/notifications/:nid/delete",
  authenticationMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    const { id, nid } = req.params;

    await db("notifications")
      .where("notifications.id", nid)
      .andWhere(function () {
        this.whereExists(function () {
          this.select("apps.id")
            .from("apps")
            .where("apps.id", id)
            .andWhere("apps.user_id", req.session?.user?.id);
        });
      })
      .delete();

    req.flash("info", "🗑️ deleted");

    return res.redirect(req.headers["referer"] ?? "back");
  },
);

// POST /apps/:aid/notifications/:nid/read
router.post(
  "/apps/:aid/notifications/:nid/read",
  authenticationMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    const { aid, nid } = req.params;
    const uid = req.session?.user?.id;

    await db("notifications")
      .where("id", nid)
      .andWhere("app_id", function (query: Knex) {
        query.select("id").from("apps").where("id", aid).andWhere("user_id", uid);
      })
      .update({ read_at: db.fn.now() });

    return res.redirect(req.headers["referer"] ?? "back");
  },
);

// POST /apps/:aid/notifications/read
router.post(
  "/apps/:aid/notifications/read",
  authenticationMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    const { aid } = req.params;
    const uid = req.session?.user?.id;

    await db("notifications")
      .andWhere("app_id", function (query: Knex) {
        query.select("id").from("apps").where("id", aid).andWhere("user_id", uid);
      })
      .update({ read_at: db.fn.now() });

    return res.redirect(
      `/apps/${aid}/notifications?toast=${encodeURIComponent(`🎉 marked all as read!`)}`,
    );
  },
);

// POST /apps/:id/notifications/test
router.post(
  "/apps/:id/notifications/test",
  authenticationMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { message, details } = req.body;

    const app = await db
      .select("api_key", "id", "is_active")
      .from("apps")
      .where({ id, user_id: req.session?.user?.id })
      .first();

    if (!app) {
      throw NotFoundError();
    }

    if (app.is_active === false) {
      return res.redirect(`/apps/${id}?toast=🚨 app is not active`);
    }

    if (app.api_key === null) {
      return res.redirect(`/apps/${id}?toast=🚨 please generate an api key first`);
    }

    try {
      await axios.post(
        extractDomain(req),
        {
          message,
          details,
        },
        {
          headers: {
            "Content-Type": "application/json",
            "X-API-KEY": app.api_key,
          },
        },
      );
    } catch (error) {
      const message = ((error as AxiosError).response as any)?.data.message;
      return res.redirect(`/apps/${id}?toast=${message}`);
    }

    return res.redirect(`/apps/${id}?toast=🎉 notification queued successfully`);
  },
);

// POST /settings/data/import
router.post(
  "/settings/data/import",
  authenticationMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    const user = req.session?.user as User;
    const configInput = req.body.config;

    try {
      const parsedConfig = JSON.parse(configInput);

      if (!Array.isArray(parsedConfig)) {
        return res.redirect("/settings/data?toast=‼️ Invalid format - must be an array");
      }

      await db.transaction(async (trx) => {
        for (const appConfig of parsedConfig) {
          // Create the app
          const [app] = await trx("apps")
            .insert({
              user_id: user.id,
              name: appConfig.name,
              url: appConfig.url,
              description: appConfig.description,
              is_active: appConfig.is_active,
            })
            .returning("*");

          // Process each channel config
          for (const channelConfig of appConfig.configs) {
            // Get channel type id
            const channel_type = await trx
              .select("id")
              .from("channel_types")
              .where({ name: channelConfig.channel_type_name })
              .first();

            if (!channel_type) {
              throw new Error(`Invalid channel type: ${channelConfig.channel_type_name}`);
            }

            // Create app channel
            const [app_channel] = await trx("app_channels")
              .insert({
                app_id: app.id,
                channel_type_id: channel_type.id,
                is_active: true,
              })
              .returning("*");

            // Create specific channel config based on type
            switch (channelConfig.channel_type_name) {
              case "email":
                await trx("email_configs").insert({
                  app_channel_id: app_channel.id,
                  name: channelConfig.config.name,
                  host: secret().encrypt(channelConfig.config.host),
                  port: secret().encrypt(channelConfig.config.port),
                  alias: secret().encrypt(channelConfig.config.alias),
                  auth_email: secret().encrypt(channelConfig.config.auth_email),
                  auth_pass: secret().encrypt(channelConfig.config.auth_pass),
                });
                break;

              case "discord":
                await trx("discord_configs").insert({
                  app_channel_id: app_channel.id,
                  name: channelConfig.config.name,
                  webhook_url: secret().encrypt(channelConfig.config.webhook_url),
                });
                break;

              case "sms":
                await trx("sms_configs").insert({
                  app_channel_id: app_channel.id,
                  name: channelConfig.config.name,
                  account_sid: secret().encrypt(channelConfig.config.account_sid),
                  auth_token: secret().encrypt(channelConfig.config.auth_token),
                  from_phone_number: secret().encrypt(channelConfig.config.from_phone_number),
                  phone_number: secret().encrypt(channelConfig.config.phone_number),
                });
                break;
            }
          }
        }
      });

      return res.redirect("/settings/data?toast=🎉 Import successful!");
    } catch (error) {
      return res.redirect("/settings/data?toast=‼️ Import failed: " + (error as Error).message);
    }
  },
);

// GET /login
router.get("/login", (req: Request, res: Response) => {
  if (req.session?.user) {
    return res.redirect("/apps");
  }

  return res.redirect("/oauth/github");
});

// GET /oauth/github
router.get("/oauth/github", async (req: Request, res: Response) => {
  if (req.session?.user) {
    return res.redirect("/apps");
  }

  const rootUrl = "https://github.com/login/oauth/authorize";

  const qs = new URLSearchParams({
    redirect_uri: oauthConfig.github.redirect_uri,
    client_id: oauthConfig.github.client_id,
    scope: "user:email",
  });

  return res.redirect(`${rootUrl}?${qs.toString()}`);
});

// GET /oauth/github/redirect
router.get("/oauth/github/redirect", async (req: Request, res: Response) => {
  const code = req.query.code as string;

  if (!code) {
    throw UnauthorizedError("Something went wrong while authenticating with github");
  }

  const { access_token } = await getGithubOauthToken(code);

  const emails = await getGithubUserEmails(access_token);

  const email = emails.filter((email) => email.primary && email.verified)[0]?.email;

  let foundUser = await db.select("*").from("users").where({ email }).first();

  if (!foundUser) {
    [foundUser] = await db("users")
      .insert({
        username: email?.split("@")[0],
        email,
        is_admin: appConfig.adminEmail === email,
        timezone: "UTC",
      })
      .returning("*");

    req.session.user = foundUser;
    req.session.save();

    await sendGeneralEmail({
      email: foundUser.email,
      subject: "Welcome to 🔔 Notify!",
      username: foundUser.username,
      message: "Thanks for using Notify. Let us know if we can help you with anything!",
    });

    return res.redirect(`/apps?toast=${encodeURIComponent("🎉 enjoy notify!")}`);
  }

  req.session.user = foundUser;
  req.session.save();

  return res.redirect(
    `/apps?toast=${encodeURIComponent(`🙏 welcome back, ${foundUser.username}!`)}`,
  );
});

export { router };
