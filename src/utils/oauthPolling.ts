import { randomBytes } from "crypto";

interface OAuthResult {
  success: boolean;
  sessionId?: string;
  user?: any;
  message?: string;
  error?: string;
  timestamp: number;
  expires: number;
}

const oauthResults = new Map<string, OAuthResult>();

setInterval(
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

  console.log(`Stored OAuth result for pollId: ${pollId}`, {
    success: result.success,
    hasSessionId: !!result.sessionId,
    expires: new Date(expires).toISOString(),
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

export function getPollingStats() {
  const now = Date.now();
  const total = oauthResults.size;
  const expired = Array.from(oauthResults.values()).filter(
    (r) => r.expires < now,
  ).length;

  return {
    total,
    active: total - expired,
    expired,
  };
}
