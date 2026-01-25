import express, { Request, Response } from "express";
import type { Knex } from "knex";
import type { AppContext } from "../../context";
import { createMiddleware } from "../middleware";
import { formatDate } from "../../utils/helpers";

export function createNotificationsRouter(context: AppContext) {
  const router = express.Router();
  const { knex } = context;
  const middleware = createMiddleware(knex, context.logger);

  router.get(
    "/",
    middleware.authenticationMiddleware,
    middleware.csrfMiddleware,
    async (req: Request, res: Response) => {
      const filter = req.query.filter as string;
      const perPage = parseInt(req.query.perPage as string) || 10;
      const currentPage = parseInt(req.query.page as string) || 1;
      const userTimezone = req.session?.user?.timezone || "UTC";

      let query = knex
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
        currentPage,
        isLengthAware: true,
      });

      const notifications = notificationsRaw.map((n: any) => ({
        ...n,
        created_at: formatDate(n.created_at, userTimezone),
      }));

      const queryParams = filter ? `?filter=${filter}` : "";

      return res.render("notifications/notifications.html", {
        title: "Notifications",
        notifications,
        pagination,
        path: `/notifications${queryParams}`,
        filter,
        layout: "_layouts/auth.html",
      });
    },
  );

  router.post(
    "/read",
    middleware.authenticationMiddleware,
    middleware.csrfMiddleware,
    async (req: Request, res: Response) => {
      const uid = req.session?.user?.id;

      await knex("notifications")
        .whereIn("app_id", function (query: Knex.QueryBuilder) {
          query.select("id").from("apps").where("user_id", uid);
        })
        .update({ read_at: knex.fn.now() });

      return res.redirect(
        `/notifications?toast=${encodeURIComponent(`🎉 marked all notifications as read!`)}`,
      );
    },
  );

  return router;
}
