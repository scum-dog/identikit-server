import request from "supertest";
import express from "express";
import charactersRouter from "../../src/routes/characters";
import { authenticateUser } from "../../src/auth/middleware";
import { addCharacterProcessingJob } from "../../src/queue";
import { query } from "../../src/database";
import {
  setupTestDatabase,
  teardownTestDatabase,
  clearTestDatabase,
} from "../helpers/database";
import { generateMockCharacterData } from "../../src/utils/mockData";

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

const mockCharacterQueries = {
  findByUserId: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  searchByLocation: jest.fn(),
  getRandomCharacters: jest.fn(),
  getTotalCount: jest.fn(),
  adminDelete: jest.fn(),
} as any;

(require("../../src/database") as any).characterQueries = mockCharacterQueries;

describe("Characters Routes", () => {
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
    app.use("/characters", charactersRouter);

    mockUser = {
      id: "test-user-123",
      username: "testuser",
      platform: "newgrounds",
      isAdmin: false,
    };

    mockAuthenticateUser.mockImplementation(
      jest.fn(async (req: any, res: any, next: any) => {
        req.user = mockUser;
        next();
      }) as any,
    );

    jest.clearAllMocks();
  });

  describe("GET /characters/me", () => {
    it("should return user's character when it exists", async () => {
      const mockCharacterData = generateMockCharacterData();
      const mockCharacter = {
        id: "char-123",
        user_id: mockUser.id,
        character_data: mockCharacterData.character_data,
        created_at: "2024-01-01T00:00:00.000Z",
        last_edited_at: "2024-01-01T00:00:00.000Z",
        is_edited: false,
        is_deleted: false,
        deleted_at: null,
        deleted_by: null,
      };

      mockCharacterQueries.findByUserId.mockResolvedValue(mockCharacter);
      mockQuery.mockResolvedValue({
        rows: [{ can_user_edit_character: true }],
      } as any);

      const response = await request(app).get("/characters/me");

      expect(response.status).toBe(200);
      expect(response.body.character_data.info.name).toBe(
        mockCharacterData.character_data.info.name,
      );
      expect(response.body.character_data.static.head.asset_id).toBe(
        mockCharacterData.character_data.static.head.asset_id,
      );
      expect(response.body.metadata.upload_id).toBe("char-123");
      expect(response.body.can_edit).toBe(true);
    });

    it("should return 404 when user has no character", async () => {
      mockCharacterQueries.findByUserId.mockResolvedValue(null);

      const response = await request(app).get("/characters/me");

      expect(response.status).toBe(404);
      expect(response.body.error.message).toBe("Character not found");
    });

    it("should handle database errors gracefully", async () => {
      mockCharacterQueries.findByUserId.mockRejectedValue(
        new Error("Database error"),
      );

      const response = await request(app).get("/characters/me");

      expect(response.status).toBe(500);
      expect(response.body.error.message).toBe("Failed to retrieve character");
    });
  });

  describe("POST /characters", () => {
    it("should create new character when user has none", async () => {
      const mockCharacterData = generateMockCharacterData();

      mockCharacterQueries.findByUserId.mockResolvedValue(null);
      mockAddCharacterProcessingJob.mockResolvedValue("job-123");

      const response = await request(app)
        .post("/characters")
        .send(mockCharacterData);

      expect(response.status).toBe(202);
      expect(response.body.message).toBe(
        "Character creation queued successfully",
      );
      expect(response.body.jobId).toBe("job-123");
      expect(response.body.status).toBe("processing");

      expect(mockAddCharacterProcessingJob).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          action: "create",
          characterData: expect.objectContaining({
            info: expect.any(Object),
            static: expect.any(Object),
            placeable_movable: expect.any(Object),
          }),
          metadata: expect.any(Object),
        }),
        2,
      );
    });

    it("should return conflict when user already has character", async () => {
      const mockCharacterData = generateMockCharacterData();
      const existingCharacter = { id: "existing-char" };

      mockCharacterQueries.findByUserId.mockResolvedValue(
        existingCharacter as any,
      );

      const response = await request(app)
        .post("/characters")
        .send(mockCharacterData);

      expect(response.status).toBe(409);
      expect(response.body.error.message).toBe(
        "User already has a character. Use PUT to update.",
      );
    });

    it("should validate character data", async () => {
      mockCharacterQueries.findByUserId.mockResolvedValue(null);

      const invalidData = {
        character_data: {
          info: {
            name: "",
          },
        },
      };

      const response = await request(app).post("/characters").send(invalidData);

      expect(response.status).toBe(400);
    });

    it("should handle queue errors gracefully", async () => {
      const mockCharacterData = generateMockCharacterData();

      mockCharacterQueries.findByUserId.mockResolvedValue(null);
      mockAddCharacterProcessingJob.mockRejectedValue(new Error("Queue error"));

      const response = await request(app)
        .post("/characters")
        .send({ character_data: mockCharacterData.character_data });

      expect(response.status).toBe(500);
      expect(response.body.error.message).toBe("Failed to create character");
    });
  });

  describe("PUT /characters/me", () => {
    it("should update existing character", async () => {
      const existingCharacter = {
        id: "char-123",
        user_id: mockUser.id,
      };

      mockCharacterQueries.findByUserId.mockResolvedValue(
        existingCharacter as any,
      );
      mockAddCharacterProcessingJob.mockResolvedValue("job-456");

      const updateData = {
        character_data: {
          info: {
            name: "Updated Name",
          },
        },
      };

      const response = await request(app)
        .put("/characters/me")
        .send(updateData);

      expect(response.status).toBe(202);
      expect(response.body.message).toBe(
        "Character update queued successfully",
      );
      expect(response.body.jobId).toBe("job-456");

      expect(mockAddCharacterProcessingJob).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          characterId: "char-123",
          action: "update",
          characterData: updateData.character_data,
          metadata: expect.any(Object),
        }),
        3,
      );
    });

    it("should return 404 when character doesn't exist", async () => {
      mockCharacterQueries.findByUserId.mockResolvedValue(null);

      const updateData = {
        character_data: {
          info: {
            name: "Updated Name",
          },
        },
      };

      const response = await request(app)
        .put("/characters/me")
        .send(updateData);

      expect(response.status).toBe(404);
      expect(response.body.error.message).toBe("Character not found");
    });

    it("should handle edit permission errors", async () => {
      const existingCharacter = { id: "char-123", user_id: mockUser.id };

      mockCharacterQueries.findByUserId.mockResolvedValue(
        existingCharacter as any,
      );
      mockAddCharacterProcessingJob.mockRejectedValue(
        new Error("Cannot edit character: weekly limit exceeded"),
      );

      const updateData = {
        character_data: {
          info: {
            name: "Updated Name",
          },
        },
      };

      const response = await request(app)
        .put("/characters/me")
        .send(updateData);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain("Cannot edit character");
    });
  });

  describe("GET /characters?view=plaza", () => {
    it("should return random characters when no country specified", async () => {
      const mockCharacters = [
        {
          id: "char-1",
          character_data: {
            info: { location: "United States" },
          },
          created_at: "2024-01-01T00:00:00.000Z",
          last_edited_at: "2024-01-01T00:00:00.000Z",
        },
        {
          id: "char-2",
          character_data: { info: { location: "Canada" } },
          created_at: "2024-01-02T00:00:00.000Z",
          last_edited_at: "2024-01-03T00:00:00.000Z",
        },
      ];

      mockCharacterQueries.getRandomCharacters.mockResolvedValue(
        mockCharacters as any,
      );
      mockCharacterQueries.getTotalCount.mockResolvedValue(2);

      const response = await request(app).get(
        "/characters?view=plaza&limit=100",
      );

      expect(response.status).toBe(200);
      expect(response.body.characters).toHaveLength(2);
      expect(response.body.count).toBe(2);
      expect(response.body.characters[0].upload_id).toBe("char-1");
      expect(response.body.characters[1].edit_time).not.toBeNull();
    });

    it("should filter by country when specified", async () => {
      const mockCharacters = [
        {
          id: "char-1",
          character_data: { info: { location: "Canada" } },
          created_at: "2024-01-01T00:00:00.000Z",
          last_edited_at: "2024-01-01T00:00:00.000Z",
        },
      ];

      mockCharacterQueries.searchByLocation.mockResolvedValue(
        mockCharacters as any,
      );
      mockCharacterQueries.getTotalCount.mockResolvedValue(1);

      const response = await request(app).get(
        "/characters?view=plaza&country=Canada&limit=50",
      );

      expect(response.status).toBe(200);
      expect(response.body.characters).toHaveLength(1);
      expect(response.body.filters.country).toBe("Canada");
      expect(mockCharacterQueries.searchByLocation).toHaveBeenCalledWith(
        "Canada",
        50,
        0,
      );
    });

    it("should return 404 for non-plaza view", async () => {
      const response = await request(app).get("/characters?view=other");

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Route not found");
    });

    it("should handle database errors in plaza view", async () => {
      mockCharacterQueries.getRandomCharacters.mockRejectedValue(
        new Error("Database error"),
      );

      const response = await request(app).get("/characters?view=plaza");

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Failed to fetch plaza characters");
    });
  });

  describe("GET /characters/:id", () => {
    it("should return specific character by ID", async () => {
      const mockCharacterData = { info: { location: "United States" } };
      const mockQueryResult = {
        rows: [
          {
            id: "char-123",
            character_data: mockCharacterData,
            created_at: "2024-01-01T00:00:00.000Z",
            last_edited_at: "2024-01-02T00:00:00.000Z",
          },
        ],
      };

      mockQuery.mockResolvedValue(mockQueryResult as any);

      const response = await request(app).get("/characters/char-123");

      expect(response.status).toBe(200);
      expect(response.body.character_data).toEqual(mockCharacterData);
      expect(response.body.metadata.upload_id).toBe("char-123");
      expect(response.body.metadata.edit_time).not.toBeNull();
    });

    it("should return 404 for non-existent character", async () => {
      mockQuery.mockResolvedValue({ rows: [] } as any);

      const response = await request(app).get("/characters/non-existent");

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Character not found");
    });

    it("should handle database errors gracefully", async () => {
      mockQuery.mockRejectedValue(new Error("Database error"));

      const response = await request(app).get("/characters/char-123");

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Failed to retrieve character");
    });
  });
});
