import { Router, Request, Response } from "express";
import { query } from "../database";
import { validateRequest } from "../utils/validation";
import { z } from "zod";
import { authenticateUser, requireAdmin } from "../auth/middleware";
import rateLimit from "express-rate-limit";
import { addCharacterProcessingJob } from "../queue";
import { JobPriority } from "../types";
import { CharacterWithUser, User } from "../types";
import { log } from "../utils/logger";
import { FIVE_MINUTES } from "../utils/constants";

const router = Router();
const adminRateLimit = rateLimit({
  windowMs: FIVE_MINUTES,
  max: 50,
  message: { error: "Too many admin actions, please slow down!!!" },
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

// require auth & admin privileges
router.use(authenticateUser);
router.use(requireAdmin);
router.use(adminRateLimit);

// GET /admin/characters - get all characters for moderation
router.get("/characters", async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = (page - 1) * limit;
    const showDeleted = req.query.showDeleted === "true";

    const whereClause = showDeleted ? "" : "WHERE is_deleted = false";
    const orderBy = "ORDER BY created_at DESC";

    const result = await query<CharacterWithUser>(
      `
      SELECT
        c.id, c.user_id, c.character_data, c.created_at, c.last_edited_at,
        c.is_deleted, c.deleted_at, c.deleted_by,
        u.username, u.platform, u.platform_user_id
      FROM characters c
      JOIN users u ON c.user_id = u.id
      ${whereClause}
      ${orderBy}
      LIMIT $1 OFFSET $2
    `,
      [limit, offset],
    );

    const countResult = await query<{ total: number }>(`
      SELECT COUNT(*) as total
      FROM characters c
      ${whereClause}
    `);

    res.json({
      characters: result.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].total.toString()),
        totalPages: Math.ceil(countResult.rows[0].total / limit),
      },
    });
  } catch (error) {
    log.error("Admin get characters error", { error });
    res.status(500).json({ error: "Failed to fetch characters" });
  }
});

// GET /admin/characters/:id - get specific character with full details
router.get("/characters/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query<CharacterWithUser>(
      `
      SELECT
        c.*,
        u.username, u.platform, u.platform_user_id,
        u.created_at as user_created_at, u.last_login
      FROM characters c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = $1
    `,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Character not found" });
    }

    const character = result.rows[0];

    res.json({
      character,
    });
  } catch (error) {
    log.error("Admin get character details error", { error });
    res.status(500).json({ error: "Failed to fetch character details" });
  }
});

// DELETE /admin/characters/:id - delete a character
router.delete(
  "/characters/:id",
  validateRequest(
    z.object({
      reason: z
        .string()
        .trim()
        .min(1, "Reason is required")
        .max(500, "Reason must be 500 characters or less"),
    }),
  ),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const charResult = await query<{
        id: string;
        user_id: string;
        is_deleted: boolean;
      }>("SELECT id, user_id, is_deleted FROM characters WHERE id = $1", [id]);

      if (charResult.rows.length === 0) {
        return res.status(404).json({ error: "Character not found" });
      }

      const character = charResult.rows[0];

      if (character.is_deleted) {
        return res.status(409).json({ error: "Character is already deleted" });
      }

      const job = await addCharacterProcessingJob(
        {
          userId: character.user_id,
          characterId: id,
          action: "delete",
          metadata: {
            adminUserId: req.user!.id,
            reason,
            userAgent: req.get("User-Agent"),
            ipAddress: req.ip,
            timestamp: new Date(),
          },
        },
        JobPriority.CRITICAL,
      );

      res.json({
        success: true,
        message: `Character deletion queued successfully`,
        jobId: job,
        status: "processing",
        deletedCharacter: {
          id: character.id,
        },
        reason,
      });
    } catch (error) {
      log.error("Admin delete character error", { error });
      res.status(500).json({ error: "Failed to delete character" });
    }
  },
);

// GET /admin/users - get all users for management
router.get("/users", async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = (page - 1) * limit;

    const result = await query<User>(
      `
      SELECT
        u.id, u.username, u.platform, u.platform_user_id,
        u.created_at, u.last_login, u.is_admin
      FROM users u
      ORDER BY u.created_at DESC
      LIMIT $1 OFFSET $2
    `,
      [limit, offset],
    );

    const countResult = await query<{ total: number }>(
      "SELECT COUNT(*) as total FROM users",
    );

    res.json({
      users: result.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].total.toString()),
        totalPages: Math.ceil(countResult.rows[0].total / limit),
      },
    });
  } catch (error) {
    log.error("Admin get users error", { error });
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

export default router;
