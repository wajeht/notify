import express, { Request, Response } from "express";
import { db } from "../../db/db";
import { appConfig, oauthConfig } from "../../config";
import { getGithubOauthToken, getGithubUserEmails, sendGeneralEmail } from "../../utils";
import { UnauthorizedError } from "../../error";

const router = express.Router();

router.get("/login", (req: Request, res: Response) => {
  if (req.session?.user) {
    return res.redirect("/apps");
  }

  return res.redirect("/oauth/github");
});

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

export { router as authRouter };
