import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { env, isProduction } from "../config/env.js";
import { User } from "../models/User.js";
import { asyncHandler, ApiError } from "../utils/errors.js";
import {
  clearSessionCookie,
  createSessionToken,
  requireAuth,
  setSessionCookie,
  type AuthRequest
} from "../middleware/auth.js";
import { recordAuditLog } from "../services/auditService.js";
import { buildOidcAuthorizationUrl, completeOidcAuthorization, oidcEnabled } from "../services/oidcService.js";

const router = Router();
const oidcCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: isProduction,
  maxAge: 10 * 60 * 1000,
  path: "/api/auth/oidc"
};

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const user = await User.findOne({ email: input.email.toLowerCase() });
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new ApiError(401, "Invalid email or password");
    }
    await recordAuditLog({
      actor: user as never,
      action: "auth.login",
      targetType: "session",
      metadata: { email: user.email }
    });
    setSessionCookie(res, createSessionToken(user as never));
    res.json({ user: { id: String(user._id), email: user.email, role: user.role } });
  })
);

router.get("/oidc/status", (_req, res) => {
  res.json({ enabled: oidcEnabled() });
});

router.get(
  "/oidc/start",
  asyncHandler(async (_req, res) => {
    if (!oidcEnabled()) throw new ApiError(404, "OIDC is not configured");
    const auth = await buildOidcAuthorizationUrl();
    res.cookie("holmes_oidc_verifier", auth.codeVerifier, oidcCookieOptions);
    res.cookie("holmes_oidc_state", auth.state, oidcCookieOptions);
    res.cookie("holmes_oidc_nonce", auth.nonce, oidcCookieOptions);
    res.redirect(auth.redirectTo.href);
  })
);

router.get(
  "/oidc/callback",
  asyncHandler(async (req, res) => {
    if (!oidcEnabled()) throw new ApiError(404, "OIDC is not configured");
    const codeVerifier = req.cookies?.holmes_oidc_verifier;
    const state = req.cookies?.holmes_oidc_state;
    const nonce = req.cookies?.holmes_oidc_nonce;
    if (!codeVerifier || !state || !nonce) throw new ApiError(400, "OIDC login state is missing");

    const currentUrl = new URL(env.OIDC_REDIRECT_URI!);
    for (const [key, value] of Object.entries(req.query)) {
      if (Array.isArray(value)) currentUrl.searchParams.set(key, String(value[0] ?? ""));
      else if (value !== undefined) currentUrl.searchParams.set(key, String(value));
    }

    const claims = await completeOidcAuthorization(currentUrl, { codeVerifier, state, nonce });
    const sub = claims?.sub;
    const email = typeof claims?.email === "string"
      ? claims.email.toLowerCase()
      : sub
        ? `${sub}@oidc.local`
        : "";
    if (!email) throw new ApiError(400, "OIDC claims did not include an email or subject");

    const user = await User.findOneAndUpdate(
      { email },
      {
        $setOnInsert: {
          email,
          passwordHash: await bcrypt.hash(`${sub ?? email}-${Date.now()}`, 12),
          role: env.OIDC_DEFAULT_ROLE
        }
      },
      { upsert: true, new: true }
    );
    await recordAuditLog({
      actor: user as never,
      action: "auth.oidc_login",
      targetType: "session",
      metadata: { email, issuer: env.OIDC_ISSUER_URL }
    });
    res.clearCookie("holmes_oidc_verifier", { path: "/api/auth/oidc" });
    res.clearCookie("holmes_oidc_state", { path: "/api/auth/oidc" });
    res.clearCookie("holmes_oidc_nonce", { path: "/api/auth/oidc" });
    setSessionCookie(res, createSessionToken(user as never));
    res.redirect("/");
  })
);

router.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get(
  "/me",
  requireAuth,
  asyncHandler<AuthRequest>(async (req, res) => {
    res.json({
      user: req.user
        ? { id: String(req.user._id), email: req.user.email, role: req.user.role }
        : null
    });
  })
);

export default router;
