import express, { Request, Response } from "express";
import type { Knex } from "knex";
import jwt from "jsonwebtoken";
import { body } from "express-validator";
import { db } from "../../db/db";
import { appConfig } from "../../config";
import { authenticationMiddleware, csrfMiddleware, validateRequestMiddleware } from "../middleware";
import { secret, extractDomain, formatDate, formatDatetime } from "../../utils";
import { NotFoundError } from "../../error";
import { ApiKeyPayload, DiscordConfig, EmailConfig, SmsConfig } from "../../types";
import { logger } from "../../logger";

const router = express.Router();

router.get("/", authenticationMiddleware, csrfMiddleware, async (req: Request, res: Response) => {
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

  return res.render("apps/list.html", {
    title: "Apps",
    apps,
    filter,
    path,
    pagination,
    layout: "_layouts/auth.html",
  });
});

router.post(
  "/",
  authenticationMiddleware,
  csrfMiddleware,
  validateRequestMiddleware([body("name").trim().notEmpty().withMessage("name is required")]),
  async (req: Request, res: Response) => {
    const { name, is_active, description, url } = req.body;
    const user = req.session?.user;

    const [app] = await db("apps")
      .insert({
        user_id: user?.id,
        name,
        url,
        description,
        is_active: is_active === "on",
      })
      .returning("*");

    return res.redirect(`/apps/${app.id}?toast=🎉 created`);
  },
);

router.get(
  "/create",
  authenticationMiddleware,
  csrfMiddleware,
  async (_req: Request, res: Response) => {
    return res.render("apps/create.html", {
      title: "App Create",
      layout: "_layouts/auth.html",
      path: "/apps/create",
    });
  },
);

router.get(
  "/:id",
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
      created_at: formatDatetime(new Date(appRaw.created_at), userTimezone),
      updated_at: formatDatetime(new Date(appRaw.updated_at), userTimezone),
    };

    return res.render("apps/detail.html", {
      title: "App",
      app,
      layout: "_layouts/app.html",
      path: `/apps/${app.id}`,
    });
  },
);

router.get(
  "/:id/edit",
  authenticationMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    const app = await db
      .select("*")
      .from("apps")
      .where({ id: req.params.id, user_id: req.session?.user?.id })
      .first();

    return res.render("apps/edit.html", {
      title: "App Edit",
      app,
      layout: "_layouts/app.html",
      path: `/apps/${app.id}`,
    });
  },
);

router.post(
  "/:id",
  authenticationMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    const { name, url, description } = req.body;

    const id = parseInt(req.params.id as string);

    const is_active = req.body.is_active === "on" ? true : false;

    await db("apps").where({ id, user_id: req.session?.user?.id }).update({
      is_active,
      name,
      url,
      description,
      updated_at: db.fn.now(),
    });

    return res.redirect(`/apps/${id}?toast=🔄 updated`);
  },
);

router.post(
  "/:id/delete",
  authenticationMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    await db("apps").where({ id: req.params.id, user_id: req.session?.user?.id }).del();

    return res.redirect("/apps?toast=🗑️ deleted");
  },
);

router.post(
  "/:id/create-api-key",
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

router.get(
  "/:id/channels",
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

    return res.render("apps/channels.html", {
      title: "App Channels",
      app,
      layout: "_layouts/app.html",
      path: `/apps/${app.id}/channels`,
    });
  },
);

router.get(
  "/:id/channels/create",
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

    return res.render("apps/channel-create.html", {
      title: "App Channels Create",
      app,
      layout: "_layouts/app.html",
      path: `/apps/${app.id}/channels/create`,
    });
  },
);

router.get(
  "/:id/channels/import",
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

    return res.render("apps/channel-import.html", {
      title: "App Channel Import",
      app,
      layout: "_layouts/app.html",
      path: `/apps/${app.id}/channels`,
    });
  },
);

