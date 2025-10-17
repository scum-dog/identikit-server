import axios from "axios";
import crypto from "crypto";
import { AuthError, ConfigError } from "./base";
import {
  OAuthProvider,
  AuthUrlResult,
  NewgroundsUser,
  NewgroundsAuthResponse,
  NewgroundsOAuthParams,
} from "../types";
import { SessionManager } from "./sessions";
import { userQueries } from "../database";

const NEWGROUNDS_API_BASE = "https://newgrounds.io/gateway_v3.php";

export class NewgroundsOAuth implements OAuthProvider<NewgroundsUser> {
  public readonly platform = "newgrounds" as const;

  generateAuthUrl(): AuthUrlResult {
    const appId = process.env.NEWGROUNDS_APP_ID;
    const redirectUri = process.env.NEWGROUNDS_REDIRECT_URI;

    if (!appId || !redirectUri) {
      throw new ConfigError(
        "Newgrounds OAuth not configured - missing NEWGROUNDS_APP_ID or NEWGROUNDS_REDIRECT_URI",
        this.platform,
      );
    }

    const state = crypto.randomBytes(32).toString("hex");

    const oauthParams: NewgroundsOAuthParams = {
      app_id: appId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "user.read",
      state,
    };

    const params = new URLSearchParams(oauthParams);

    return {
      authUrl: `https://newgrounds.io/oauth/authorize?${params.toString()}`,
      state,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    };
  }

  async authenticateWithCode(
    code: string,
    _state?: string,
    _codeVerifier?: string,
  ): Promise<{ sessionId: string; user: NewgroundsUser }> {
    const appId = process.env.NEWGROUNDS_APP_ID;
    const encryptionKey = process.env.NEWGROUNDS_ENCRYPTION_KEY;

    if (!appId || !encryptionKey) {
      throw new ConfigError("Newgrounds API not configured", this.platform);
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
        throw new AuthError(
          data.error?.message || "Failed to authenticate with Newgrounds",
          this.platform,
        );
      }

      const newgroundsUser: NewgroundsUser = {
        ...data.result.user,
        username: data.result.user.name,
      };

      const user = await this.createOrUpdateUser(newgroundsUser);

      const sessionId = await SessionManager.createSession({
        userId: user.id,
        platform: "newgrounds",
        platformUserId: newgroundsUser.id.toString(),
        username: newgroundsUser.username,
        isAdmin: user.is_admin,
      });

      return { sessionId, user: newgroundsUser };
    } catch (error) {
      console.error("Newgrounds auth error:", error);
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError(
        "Failed to authenticate with Newgrounds",
        this.platform,
      );
    }
  }

  async validateSession(sessionId: string): Promise<NewgroundsUser | null> {
    try {
      const session = await SessionManager.validateSession(sessionId);
      if (!session || session.platform !== "newgrounds") {
        return null;
      }

      const appId = process.env.NEWGROUNDS_APP_ID;
      if (!appId) {
        throw new ConfigError("Newgrounds API not configured", this.platform);
      }

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
        return null;
      }

      return {
        ...data.result.user,
        username: data.result.user.name,
      };
    } catch (error) {
      console.error("Newgrounds session validation error:", error);
      return null;
    }
  }

  private async createOrUpdateUser(newgroundsUser: NewgroundsUser) {
    let user = await userQueries.findByPlatformId(
      "newgrounds",
      newgroundsUser.id.toString(),
    );

    if (!user) {
      user = await userQueries.create(
        "newgrounds",
        newgroundsUser.id.toString(),
        newgroundsUser.username,
        undefined,
      );
    } else {
      await userQueries.updateLastLogin(user.id);
    }

    return user;
  }
}

export const newgroundsAuth = new NewgroundsOAuth();
