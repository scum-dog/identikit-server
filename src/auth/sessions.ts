import crypto from "crypto";
import { query } from "../database";
import { SessionData, CreateSessionData, DatabaseSession } from "../types";

export class SessionManager {
  private static readonly DEFAULT_EXPIRY_HOURS = 24 * 7; // 7 days

  static generateToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  static async createSession(sessionData: CreateSessionData): Promise<string> {
    const sessionId = this.generateToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.DEFAULT_EXPIRY_HOURS);

    await query(`DELETE FROM user_sessions WHERE user_id = $1`, [
      sessionData.userId,
    ]);

    await query(
      `INSERT INTO user_sessions
       (session_id, user_id, platform, platform_user_id, platform_session_id, username, is_admin, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        sessionId,
        sessionData.userId,
        sessionData.platform,
        sessionData.platformUserId,
        sessionData.platformSessionId,
        sessionData.username,
        sessionData.isAdmin,
        expiresAt,
      ],
    );

    return sessionId;
  }

  static async validateSession(sessionId: string): Promise<SessionData | null> {
    if (!sessionId) {
      return null;
    }

    const result = await query<DatabaseSession>(
      `SELECT session_id, user_id, platform, platform_user_id, platform_session_id, username, is_admin,
              created_at, expires_at
       FROM user_sessions
       WHERE session_id = $1 AND expires_at > NOW()`,
      [sessionId],
    );

    if (result.rows.length === 0) {
      return null;
    }

    const session = result.rows[0];

    return {
      id: session.session_id,
      userId: session.user_id,
      platform: session.platform,
      platformUserId: session.platform_user_id,
      platformSessionId: session.platform_session_id,
      username: session.username,
      isAdmin: session.is_admin,
      createdAt: session.created_at,
      expiresAt: session.expires_at,
    };
  }

  static async deleteSession(sessionId: string): Promise<void> {
    await query(`DELETE FROM user_sessions WHERE session_id = $1`, [sessionId]);
  }
}
