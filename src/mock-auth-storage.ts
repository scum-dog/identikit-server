import { randomUUID } from "crypto";
import crypto from "crypto";
import { Platform } from "./types";

interface MockUser {
  id: string;
  platform: Platform;
  platform_user_id: string;
  username: string;
  email: string;
  created_at: string;
  last_login: string;
  is_admin: boolean;
}

interface MockSession {
  id: string;
  userId: string;
  platform: Platform;
  platformUserId: string;
  platformSessionId?: string;
  username: string;
  isAdmin: boolean;
  createdAt: Date;
  expiresAt: Date;
}

const users = new Map<string, MockUser>();
const sessions = new Map<string, MockSession>();
const usersByPlatform = new Map<string, MockUser>();

let cleanupInterval = setInterval(
  () => {
    const now = new Date();
    for (const [sessionId, session] of sessions.entries()) {
      if (session.expiresAt < now) {
        sessions.delete(sessionId);
      }
    }
  },
  5 * 60 * 1000,
);

export const mockUserOps = {
  findByPlatformId: async (
    platform: Platform,
    platformUserId: string,
  ): Promise<MockUser | undefined> => {
    const key = `${platform}:${platformUserId}`;
    return usersByPlatform.get(key);
  },

  create: async (
    platform: Platform,
    platformUserId: string,
    username: string,
    email?: string,
  ): Promise<MockUser> => {
    const user: MockUser = {
      id: randomUUID(),
      platform,
      platform_user_id: platformUserId,
      username,
      email: email || "",
      created_at: new Date().toISOString(),
      last_login: new Date().toISOString(),
      is_admin: false,
    };

    users.set(user.id, user);
    usersByPlatform.set(`${platform}:${platformUserId}`, user);
    return user;
  },

  updateLastLogin: async (userId: string): Promise<void> => {
    const user = users.get(userId);
    if (user) {
      user.last_login = new Date().toISOString();
    }
  },
};

export const mockSessionOps = {
  generateToken(): string {
    return crypto.randomBytes(32).toString("hex");
  },

  async createSession(data: {
    userId: string;
    platform: Platform;
    platformUserId: string;
    platformSessionId?: string;
    username: string;
    isAdmin: boolean;
  }): Promise<string> {
    const sessionId = this.generateToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24 * 7); // 7 days

    const session: MockSession = {
      id: sessionId,
      userId: data.userId,
      platform: data.platform,
      platformUserId: data.platformUserId,
      platformSessionId: data.platformSessionId,
      username: data.username,
      isAdmin: data.isAdmin,
      createdAt: new Date(),
      expiresAt,
    };

    sessions.set(sessionId, session);
    return sessionId;
  },

  async validateSession(sessionId: string): Promise<MockSession | null> {
    if (!sessionId) return null;

    const session = sessions.get(sessionId);
    if (!session) return null;

    if (session.expiresAt <= new Date()) {
      sessions.delete(sessionId);
      return null;
    }

    return session;
  },

  async deleteSession(sessionId: string): Promise<void> {
    sessions.delete(sessionId);
  },
};

process.on("exit", () => {
  if (cleanupInterval) clearInterval(cleanupInterval);
});
