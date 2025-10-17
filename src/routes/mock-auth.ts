import { Router, Request, Response } from "express";
import { mockDataStore } from "../mock-data";
import { randomUUID } from "crypto";

const router = Router();

// create mock users
const MOCK_USER = {
  id: randomUUID(),
  username: "TestUser123",
  platform: "newgrounds",
  isAdmin: false,
};

const MOCK_ITCH_USER = {
  id: randomUUID(),
  username: "ItchUser456",
  platform: "itchio",
  isAdmin: false,
};

const MOCK_GOOGLE_USER = {
  id: randomUUID(),
  username: "GoogleUser789",
  platform: "google",
  isAdmin: false,
};

// GET /mock/api/auth/newgrounds/me - get mock Newgrounds user info
router.get("/newgrounds/me", (req: Request, res: Response) => {
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

// GET /mock/api/auth/itch/me - get mock itch.io user info
router.get("/itch/me", (req: Request, res: Response) => {
  try {
    let user = mockDataStore.getUser(MOCK_ITCH_USER.id);
    if (!user) {
      user = {
        id: MOCK_ITCH_USER.id,
        username: MOCK_ITCH_USER.username,
        platform: MOCK_ITCH_USER.platform,
        platform_user_id: "67890",
        email: "itchuser@example.com",
        created_at: new Date(2023, 0, 1).toISOString(),
        last_login: new Date().toISOString(),
        is_admin: MOCK_ITCH_USER.isAdmin,
      };
    }

    const characters = mockDataStore.getCharacters();
    const character = characters.find(
      (char) => char.user_id === MOCK_ITCH_USER.id && !char.is_deleted,
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
    console.error("Mock get itch user info error:", error);
    res.status(500).json({ error: "Failed to get user information" });
  }
});

// GET /mock/api/auth/google/me - get mock Google user info
router.get("/google/me", (req: Request, res: Response) => {
  try {
    let user = mockDataStore.getUser(MOCK_GOOGLE_USER.id);
    if (!user) {
      user = {
        id: MOCK_GOOGLE_USER.id,
        username: MOCK_GOOGLE_USER.username,
        platform: MOCK_GOOGLE_USER.platform,
        platform_user_id: "google123456",
        email: "googleuser@gmail.com",
        created_at: new Date(2023, 0, 1).toISOString(),
        last_login: new Date().toISOString(),
        is_admin: MOCK_GOOGLE_USER.isAdmin,
      };
    }

    const characters = mockDataStore.getCharacters();
    const character = characters.find(
      (char) => char.user_id === MOCK_GOOGLE_USER.id && !char.is_deleted,
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
    console.error("Mock get Google user info error:", error);
    res.status(500).json({ error: "Failed to get user information" });
  }
});

export default router;
