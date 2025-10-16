import { Router, Request, Response } from "express";
import { mockDataStore } from "../mock-data";
import { randomUUID } from "crypto";

const router = Router();

// create mock user
const MOCK_USER = {
  id: randomUUID(),
  username: "TestUser123",
  platform: "newgrounds",
  isAdmin: false,
};

// GET /mock/api/auth/me - get current mock user info
router.get("/me", (req: Request, res: Response) => {
  try {
    let user = mockDataStore.getUser(MOCK_USER.id);
    if (!user) {
      user = {
        id: MOCK_USER.id,
        username: MOCK_USER.username,
        platform: MOCK_USER.platform,
        platform_user_id: "12345",
        email: "testuser@example.com",
        created_at: new Date(2023, 0, 1).toISOString(),
        last_login: new Date().toISOString(),
        is_admin: MOCK_USER.isAdmin,
      };
    }

    const characters = mockDataStore.getCharacters();
    const character = characters.find(
      (char) => char.user_id === MOCK_USER.id && !char.is_deleted,
    );

    const characterInfo = character
      ? {
          upload_id: character.upload_id,
          creator_name: character.creator_name,
          creation_time: character.creation_time,
          edit_time: character.edit_time,
          edit_count: character.edit_count,
        }
      : null;

    res.json({
      user: {
        id: user.id,
        username: user.username,
        platform: user.platform,
        isAdmin: user.is_admin,
      },
      character: characterInfo,
      hasCharacter: !!character,
    });
  } catch (error) {
    console.error("Mock get user info error:", error);
    res.status(500).json({ error: "Failed to get user information" });
  }
});

export default router;
