import axios from "axios";
import crypto from "crypto";
import { AuthError } from "../utils/authHelpers";
import {
  OAuthProvider,
  AuthUrlResult,
  PlatformUser,
  GoogleAuthResponse,
  GoogleUserInfoResponse,
  GoogleOAuthParams,
} from "../types";
import { TEN_MINUTES } from "../utils/constants";
import { SessionManager } from "./sessions";
import { userQueries, oauthStateQueries } from "../database";
import { log } from "../utils/logger";
import { handleConstraints } from "../utils/errorHandler";

export class GoogleAuth implements OAuthProvider<PlatformUser> {
  public readonly platform = "google" as const;
  private readonly clientId = process.env.GOOGLE_CLIENT_ID;
  private readonly clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  private readonly redirectUri = process.env.GOOGLE_REDIRECT_URI;

  async generateAuthUrl(pollId?: string): Promise<AuthUrlResult> {
    const baseState = crypto.randomBytes(32).toString("hex");
    const state = pollId ? `${baseState}_pollid_${pollId}` : baseState;

    const expiresAt = new Date(Date.now() + TEN_MINUTES);
    await oauthStateQueries.create(state, this.platform, expiresAt);

    const oauthParams: GoogleOAuthParams = {
      client_id: this.clientId!,
      redirect_uri: this.redirectUri!,
      scope: "openid email",
      response_type: "code",
      state,
    };

    const params = new URLSearchParams(oauthParams);

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return {
      authUrl,
      state,
      expiresAt,
    };
  }

  async authenticateWithCode(
    code: string,
    state?: string,
    _codeVerifier?: string,
  ): Promise<{ sessionId: string; user: PlatformUser }> {
    if (!state) {
      throw new AuthError("Missing state parameter", this.platform);
    }

    const stateData = await oauthStateQueries.validate(state, this.platform);
    if (!stateData) {
      throw new AuthError("Invalid or expired state parameter", this.platform);
    }

    await oauthStateQueries.delete(state);

    try {
      const tokens = await this.exchangeCodeForTokens(code);
      const googleUser = await this.fetchUserProfile(tokens.access_token);
      const user = await this.createOrUpdateUser(googleUser);

      const sessionId = await SessionManager.createSession({
        userId: user.id,
        platform: "google",
        platformUserId: googleUser.id,
        platformSessionId: tokens.refresh_token,
        username: googleUser.username,
        isAdmin: user.is_admin,
      });

      return { sessionId, user: googleUser };
    } catch (error) {
      log.error("Google authentication error", { error });
      throw new AuthError(
        `Google authentication failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        this.platform,
      );
    }
  }

  private async exchangeCodeForTokens(
    code: string,
  ): Promise<GoogleAuthResponse> {
    const tokenData = {
      client_id: this.clientId!,
      client_secret: this.clientSecret!,
      code,
      grant_type: "authorization_code",
      redirect_uri: this.redirectUri!,
    };

    const response = await axios.post(
      "https://oauth2.googleapis.com/token",
      new URLSearchParams(tokenData),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    return response.data;
  }

  private async refreshAccessToken(
    refreshToken: string,
  ): Promise<{ access_token: string }> {
    const tokenData = {
      client_id: this.clientId!,
      client_secret: this.clientSecret!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    };

    const response = await axios.post(
      "https://oauth2.googleapis.com/token",
      new URLSearchParams(tokenData),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    return response.data;
  }

  private async fetchUserProfile(accessToken: string): Promise<PlatformUser> {
    const response = await axios.get<GoogleUserInfoResponse>(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    const data = response.data;

    return {
      id: data.id,
      username: data.email.split("@")[0],
    };
  }

  private async createOrUpdateUser(googleUser: PlatformUser) {
    let user = await userQueries.findByPlatformId("google", googleUser.id);

    if (!user) {
      user = await handleConstraints(() =>
        userQueries.create("google", googleUser.id, googleUser.username),
      );
    } else {
      await userQueries.updateLastLogin(user.id);
    }

    return user;
  }

  async validateSession(sessionId: string): Promise<PlatformUser | null> {
    try {
      const session = await SessionManager.validateSession(sessionId);
      if (!session || session.platform !== "google") {
        return null;
      }

      if (session.platformSessionId) {
        try {
          const tokens = await this.refreshAccessToken(
            session.platformSessionId,
          );

          const googleUser = await this.fetchUserProfile(tokens.access_token);

          return googleUser;
        } catch {
          log.info(
            "Google session no longer valid, invalidating local session",
          );
          return null;
        }
      }

      log.info("No platform session ID found, cannot re-validate with Google");
      return null;
    } catch (error) {
      log.error("Google session validation error", { error });
      return null;
    }
  }
}

export const googleAuth = new GoogleAuth();
