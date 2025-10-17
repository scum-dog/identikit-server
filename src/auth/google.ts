import axios from "axios";
import crypto from "crypto";
import { AuthError, ConfigError } from "./base";
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
    if (!this.isConfigured()) {
      throw new ConfigError(
        "Google OAuth not configured. Missing: " +
          this.getMissingConfig().join(", "),
        this.platform,
      );
    }

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
    if (!this.isConfigured()) {
      throw new AuthError("Google OAuth not configured", this.platform);
    }

    try {
      const tokens = await this.exchangeCodeForTokens(code);
      const googleUser = await this.fetchUserProfile(tokens.access_token);
      const user = await this.createOrUpdateUser(googleUser);

      const sessionId = await SessionManager.createSession({
        userId: user.id,
        platform: "google",
        platformUserId: googleUser.id,
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

      // we could refresh the token here in future if needed,
      // but for now we'll trust the session if it exists
      const user = await userQueries.findByPlatformId(
        "google",
        session.platformUserId,
      );
      if (!user) {
        return null;
      }

      return {
        id: session.platformUserId,
        username: session.username,
        email: user.email || "",
        name: user.username || session.username,
        email_verified: true,
      };
    } catch (error) {
      console.error("Google session validation error:", error);
      return null;
    }
  }

  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret && this.redirectUri);
  }

  getMissingConfig(): string[] {
    const missing = [];
    if (!this.clientId) missing.push("GOOGLE_CLIENT_ID");
    if (!this.clientSecret) missing.push("GOOGLE_CLIENT_SECRET");
    if (!this.redirectUri) missing.push("GOOGLE_REDIRECT_URI");
    return missing;
  }
}

export const googleAuth = new GoogleAuth();
