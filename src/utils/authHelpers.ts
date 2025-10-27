import { PlatformUser, AuthResult, Platform } from "../types";

export class AuthError extends Error {
  constructor(
    message: string,
    public platform: Platform,
    public code?: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export class ConfigError extends Error {
  constructor(
    message: string,
    public platform: Platform,
  ) {
    super(message);
    this.name = "ConfigError";
  }
}

export const createAuthResponse = (
  user: PlatformUser & { platform?: string; is_admin?: boolean },
  sessionId: string,
  message: string = "Authentication successful",
): AuthResult & { success: true } => ({
  success: true,
  user: {
    id: String(user.id),
    username: user.username,
    platform: user.platform || "",
    isAdmin: Boolean(user.is_admin),
  },
  sessionId,
  tokenType: "Bearer",
  message,
});

export const authRateLimit = {
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: "Too many authentication attempts, please try again later",
  },
};
