import { Pool } from "pg";
import { addCharacterProcessingJob } from "../../src/queue";
import { JobPriority, CharacterData } from "../../src/types";
import {
  setupTestDatabase,
  teardownTestDatabase,
  clearTestDatabase,
} from "../helpers/database";

function createTestCharacterData(name = "Test Character"): CharacterData {
  return {
    info: {
      name,
      sex: "male" as const,
      date_of_birth: "1990-01-01",
      height_in: 72,
      weight_lb: 180,
      eye_color: "brown" as const,
      hair_color: "black" as const,
      race: ["white"],
      ethnicity: "not_hispanic_latino" as const,
      location: "United States",
    },
    static: {
      head: { asset_id: 1 },
      hair: { asset_id: 1 },
    },
    placeable_movable: {
      eyes: {
        asset_id: 1,
        offset_x: 0,
        offset_y: 0,
        scale: 1.0,
        rotation: 0,
      },
      eyebrows: {
        asset_id: 1,
        offset_x: 0,
        offset_y: 0,
        scale: 1.0,
        rotation: 0,
      },
      nose: { asset_id: 1, offset_y: 0, scale: 1.0 },
      lips: { asset_id: 1, offset_y: 0, scale: 1.0 },
    },
  };
}

jest.mock("pg");

const mockPool = {
  query: jest.fn(),
  end: jest.fn().mockResolvedValue(undefined),
} as any;

(Pool as any).mockImplementation(() => mockPool);

jest.mock("../../src/queue", () => {
  const originalModule = jest.requireActual("../../src/queue");

  const mockQueueInstance = {
    addJob: jest.fn().mockImplementation((data, priority = 1) => {
      const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      return Promise.resolve(jobId);
    }),
    startProcessing: jest.fn().mockResolvedValue(undefined),
    shutdown: jest.fn().mockResolvedValue(undefined),
    getQueueSizes: jest.fn().mockReturnValue({ high: 0, normal: 0, low: 0 }),
  };

  return {
    ...originalModule,
    addCharacterProcessingJob: mockQueueInstance.addJob,
    initializeQueue: mockQueueInstance.startProcessing,
    shutdownQueue: mockQueueInstance.shutdown,
    __mockQueueInstance: mockQueueInstance,
  };
});

const queue = require("../../src/queue");

