import { requireAdmin, requirePlatform } from "../../src/auth/middleware";
import {
  createMockRequest,
  createMockResponse,
  mockNext,
  resetMocks,
} from "../helpers/testUtils";

describe("Auth Middleware (Logic Tests)", () => {
  beforeEach(() => {
    resetMocks();
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
});
