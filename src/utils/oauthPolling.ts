import { randomBytes } from "crypto";
import { PlatformUser } from "../types";

interface OAuthResult {
  success: boolean;
  sessionId?: string;
  user?: PlatformUser;
  message?: string;
  error?: string;
  timestamp: number;
  expires: number;
}

const oauthResults = new Map<string, OAuthResult>();

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

if (process.env.NODE_ENV !== "test") {
  cleanupInterval = setInterval(
    () => {
      const now = Date.now();
      for (const [pollId, result] of oauthResults.entries()) {
        if (result.expires < now) {
          oauthResults.delete(pollId);
        }
      }
    },
    5 * 60 * 1000,
  );

  cleanupInterval.unref();
}

export function generatePollId(): string {
  return randomBytes(32).toString("hex");
}

export function storeOAuthResult(
  pollId: string,
  result: Omit<OAuthResult, "timestamp" | "expires">,
): void {
  const now = Date.now();
  const expires = now + 10 * 60 * 1000; // 10 minutes

  oauthResults.set(pollId, {
    ...result,
    timestamp: now,
    expires,
  });
}

export function getOAuthResult(pollId: string): OAuthResult | null {
  const result = oauthResults.get(pollId);

  if (!result) {
    return null;
  }

  if (result.expires < Date.now()) {
    oauthResults.delete(pollId);
    return null;
  }

  return result;
}

export function removeOAuthResult(pollId: string): void {
  oauthResults.delete(pollId);
}

export function cleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
  oauthResults.clear();
}
