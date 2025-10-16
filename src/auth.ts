import axios from "axios";
import { Request, Response, NextFunction } from "express";
import { userQueries } from "./database";

const NEWGROUNDS_API_BASE = "https://newgrounds.io/gateway_v3.php";

interface NewgroundsUser {
  id: number;
  name: string;
  supporter: boolean;
}

interface NewgroundsAuthResponse {
  success: boolean;
  result?: {
    user: NewgroundsUser;
  };
  error?: {
    message: string;
  };
}

// newgrounds OAuth
export const newgroundsAuth = {
  getAuthUrl: (state?: string) => {
    const appId = process.env.NEWGROUNDS_APP_ID;
    const redirectUri = process.env.NEWGROUNDS_REDIRECT_URI;

    if (!appId || !redirectUri) {
      throw new Error("Newgrounds OAuth not configured");
    }

    const params = new URLSearchParams({
      app_id: appId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "user.read",
    });

    if (state) {
      params.append("state", state);
    }

    return `https://newgrounds.io/oauth/authorize?${params.toString()}`;
  },

  // exchange auth code for access token & user info
  exchangeCode: async (code: string): Promise<NewgroundsUser> => {
    const appId = process.env.NEWGROUNDS_APP_ID;
    const encryptionKey = process.env.NEWGROUNDS_ENCRYPTION_KEY;

    if (!appId || !encryptionKey) {
      throw new Error("Newgrounds API not configured");
    }

    try {
      const response = await axios.post(NEWGROUNDS_API_BASE, {
        app_id: appId,
        session_id: code,
        call: {
          component: "App.checkSession",
          parameters: {},
        },
      });

      const data: NewgroundsAuthResponse = response.data;

      if (!data.success || !data.result?.user) {
        throw new Error(
          data.error?.message || "Failed to authenticate with Newgrounds",
        );
      }

      return data.result.user;
    } catch (error) {
      console.error("Newgrounds auth error:", error);
      throw new Error("Failed to authenticate with Newgrounds");
    }
  },

  // complete auth and return session info
  authenticateWithCode: async (
    code: string,
  ): Promise<{ sessionId: string; user: NewgroundsUser }> => {
    const user = await newgroundsAuth.exchangeCode(code);
    return {
      sessionId: code,
      user: user,
    };
  },

  // get user info from existing session
  getUserInfo: async (sessionId: string): Promise<NewgroundsUser> => {
    const appId = process.env.NEWGROUNDS_APP_ID;

    if (!appId) {
      throw new Error("Newgrounds API not configured");
    }

    try {
      const response = await axios.post(NEWGROUNDS_API_BASE, {
        app_id: appId,
        session_id: sessionId,
        call: {
          component: "App.getCurrentUser",
          parameters: {},
        },
      });

      const data: NewgroundsAuthResponse = response.data;

      if (!data.success || !data.result?.user) {
        throw new Error("Invalid session");
      }

      return data.result.user;
    } catch (error) {
      console.error("Get user info error:", error);
      throw new Error("Failed to get user info");
    }
  },
};

export const authenticateUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No valid authorization header" });
    }

    const sessionId = authHeader.substring(7); // remove 'Bearer '

    // verify session w/ newgrounds
    const ngUser = await newgroundsAuth.getUserInfo(sessionId);

    // find or create user in our database
    let user = await userQueries.findByPlatformId(
      "newgrounds",
      ngUser.id.toString(),
    );

    if (!user) {
      user = await userQueries.create(
        "newgrounds",
        ngUser.id.toString(),
        ngUser.name,
      );
    } else {
      await userQueries.updateLastLogin(user.id);
    }

    req.user = {
      id: user.id,
      username: user.username,
      platform: user.platform,
      platformUserId: user.platform_user_id,
      isAdmin: user.is_admin,
    };

    next();
  } catch (error) {
    console.error("Authentication error:", error);
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

export const authRateLimit = {
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: "Too many authentication attempts, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
};

// extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        platform: string;
        platformUserId: string;
        isAdmin: boolean;
      };
    }
  }
}
