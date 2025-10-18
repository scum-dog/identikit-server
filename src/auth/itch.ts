import axios from "axios";
import crypto from "crypto";
import { AuthError } from "./base";
import {
  OAuthProvider,
  AuthUrlResult,
  ItchUser,
  ItchAuthResponse,
  ItchOAuthParams,
} from "../types";
import { SessionManager } from "./sessions";
import { userQueries } from "../database";

export class ItchOAuth implements OAuthProvider<ItchUser> {
  public readonly platform = "itchio" as const;

  generateAuthUrl(): AuthUrlResult {
    const clientId = process.env.ITCH_IO_CLIENT_ID!;
    const redirectUri = process.env.ITCH_IO_REDIRECT_URI!;

    const state = crypto.randomBytes(32).toString("hex");

    const oauthParams: ItchOAuthParams = {
      client_id: clientId,
      scope: "profile:me",
      redirect_uri: redirectUri,
      response_type: "token",
      state,
    };

    const params = new URLSearchParams(oauthParams);

    return {
      authUrl: `https://itch.io/user/oauth?${params.toString()}`,
      state,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    };
  }

  // "code" is actually the access token from implicit flow
  async authenticateWithCode(
    accessToken: string,
    _state?: string,
    _codeVerifier?: string,
  ): Promise<{ sessionId: string; user: ItchUser }> {
    if (!accessToken) {
      throw new AuthError("Access token is required", this.platform);
    }

    try {
      const response = await axios.get(
        `https://itch.io/api/1/${accessToken}/me`,
      );
      const data: ItchAuthResponse = response.data;

      if (!data.user) {
        throw new AuthError(
          "Failed to get user info from Itch.io",
          this.platform,
        );
      }

      const itchUser = data.user;
      const user = await this.createOrUpdateUser(itchUser);

      const sessionId = await SessionManager.createSession({
        userId: user.id,
        platform: "itchio",
        platformUserId: itchUser.id.toString(),
        username: itchUser.username,
        isAdmin: user.is_admin,
      });

      return { sessionId, user: itchUser };
    } catch (error) {
      console.error("Itch.io token verification error:", error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        throw new AuthError("Invalid or expired access token", this.platform);
      }
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError("Failed to verify token with Itch.io", this.platform);
    }
  }

  async validateSession(sessionId: string): Promise<ItchUser | null> {
    try {
      const session = await SessionManager.validateSession(sessionId);
      if (!session || session.platform !== "itchio") {
        return null;
      }

      // we need the access token to validate, but sessions don't store tokens
      // so again, we'll trust the session if it exists and hasn't expired
      const user = await userQueries.findByPlatformId(
        "itchio",
        session.platformUserId,
      );
      if (!user) {
        return null;
      }

      return {
        id: parseInt(session.platformUserId),
        username: session.username,
        display_name: user.username || session.username,
        url: `https://${session.username}.itch.io`,
      };
    } catch (error) {
      console.error("Itch.io session validation error:", error);
      return null;
    }
  }

  private async createOrUpdateUser(itchUser: ItchUser) {
    let user = await userQueries.findByPlatformId(
      "itchio",
      itchUser.id.toString(),
    );

    if (!user) {
      user = await userQueries.create(
        "itchio",
        itchUser.id.toString(),
        itchUser.username,
        undefined,
      );
    } else {
      await userQueries.updateLastLogin(user.id);
    }

    return user;
  }
}

export const itchAuth = new ItchOAuth();
