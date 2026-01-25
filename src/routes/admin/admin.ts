import express, { Request, Response } from "express";
import { db } from "../../db/db";
import { authenticationMiddleware, adminOnlyMiddleware, csrfMiddleware } from "../middleware";
import { formatDate } from "../../utils";

const router = express.Router();

// GET /admin
router.get("/", authenticationMiddleware, adminOnlyMiddleware, csrfMiddleware, async (_req: Request, res: Response) => {
  return res.redirect("/admin/users");
});

// GET /admin/users
router.get("/users", authenticationMiddleware, adminOnlyMiddleware, csrfMiddleware, async (_req: Request, res: Response) => {
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
});

// POST /admin/users/:id
router.post("/users/:id", authenticationMiddleware, adminOnlyMiddleware, csrfMiddleware, async (req: Request, res: Response) => {
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
});

// POST /admin/users/:uid/apps/:aid
router.post("/users/:uid/apps/:aid", authenticationMiddleware, adminOnlyMiddleware, csrfMiddleware, async (req: Request, res: Response) => {
  await db("apps")
    .update({
      name: req.body.name,
      url: req.body.url,
      description: req.body.description,
    })
    .where({ id: parseInt(req.body.appId) });

  req.flash("info", "🎉 updated!");

  return res.redirect(req.headers["referer"] ?? "back");
});

// GET /admin/jobs
router.get("/jobs", authenticationMiddleware, adminOnlyMiddleware, csrfMiddleware, async (req: Request, res: Response) => {
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

  return res.render("admin/jobs.html", {
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
    layout: "_layouts/admin.html",
  });
});

// POST /admin/jobs/:id/retry
router.post("/jobs/:id/retry", authenticationMiddleware, adminOnlyMiddleware, csrfMiddleware, async (req: Request, res: Response) => {
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
});

// POST /admin/jobs/:id/delete
router.post("/jobs/:id/delete", authenticationMiddleware, adminOnlyMiddleware, csrfMiddleware, async (req: Request, res: Response) => {
  const jobId = parseInt(req.params.id as string);

  await db("jobs").where({ id: jobId }).delete();

  req.flash("info", "🗑️ Job deleted");
  return res.redirect((req.headers["referer"] as string) ?? "/admin/jobs");
});

export { router as adminRouter };
