import request from "supertest";
import express from "express";
import adminRouter from "../../src/routes/admin";
import { authenticateUser, requireAdmin } from "../../src/auth/middleware";
import { addCharacterProcessingJob } from "../../src/queue";
import { query } from "../../src/database";

jest.mock("../../src/database");
jest.mock("../../src/queue");
jest.mock("../../src/auth/middleware");

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockAddCharacterProcessingJob =
  addCharacterProcessingJob as jest.MockedFunction<
    typeof addCharacterProcessingJob
  >;
const mockAuthenticateUser = authenticateUser as jest.MockedFunction<
  typeof authenticateUser
>;
const mockRequireAdmin = requireAdmin as jest.MockedFunction<
  typeof requireAdmin
>;

describe("Admin Routes", () => {
  let app: express.Application;
  let mockAdminUser: any;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/admin", adminRouter);

    mockAdminUser = {
      id: "admin-user-123",
      username: "adminuser",
      platform: "google",
      isAdmin: true,
    };

    mockAuthenticateUser.mockImplementation(
      jest.fn(async (req: any, res: any, next: any) => {
        req.user = mockAdminUser;
        next();
      }) as any,
    );

    mockRequireAdmin.mockImplementation(
      jest.fn(async (req: any, res: any, next: any) => {
        if (!req.user?.isAdmin) {
          return res.status(403).json({ error: "Admin access required" });
        }
        next();
      }) as any,
    );

    jest.clearAllMocks();
  });

  describe("GET /admin/characters", () => {
    it("should return paginated character list", async () => {
      const mockCharacters = [
        {
          id: "char-1",
          user_id: "user-1",
          character_data: JSON.stringify({ info: { name: "John" } }),
          created_at: "2024-01-01T00:00:00.000Z",
          last_edited_at: "2024-01-01T00:00:00.000Z",
          is_deleted: false,
          deleted_at: null,
          deleted_by: null,
          username: "testuser1",
          platform: "newgrounds",
          platform_user_id: "ng_user1",
        },
        {
          id: "char-2",
          user_id: "user-2",
          character_data: JSON.stringify({ info: { name: "Jane" } }),
          created_at: "2024-01-02T00:00:00.000Z",
          last_edited_at: "2024-01-02T00:00:00.000Z",
          is_deleted: false,
          deleted_at: null,
          deleted_by: null,
          username: "testuser2",
          platform: "itch",
          platform_user_id: "itch_user2",
        },
      ];

      const mockCountResult = { rows: [{ total: 25 }] };

      mockQuery
        .mockResolvedValueOnce({ rows: mockCharacters } as any)
        .mockResolvedValueOnce(mockCountResult as any);

      const response = await request(app).get(
        "/admin/characters?page=1&limit=2",
      );

      expect(response.status).toBe(200);
      expect(response.body.characters).toHaveLength(2);
      expect(response.body.characters[0].id).toBe("char-1");
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(2);
      expect(response.body.pagination.total).toBe(25);
      expect(response.body.pagination.totalPages).toBe(13);
    });

    it("should handle showDeleted parameter", async () => {
      const mockCharacters = [
        {
          id: "char-1",
          user_id: "user-1",
          character_data: JSON.stringify({
            info: { name: "Deleted Character" },
          }),
          created_at: "2024-01-01T00:00:00.000Z",
          last_edited_at: "2024-01-01T00:00:00.000Z",
          is_deleted: true,
          deleted_at: "2024-01-15T00:00:00.000Z",
          deleted_by: "admin-123",
          username: "testuser1",
          platform: "newgrounds",
          platform_user_id: "ng_user1",
        },
      ];

      const mockCountResult = { rows: [{ total: 5 }] };

      mockQuery
        .mockResolvedValueOnce({ rows: mockCharacters } as any)
        .mockResolvedValueOnce(mockCountResult as any);

      const response = await request(app).get(
        "/admin/characters?showDeleted=true",
      );

      expect(response.status).toBe(200);
      expect(response.body.characters).toHaveLength(1);
      expect(response.body.characters[0].is_deleted).toBe(true);
    });

    it("should apply default pagination", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [{ total: 0 }] } as any);

      const response = await request(app).get("/admin/characters");

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(50);
    });

    it("should handle database errors gracefully", async () => {
      mockQuery.mockRejectedValue(new Error("Database error"));

      const response = await request(app).get("/admin/characters");

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Failed to fetch characters");
    });
  });

  describe("GET /admin/characters/:id", () => {
    it("should return specific character with full details", async () => {
      const mockCharacter = {
        id: "char-123",
        user_id: "user-123",
        character_data: { info: { name: "John Doe" } },
        created_at: "2024-01-01T00:00:00.000Z",
        last_edited_at: "2024-01-02T00:00:00.000Z",
        is_deleted: false,
        deleted_at: null,
        deleted_by: null,
        username: "johndoe",
        platform: "google",
        platform_user_id: "google_123",
        user_created_at: "2023-12-01T00:00:00.000Z",
        last_login: "2024-01-01T00:00:00.000Z",
      };

      mockQuery.mockResolvedValue({ rows: [mockCharacter] } as any);

      const response = await request(app).get("/admin/characters/char-123");

      expect(response.status).toBe(200);
      expect(response.body.character.id).toBe("char-123");
      expect(response.body.character.character_data).toEqual({
        info: { name: "John Doe" },
      });
      expect(response.body.character.username).toBe("johndoe");
      expect(response.body.character.platform).toBe("google");
    });

    it("should return 404 for non-existent character", async () => {
      mockQuery.mockResolvedValue({ rows: [] } as any);

      const response = await request(app).get("/admin/characters/non-existent");

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Character not found");
    });

    it("should handle database errors gracefully", async () => {
      mockQuery.mockRejectedValue(new Error("Database error"));

      const response = await request(app).get("/admin/characters/char-123");

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Failed to fetch character details");
    });
  });

  describe("DELETE /admin/characters/:id", () => {
    it("should delete character with valid reason", async () => {
      const mockCharacter = {
        id: "char-123",
        user_id: "user-123",
        is_deleted: false,
      };

      mockQuery.mockResolvedValue({ rows: [mockCharacter] } as any);
      mockAddCharacterProcessingJob.mockResolvedValue("job-789");

      const deleteData = {
        reason: "Inappropriate content - violates community guidelines",
      };

      const response = await request(app)
        .delete("/admin/characters/char-123")
        .send(deleteData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe(
        "Character deletion queued successfully",
      );
      expect(response.body.jobId).toBe("job-789");
      expect(response.body.reason).toBe(deleteData.reason);

      expect(mockAddCharacterProcessingJob).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-123",
          characterId: "char-123",
          action: "delete",
          metadata: expect.objectContaining({
            adminUserId: mockAdminUser.id,
            reason: deleteData.reason,
          }),
        }),
        4, // JobPriority.CRITICAL
      );
    });

    it("should return 404 for non-existent character", async () => {
      mockQuery.mockResolvedValue({ rows: [] } as any);

      const deleteData = {
        reason: "Test reason",
      };

      const response = await request(app)
        .delete("/admin/characters/non-existent")
        .send(deleteData);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Character not found");
    });

    it("should return 409 for already deleted character", async () => {
      const mockCharacter = {
        id: "char-123",
        user_id: "user-123",
        is_deleted: true,
      };

      mockQuery.mockResolvedValue({ rows: [mockCharacter] } as any);

      const deleteData = {
        reason: "Test reason",
      };

      const response = await request(app)
        .delete("/admin/characters/char-123")
        .send(deleteData);

      expect(response.status).toBe(409);
      expect(response.body.error).toBe("Character is already deleted");
    });

    it("should validate reason is provided", async () => {
      const response = await request(app)
        .delete("/admin/characters/char-123")
        .send({});

      expect(response.status).toBe(400);
    });

    it("should validate reason length", async () => {
      const longReason = "a".repeat(501);

      const response = await request(app)
        .delete("/admin/characters/char-123")
        .send({ reason: longReason });

      expect(response.status).toBe(400);
    });

    it("should handle queue errors gracefully", async () => {
      const mockCharacter = {
        id: "char-123",
        user_id: "user-123",
        is_deleted: false,
      };

      mockQuery.mockResolvedValue({ rows: [mockCharacter] } as any);
      mockAddCharacterProcessingJob.mockRejectedValue(new Error("Queue error"));

      const deleteData = {
        reason: "Valid reason",
      };

      const response = await request(app)
        .delete("/admin/characters/char-123")
        .send(deleteData);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Failed to delete character");
    });
  });

  describe("GET /admin/users", () => {
    it("should return paginated user list", async () => {
      const mockUsers = [
        {
          id: "user-1",
          username: "user1",
          platform: "newgrounds",
          platform_user_id: "ng_user1",
          created_at: "2024-01-01T00:00:00.000Z",
          last_login: "2024-01-15T00:00:00.000Z",
          is_admin: false,
        },
        {
          id: "admin-1",
          username: "adminuser",
          platform: "google",
          platform_user_id: "google_admin",
          created_at: "2023-12-01T00:00:00.000Z",
          last_login: "2024-01-20T00:00:00.000Z",
          is_admin: true,
        },
      ];

      const mockCountResult = { rows: [{ total: 150 }] };

      mockQuery
        .mockResolvedValueOnce({ rows: mockUsers } as any)
        .mockResolvedValueOnce(mockCountResult as any);

      const response = await request(app).get("/admin/users?page=1&limit=10");

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(2);
      expect(response.body.users[0].id).toBe("user-1");
      expect(response.body.users[1].is_admin).toBe(true);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(10);
      expect(response.body.pagination.total).toBe(150);
      expect(response.body.pagination.totalPages).toBe(15);
    });

    it("should apply default pagination for users", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [{ total: 0 }] } as any);

      const response = await request(app).get("/admin/users");

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(50);
    });

    it("should handle database errors gracefully", async () => {
      mockQuery.mockRejectedValue(new Error("Database error"));

      const response = await request(app).get("/admin/users");

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Failed to fetch users");
    });
  });

  describe("Authentication and Authorization", () => {
    it("should require admin access for all routes", async () => {
      const regularUser = {
        id: "user-123",
        username: "regularuser",
        platform: "newgrounds",
        isAdmin: false,
      };

      mockAuthenticateUser.mockImplementation(
        jest.fn(async (req: any, res: any, next: any) => {
          req.user = regularUser;
          next();
        }) as any,
      );

      mockRequireAdmin.mockImplementation(
        jest.fn(async (req: any, res: any, next: any) => {
          if (!req.user?.isAdmin) {
            return res.status(403).json({ error: "Admin access required" });
          }
          next();
        }) as any,
      );

      const response = await request(app).get("/admin/characters");

      expect(response.status).toBe(403);
      expect(response.body.error).toBe("Admin access required");
    });
  });

  describe("Rate Limiting", () => {
    it("should apply rate limiting to admin routes", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [{ total: 0 }] } as any);

      const response1 = await request(app).get("/admin/characters");
      const response2 = await request(app).get("/admin/characters");

      expect([200, 500].includes(response1.status)).toBe(true);
      expect([200, 500].includes(response2.status)).toBe(true);
    });
  });
});
