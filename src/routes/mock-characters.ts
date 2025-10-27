import { Router, Request, Response } from "express";
import { mockDataStore, generateMockCharacter } from "../utils/mockData";
import {
  validateRequest,
  validatePlazaQuery,
  characterUploadSchema,
  characterUpdateSchema,
} from "../utils/validation";
import { randomUUID } from "crypto";
import {
  MockCharacterRouteUpdates,
  PlazaQueryRequest,
  MockCharacter,
} from "../types";
import { log } from "../utils/logger";

const router = Router();

// create mock user
const MOCK_USER = {
  id: randomUUID(),
  username: "TestUser123",
  platform: "newgrounds",
  isAdmin: false,
};

const mockCanUserEditCharacter = (character: MockCharacter): boolean => {
  const creationDate = new Date(character.created_at);
  const lastEditDate = character.last_edited_at
    ? new Date(character.last_edited_at)
    : creationDate;
  const now = new Date();

  const daysSinceCreation =
    (now.getTime() - creationDate.getTime()) / (1000 * 3600 * 24);

  const daysSinceLastEdit =
    (now.getTime() - lastEditDate.getTime()) / (1000 * 3600 * 24);

  if (daysSinceCreation < 30) {
    return false;
  }

  if (daysSinceLastEdit < 7) {
    return false;
  }

  return true;
};

// GET /mock/characters/me - get mock user's character
router.get("/me", (req: Request, res: Response) => {
  try {
    const characters = mockDataStore.getCharacters();
    let character = characters.find(
      (char) => char.user_id === MOCK_USER.id && !char.is_deleted,
    );

    if (!character) {
      character = generateMockCharacter(MOCK_USER.id, randomUUID());
      mockDataStore.addCharacter(character);
    }

    const creationDate = new Date(character.created_at);

    const lastEditDate = character.last_edited_at
      ? new Date(character.last_edited_at)
      : creationDate;

    const now = new Date();

    const daysSinceCreation =
      (now.getTime() - creationDate.getTime()) / (1000 * 3600 * 24);

    const daysSinceLastEdit =
      (now.getTime() - lastEditDate.getTime()) / (1000 * 3600 * 24);

    const canEdit = daysSinceCreation >= 30 && daysSinceLastEdit >= 7;

    res.json({
      character,
      canEdit,
    });
  } catch (error) {
    log.error("Mock get character error", { error });
    res.status(500).json({ error: "Failed to retrieve character" });
  }
});

// POST /mock/characters - create new mock character
router.post(
  "/",
  validateRequest(characterUploadSchema),
  (req: Request, res: Response) => {
    try {
      const characters = mockDataStore.getCharacters();
      const existingCharacter = characters.find(
        (char) => char.user_id === MOCK_USER.id && !char.is_deleted,
      );

      if (existingCharacter) {
        return res.status(409).json({
          error: "User already has a character. Use PUT to update.",
        });
      }

      const characterData = req.body.character_data;

      const newCharacter = {
        upload_id: randomUUID(),
        user_id: MOCK_USER.id,
        created_at: new Date().toISOString(),
        last_edited_at: new Date().toISOString(),
        location: req.body.location || {
          country: null,
          region: null,
          city: null,
        },
        character_data: characterData,
        date_of_birth: req.body.date_of_birth
          ? new Date(req.body.date_of_birth).toISOString().split("T")[0]
          : null,
        is_edited: false,
        is_deleted: false,
        deleted_at: null,
        deleted_by: null,
      };

      mockDataStore.addCharacter(newCharacter);

      res.status(201).json({
        message: "Character created successfully",
        character: newCharacter,
      });
    } catch (error) {
      log.error("Mock create character error", { error });
      res.status(500).json({ error: "Failed to create character" });
    }
  },
);

// PUT /mock/characters/me - update mock user's mock character
router.put(
  "/me",
  validateRequest(characterUpdateSchema),
  (req: Request, res: Response) => {
    try {
      const characters = mockDataStore.getCharacters();
      const character = characters.find(
        (char) => char.user_id === MOCK_USER.id && !char.is_deleted,
      );

      if (!character) {
        return res.status(404).json({ error: "No character found to update" });
      }

      const canEdit = mockCanUserEditCharacter(character);

      if (!canEdit) {
        return res.status(403).json({
          error:
            "Cannot edit character: either in freeze period or weekly limit exceeded",
        });
      }

      const updates: MockCharacterRouteUpdates = {};
      if (req.body.location) {
        updates.location = {
          country:
            req.body.location.country !== undefined
              ? req.body.location.country
              : character.location.country,
          region:
            req.body.location.region !== undefined
              ? req.body.location.region
              : character.location.region,
          city:
            req.body.location.city !== undefined
              ? req.body.location.city
              : character.location.city,
        };
      }
      if (req.body.character_data) {
        const updatedCharacterData = {
          ...character.character_data,
          ...req.body.character_data,
        };
        updates.character_data = updatedCharacterData;
      }

      const updatedCharacter = mockDataStore.updateCharacter(
        character.upload_id,
        updates as Partial<MockCharacter>,
      );

      res.json({
        message: "Character updated successfully",
        character: updatedCharacter,
      });
    } catch (error) {
      log.error("Mock update character error", { error });
      res.status(500).json({ error: "Failed to update character" });
    }
  },
);

// GET /mock/characters/plaza - get mock characters for plaza display
router.get("/plaza", validatePlazaQuery, (req: Request, res: Response) => {
  try {
    const {
      country,
      region,
      limit = 100,
    } = (req as PlazaQueryRequest).validatedQuery || req.query;
    let characters = mockDataStore
      .getCharacters()
      .filter((char) => !char.is_deleted);

    if (country) {
      characters = characters.filter(
        (char) =>
          char.location?.country &&
          char.location.country
            .toLowerCase()
            .includes((country as string).toLowerCase()),
      );
    }

    if (region) {
      characters = characters.filter(
        (char) =>
          char.location?.region &&
          char.location.region
            .toLowerCase()
            .includes((region as string).toLowerCase()),
      );
    }

    characters = characters.sort(() => Math.random() - 0.5);
    characters = characters.slice(0, Number(limit));

    const plazaCharacters = characters.map((char) => ({
      upload_id: char.upload_id,
      creation_time: char.created_at,
      edit_time:
        char.last_edited_at !== char.created_at ? char.last_edited_at : null,
      location: char.location,
      character_data: char.character_data,
    }));

    res.json({
      characters: plazaCharacters,
      count: plazaCharacters.length,
      filters: { country, region },
    });
  } catch (error) {
    log.error("Mock plaza fetch error", { error });
    res.status(500).json({ error: "Failed to fetch plaza characters" });
  }
});

// GET /mock/characters/:id - get specific mock character by ID
router.get("/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const character = mockDataStore.getCharacter(id);

    if (!character || character.is_deleted) {
      return res.status(404).json({ error: "Character not found" });
    }

    const publicCharacter = {
      upload_id: character.upload_id,
      creation_time: character.created_at,
      edit_time:
        character.last_edited_at !== character.created_at
          ? character.last_edited_at
          : null,
      location: character.location,
      character_data: character.character_data,
    };

    res.json({
      character: publicCharacter,
    });
  } catch (error) {
    log.error("Mock get character by ID error", { error });
    res.status(500).json({ error: "Failed to retrieve character" });
  }
});

export default router;
