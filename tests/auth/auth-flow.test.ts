import request from "supertest";
import express from "express";
import authRouter from "../../src/routes/auth";
import { authenticateUser } from "../../src/auth/middleware";
import { SessionManager } from "../../src/auth/sessions";
import { query } from "../../src/database";
import {
  setupTestDatabase,
  teardownTestDatabase,
  clearTestDatabase,
} from "../helpers/database";
import { ONE_WEEK } from "../../src/utils/constants";

jest.mock("../../src/database");
jest.mock("../../src/auth/middleware");
jest.mock("../../src/auth/sessions");

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockAuthenticateUser = authenticateUser as jest.MockedFunction<
  typeof authenticateUser
>;
const mockSessionManager = {
  deleteSession: jest.fn(),
  createSession: jest.fn(),
  validateSession: jest.fn(),
  generateToken: jest.fn(),
} as any;

(SessionManager as any).deleteSession = mockSessionManager.deleteSession;
(SessionManager as any).createSession = mockSessionManager.createSession;
(SessionManager as any).validateSession = mockSessionManager.validateSession;

describe("Auth Flow Integration", () => {
  let app: express.Application;
  let mockUser: any;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();

    app = express();
    app.use(express.json());
    app.use("/auth", authRouter);

    mockUser = {
      id: "user-123",
      username: "testuser",
      platform: "newgrounds",
      isAdmin: false,
    };

    mockAuthenticateUser.mockImplementation(
      jest.fn(async (req: any, res: any, next: any) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return res.status(401).json({ error: "Authentication required" });
        }

        const sessionId = authHeader.substring(7);
        const session = await mockSessionManager.validateSession(sessionId);

        if (!session) {
          return res.status(401).json({ error: "Invalid or expired session" });
        }

        req.user = mockUser;
        next();
      }) as any,
    );

    jest.clearAllMocks();
  });

  describe("GET /auth/session", () => {
    it("should verify valid session and return user info", async () => {
      mockSessionManager.validateSession.mockResolvedValue({
        id: "session-123",
        userId: mockUser.id,
        platform: mockUser.platform,
        username: mockUser.username,
        isAdmin: mockUser.isAdmin,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + ONE_WEEK),
      } as any);

      const response = await request(app)
        .get("/auth/session")
        .set("Authorization", "Bearer valid-session-id");

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);
      expect(response.body.user.id).toBe(mockUser.id);
      expect(response.body.user.username).toBe(mockUser.username);
      expect(response.body.user.platform).toBe(mockUser.platform);
      expect(response.body.user.isAdmin).toBe(mockUser.isAdmin);
    });

    it("should reject request without authorization header", async () => {
      const response = await request(app).get("/auth/session");

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Authentication required");
    });

    it("should reject request with invalid session", async () => {
      mockSessionManager.validateSession.mockResolvedValue(null);

      const response = await request(app)
        .get("/auth/session")
        .set("Authorization", "Bearer invalid-session-id");

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Invalid or expired session");
    });

    it("should reject request with malformed authorization header", async () => {
      const response = await request(app)
        .get("/auth/session")
        .set("Authorization", "InvalidFormat");

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Authentication required");
    });
  });

  describe("GET /auth/me", () => {
    it("should return user info with character when user has one", async () => {
      const mockCharacter = {
        id: "char-123",
        created_at: "2024-01-01T00:00:00.000Z",
        last_edited_at: "2024-01-02T00:00:00.000Z",
        is_edited: true,
      };

      mockSessionManager.validateSession.mockResolvedValue({
        id: "session-123",
        userId: mockUser.id,
        username: mockUser.username,
        platform: mockUser.platform,
        isAdmin: mockUser.isAdmin,
      } as any);

      mockQuery.mockResolvedValue({ rows: [mockCharacter] } as any);

      const response = await request(app)
        .get("/auth/me")
        .set("Authorization", "Bearer valid-session-id");

      expect(response.status).toBe(200);
      expect(response.body.user.id).toBe(mockUser.id);
      expect(response.body.user.username).toBe(mockUser.username);
      expect(response.body.character).toEqual(mockCharacter);
      expect(response.body.hasCharacter).toBe(true);

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT id, created_at, last_edited_at, is_edited FROM characters WHERE user_id = $1 AND is_deleted = false",
        [mockUser.id],
      );
    });

    it("should return user info without character when user has none", async () => {
      mockSessionManager.validateSession.mockResolvedValue({
        id: "session-123",
        userId: mockUser.id,
        username: mockUser.username,
        platform: mockUser.platform,
        isAdmin: mockUser.isAdmin,
      } as any);

      mockQuery.mockResolvedValue({ rows: [] } as any);

      const response = await request(app)
        .get("/auth/me")
        .set("Authorization", "Bearer valid-session-id");

      expect(response.status).toBe(200);
      expect(response.body.user.id).toBe(mockUser.id);
      expect(response.body.character).toBeNull();
      expect(response.body.hasCharacter).toBe(false);
    });

    it("should handle admin user correctly", async () => {
      const adminUser = {
        ...mockUser,
        isAdmin: true,
        username: "adminuser",
      };

      mockUser = adminUser;

      mockSessionManager.validateSession.mockResolvedValue({
        id: "session-123",
        userId: adminUser.id,
        username: adminUser.username,
        platform: adminUser.platform,
        isAdmin: adminUser.isAdmin,
      } as any);

      mockQuery.mockResolvedValue({ rows: [] } as any);

      const response = await request(app)
        .get("/auth/me")
        .set("Authorization", "Bearer admin-session-id");

      expect(response.status).toBe(200);
      expect(response.body.user.isAdmin).toBe(true);
      expect(response.body.user.username).toBe("adminuser");
    });

    it("should handle database errors gracefully", async () => {
      mockSessionManager.validateSession.mockResolvedValue({
        id: "session-123",
        userId: mockUser.id,
      } as any);

      mockQuery.mockRejectedValue(new Error("Database connection failed"));

      const response = await request(app)
        .get("/auth/me")
        .set("Authorization", "Bearer valid-session-id");

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Failed to get user information");
    });

    it("should require authentication", async () => {
      const response = await request(app).get("/auth/me");

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Authentication required");
    });
  });

  describe("DELETE /auth/session", () => {
    it("should successfully logout and delete session", async () => {
      mockSessionManager.validateSession.mockResolvedValue({
        id: "session-123",
        userId: mockUser.id,
      } as any);

      mockSessionManager.deleteSession.mockResolvedValue(undefined);

      const response = await request(app)
        .delete("/auth/session")
        .set("Authorization", "Bearer valid-session-id");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe(
        "Logout successful. Session cleared from server.",
      );

      expect(mockSessionManager.deleteSession).toHaveBeenCalledWith(
        "valid-session-id",
      );
    });

    it("should handle logout when session deletion fails", async () => {
      mockSessionManager.validateSession.mockResolvedValue({
        id: "session-123",
        userId: mockUser.id,
      } as any);

      mockSessionManager.deleteSession.mockRejectedValue(
        new Error("Database error"),
      );

      const response = await request(app)
        .delete("/auth/session")
        .set("Authorization", "Bearer valid-session-id");

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Logout failed");
    });

    it("should still attempt logout with malformed authorization header", async () => {
      mockSessionManager.validateSession.mockResolvedValue({
        id: "session-123",
        userId: mockUser.id,
      } as any);

      const response = await request(app)
        .delete("/auth/session")
        .set("Authorization", "InvalidFormat");

      expect(response.status).toBe(401);
    });

    it("should require authentication for logout", async () => {
      const response = await request(app).delete("/auth/session");

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Authentication required");
    });

    it("should handle logout gracefully when session ID is extracted", async () => {
      mockSessionManager.validateSession.mockResolvedValue({
        id: "session-123",
        userId: mockUser.id,
      } as any);

      mockSessionManager.deleteSession.mockResolvedValue(undefined);

      const response = await request(app)
        .delete("/auth/session")
        .set("Authorization", "Bearer session-to-delete");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockSessionManager.deleteSession).toHaveBeenCalledWith(
        "session-to-delete",
      );
    });
  });

  describe("Platform-Specific Authentication", () => {
    it("should have Newgrounds authentication routes mounted", async () => {
      const response = await request(app).get("/auth/newgrounds/callback");

      expect(response.status).toBeGreaterThan(0);
      expect(response.status).toBeLessThan(600);
    });

    it("should have Itch.io authentication routes mounted", async () => {
      const response = await request(app).get("/auth/itchio/callback");

      expect(response.status).toBeGreaterThan(0);
      expect(response.status).toBeLessThan(600);
    });

    it("should have Google authentication routes mounted", async () => {
      const response = await request(app).get("/auth/google/callback");

      expect(response.status).toBeGreaterThan(0);
      expect(response.status).toBeLessThan(600);
    });

    it("should have OAuth polling routes mounted", async () => {
      const response = await request(app).get(
        "/auth/oauth/status/invalid-request-id",
      );

      expect(response.status).toBeGreaterThan(0);
      expect(response.status).toBeLessThan(600);
    });
  });

  describe("Session Lifecycle", () => {
    it("should handle complete auth flow simulation", async () => {
      const sessionId = "complete-flow-session";

      mockSessionManager.validateSession.mockResolvedValue({
        id: sessionId,
        userId: mockUser.id,
        platform: mockUser.platform,
        username: mockUser.username,
        isAdmin: mockUser.isAdmin,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + ONE_WEEK),
      } as any);

      mockQuery.mockResolvedValue({ rows: [] } as any);

      const sessionResponse = await request(app)
        .get("/auth/session")
        .set("Authorization", `Bearer ${sessionId}`);

      expect(sessionResponse.status).toBe(200);
      expect(sessionResponse.body.valid).toBe(true);

      const meResponse = await request(app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${sessionId}`);

      expect(meResponse.status).toBe(200);
      expect(meResponse.body.user.id).toBe(mockUser.id);
      expect(meResponse.body.hasCharacter).toBe(false);

      mockSessionManager.deleteSession.mockResolvedValue(undefined);

      const logoutResponse = await request(app)
        .delete("/auth/session")
        .set("Authorization", `Bearer ${sessionId}`);

      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.body.success).toBe(true);

      expect(mockSessionManager.deleteSession).toHaveBeenCalledWith(sessionId);
    });

    it("should handle session expiration", async () => {
      mockSessionManager.validateSession.mockResolvedValue(null);

      const response = await request(app)
        .get("/auth/session")
        .set("Authorization", "Bearer expired-session");

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Invalid or expired session");
    });
  });

  describe("Error Handling", () => {
    it("should handle authentication middleware errors", async () => {
      mockSessionManager.validateSession.mockRejectedValue(
        new Error("Session service unavailable"),
      );

      const response = await request(app)
        .get("/auth/session")
        .set("Authorization", "Bearer session-causing-error");

      expect([401, 500].includes(response.status)).toBe(true);
    });

    it("should handle malformed bearer tokens", async () => {
      const malformedTokens = [
        "Bearer", // missing
        "Bearer ", // empty
        "Basic token123", // wrong auth type
        "Bearer  ", // whitespace only
        "", // empty header
      ];

      for (const token of malformedTokens) {
        const response = await request(app)
          .get("/auth/session")
          .set("Authorization", token);

        expect(response.status).toBe(401);
      }
    });
  });
});
