import express, { Request, Response } from "express";
import type { AppContext } from "../../context";
import { appConfig, oauthConfig } from "../../config";
import { getGithubOauthToken, getGithubUserEmails } from "../../utils";
import { UnauthorizedError } from "../../error";

export function createAuthRouter(context: AppContext) {
  const router = express.Router();
  const { knex, logger } = context;

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

    const { access_token } = await getGithubOauthToken(code, logger);

    const emails = await getGithubUserEmails(access_token, logger);

    const email = emails.filter((email) => email.primary && email.verified)[0]?.email;

    let foundUser = await knex.select("*").from("users").where({ email }).first();

    if (!foundUser) {
      [foundUser] = await knex("users")
        .insert({
          username: email?.split("@")[0],
          email,
          is_admin: appConfig.adminEmail === email,
          timezone: "UTC",
        })
        .returning("*");

      req.session.user = foundUser;
      req.session.save();

      await context.mail.sendGeneralEmail({
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

  return router;
}
