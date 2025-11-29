import axios from "axios";
import crypto from "crypto";
import { AuthError } from "../utils/authHelpers";
import {
  OAuthProvider,
  AuthUrlResult,
  PlatformUser,
  ItchAuthResponse,
  ItchOAuthParams,
} from "../types";
import { SessionManager } from "./sessions";
import { userQueries, oauthStateQueries } from "../database";
import { log } from "../utils/logger";
import { handleConstraints } from "../utils/errorHandler";

export class ItchOAuth implements OAuthProvider<PlatformUser> {
  public readonly platform = "itch" as const;

  async generateAuthUrl(pollId?: string): Promise<AuthUrlResult> {
    const clientId = process.env.ITCH_IO_CLIENT_ID!;
    const redirectUri = process.env.ITCH_IO_REDIRECT_URI!;

    const baseState = crypto.randomBytes(32).toString("hex");
    const state = pollId ? `${baseState}_pollid_${pollId}` : baseState;

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await oauthStateQueries.create(state, this.platform, expiresAt);

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
      expiresAt,
    };
  }

  async authenticateWithCode(
    accessToken: string,
    state?: string,
    _codeVerifier?: string,
  ): Promise<{ sessionId: string; user: PlatformUser }> {
    if (!accessToken) {
      throw new AuthError("Access token is required", this.platform);
    }

    if (!state) {
      throw new AuthError("Missing state parameter", this.platform);
    }

    const stateData = await oauthStateQueries.validate(state, this.platform);
    if (!stateData) {
      throw new AuthError("Invalid or expired state parameter", this.platform);
    }

    await oauthStateQueries.delete(state);

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

      const itchUser: PlatformUser = {
        id: data.user.id.toString(),
        username: data.user.username,
      };

      const user = await this.createOrUpdateUser(itchUser);
      const sessionId = await SessionManager.createSession({
        userId: user.id,
        platform: "itch",
        platformUserId: itchUser.id,
        platformSessionId: accessToken,
        username: itchUser.username,
        isAdmin: user.is_admin,
      });

      return { sessionId, user: itchUser };
    } catch (error) {
      log.error("Itch.io token verification error", { error });
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        throw new AuthError("Invalid or expired access token", this.platform);
      }
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError("Failed to verify token with Itch.io", this.platform);
    }
  }

  async validateSession(sessionId: string): Promise<PlatformUser | null> {
    try {
      const session = await SessionManager.validateSession(sessionId);
      if (!session || session.platform !== "itch") {
        return null;
      }

      if (session.platformSessionId) {
        try {
          const response = await axios.get(
            `https://itch.io/api/1/${session.platformSessionId}/me`,
          );
          const data: ItchAuthResponse = response.data;

          if (!data.user) {
            log.info(
              "Itch.io session no longer valid, invalidating local session",
            );
            return null;
          }

          return {
            id: data.user.id.toString(),
            username: data.user.username,
          };
        } catch {
          log.info(
            "Itch.io session no longer valid, invalidating local session",
          );
          return null;
        }
      }

      log.info("No platform session ID found, cannot re-validate with Itch.io");
      return null;
    } catch (error) {
      log.error("Itch.io session validation error", { error });
      return null;
    }
  }

  private async createOrUpdateUser(itchUser: PlatformUser) {
    let user = await userQueries.findByPlatformId("itch", itchUser.id);

    if (!user) {
      user = await handleConstraints(() =>
        userQueries.create("itch", itchUser.id, itchUser.username),
      );
    } else {
      await userQueries.updateLastLogin(user.id);
    }

    return user;
  }
}

export const itchAuth = new ItchOAuth();
