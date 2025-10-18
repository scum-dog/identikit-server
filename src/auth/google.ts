import axios from "axios";
import crypto from "crypto";
import { AuthError } from "./base";
import {
  OAuthProvider,
  AuthUrlResult,
  GoogleUser,
  GoogleAuthResponse,
  GoogleUserInfoResponse,
  GoogleOAuthParams,
} from "../types";
import { SessionManager } from "./sessions";
import { userQueries } from "../database";

export class GoogleAuth implements OAuthProvider<GoogleUser> {
  public readonly platform = "google" as const;
  private readonly clientId = process.env.GOOGLE_CLIENT_ID;
  private readonly clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  private readonly redirectUri = process.env.GOOGLE_REDIRECT_URI;

  generateAuthUrl(): AuthUrlResult {
    const state = crypto.randomBytes(32).toString("hex");

    const oauthParams: GoogleOAuthParams = {
      client_id: this.clientId!,
      redirect_uri: this.redirectUri!,
      scope: "openid email profile",
      response_type: "code",
      state,
    };

    const params = new URLSearchParams(oauthParams);

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return {
      authUrl,
      state,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    };
  }

  async authenticateWithCode(
    code: string,
    _state?: string,
    _codeVerifier?: string,
  ): Promise<{ sessionId: string; user: GoogleUser }> {
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
      console.error("Google authentication error:", error);
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

  private async fetchUserProfile(accessToken: string): Promise<GoogleUser> {
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
      id: data.sub,
      username: data.email.split("@")[0],
      email: data.email,
      name: data.name,
      picture: data.picture,
      email_verified: data.email_verified,
    };
  }

  private async createOrUpdateUser(googleUser: GoogleUser) {
    let user = await userQueries.findByPlatformId("google", googleUser.id);

    if (!user) {
      user = await userQueries.create(
        "google",
        googleUser.id,
        googleUser.username,
        googleUser.email,
      );
    } else {
      await userQueries.updateLastLogin(user.id);
    }

    return user;
  }

  async validateSession(sessionId: string): Promise<GoogleUser | null> {
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
          console.log(
            "Google session no longer valid, invalidating local session",
          );
          return null;
        }
      }

      console.log(
        "No platform session ID found, cannot re-validate with Google",
      );
      return null;
    } catch (error) {
      console.error("Google session validation error:", error);
      return null;
    }
  }
}

export const googleAuth = new GoogleAuth();
