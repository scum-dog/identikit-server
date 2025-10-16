import { Router, Request, Response } from "express";
import { characterQueries, query } from "../database";
import { validateRequest } from "../validation";
import { z } from "zod";
import { authenticateUser, requireAdmin } from "../auth";
import rateLimit from "express-rate-limit";

const router = Router();
const adminRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: { error: "Too many admin actions, please slow down!!!" },
});

// require auth & admin privileges
router.use(authenticateUser);
router.use(requireAdmin);
router.use(adminRateLimit);

// GET /api/admin/characters - get all characters for moderation
router.get("/characters", async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = (page - 1) * limit;
    const showDeleted = req.query.showDeleted === "true";

    const whereClause = showDeleted ? "" : "WHERE is_deleted = false";
    const orderBy = "ORDER BY created_at DESC";

    const result = await query(
      `
      SELECT
        c.id, c.name, c.country, c.region, c.city,
        c.created_at, c.last_edited_at, c.edit_count,
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

    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM characters c
      ${whereClause}
    `);

    res.json({
      characters: result.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].total),
        totalPages: Math.ceil(countResult.rows[0].total / limit),
      },
    });
  } catch (error) {
    console.error("Admin get characters error:", error);
    res.status(500).json({ error: "Failed to fetch characters" });
  }
});

// GET /api/admin/character/:id - get specific character with full details
router.get("/character/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      `
      SELECT
        c.*,
        u.username, u.platform, u.platform_user_id, u.email,
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

    const editHistory = await query(
      `
      SELECT
        ce.*,
        u.username as editor_username
      FROM character_edits ce
      LEFT JOIN users u ON ce.user_id = u.id
      WHERE ce.character_id = $1
      ORDER BY ce.edited_at DESC
      LIMIT 20
    `,
      [id],
    );

    res.json({
      character: {
        ...character,
        character_data:
          typeof character.character_data === "string"
            ? JSON.parse(character.character_data)
            : character.character_data,
      },
      editHistory: editHistory.rows,
    });
  } catch (error) {
    console.error("Admin get character details error:", error);
    res.status(500).json({ error: "Failed to fetch character details" });
  }
});

// DELETE /api/admin/character/:id - delete a character
router.delete(
  "/character/:id",
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

      const charResult = await query(
        "SELECT id, name, user_id, is_deleted FROM characters WHERE id = $1",
        [id],
      );

      if (charResult.rows.length === 0) {
        return res.status(404).json({ error: "Character not found" });
      }

      const character = charResult.rows[0];

      if (character.is_deleted) {
        return res.status(409).json({ error: "Character is already deleted" });
      }

      await characterQueries.adminDelete(id, req.user!.id, reason);

      res.json({
        success: true,
        message: `Character "${character.name}" has been deleted`,
        deletedCharacter: {
          id: character.id,
          name: character.name,
        },
        reason,
      });
    } catch (error) {
      console.error("Admin delete character error:", error);
      res.status(500).json({ error: "Failed to delete character" });
    }
  },
);

// GET /api/admin/users - get all users for management
router.get("/users", async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = (page - 1) * limit;

    const result = await query(
      `
      SELECT
        u.id, u.username, u.platform, u.platform_user_id,
        u.created_at, u.last_login, u.is_admin,
        COUNT(c.id) as character_count
      FROM users u
      LEFT JOIN characters c ON u.id = c.user_id AND c.is_deleted = false
      GROUP BY u.id
      ORDER BY u.created_at DESC
      LIMIT $1 OFFSET $2
    `,
      [limit, offset],
    );

    const countResult = await query("SELECT COUNT(*) as total FROM users");

    res.json({
      users: result.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].total),
        totalPages: Math.ceil(countResult.rows[0].total / limit),
      },
    });
  } catch (error) {
    console.error("Admin get users error:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// GET /api/admin/actions - get admin action history
router.get("/actions", async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = (page - 1) * limit;

    const result = await query(
      `
      SELECT
        aa.*,
        admin_user.username as admin_username,
        target_char.name as target_character_name,
        target_user.username as target_username
      FROM admin_actions aa
      JOIN users admin_user ON aa.admin_user_id = admin_user.id
      LEFT JOIN characters target_char ON aa.target_character_id = target_char.id
      LEFT JOIN users target_user ON aa.target_user_id = target_user.id
      ORDER BY aa.created_at DESC
      LIMIT $1 OFFSET $2
    `,
      [limit, offset],
    );

    const countResult = await query(
      "SELECT COUNT(*) as total FROM admin_actions",
    );

    res.json({
      actions: result.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].total),
        totalPages: Math.ceil(countResult.rows[0].total / limit),
      },
    });
  } catch (error) {
    console.error("Admin get actions error:", error);
    res.status(500).json({ error: "Failed to fetch admin actions" });
  }
});

// GET /api/admin/stats - get platform statistics
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const stats = await Promise.all([
      query("SELECT COUNT(*) as total_users FROM users"),
      query(
        "SELECT COUNT(*) as total_characters FROM characters WHERE is_deleted = false",
      ),
      query(
        "SELECT COUNT(*) as deleted_characters FROM characters WHERE is_deleted = true",
      ),
      query(
        "SELECT COUNT(*) as total_edits FROM character_edits WHERE edit_type = 'user_edit'",
      ),
      query("SELECT COUNT(*) as admin_actions FROM admin_actions"),
      query(`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM characters
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `),
      query(`
        SELECT country, COUNT(*) as count
        FROM characters
        WHERE is_deleted = false AND country IS NOT NULL
        GROUP BY country
        ORDER BY count DESC
        LIMIT 10
      `),
    ]);

    res.json({
      overview: {
        totalUsers: parseInt(stats[0].rows[0].total_users),
        totalCharacters: parseInt(stats[1].rows[0].total_characters),
        deletedCharacters: parseInt(stats[2].rows[0].deleted_characters),
        totalEdits: parseInt(stats[3].rows[0].total_edits),
        adminActions: parseInt(stats[4].rows[0].admin_actions),
      },
      dailyCreations: stats[5].rows,
      topCountries: stats[6].rows,
    });
  } catch (error) {
    console.error("Admin get stats error:", error);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

export default router;
