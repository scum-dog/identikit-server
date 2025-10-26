import { query } from "./database";
import { log } from "./logger";

export enum JobPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  CRITICAL = 4,
}

export interface CharacterProcessingJobData {
  userId: string;
  characterId?: string;
  action: "create" | "update" | "delete";
  characterData?: object;
  metadata?: {
    adminUserId?: string;
    reason?: string;
    userAgent?: string;
    ipAddress?: string;
    timestamp?: Date;
  };
}

export interface QueueJob {
  id: string;
  data: CharacterProcessingJobData;
  priority: JobPriority;
  status: "pending" | "processing" | "completed" | "failed";
  created_at: Date;
  processed_at?: Date;
  error?: string;
}

class CharacterProcessingQueue {
  private jobs: Map<string, QueueJob> = new Map();
  private processing = false;

  async addJob(
    data: CharacterProcessingJobData,
    priority: JobPriority = JobPriority.NORMAL,
  ): Promise<string> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const job: QueueJob = {
      id: jobId,
      data,
      priority,
      status: "pending",
      created_at: new Date(),
    };

    this.jobs.set(jobId, job);
    log.info("Job queued", { jobId, action: data.action, priority });

    this.processJob(jobId);

    return jobId;
  }

  private async processJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    try {
      job.status = "processing";
      job.processed_at = new Date();

      log.info("Processing job", { jobId, action: job.data.action });

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

      job.status = "completed";
      log.info("Job completed", { jobId, action: job.data.action });
    } catch (error) {
      job.status = "failed";
      job.error = error instanceof Error ? error.message : String(error);
      log.error("Job failed", {
        jobId,
        action: job.data.action,
        error: job.error,
      });
    }
  }

  private async processCreateCharacter(
    data: CharacterProcessingJobData,
  ): Promise<void> {
    if (!data.characterData) {
      throw new Error("Character data is required for creation");
    }

    await query(
      `INSERT INTO characters (user_id, character_data)
       VALUES ($1, $2)`,
      [data.userId, JSON.stringify(data.characterData)],
    );
  }

  private async processUpdateCharacter(
    data: CharacterProcessingJobData,
  ): Promise<void> {
    if (!data.characterId) {
      throw new Error("Character ID is required for update");
    }

    const canEdit = await query<{ can_edit: boolean }>(
      "SELECT can_user_edit_character($1, $2) as can_edit",
      [data.characterId, data.userId],
    );

    if (!canEdit.rows[0]?.can_edit) {
      throw new Error(
        "Cannot edit character: edit window expired or character already edited",
      );
    }

    await query(
      `UPDATE characters
       SET character_data = $1, last_edited_at = NOW(), is_edited = true
       WHERE id = $2 AND user_id = $3`,
      [JSON.stringify(data.characterData), data.characterId, data.userId],
    );
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

    await query(
      "UPDATE characters SET is_deleted = true, deleted_at = NOW(), deleted_by = $1 WHERE id = $2",
      [adminUserId, data.characterId],
    );
  }

  getJob(jobId: string): QueueJob | undefined {
    return this.jobs.get(jobId);
  }

  getJobStatus(jobId: string): string {
    const job = this.jobs.get(jobId);
    return job?.status || "not_found";
  }
}

const characterQueue = new CharacterProcessingQueue();

export const addCharacterProcessingJob = (
  data: CharacterProcessingJobData,
  priority: JobPriority = JobPriority.NORMAL,
): Promise<string> => {
  return characterQueue.addJob(data, priority);
};

export const getCharacterProcessingJob = (
  jobId: string,
): QueueJob | undefined => {
  return characterQueue.getJob(jobId);
};

export const getCharacterProcessingJobStatus = (jobId: string): string => {
  return characterQueue.getJobStatus(jobId);
};
