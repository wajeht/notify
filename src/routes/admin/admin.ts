import express, { Request, Response } from "express";
import type { AppContext } from "../../context";
import { createMiddleware } from "../middleware";
import { formatDate } from "../../utils/helpers";

export function createAdminRouter(context: AppContext) {
  const router = express.Router();
  const { knex } = context;
  const middleware = createMiddleware(knex, context.logger);

  router.get(
    "/",
    middleware.authenticationMiddleware,
    middleware.adminOnlyMiddleware,
    middleware.csrfMiddleware,
    async (_req: Request, res: Response) => {
      return res.redirect("/admin/users");
    },
  );

  router.get(
    "/users",
    middleware.authenticationMiddleware,
    middleware.adminOnlyMiddleware,
    middleware.csrfMiddleware,
    async (_req: Request, res: Response) => {
      const rows = await knex
        .select(
          "users.id",
          "users.username",
          "users.email",
          "users.timezone",
          "users.is_admin",
          "users.max_apps_allowed",
          "users.created_at",
          "users.updated_at",
          "apps.id as app_id",
          "apps.name as app_name",
          "apps.url as app_url",
          "apps.description as app_description",
          "apps.created_at as app_created_at",
          "apps.updated_at as app_updated_at",
        )
        .from("users")
        .leftJoin("apps", "apps.user_id", "users.id")
        .orderBy("users.id");

      const usersMap = new Map<number, any>();
      for (const row of rows) {
        if (!usersMap.has(row.id)) {
          usersMap.set(row.id, {
            id: row.id,
            username: row.username,
            email: row.email,
            timezone: row.timezone,
            is_admin: row.is_admin,
            max_apps_allowed: row.max_apps_allowed,
            created_at: formatDate(row.created_at, row.timezone),
            updated_at: formatDate(row.updated_at, row.timezone),
            apps: [],
          });
        }
        if (row.app_id) {
          usersMap.get(row.id).apps.push({
            id: row.app_id,
            name: row.app_name,
            url: row.app_url,
            description: row.app_description,
            created_at: formatDate(row.app_created_at, row.timezone),
            updated_at: formatDate(row.app_updated_at, row.timezone),
          });
        }
      }

      return res.render("admin/users.html", {
        title: "Admin Users",
        users: Array.from(usersMap.values()),
        path: "/admin/users",
        layout: "_layouts/admin.html",
      });
    },
  );

  router.post(
    "/users/:id",
    middleware.authenticationMiddleware,
    middleware.adminOnlyMiddleware,
    middleware.csrfMiddleware,
    async (req: Request, res: Response) => {
      await knex("users")
        .update({
          username: req.body.username,
          email: req.body.email,
          timezone: req.body.timezone,
          max_apps_allowed: parseInt(req.body.max_apps_allowed),
        })
        .where({ id: parseInt(req.body.userId) });

      req.flash("info", "🎉 updated!");

      return res.redirect(req.headers["referer"] ?? "back");
    },
  );

  router.post(
    "/users/:uid/apps/:aid",
    middleware.authenticationMiddleware,
    middleware.adminOnlyMiddleware,
    middleware.csrfMiddleware,
    async (req: Request, res: Response) => {
      await knex("apps")
        .update({
          name: req.body.name,
          url: req.body.url,
          description: req.body.description,
        })
        .where({ id: parseInt(req.body.appId) });

      req.flash("info", "🎉 updated!");

      return res.redirect(req.headers["referer"] ?? "back");
    },
  );

  return router;
}