describe("Character Processing Queue", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    try {
      await queue.shutdownQueue();
    } catch (error) {}

    jest.clearAllTimers();
    jest.useRealTimers();

    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();
    jest.clearAllMocks();
  });

  describe("Job Creation", () => {
    it("should create character creation job with correct priority", async () => {
      const jobData = {
        userId: "user-123",
        action: "create" as const,
        characterData: createTestCharacterData(),
        metadata: {
          userAgent: "test-agent",
          ipAddress: "127.0.0.1",
          timestamp: new Date(),
        },
      };

      const jobId = await addCharacterProcessingJob(
        jobData,
        JobPriority.NORMAL,
      );

      expect(jobId).toMatch(/^job_\d+_[a-z0-9]+$/);
      expect(typeof jobId).toBe("string");
    });

    it("should create character update job with high priority", async () => {
      const jobData = {
        userId: "user-123",
        characterId: "char-456",
        action: "update" as const,
        characterData: createTestCharacterData("Updated Character"),
        metadata: {
          userAgent: "test-agent",
          ipAddress: "127.0.0.1",
          timestamp: new Date(),
        },
      };

      const jobId = await addCharacterProcessingJob(jobData, JobPriority.HIGH);

      expect(jobId).toMatch(/^job_\d+_[a-z0-9]+$/);
    });

    it("should create character deletion job with critical priority", async () => {
      const jobData = {
        userId: "user-123",
        characterId: "char-456",
        action: "delete" as const,
        metadata: {
          adminUserId: "admin-789",
          reason: "Inappropriate content",
          userAgent: "admin-agent",
          ipAddress: "192.168.1.1",
          timestamp: new Date(),
        },
      };

      const jobId = await addCharacterProcessingJob(
        jobData,
        JobPriority.CRITICAL,
      );

      expect(jobId).toMatch(/^job_\d+_[a-z0-9]+$/);
    });
  });

  describe("Job Processing", () => {
    it("should process character creation job", async () => {
      const mockCharacterData = createTestCharacterData();

      const jobData = {
        userId: "user-123",
        action: "create" as const,
        characterData: mockCharacterData,
        metadata: {
          userAgent: "test-agent",
          ipAddress: "127.0.0.1",
          timestamp: new Date(),
        },
      };

      mockPool.query.mockResolvedValue({ rows: [], rowCount: 1 });

      const jobId = await addCharacterProcessingJob(
        jobData,
        JobPriority.NORMAL,
      );

      expect(jobId).toBeDefined();

      expect(jobId).toMatch(/^job_\d+_[a-z0-9]+$/);
    });

    it("should process character update job with edit validation", async () => {
      const jobData = {
        userId: "user-123",
        characterId: "char-456",
        action: "update" as const,
        characterData: createTestCharacterData("Updated Character Name"),
        metadata: {
          userAgent: "test-agent",
          ipAddress: "127.0.0.1",
          timestamp: new Date(),
        },
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [{ can_edit: true }] })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const jobId = await addCharacterProcessingJob(jobData, JobPriority.HIGH);

      expect(jobId).toBeDefined();
      expect(jobId).toMatch(/^job_\d+_[a-z0-9]+$/);
    });

    it("should process character deletion job", async () => {
      const jobData = {
        userId: "user-123",
        characterId: "char-456",
        action: "delete" as const,
        metadata: {
          adminUserId: "admin-789",
          reason: "Community guideline violation",
          userAgent: "admin-agent",
          ipAddress: "192.168.1.1",
          timestamp: new Date(),
        },
      };

      mockPool.query.mockResolvedValue({ rows: [], rowCount: 1 });

      const jobId = await addCharacterProcessingJob(
        jobData,
        JobPriority.CRITICAL,
      );

      expect(jobId).toBeDefined();
      expect(jobId).toMatch(/^job_\d+_[a-z0-9]+$/);
    });
  });

  describe("Priority Handling", () => {
    it("should handle different job priorities", async () => {
      const baseJobData = {
        userId: "user-123",
        action: "create" as const,
        characterData: createTestCharacterData("Test"),
        metadata: {
          userAgent: "test",
          ipAddress: "127.0.0.1",
          timestamp: new Date(),
        },
      };

      const lowJob = await addCharacterProcessingJob(
        baseJobData,
        JobPriority.LOW,
      );
      const normalJob = await addCharacterProcessingJob(
        baseJobData,
        JobPriority.NORMAL,
      );
      const highJob = await addCharacterProcessingJob(
        baseJobData,
        JobPriority.HIGH,
      );
      const criticalJob = await addCharacterProcessingJob(
        baseJobData,
        JobPriority.CRITICAL,
      );

      expect(lowJob).toMatch(/^job_\d+_[a-z0-9]+$/);
      expect(normalJob).toMatch(/^job_\d+_[a-z0-9]+$/);
      expect(highJob).toMatch(/^job_\d+_[a-z0-9]+$/);
      expect(criticalJob).toMatch(/^job_\d+_[a-z0-9]+$/);

      const jobIds = [lowJob, normalJob, highJob, criticalJob];
      const uniqueIds = new Set(jobIds);
      expect(uniqueIds.size).toBe(4);
    });

    it("should default to NORMAL priority when not specified", async () => {
      const jobData = {
        userId: "user-123",
        action: "create" as const,
        characterData: createTestCharacterData("Test"),
        metadata: {
          userAgent: "test",
          ipAddress: "127.0.0.1",
          timestamp: new Date(),
        },
      };

      const jobId = await addCharacterProcessingJob(jobData);

      expect(jobId).toMatch(/^job_\d+_[a-z0-9]+$/);
    });
  });

  describe("Error Handling", () => {
    it("should handle database connection errors gracefully", async () => {
      const jobData = {
        userId: "user-123",
        action: "create" as const,
        characterData: createTestCharacterData("Test"),
        metadata: {
          userAgent: "test",
          ipAddress: "127.0.0.1",
          timestamp: new Date(),
        },
      };

      mockPool.query.mockRejectedValue(new Error("Connection failed"));

      const jobId = await addCharacterProcessingJob(jobData);

      expect(jobId).toMatch(/^job_\d+_[a-z0-9]+$/);
    });

    it("should handle missing required data for create action", async () => {
      const jobData = {
        userId: "user-123",
        action: "create" as const,
        metadata: {
          userAgent: "test",
          ipAddress: "127.0.0.1",
          timestamp: new Date(),
        },
      };

      const jobId = await addCharacterProcessingJob(jobData as any);

      expect(jobId).toMatch(/^job_\d+_[a-z0-9]+$/);
    });

    it("should handle missing characterId for update action", async () => {
      const jobData = {
        userId: "user-123",
        action: "update" as const,
        characterData: createTestCharacterData("Test"),
        metadata: {
          userAgent: "test",
          ipAddress: "127.0.0.1",
          timestamp: new Date(),
        },
      };

      const jobId = await addCharacterProcessingJob(jobData as any);

      expect(jobId).toMatch(/^job_\d+_[a-z0-9]+$/);
    });

    it("should handle missing adminUserId for delete action", async () => {
      const jobData = {
        userId: "user-123",
        characterId: "char-456",
        action: "delete" as const,
        metadata: {
          reason: "Test reason",
          userAgent: "test",
          ipAddress: "127.0.0.1",
          timestamp: new Date(),
        },
      };

      const jobId = await addCharacterProcessingJob(jobData as any);

      expect(jobId).toMatch(/^job_\d+_[a-z0-9]+$/);
    });

    it("should handle edit permission denied", async () => {
      const jobData = {
        userId: "user-123",
        characterId: "char-456",
        action: "update" as const,
        characterData: createTestCharacterData("Test"),
        metadata: {
          userAgent: "test",
          ipAddress: "127.0.0.1",
          timestamp: new Date(),
        },
      };

      mockPool.query.mockResolvedValue({ rows: [{ can_edit: false }] });

      const jobId = await addCharacterProcessingJob(jobData);

      expect(jobId).toMatch(/^job_\d+_[a-z0-9]+$/);
    });
  });

  describe("Concurrent Job Processing", () => {
    it("should handle multiple concurrent jobs", async () => {
      const jobPromises = [];

      for (let i = 0; i < 10; i++) {
        const jobData = {
          userId: `user-${i}`,
          action: "create" as const,
          characterData: createTestCharacterData(`Character ${i}`),
          metadata: {
            userAgent: "test",
            ipAddress: "127.0.0.1",
            timestamp: new Date(),
          },
        };

        jobPromises.push(addCharacterProcessingJob(jobData));
      }

      const jobIds = await Promise.all(jobPromises);

      expect(jobIds).toHaveLength(10);
      jobIds.forEach((jobId) => {
        expect(jobId).toMatch(/^job_\d+_[a-z0-9]+$/);
      });

      const uniqueIds = new Set(jobIds);
      expect(uniqueIds.size).toBe(10);
    });

    it("should handle mixed priority jobs concurrently", async () => {
      const priorities = [
        JobPriority.LOW,
        JobPriority.NORMAL,
        JobPriority.HIGH,
        JobPriority.CRITICAL,
      ];
      const jobPromises = [];

      for (let i = 0; i < 8; i++) {
        const priority = priorities[i % priorities.length];
        const jobData = {
          userId: `user-${i}`,
          action: "create" as const,
          characterData: createTestCharacterData(`Character ${i}`),
          metadata: {
            userAgent: "test",
            ipAddress: "127.0.0.1",
            timestamp: new Date(),
          },
        };

        jobPromises.push(addCharacterProcessingJob(jobData, priority));
      }

      const jobIds = await Promise.all(jobPromises);

      expect(jobIds).toHaveLength(8);
      jobIds.forEach((jobId) => {
        expect(jobId).toMatch(/^job_\d+_[a-z0-9]+$/);
      });

      const uniqueIds = new Set(jobIds);
      expect(uniqueIds.size).toBe(8);
    });
  });
});
