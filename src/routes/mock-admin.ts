import { Router, Request, Response } from "express";
import { mockDataStore } from "../utils/mockData";
import { validateRequest } from "../utils/validation";
import { z } from "zod";
import { log } from "../utils/logger";
import { mockRouteAdmin } from "../utils/testMockData";

const router = Router();

const MOCK_ADMIN = {
  id: mockRouteAdmin.id,
  username: mockRouteAdmin.username,
  platform: mockRouteAdmin.platform,
  isAdmin: mockRouteAdmin.is_admin,
};

// GET /mock/admin/characters - get mock characters for moderation
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
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    const total = characters.length;
    const paginatedCharacters = characters.slice(offset, offset + limit);

    const charactersWithUsers = paginatedCharacters.map((char) => {
      const user = mockDataStore.getUser(char.user_id);
      return {
        upload_id: char.upload_id,
        location: char.location,
        creation_time: char.created_at,
        edit_time: char.last_edited_at,
        is_edited: char.is_edited,
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
    log.error("Mock admin get characters error", { error });
    res.status(500).json({ error: "Failed to fetch characters" });
  }
});

// GET /mock/admin/character/:id - get specific mock character with full details
router.get("/character/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const character = mockDataStore.getCharacter(id);

    if (!character) {
      return res.status(404).json({ error: "Character not found" });
    }

    const user = mockDataStore.getUser(character.user_id);

    const characterWithDetails = {
      ...character,
      username: user?.username || "Unknown",
      platform: user?.platform || "unknown",
      platform_user_id: user?.platform_user_id || "unknown",
      user_created_at: user?.created_at || null,
      last_login: user?.last_login || null,
    };

    res.json({
      character: characterWithDetails,
    });
  } catch (error) {
    log.error("Mock admin get character details error", { error });
    res.status(500).json({ error: "Failed to fetch character details" });
  }
});

// DELETE /mock/admin/character/:id - delete a mock character
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

      const deletedCharacter = mockDataStore.deleteCharacter(id, MOCK_ADMIN.id);

      if (!deletedCharacter) {
        return res.status(500).json({ error: "Failed to delete character" });
      }

      res.json({
        success: true,
        message: `Character has been deleted`,
        deletedCharacter: {
          upload_id: character.upload_id,
        },
        reason,
      });
    } catch (error) {
      log.error("Mock admin delete character error", { error });
      res.status(500).json({ error: "Failed to delete character" });
    }
  },
);

// GET /mock/admin/users - get all mock users for management
router.get("/users", (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = (page - 1) * limit;

    const users = mockDataStore.getUsers();

    users.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    const total = users.length;
    const paginatedUsers = users.slice(offset, offset + limit);

    const usersWithData = paginatedUsers.map((user) => {
      return {
        id: user.id,
        username: user.username,
        platform: user.platform,
        platform_user_id: user.platform_user_id,
        created_at: user.created_at,
        last_login: user.last_login,
        is_admin: user.is_admin,
      };
    });

    res.json({
      users: usersWithData,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    log.error("Mock admin get users error", { error });
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

export default router;
