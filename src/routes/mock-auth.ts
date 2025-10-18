import { Router, Request, Response } from "express";
import { mockDataStore } from "../mock-data";
import { randomUUID } from "crypto";

const router = Router();

const MOCK_USER = {
  id: randomUUID(),
  username: "TestUser123",
  platform: "newgrounds",
  platform_user_id: "12345",
  email: "testuser@example.com",
  isAdmin: false,
};

const MOCK_ITCH_USER = {
  id: randomUUID(),
  username: "ItchUser456",
  platform: "itchio",
  platform_user_id: "67890",
  email: "itchuser@example.com",
  isAdmin: false,
};

const MOCK_GOOGLE_USER = {
  id: randomUUID(),
  username: "GoogleUser789",
  platform: "google",
  platform_user_id: "google123456",
  email: "googleuser@gmail.com",
  isAdmin: false,
};

// GET /mock/api/auth/me - get mock user info
router.get("/me", (_req: Request, res: Response) => {
  try {
    const mockUsers = [MOCK_USER, MOCK_ITCH_USER, MOCK_GOOGLE_USER];
    const selectedMockUser =
      mockUsers[Math.floor(Math.random() * mockUsers.length)];

    let user = mockDataStore.getUser(selectedMockUser.id);
    if (!user) {
      user = {
        id: selectedMockUser.id,
        username: selectedMockUser.username,
        platform: selectedMockUser.platform,
        platform_user_id: selectedMockUser.platform_user_id,
        email: selectedMockUser.email,
        created_at: new Date(2023, 0, 1).toISOString(),
        last_login: new Date().toISOString(),
        is_admin: selectedMockUser.isAdmin,
      };
    }

    const characters = mockDataStore.getCharacters();
    const character = characters.find(
      (char) => char.user_id === selectedMockUser.id && !char.is_deleted,
    );

    const characterInfo = character
      ? {
          upload_id: character.upload_id,
          creator_name: character.creator_name,
          creation_time: character.created_at,
          edit_time: character.last_edited_at,
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
