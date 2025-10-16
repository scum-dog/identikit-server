import { Router, Request, Response } from "express";
import { mockDataStore } from "../mock-data";
import { validateRequest } from "../validation";
import { z } from "zod";
import { randomUUID } from "crypto";

const router = Router();

const MOCK_ADMIN = {
  id: randomUUID(),
  username: "AdminUser",
  platform: "newgrounds",
  isAdmin: true,
};

// GET /mock/api/admin/characters - get mock characters for moderation
router.get("/characters", (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = (page - 1) * limit;
    const showDeleted = req.query.showDeleted === "true";

    let characters = mockDataStore.getCharacters();

    if (!showDeleted) {
      characters = characters.filter((char) => !char.is_deleted);
    }

    characters.sort(
      (a, b) =>
        new Date(b.creation_time).getTime() -
        new Date(a.creation_time).getTime(),
    );

    const total = characters.length;
    const paginatedCharacters = characters.slice(offset, offset + limit);

    const charactersWithUsers = paginatedCharacters.map((char) => {
      const user = mockDataStore.getUser(char.user_id);
      return {
        upload_id: char.upload_id,
        creator_name: char.creator_name,
        location: char.location,
        creation_time: char.creation_time,
        edit_time: char.edit_time,
        edit_count: char.edit_count,
        is_deleted: char.is_deleted,
        deleted_at: char.deleted_at,
        deleted_by: char.deleted_by,
        username: user?.username || "Unknown",
        platform: user?.platform || "unknown",
        platform_user_id: user?.platform_user_id || "unknown",
      };
    });

    res.json({
      characters: charactersWithUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Mock admin get characters error:", error);
    res.status(500).json({ error: "Failed to fetch characters" });
  }
});

// GET /mock/api/admin/character/:id - get specific mock character with full details
router.get("/character/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const character = mockDataStore.getCharacter(id);

    if (!character) {
      return res.status(404).json({ error: "Character not found" });
    }

    const user = mockDataStore.getUser(character.user_id);
    const editHistory = mockDataStore.getEditHistory(character.id);

    const characterWithDetails = {
      ...character,
      username: user?.username || "Unknown",
      platform: user?.platform || "unknown",
      platform_user_id: user?.platform_user_id || "unknown",
      email: user?.email || null,
      user_created_at: user?.created_at || null,
      last_login: user?.last_login || null,
    };

    res.json({
      character: characterWithDetails,
      editHistory,
    });
  } catch (error) {
    console.error("Mock admin get character details error:", error);
    res.status(500).json({ error: "Failed to fetch character details" });
  }
});

// DELETE /mock/api/admin/character/:id - delete a mock character
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
  (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const character = mockDataStore.getCharacter(id);

      if (!character) {
        return res.status(404).json({ error: "Character not found" });
      }

      if (character.is_deleted) {
        return res.status(409).json({ error: "Character is already deleted" });
      }

      const deletedCharacter = mockDataStore.deleteCharacter(
        id,
        MOCK_ADMIN.id,
        reason,
      );

      if (!deletedCharacter) {
        return res.status(500).json({ error: "Failed to delete character" });
      }

      res.json({
        success: true,
        message: `Character "${character.creator_name}" has been deleted`,
        deletedCharacter: {
          upload_id: character.upload_id,
          creator_name: character.creator_name,
        },
        reason,
      });
    } catch (error) {
      console.error("Mock admin delete character error:", error);
      res.status(500).json({ error: "Failed to delete character" });
    }
  },
);

// GET /mock/api/admin/users - get all mock users for management
router.get("/users", (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = (page - 1) * limit;

    let users = mockDataStore.getUsers();
    const characters = mockDataStore.getCharacters();

    users.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    const total = users.length;
    const paginatedUsers = users.slice(offset, offset + limit);

    const usersWithCharacterCount = paginatedUsers.map((user) => {
      const characterCount = characters.filter(
        (char) => char.user_id === user.id && !char.is_deleted,
      ).length;

      return {
        id: user.id,
        username: user.username,
        platform: user.platform,
        platform_user_id: user.platform_user_id,
        created_at: user.created_at,
        last_login: user.last_login,
        is_admin: user.is_admin,
        character_count: characterCount,
      };
    });

    res.json({
      users: usersWithCharacterCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Mock admin get users error:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// GET /mock/api/admin/actions - get mock admin action history
router.get("/actions", (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = (page - 1) * limit;

    const actions = mockDataStore.getAdminActions();

    const total = actions.length;
    const paginatedActions = actions.slice(offset, offset + limit);

    res.json({
      actions: paginatedActions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Mock admin get actions error:", error);
    res.status(500).json({ error: "Failed to fetch admin actions" });
  }
});

// GET /mock/api/admin/stats - get mock platform/server statistics
router.get("/stats", (req: Request, res: Response) => {
  try {
    const users = mockDataStore.getUsers();
    const characters = mockDataStore.getCharacters();
    const adminActions = mockDataStore.getAdminActions();

    const totalUsers = users.length;
    const totalCharacters = characters.filter(
      (char) => !char.is_deleted,
    ).length;
    const deletedCharacters = characters.filter(
      (char) => char.is_deleted,
    ).length;

    let totalEdits = 0;
    characters.forEach((char) => {
      const history = mockDataStore.getEditHistory(char.id);
      totalEdits += history.filter(
        (edit) => edit.edit_type === "user_edit",
      ).length;
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyCreations = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];

      const count = characters.filter((char) => {
        const charDate = char.created_at.split("T")[0];
        return charDate === dateStr;
      }).length;

      dailyCreations.push({
        date: dateStr,
        count,
      });
    }

    const countryCounts = new Map<string, number>();
    characters
      .filter((char) => !char.is_deleted && char.country)
      .forEach((char) => {
        const count = countryCounts.get(char.country!) || 0;
        countryCounts.set(char.country!, count + 1);
      });

    const topCountries = Array.from(countryCounts.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    res.json({
      overview: {
        totalUsers,
        totalCharacters,
        deletedCharacters,
        totalEdits,
        adminActions: adminActions.length,
      },
      dailyCreations,
      topCountries,
    });
  } catch (error) {
    console.error("Mock admin get stats error:", error);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

export default router;
