import { SessionManager } from "../../src/auth/sessions";
import {
  setupTestDatabase,
  teardownTestDatabase,
  clearTestDatabase,
  createTestUser,
} from "../helpers/database";
import { Pool } from "pg";

jest.mock("../../src/database", () => {
  let testPool: Pool;

  return {
    query: jest
      .fn()
      .mockImplementation(async (text: string, params?: any[]) => {
        if (!testPool) {
          const { getTestPool } = require("../helpers/database");
          testPool = getTestPool();
        }

        if (params && params.length > 0) {
          let query = text;
          params.forEach((param, index) => {
            const placeholder = `$${index + 1}`;
            const value =
              param === undefined || param === null
                ? "NULL"
                : typeof param === "string"
                  ? `'${param}'`
                  : typeof param === "boolean"
                    ? param
                    : param instanceof Date
                      ? `'${param.toISOString()}'`
                      : param;
            query = query.replace(placeholder, value);
          });

          query = query.replace(
            /expires_at > NOW\(\)/g,
            `expires_at > '${new Date().toISOString()}'`,
          );

          return testPool.query(query);
        }

        return testPool.query(text);
      }),
  };
});

describe("SessionManager Database Integration", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();
  });

  describe("session lifecycle with real database", () => {
    it("should create, validate, and delete session end-to-end", async () => {
      const user = await createTestUser({
        id: "test-user-123",
        platform: "newgrounds",
        platform_user_id: "ng_user",
        username: "testuser",
        is_admin: false,
      });

      const sessionData = {
        userId: user.id,
        platform: "newgrounds" as const,
        platformUserId: user.platform_user_id,
        username: user.username,
        isAdmin: user.is_admin,
      };

      const sessionId = await SessionManager.createSession(sessionData);
      expect(sessionId).toHaveLength(64);
      expect(sessionId).toMatch(/^[0-9a-f]+$/i);

      const validatedSession = await SessionManager.validateSession(sessionId);
      expect(validatedSession).toBeTruthy();
      expect(validatedSession?.userId).toBe(user.id);
      expect(validatedSession?.platform).toBe("newgrounds");
      expect(validatedSession?.username).toBe(user.username);
      expect(validatedSession?.isAdmin).toBe(false);

      await SessionManager.deleteSession(sessionId);

      const deletedSession = await SessionManager.validateSession(sessionId);
      expect(deletedSession).toBeNull();
    });

    it("should enforce single session per user constraint", async () => {
      const user = await createTestUser({
        id: "test-user-456",
        platform: "itch",
        platform_user_id: "itch_user",
        username: "itchuser",
        is_admin: false,
      });

      const sessionData = {
        userId: user.id,
        platform: "itch" as const,
        platformUserId: user.platform_user_id,
        username: user.username,
        isAdmin: user.is_admin,
      };

      const sessionId1 = await SessionManager.createSession(sessionData);
      const sessionId2 = await SessionManager.createSession(sessionData);
      const session1 = await SessionManager.validateSession(sessionId1);

      expect(session1).toBeNull();

      const session2 = await SessionManager.validateSession(sessionId2);

      expect(session2).toBeTruthy();
      expect(session2?.userId).toBe(user.id);
    });

    it("should handle admin user sessions correctly", async () => {
      const adminUser = await createTestUser({
        id: "admin-user-789",
        platform: "google",
        platform_user_id: "google_admin",
        username: "adminuser",
        is_admin: true,
      });

      const sessionData = {
        userId: adminUser.id,
        platform: "google" as const,
        platformUserId: adminUser.platform_user_id,
        username: adminUser.username,
        isAdmin: adminUser.is_admin,
      };

      const sessionId = await SessionManager.createSession(sessionData);
      const session = await SessionManager.validateSession(sessionId);

      expect(session).toBeTruthy();
      expect(session?.isAdmin).toBe(true);
      expect(session?.platform).toBe("google");
    });

    it("should preserve platform session metadata", async () => {
      const user = await createTestUser({
        id: "metadata-user",
        platform: "itch",
        platform_user_id: "itch_meta",
        username: "metauser",
        is_admin: false,
      });

      const sessionData = {
        userId: user.id,
        platform: "itch" as const,
        platformUserId: user.platform_user_id,
        platformSessionId: "itch_session_abc123",
        username: user.username,
        isAdmin: user.is_admin,
      };

      const sessionId = await SessionManager.createSession(sessionData);
      const session = await SessionManager.validateSession(sessionId);

      expect(session).toBeTruthy();
      expect(session?.platformSessionId).toBe("itch_session_abc123");
      expect(session?.platformUserId).toBe("itch_meta");
    });

    it("should handle concurrent session operations", async () => {
      const users = await Promise.all([
        createTestUser({
          id: "concurrent-user-1",
          platform: "newgrounds",
          platform_user_id: "ng_conc1",
          username: "concuser1",
        }),
        createTestUser({
          id: "concurrent-user-2",
          platform: "itch",
          platform_user_id: "itch_conc2",
          username: "concuser2",
        }),
        createTestUser({
          id: "concurrent-user-3",
          platform: "google",
          platform_user_id: "google_conc3",
          username: "concuser3",
        }),
      ]);

      const sessionPromises = users.map((user) =>
        SessionManager.createSession({
          userId: user.id,
          platform: user.platform as any,
          platformUserId: user.platform_user_id,
          username: user.username,
          isAdmin: user.is_admin,
        }),
      );

      const sessionIds = await Promise.all(sessionPromises);
      const validationPromises = sessionIds.map((sessionId) =>
        SessionManager.validateSession(sessionId),
      );

      const sessions = await Promise.all(validationPromises);
      expect(sessions).toHaveLength(3);

      sessions.forEach((session, index) => {
        expect(session).toBeTruthy();
        expect(session?.userId).toBe(users[index].id);
      });

      const uniqueSessionIds = new Set(sessionIds);
      expect(uniqueSessionIds.size).toBe(3);
    });
  });
});
