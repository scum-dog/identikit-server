import { Pool } from "pg";
import { log } from "./utils/logger";
import { JobPriority, CharacterProcessingJobData, QueueJob } from "./types";
import { ONE_SECOND, THIRTY_SECONDS } from "./utils/constants";

const queuePool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 20,
  idleTimeoutMillis: THIRTY_SECONDS,
  connectionTimeoutMillis: 2000,
});

const highPriorityJobs: QueueJob[] = [];
const normalPriorityJobs: QueueJob[] = [];
const lowPriorityJobs: QueueJob[] = [];

class CharacterProcessingQueue {
  private workers: Promise<void>[] = [];
  private shouldStop = false;

  async addJob(
    data: CharacterProcessingJobData,
    priority: JobPriority = JobPriority.NORMAL,
  ): Promise<string> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const job: QueueJob = { id: jobId, data, priority };

    if (priority >= JobPriority.HIGH) {
      highPriorityJobs.push(job);
    } else if (priority === JobPriority.NORMAL) {
      normalPriorityJobs.push(job);
    } else {
      lowPriorityJobs.push(job);
    }

    log.info("Job queued", {
      jobId,
      action: data.action,
      priority,
      queueSizes: this.getQueueSizes(),
    });

    return jobId;
  }

  async startProcessing(): Promise<void> {
    log.info("Starting queue with 5 workers");

    for (let i = 0; i < 5; i++) {
      this.workers.push(this.runWorker(i + 1));
    }
  }

  async shutdown(): Promise<void> {
    this.shouldStop = true;
    await Promise.all(this.workers);
    await queuePool.end();
    log.info("Queue stopped");
  }

  private getQueueSizes() {
    return {
      high: highPriorityJobs.length,
      normal: normalPriorityJobs.length,
      low: lowPriorityJobs.length,
    };
  }

  private getNextJob(): QueueJob | null {
    return (
      highPriorityJobs.shift() ||
      normalPriorityJobs.shift() ||
      lowPriorityJobs.shift() ||
      null
    );
  }

  private async runWorker(workerId: number): Promise<void> {
    log.info(`Worker ${workerId} started`);

    while (!this.shouldStop) {
      try {
        const job = this.getNextJob();

        if (job) {
          await this.processJob(job, workerId);
        } else {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } catch (error) {
        log.error(`Worker ${workerId} error:`, { error });
        await new Promise((resolve) => setTimeout(resolve, ONE_SECOND));
      }
    }

    log.info(`Worker ${workerId} stopped`);
  }

  private async processJob(job: QueueJob, workerId: number): Promise<void> {
    try {
      log.info(`Worker ${workerId} processing job`, {
        jobId: job.id,
        action: job.data.action,
      });

      switch (job.data.action) {
        case "create":
          await this.processCreateCharacter(job.data);
          break;
        case "update":
          await this.processUpdateCharacter(job.data);
          break;
        case "delete":
          await this.processDeleteCharacter(job.data);
          break;
        default:
          throw new Error(`Unknown action: ${job.data.action}`);
      }

      log.info(`Job completed`, { jobId: job.id, action: job.data.action });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      log.error("Job failed", {
        jobId: job.id,
        action: job.data.action,
        error: errorMessage,
      });
    }
  }

  private async processCreateCharacter(
    data: CharacterProcessingJobData,
  ): Promise<void> {
    if (!data.characterData) {
      throw new Error("Character data is required for creation");
    }

    await queuePool.query(
      `INSERT INTO characters (user_id, character_data) VALUES ($1, $2)`,
      [data.userId, data.characterData],
    );
  }

  private async processUpdateCharacter(
    data: CharacterProcessingJobData,
  ): Promise<void> {
    if (!data.characterId) {
      throw new Error("Character ID is required for update");
    }

    if (!data.characterData) {
      throw new Error("Character data is required for update");
    }

    await queuePool.query("SELECT update_character_data($1, $2, $3)", [
      data.characterId,
      data.userId,
      data.characterData,
    ]);
  }

  private async processDeleteCharacter(
    data: CharacterProcessingJobData,
  ): Promise<void> {
    if (!data.characterId) {
      throw new Error("Character ID is required for deletion");
    }

    const adminUserId = data.metadata?.adminUserId;
    if (!adminUserId) {
      throw new Error("Admin user ID is required for deletion");
    }

    await queuePool.query(
      "UPDATE characters SET is_deleted = true, deleted_at = NOW(), deleted_by = $1 WHERE id = $2",
      [adminUserId, data.characterId],
    );
  }
}

const characterQueue = new CharacterProcessingQueue();

export const addCharacterProcessingJob = (
  data: CharacterProcessingJobData,
  priority: JobPriority = JobPriority.NORMAL,
): Promise<string> => {
  return characterQueue.addJob(data, priority);
};

export const initializeQueue = async (): Promise<void> => {
  await characterQueue.startProcessing();
};

export const shutdownQueue = async (): Promise<void> => {
  await characterQueue.shutdown();
};
