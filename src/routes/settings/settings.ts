import express, { Request, Response } from "express";
import { body } from "express-validator";
import { db } from "../../db/db";
import { authenticationMiddleware, csrfMiddleware, validateRequestMiddleware } from "../middleware";
import { secret, sendGeneralEmail } from "../../utils";
import { HttpError, ValidationError } from "../../error";
import { User } from "../../types";

const router = express.Router();

// GET /settings
router.get("/", authenticationMiddleware, csrfMiddleware, async (req: Request, res: Response) => {
  return res.render("settings/account.html", {
    title: "Settings",
    user: req.session?.user,
    path: "/settings",
    layout: "_layouts/settings.html",
  });
});

// GET /settings/account
router.get(
  "/account",
  authenticationMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    return res.render("settings/account.html", {
      title: "Account",
      user: req.session?.user,
      path: "/settings/account",
      layout: "_layouts/settings.html",
    });
  },
);

// POST /settings/account
router.post(
  "/account",
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

// GET /settings/data
router.get(
  "/data",
  authenticationMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    return res.render("settings/data.html", {
      title: "Data",
      user: req.session?.user,
      path: "/settings/data",
      layout: "_layouts/settings.html",
    });
  },
);

// POST /settings/data
router.post(
  "/data",
  authenticationMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    const user = req.session?.user as User;

    const apps = await db.select("*").from("apps").where("user_id", user.id);

    if (!apps.length) {
      res.redirect("/settings/data?toast=🤷 nothing to export!");
      return;
    }

    const result = [];

    for (const app of apps) {
      const channels = await db
        .select("channel_types.name as channel_type_name", "app_channels.id as app_channel_id")
        .from("app_channels")
        .leftJoin("channel_types", "channel_types.id", "app_channels.channel_type_id")
        .leftJoin("apps", "apps.id", "app_channels.app_id")
        .where({ app_id: app.id, "apps.user_id": app.user_id });

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
                created_at: _ca,
                updated_at: _ua,
                app_channel_id: _aci,
                id: _id,
                name,
                ...cleanedConfig
              } = config;

              const decryptedConfig = Object.entries(cleanedConfig).reduce(
                (acc, [key, value]) => {
                  if (typeof value === "string") {
                    acc[key] = secret().decrypt(value);
                  } else {
                    acc[key] = value;
                  }
                  return acc;
                },
                {} as Record<string, unknown>,
              );

              decryptedConfig.name = name;

              return { channel_type_name, config: decryptedConfig };
            }
          }

          return { channel_type_name, app_channel_id };
        }),
      );

      result.push({
        name: app.name,
        url: app.url,
        description: app.description,
        is_active: app.is_active,
        configs,
      });
    }

    const filename = `notify-export-${user.username}-${Date.now()}.json`;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(JSON.stringify(result, null, 2));
  },
);

// POST /settings/data/import
router.post(
  "/data/import",
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
          const [app] = await trx("apps")
            .insert({
              user_id: user.id,
              name: appConfig.name,
              url: appConfig.url,
              description: appConfig.description,
              is_active: appConfig.is_active,
            })
            .returning("*");

          for (const channelConfig of appConfig.configs) {
            const channel_type = await trx
              .select("id")
              .from("channel_types")
              .where({ name: channelConfig.channel_type_name })
              .first();

            if (!channel_type) {
              throw new Error(`Invalid channel type: ${channelConfig.channel_type_name}`);
            }

            const [app_channel] = await trx("app_channels")
              .insert({
                app_id: app.id,
                channel_type_id: channel_type.id,
                is_active: true,
              })
              .returning("*");

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

// GET /settings/danger-zone
router.get(
  "/danger-zone",
  authenticationMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    return res.render("settings/danger-zone.html", {
      title: "Danger Zone",
      user: req.session?.user,
      path: "/settings/danger-zone",
      layout: "_layouts/settings.html",
    });
  },
);

// POST /settings/danger-zone/delete
router.post(
  "/danger-zone/delete",
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

export { router as settingsRouter };
