import { Request, Response, NextFunction } from "express";
import { SessionManager } from "./sessions";
import { Platform } from "../types";
import { log } from "../utils/logger";
import { FIFTEEN_MINUTES } from "../utils/constants";

export const authenticateUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const sessionId = authHeader.substring(7);
    const session = await SessionManager.validateSession(sessionId);

    if (!session) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }

    req.user = {
      id: session.userId,
      username: session.username,
      platform: session.platform,
      platformUserId: session.platformUserId,
      isAdmin: session.isAdmin,
    };

    next();
  } catch (error) {
    log.error("Auth error:", { error });
    return res.status(401).json({ error: "Authentication failed" });
  }
};

export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

export const requirePlatform = (platform: Platform) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (req.user.platform !== platform) {
      return res.status(403).json({
        error: `This endpoint requires ${platform} authentication`,
      });
    }

    next();
  };
};

export const authRateLimit = {
  windowMs: FIFTEEN_MINUTES,
  max: 10,
  message: {
    error: "Too many authentication attempts, please try again later",
  },
};
