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
  CharacterDataStructure,
} from "../types";
import { log } from "../utils/logger";
import { mockRouteUser, canUserEditCharacter } from "../utils/testMockData";
import {
  successResponse,
  createdResponse,
  notFoundResponse,
  conflictResponse,
  forbiddenResponse,
  internalServerErrorResponse,
} from "../utils/responseHelpers";

const router = Router();

const MOCK_USER = {
  id: mockRouteUser.id,
  username: mockRouteUser.username,
  platform: mockRouteUser.platform,
  isAdmin: mockRouteUser.is_admin,
};

const mockCanUserEditCharacter = (character: MockCharacter): boolean => {
  return canUserEditCharacter(character.created_at, character.last_edited_at);
};

// GET /mock/characters/me - get mock user's character
router.get("/me", (_req: Request, res: Response) => {
  try {
    const characters = mockDataStore.getCharacters();
    let character = characters.find(
      (char) => char.user_id === MOCK_USER.id && !char.is_deleted,
    );

    if (!character) {
      character = generateMockCharacter(MOCK_USER.id, randomUUID());
      mockDataStore.addCharacter(character);
    }

    const canEdit = mockCanUserEditCharacter(character);

    successResponse(res, {
      upload_id: character.upload_id,
      user_id: character.user_id,
      created_at: character.created_at,
      last_edited_at: character.last_edited_at,
      location: character.character_data.character_data.info.location || {},
      character_data: character.character_data,
      is_edited: character.is_edited,
      is_deleted: character.is_deleted,
      deleted_at: character.deleted_at,
      deleted_by: character.deleted_by,
      can_edit: canEdit,
    });
  } catch (error) {
    log.error("Mock get character error", { error });
    internalServerErrorResponse(res, "Failed to retrieve character");
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
        return conflictResponse(
          res,
          "User already has a character. Use PUT to update.",
        );
      }

      const { character_data, metadata } = req.body;

      const newCharacter = {
        upload_id: metadata.upload_id,
        user_id: MOCK_USER.id,
        created_at: metadata.created_at,
        last_edited_at: metadata.last_edited_at,
        character_data: character_data,
        is_edited: metadata.is_edited,
        is_deleted: metadata.is_deleted,
        deleted_at: metadata.deleted_at,
        deleted_by: metadata.deleted_by,
      };

      mockDataStore.addCharacter(newCharacter);

      createdResponse(res, {
        message: "Character created successfully",
        upload_id: newCharacter.upload_id,
        user_id: newCharacter.user_id,
        created_at: newCharacter.created_at,
        last_edited_at: newCharacter.last_edited_at,
        character_data: newCharacter.character_data,
        is_edited: newCharacter.is_edited,
        is_deleted: newCharacter.is_deleted,
        deleted_at: newCharacter.deleted_at,
        deleted_by: newCharacter.deleted_by,
      });
    } catch (error) {
      log.error("Mock create character error", { error });
      internalServerErrorResponse(res, "Failed to create character");
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
        return notFoundResponse(res, "Character");
      }

      const canEdit = mockCanUserEditCharacter(character);

      if (!canEdit) {
        return forbiddenResponse(
          res,
          "Cannot edit character: either in freeze period or weekly limit exceeded",
        );
      }

      const updates: MockCharacterRouteUpdates = {};

      if (req.body.character_data) {
        const currentCharacterData =
          character.character_data as CharacterDataStructure;
        const updatedCharacterData = {
          static: {
            ...currentCharacterData.static,
            ...(req.body.character_data.static || {}),
          },
          placeable_movable: {
            ...currentCharacterData.placeable_movable,
            ...(req.body.character_data.placeable_movable || {}),
          },
        };
        updates.character_data = updatedCharacterData;
      }

      const updatedCharacter = mockDataStore.updateCharacter(
        character.upload_id,
        updates as Partial<MockCharacter>,
      );

      if (!updatedCharacter) {
        return internalServerErrorResponse(res, "Failed to update character");
      }

      successResponse(res, {
        message: "Character updated successfully",
        upload_id: updatedCharacter.upload_id,
        user_id: updatedCharacter.user_id,
        created_at: updatedCharacter.created_at,
        last_edited_at: updatedCharacter.last_edited_at,
        character_data: updatedCharacter.character_data,
        is_edited: updatedCharacter.is_edited,
        is_deleted: updatedCharacter.is_deleted,
        deleted_at: updatedCharacter.deleted_at,
        deleted_by: updatedCharacter.deleted_by,
        can_edit: mockCanUserEditCharacter(updatedCharacter),
      });
    } catch (error) {
      log.error("Mock update character error", { error });
      internalServerErrorResponse(res, "Failed to update character");
    }
  },
);

// GET /mock/characters?view=plaza - get mock characters for plaza display
router.get("/", validatePlazaQuery, (req: Request, res: Response) => {
  if (req.query.view !== "plaza") {
    return res.status(404).json({ error: "Route not found" });
  }
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
      characters = characters.filter((char) => {
        return (
          char.character_data.info.location.country &&
          char.character_data.info.location.country
            .toLowerCase()
            .includes((country as string).toLowerCase())
        );
      });
    }

    if (region) {
      characters = characters.filter((char) => {
        return (
          char.character_data.info.location.region &&
          char.character_data.info.location.region
            .toLowerCase()
            .includes((region as string).toLowerCase())
        );
      });
    }

    characters = characters.sort(() => Math.random() - 0.5);
    characters = characters.slice(0, Number(limit));

    const plazaCharacters = characters.map((char) => {
      return {
        upload_id: char.upload_id,
        creation_time: char.created_at,
        edit_time:
          char.last_edited_at !== char.created_at ? char.last_edited_at : null,
        location: {
          country: char.character_data.info.location.country,
          region: char.character_data.info.location.region || null,
          city: char.character_data.info.location.city || null,
        },
        character_data: char.character_data,
      };
    });

    res.json({
      characters: plazaCharacters,
      count: plazaCharacters.length,
      filters: { country, region },
    });
  } catch (error) {
    log.error("Mock plaza fetch error", { error });
    internalServerErrorResponse(res, "Failed to fetch plaza characters");
  }
});

// GET /mock/characters/:id - get specific mock character by ID
router.get("/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const character = mockDataStore.getCharacter(id);

    if (!character || character.is_deleted) {
      return notFoundResponse(res, "Character");
    }

    const publicCharacter = {
      upload_id: character.upload_id,
      creation_time: character.created_at,
      edit_time:
        character.last_edited_at !== character.created_at
          ? character.last_edited_at
          : null,
      character_data: character.character_data,
    };

    successResponse(res, publicCharacter);
  } catch (error) {
    log.error("Mock get character by ID error", { error });
    internalServerErrorResponse(res, "Failed to retrieve character");
  }
});

export default router;
