import express, { Request, Response } from "express";
import { db } from "../../db/db";
import { authenticationMiddleware, adminOnlyMiddleware, csrfMiddleware } from "../middleware";
import { formatDate } from "../../utils";

const router = express.Router();

router.get(
  "/",
  authenticationMiddleware,
  adminOnlyMiddleware,
  csrfMiddleware,
  async (_req: Request, res: Response) => {
    return res.redirect("/admin/users");
  },
);

router.get(
  "/users",
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

    return res.render("admin/users.html", {
      title: "Admin Users",
      users,
      path: "/admin/users",
      layout: "_layouts/admin.html",
    });
  },
);

router.post(
  "/users/:id",
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
      })
      .where({ id: parseInt(req.body.userId) });

    req.flash("info", "🎉 updated!");

    return res.redirect(req.headers["referer"] ?? "back");
  },
);

router.post(
  "/users/:uid/apps/:aid",
  authenticationMiddleware,
  adminOnlyMiddleware,
  csrfMiddleware,
  async (req: Request, res: Response) => {
    await db("apps")
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

export { router as adminRouter };
