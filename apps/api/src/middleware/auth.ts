import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env, isProduction } from "../config/env.js";
import { User, type UserDoc } from "../models/User.js";
import { ApiError } from "../utils/errors.js";

const cookieName = "holmes_ui_session";

export interface AuthRequest extends Request {
  user?: UserDoc & { _id: unknown };
}

export function createSessionToken(user: UserDoc & { _id: unknown }) {
  return jwt.sign({ sub: String(user._id), role: user.role }, env.APP_SECRET, {
    expiresIn: "7d"
  });
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/"
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(cookieName, { path: "/" });
}

export async function requireAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const token = req.cookies?.[cookieName];
  if (!token) return next(new ApiError(401, "Authentication required"));

  try {
    const payload = jwt.verify(token, env.APP_SECRET) as { sub: string };
    const user = await User.findById(payload.sub);
    if (!user) return next(new ApiError(401, "Authentication required"));
    req.user = user as UserDoc & { _id: unknown };
    return next();
  } catch {
    return next(new ApiError(401, "Authentication required"));
  }
}
