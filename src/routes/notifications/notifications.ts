import express, { Request, Response } from "express";
import type { Knex } from "knex";
import { db } from "../../db/db";
import { authenticationMiddleware, csrfMiddleware } from "../middleware";
import { formatDate } from "../../utils";

const router = express.Router();

// GET /notifications
router.get("/", authenticationMiddleware, csrfMiddleware, async (req: Request, res: Response) => {
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

  return res.render("notifications/notifications.html", {
    title: "Notifications",
    notifications,
    pagination,
    path,
    filter,
    layout: "_layouts/auth.html",
  });
});

// POST /notifications/read
router.post(
  "/read",
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

export { router as notificationsRouter };
