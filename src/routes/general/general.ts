import express, { Request, Response } from "express";
import { HttpError } from "../../error";

const router = express.Router();

// GET /
router.get("/", (req: Request, res: Response) => {
  if (req.session?.user) {
    res.redirect("/apps");
    return;
  }

  res.render("general/home.html", {
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
  res.render("general/terms-of-service.html", {
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

export { router as generalRouter };
