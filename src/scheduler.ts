import { query, oauthStateQueries } from "./database";
import { log } from "./utils/logger";
import { ONE_MINUTE, ONE_HOUR } from "./utils/constants";

export class DatabaseScheduler {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private readonly cleanupIntervalMs: number;

  constructor(cleanupIntervalMinutes: number = 60) {
    this.cleanupIntervalMs =
      cleanupIntervalMinutes === 60
        ? ONE_HOUR
        : cleanupIntervalMinutes * ONE_MINUTE;
  }

  start(): void {
    if (this.intervalId) {
      log.warn("DatabaseScheduler is already running");
      return;
    }

    log.info("Starting DatabaseScheduler", {
      cleanupIntervalMinutes: this.cleanupIntervalMs / ONE_MINUTE,
    });

    this.runCleanup();

    this.intervalId = setInterval(() => {
      this.runCleanup();
    }, this.cleanupIntervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      log.info("DatabaseScheduler stopped");
    }
  }

  private async runCleanup(): Promise<void> {
    try {
      await this.runSessionCleanup();
      await this.runOAuthStateCleanup();
    } catch (error) {
      log.error("Cleanup failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async runSessionCleanup(): Promise<void> {
    const sessionResult = await query(
      "SELECT cleanup_expired_sessions() as deleted_count",
    );
    const deletedSessions = sessionResult.rows[0]?.deleted_count || 0;

    log.info("Session cleanup completed", {
      deletedSessions,
    });
  }

  private async runOAuthStateCleanup(): Promise<void> {
    const deletedStates = await oauthStateQueries.cleanup();

    log.info("OAuth state cleanup completed", {
      deletedStates,
    });
  }
}