router.post(
  "/:id/channels/import",
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

router.post(
  "/:id/channels/export",
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

router.post(
  "/:id/channels/discord",
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

router.post(
  "/:id/channels/sms",
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

router.post(
  "/:id/channels/email",
  authenticationMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const { name, is_active, host, port, alias, auth_email, auth_pass } = req.body;

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

      await trx("email_configs").insert({
        app_channel_id: app_channel.id,
        name,
        host: secret().encrypt(host),
        port: secret().encrypt(port),
        alias: secret().encrypt(alias),
        auth_email: secret().encrypt(auth_email),
        auth_pass: secret().encrypt(auth_pass),
      });
    });

    return res.redirect(`/apps/${id}/channels?toast=🎉 created`);
  },
);

router.post(
  "/:aid/channels/:cid/delete",
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

router.get(
  "/:id/channels/:cid/configs/:cfid/edit",
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

    return res.render("apps/channel-edit.html", {
      title: "App Channel",
      app,
      channel,
      config,
      layout: "_layouts/app.html",
      path: `/apps/${id}/channels/${cid}/edit`,
    });
  },
);

router.post(
  "/:id/channels/:cid/configs/:cfid/sms",
  authenticationMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    const { id, cfid, cid } = req.params;

    const { name, is_active, account_sid, auth_token, from_phone_number, phone_number } = req.body;

    const app = await db
      .select("*")
      .from("apps")
      .where({ id, user_id: req.session?.user?.id })
      .first();

    if (!app) {
      throw NotFoundError();
    }

    await db.transaction(async (trx) => {
      await trx("sms_configs")
        .where({ id: cfid })
        .update({
          name,
          account_sid: secret().encrypt(account_sid),
          auth_token: secret().encrypt(auth_token),
          from_phone_number: secret().encrypt(from_phone_number),
          phone_number: secret().encrypt(phone_number),
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

router.post(
  "/:id/channels/:cid/configs/:cfid/discord",
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

router.post(
  "/:id/channels/:cid/configs/:cfid/email",
  authenticationMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    const { id, cfid, cid } = req.params;

    const { name, is_active, host, port, alias, auth_email, auth_pass } = req.body;

    const app = await db
      .select("*")
      .from("apps")
      .where({ id, user_id: req.session?.user?.id })
      .first();

    if (!app) {
      throw NotFoundError();
    }

    await db.transaction(async (trx) => {
      await trx("email_configs")
        .where({ id: cfid })
        .update({
          name,
          host: secret().encrypt(host),
          port: secret().encrypt(port),
          alias: secret().encrypt(alias),
          auth_email: secret().encrypt(auth_email),
          auth_pass: secret().encrypt(auth_pass),
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

router.get(
  "/:id/notifications",
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

    return res.render("apps/notifications.html", {
      title: "App Notifications",
      app: {
        ...app,
        notifications,
      },
      pagination: result.pagination,
      layout: "_layouts/app.html",
      path: `/apps/${appId}/notifications`,
    });
  },
);

router.get(
  "/:id/settings",
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

    return res.render("apps/settings.html", {
      title: "App Settings",
      app,
      layout: "_layouts/app.html",
      path: `/apps/${app.id}/settings`,
    });
  },
);

router.post(
  "/:id/notifications/:nid/delete",
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

router.post(
  "/:aid/notifications/:nid/read",
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

router.post(
  "/:aid/notifications/read",
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

router.post(
  "/:id/notifications/test",
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
      const response = await fetch(extractDomain(req), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": app.api_key,
        },
        body: JSON.stringify({ message, details }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { message?: string; error?: string };
        return res.redirect(`/apps/${id}?toast=${data.message || data.error}`);
      }
    } catch (err) {
      logger.error("[testNotification] failed", err);
      return res.redirect(`/apps/${id}?toast=failed to send notification`);
    }

    return res.redirect(`/apps/${id}?toast=🎉 notification queued successfully`);
  },
);

export { router as appsRouter };
