import { SessionManager } from "../../src/auth/sessions";

jest.mock("../../src/database", () => ({
  query: jest.fn(),
}));

let mockQuery: jest.Mock;

describe("SessionManager", () => {
  beforeEach(() => {
    mockQuery = require("../../src/database").query;
    mockQuery.mockClear();
  });

  describe("generateToken", () => {
    it("should generate a 64-character hex token", () => {
      const token = SessionManager.generateToken();

      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[0-9a-f]+$/i);
    });

    it("should generate unique tokens", () => {
      const token1 = SessionManager.generateToken();
      const token2 = SessionManager.generateToken();

      expect(token1).not.toBe(token2);
    });
  });

  describe("createSession", () => {
    it("should create session with correct expiry time", async () => {
      const sessionData = {
        userId: "test-user-id",
        platform: "newgrounds" as const,
        platformUserId: "ng_user",
        username: "testuser",
        isAdmin: false,
      };

      const dateBefore = new Date();
      dateBefore.setHours(dateBefore.getHours() + 24 * 7 - 1);

      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const sessionId = await SessionManager.createSession(sessionData);

      expect(sessionId).toHaveLength(64);
      expect(mockQuery).toHaveBeenCalledWith(
        "DELETE FROM user_sessions WHERE user_id = $1",
        [sessionData.userId],
      );

      const insertCall = mockQuery.mock.calls[1];
      expect(insertCall[0]).toContain("INSERT INTO user_sessions");
      expect(insertCall[1][1]).toBe(sessionData.userId);
      expect(insertCall[1][2]).toBe(sessionData.platform);
      expect(insertCall[1][3]).toBe(sessionData.platformUserId);
      expect(insertCall[1][5]).toBe(sessionData.username);
      expect(insertCall[1][6]).toBe(sessionData.isAdmin);

      const expiryDate = new Date(insertCall[1][7]);
      const dateAfter = new Date();
      dateAfter.setHours(dateAfter.getHours() + 24 * 7 + 1);

      expect(expiryDate.getTime()).toBeGreaterThan(dateBefore.getTime());
      expect(expiryDate.getTime()).toBeLessThan(dateAfter.getTime());
    });

    it("should delete existing session before creating new one", async () => {
      const sessionData = {
        userId: "test-user-id",
        platform: "newgrounds" as const,
        platformUserId: "ng_user",
        username: "testuser",
        isAdmin: false,
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await SessionManager.createSession(sessionData);

      expect(mockQuery).toHaveBeenNthCalledWith(
        1,
        "DELETE FROM user_sessions WHERE user_id = $1",
        [sessionData.userId],
      );
    });

    it("should handle admin users correctly", async () => {
      const adminSessionData = {
        userId: "admin-user-id",
        platform: "newgrounds" as const,
        platformUserId: "ng_admin",
        username: "adminuser",
        isAdmin: true,
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await SessionManager.createSession(adminSessionData);

      const insertCall = mockQuery.mock.calls[1];
      expect(insertCall[1][6]).toBe(true);
    });
  });

  describe("validateSession", () => {
    it("should return null for empty session ID", async () => {
      const result = await SessionManager.validateSession("");
      expect(result).toBeNull();
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it("should return null for null session ID", async () => {
      const result = await SessionManager.validateSession(null as any);
      expect(result).toBeNull();
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it("should return session data for valid session", async () => {
      const mockSessionRow = {
        session_id: "valid-session-id",
        user_id: "user-123",
        platform: "newgrounds",
        platform_user_id: "ng_user",
        platform_session_id: "ng_session",
        username: "testuser",
        is_admin: false,
        created_at: new Date("2023-01-01"),
        expires_at: new Date("2023-01-08"),
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockSessionRow] });

      const result = await SessionManager.validateSession("valid-session-id");

      expect(result).toEqual({
        id: "valid-session-id",
        userId: "user-123",
        platform: "newgrounds",
        platformUserId: "ng_user",
        platformSessionId: "ng_session",
        username: "testuser",
        isAdmin: false,
        createdAt: mockSessionRow.created_at,
        expiresAt: mockSessionRow.expires_at,
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("SELECT session_id, user_id"),
        ["valid-session-id"],
      );
    });

    it("should return null for expired or non-existent session", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await SessionManager.validateSession("invalid-session-id");

      expect(result).toBeNull();
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("expires_at > NOW()"),
        ["invalid-session-id"],
      );
    });

    it("should only return non-expired sessions", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await SessionManager.validateSession("session-id");

      const queryCall = mockQuery.mock.calls[0];
      expect(queryCall[0]).toContain("expires_at > NOW()");
    });
  });

  describe("deleteSession", () => {
    it("should delete session by session ID", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await SessionManager.deleteSession("session-to-delete");

      expect(mockQuery).toHaveBeenCalledWith(
        "DELETE FROM user_sessions WHERE session_id = $1",
        ["session-to-delete"],
      );
    });

    it("should handle deletion of non-existent session", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(
        SessionManager.deleteSession("non-existent-session"),
      ).resolves.not.toThrow();
    });
  });

  describe("session business logic", () => {
    it("should enforce one session per user", async () => {
      const sessionData = {
        userId: "same-user-id",
        platform: "newgrounds" as const,
        platformUserId: "ng_user",
        username: "testuser",
        isAdmin: false,
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await SessionManager.createSession(sessionData);
      await SessionManager.createSession(sessionData);

      expect(mockQuery).toHaveBeenCalledWith(
        "DELETE FROM user_sessions WHERE user_id = $1",
        [sessionData.userId],
      );
      expect(mockQuery).toHaveBeenCalledTimes(4);
    });

    it("should handle different platforms correctly", async () => {
      const platforms = ["newgrounds", "itch", "google"] as const;

      mockQuery.mockResolvedValue({ rows: [] });

      for (const platform of platforms) {
        const sessionData = {
          userId: `${platform}-user-id`,
          platform,
          platformUserId: `${platform}_user`,
          username: `${platform}user`,
          isAdmin: false,
        };

        await SessionManager.createSession(sessionData);

        const insertCall =
          mockQuery.mock.calls[mockQuery.mock.calls.length - 1];
        expect(insertCall[1][2]).toBe(platform);
      }
    });

    it("should preserve session metadata correctly", async () => {
      const sessionData = {
        userId: "metadata-user",
        platform: "itch" as const,
        platformUserId: "itch_12345",
        platformSessionId: "itch_session_abc",
        username: "itchuser",
        isAdmin: true,
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await SessionManager.createSession(sessionData);

      const insertCall = mockQuery.mock.calls[1];
      expect(insertCall[1][2]).toBe("itch");
      expect(insertCall[1][3]).toBe("itch_12345");
      expect(insertCall[1][4]).toBe("itch_session_abc");
      expect(insertCall[1][5]).toBe("itchuser");
      expect(insertCall[1][6]).toBe(true);
    });
  });
});
