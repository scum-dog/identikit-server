import {
  requireAdmin,
  requirePlatform,
  authenticateUser,
} from "../../src/auth/middleware";
import { SessionManager } from "../../src/auth/sessions";
import {
  createMockRequest,
  createMockResponse,
  mockNext,
  resetMocks,
} from "../helpers/testUtils";

jest.mock("../../src/auth/sessions");

const mockSessionManager = SessionManager as jest.Mocked<typeof SessionManager>;

describe("Auth Middleware (Logic Tests)", () => {
  beforeEach(() => {
    resetMocks();
    jest.clearAllMocks();
  });

  describe("requireAdmin", () => {
    it("should allow admin users", () => {
      const req = createMockRequest({
        user: {
          id: "admin-user-id",
          username: "adminuser",
          platform: "newgrounds",
          platformUserId: "ng_admin",
          isAdmin: true,
        },
      });
      const res = createMockResponse();

      requireAdmin(req as any, res as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should reject non-admin users", () => {
      const req = createMockRequest({
        user: {
          id: "regular-user-id",
          username: "regularuser",
          platform: "newgrounds",
          platformUserId: "ng_user",
          isAdmin: false,
        },
      });
      const res = createMockResponse();

      requireAdmin(req as any, res as any, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: "Admin access required" });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject requests without user", () => {
      const req = createMockRequest();
      const res = createMockResponse();

      requireAdmin(req as any, res as any, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: "Admin access required" });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject users with undefined isAdmin", () => {
      const req = createMockRequest({
        user: {
          id: "user-id",
          username: "user",
          platform: "newgrounds",
          platformUserId: "ng_user",
          isAdmin: undefined as any,
        },
      });
      const res = createMockResponse();

      requireAdmin(req as any, res as any, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: "Admin access required" });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("requirePlatform", () => {
    it("should allow users from correct platform", () => {
      const middleware = requirePlatform("newgrounds");
      const req = createMockRequest({
        user: {
          id: "user-id",
          username: "user",
          platform: "newgrounds",
          platformUserId: "ng_user",
          isAdmin: false,
        },
      });
      const res = createMockResponse();

      middleware(req as any, res as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should reject users from wrong platform", () => {
      const middleware = requirePlatform("google");
      const req = createMockRequest({
        user: {
          id: "user-id",
          username: "user",
          platform: "newgrounds",
          platformUserId: "ng_user",
          isAdmin: false,
        },
      });
      const res = createMockResponse();

      middleware(req as any, res as any, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "This endpoint requires google authentication",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject unauthenticated users", () => {
      const middleware = requirePlatform("newgrounds");
      const req = createMockRequest();
      const res = createMockResponse();

      middleware(req as any, res as any, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: "Authentication required",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should handle all supported platforms", () => {
      const platforms = ["newgrounds", "itch", "google"] as const;

      platforms.forEach((platform) => {
        const middleware = requirePlatform(platform);
        const req = createMockRequest({
          user: {
            id: "user-id",
            username: "user",
            platform: platform,
            platformUserId: `${platform}_user`,
            isAdmin: false,
          },
        });
        const res = createMockResponse();

        middleware(req as any, res as any, mockNext);

        expect(mockNext).toHaveBeenCalled();
        mockNext.mockClear();
      });
    });

    it("should create different middleware instances for different platforms", () => {
      const ngMiddleware = requirePlatform("newgrounds");
      const googleMiddleware = requirePlatform("google");

      expect(ngMiddleware).not.toBe(googleMiddleware);
    });
  });

  describe("middleware composition", () => {
    it("should work correctly when admin middleware is used after platform middleware", () => {
      const platformMiddleware = requirePlatform("newgrounds");
      const req = createMockRequest({
        user: {
          id: "admin-user-id",
          username: "adminuser",
          platform: "newgrounds",
          platformUserId: "ng_admin",
          isAdmin: true,
        },
      });
      const res = createMockResponse();

      platformMiddleware(req as any, res as any, mockNext);
      expect(mockNext).toHaveBeenCalled();
      mockNext.mockClear();

      requireAdmin(req as any, res as any, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("authenticateUser integration", () => {
    it("should authenticate user with valid session", async () => {
      const mockSession = {
        id: "session-123",
        userId: "user-456",
        username: "testuser",
        platform: "newgrounds" as const,
        platformUserId: "ng_user",
        isAdmin: false,
        createdAt: new Date(),
        expiresAt: new Date(),
      };

      mockSessionManager.validateSession.mockResolvedValueOnce(mockSession);

      const req = createMockRequest({
        headers: {
          authorization: "Bearer session-123",
        },
      });
      const res = createMockResponse();

      await authenticateUser(req as any, res as any, mockNext);

      expect(mockSessionManager.validateSession).toHaveBeenCalledWith(
        "session-123",
      );
      expect(req.user).toEqual({
        id: "user-456",
        username: "testuser",
        platform: "newgrounds",
        platformUserId: "ng_user",
        isAdmin: false,
      });
      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should reject requests without authorization header", async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      await authenticateUser(req as any, res as any, mockNext);

      expect(mockSessionManager.validateSession).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: "Authentication required",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject requests with malformed authorization header", async () => {
      const req = createMockRequest({
        headers: {
          authorization: "InvalidFormat session-123",
        },
      });
      const res = createMockResponse();

      await authenticateUser(req as any, res as any, mockNext);

      expect(mockSessionManager.validateSession).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: "Authentication required",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject requests with invalid session", async () => {
      mockSessionManager.validateSession.mockResolvedValueOnce(null);

      const req = createMockRequest({
        headers: {
          authorization: "Bearer invalid-session",
        },
      });
      const res = createMockResponse();

      await authenticateUser(req as any, res as any, mockNext);

      expect(mockSessionManager.validateSession).toHaveBeenCalledWith(
        "invalid-session",
      );
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: "Invalid or expired session",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should handle authentication errors gracefully", async () => {
      mockSessionManager.validateSession.mockRejectedValueOnce(
        new Error("Database error"),
      );

      const req = createMockRequest({
        headers: {
          authorization: "Bearer session-123",
        },
      });
      const res = createMockResponse();

      await authenticateUser(req as any, res as any, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Authentication failed" });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should authenticate admin users correctly", async () => {
      const adminSession = {
        id: "admin-session",
        userId: "admin-456",
        username: "adminuser",
        platform: "newgrounds" as const,
        platformUserId: "ng_admin",
        isAdmin: true,
        createdAt: new Date(),
        expiresAt: new Date(),
      };

      mockSessionManager.validateSession.mockResolvedValueOnce(adminSession);

      const req = createMockRequest({
        headers: {
          authorization: "Bearer admin-session",
        },
      });
      const res = createMockResponse();

      await authenticateUser(req as any, res as any, mockNext);

      expect(req.user?.isAdmin).toBe(true);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe("authentication flow integration", () => {
    it("should complete full authentication flow for admin endpoint", async () => {
      const adminSession = {
        id: "admin-session",
        userId: "admin-456",
        username: "adminuser",
        platform: "newgrounds" as const,
        platformUserId: "ng_admin",
        isAdmin: true,
        createdAt: new Date(),
        expiresAt: new Date(),
      };

      mockSessionManager.validateSession.mockResolvedValueOnce(adminSession);

      const req = createMockRequest({
        headers: {
          authorization: "Bearer admin-session",
        },
      });
      const res = createMockResponse();

      await authenticateUser(req as any, res as any, mockNext);
      expect(mockNext).toHaveBeenCalled();
      mockNext.mockClear();

      requireAdmin(req as any, res as any, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should reject non-admin user trying to access admin endpoint", async () => {
      const userSession = {
        id: "user-session",
        userId: "user-456",
        username: "regularuser",
        platform: "newgrounds" as const,
        platformUserId: "ng_user",
        isAdmin: false,
        createdAt: new Date(),
        expiresAt: new Date(),
      };

      mockSessionManager.validateSession.mockResolvedValueOnce(userSession);

      const req = createMockRequest({
        headers: {
          authorization: "Bearer user-session",
        },
      });
      const res = createMockResponse();

      await authenticateUser(req as any, res as any, mockNext);
      expect(mockNext).toHaveBeenCalled();
      mockNext.mockClear();

      requireAdmin(req as any, res as any, mockNext);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: "Admin access required" });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should complete platform-specific authentication flow", async () => {
      const itchSession = {
        id: "itch-session",
        userId: "itch-user-456",
        username: "itchuser",
        platform: "itch" as const,
        platformUserId: "itch_user",
        isAdmin: false,
        createdAt: new Date(),
        expiresAt: new Date(),
      };

      mockSessionManager.validateSession.mockResolvedValueOnce(itchSession);

      const req = createMockRequest({
        headers: {
          authorization: "Bearer itch-session",
        },
      });
      const res = createMockResponse();

      await authenticateUser(req as any, res as any, mockNext);
      expect(mockNext).toHaveBeenCalled();
      mockNext.mockClear();

      const itchMiddleware = requirePlatform("itch");
      itchMiddleware(req as any, res as any, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should reject wrong platform user", async () => {
      const newgroundsSession = {
        id: "ng-session",
        userId: "ng-user-456",
        username: "nguser",
        platform: "newgrounds" as const,
        platformUserId: "ng_user",
        isAdmin: false,
        createdAt: new Date(),
        expiresAt: new Date(),
      };

      mockSessionManager.validateSession.mockResolvedValueOnce(
        newgroundsSession,
      );

      const req = createMockRequest({
        headers: {
          authorization: "Bearer ng-session",
        },
      });
      const res = createMockResponse();

      await authenticateUser(req as any, res as any, mockNext);
      expect(mockNext).toHaveBeenCalled();
      mockNext.mockClear();

      const googleMiddleware = requirePlatform("google");
      googleMiddleware(req as any, res as any, mockNext);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "This endpoint requires google authentication",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
