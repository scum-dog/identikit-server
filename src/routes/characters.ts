import { Router, Request, Response } from "express";
import { characterQueries, query } from "../database";
import {
  validateRequest,
  validatePlazaQuery,
  characterUploadSchema,
  characterUpdateSchema,
} from "../validation";
import { authenticateUser } from "../auth/middleware";
import rateLimit from "express-rate-limit";
import {
  CharacterRouteUpdates,
  PlazaQueryRequest,
  PlazaCharacterData,
  DatabaseQueryResult,
  CanEditResult,
} from "../types";

const router = Router();
const characterRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Too many requests, please try again later" },
});

const uploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: "Upload limit exceeded, please try again later" },
});

// GET /api/characters/me - get current user's character
router.get("/me", authenticateUser, async (req: Request, res: Response) => {
  try {
    const character = await characterQueries.findByUserId(req.user!.id);

    if (!character) {
      return res
        .status(404)
        .json({ error: "No character found for this user" });
    }

    res.json({
      character: {
        upload_id: character.id,
        user_id: character.user_id,
        creator_name: character.name,
        created_at: character.created_at,
        last_edited_at: character.last_edited_at,
        location: {
          country: character.country,
          region: character.region,
          city: character.city,
        },
        character_data:
          typeof character.character_data === "string"
            ? JSON.parse(character.character_data)
            : character.character_data,
        date_of_birth: character.date_of_birth,
        edit_count: character.edit_count,
        is_deleted: character.is_deleted,
        deleted_at: character.deleted_at,
        deleted_by: character.deleted_by,
      },
      canEdit: await canUserEditCharacter(character.id, req.user!.id),
    });
  } catch (error) {
    console.error("Get character error:", error);
    res.status(500).json({ error: "Failed to retrieve character" });
  }
});

// POST /api/characters - create new character
router.post(
  "/",
  authenticateUser,
  uploadRateLimit,
  validateRequest(characterUploadSchema),
  async (req: Request, res: Response) => {
    try {
      // check if user already has a character
      const existingCharacter = await characterQueries.findByUserId(
        req.user!.id,
      );
      if (existingCharacter) {
        return res
          .status(409)
          .json({ error: "User already has a character. Use PUT to update." });
      }

      const characterData = {
        name: req.body.creator_name,
        characterJson: req.body.character_data,
        country: req.body.location?.country,
        region: req.body.location?.region,
        city: req.body.location?.city,
        dateOfBirth: req.body.date_of_birth,
        heightCm: req.body.character_data.static.height_cm,
        weightKg: req.body.character_data.static.weight_kg,
      };

      const newCharacter = await characterQueries.create(
        req.user!.id,
        characterData,
      );

      res.status(201).json({
        message: "Character created successfully",
        character: {
          upload_id: newCharacter.id,
          user_id: newCharacter.user_id,
          creator_name: newCharacter.name,
          creation_time: newCharacter.created_at,
          edit_time: null,
          location: {
            country: newCharacter.country,
            region: newCharacter.region,
            city: newCharacter.city,
          },
          character_data:
            typeof newCharacter.character_data === "string"
              ? JSON.parse(newCharacter.character_data)
              : newCharacter.character_data,
          date_of_birth: newCharacter.date_of_birth,
          edit_count: newCharacter.edit_count,
          is_deleted: newCharacter.is_deleted,
          deleted_at: newCharacter.deleted_at,
          deleted_by: newCharacter.deleted_by,
        },
      });
    } catch (error) {
      console.error("Create character error:", error);
      res.status(500).json({ error: "Failed to create character" });
    }
  },
);

// PUT /api/characters/me - update current user's character
router.put(
  "/me",
  authenticateUser,
  characterRateLimit,
  validateRequest(characterUpdateSchema),
  async (req: Request, res: Response) => {
    try {
      const character = await characterQueries.findByUserId(req.user!.id);

      if (!character) {
        return res.status(404).json({ error: "No character found to update" });
      }

      const updates: CharacterRouteUpdates = {};

      if (req.body.creator_name) updates.name = req.body.creator_name;
      if (req.body.date_of_birth) updates.dateOfBirth = req.body.date_of_birth;
      if (req.body.location) {
        if (req.body.location.country !== undefined)
          updates.country = req.body.location.country;
        if (req.body.location.region !== undefined)
          updates.region = req.body.location.region;
        if (req.body.location.city !== undefined)
          updates.city = req.body.location.city;
      }
      if (req.body.character_data) {
        updates.characterJson = req.body.character_data;
        if (req.body.character_data.static?.height_cm) {
          updates.heightCm = req.body.character_data.static.height_cm;
        }
        if (req.body.character_data.static?.weight_kg) {
          updates.weightKg = req.body.character_data.static.weight_kg;
        }
      }

      const updatedCharacter = await characterQueries.update(
        character.id,
        req.user!.id,
        updates,
      );

      res.json({
        message: "Character updated successfully",
        character: {
          upload_id: updatedCharacter.id,
          user_id: updatedCharacter.user_id,
          creator_name: updatedCharacter.name,
          created_at: updatedCharacter.created_at,
          last_edited_at: updatedCharacter.last_edited_at,
          location: {
            country: updatedCharacter.country,
            region: updatedCharacter.region,
            city: updatedCharacter.city,
          },
          character_data:
            typeof updatedCharacter.character_data === "string"
              ? JSON.parse(updatedCharacter.character_data)
              : updatedCharacter.character_data,
          date_of_birth: updatedCharacter.date_of_birth,
          edit_count: updatedCharacter.edit_count,
          is_deleted: updatedCharacter.is_deleted,
          deleted_at: updatedCharacter.deleted_at,
          deleted_by: updatedCharacter.deleted_by,
        },
      });
    } catch (error) {
      console.error("Update character error:", error);

      if (
        error instanceof Error &&
        error.message.includes("Cannot edit character")
      ) {
        return res.status(403).json({ error: error.message });
      }

      res.status(500).json({ error: "Failed to update character" });
    }
  },
);

// GET /api/characters/plaza - get characters for plaza display
router.get(
  "/plaza",
  validatePlazaQuery,
  async (req: Request, res: Response) => {
    try {
      const { country, region, limit } =
        (req as PlazaQueryRequest).validatedQuery || req.query;

      let characters;

      if (country || region) {
        characters = await characterQueries.searchByLocation(
          country as string,
          region as string,
          Number(limit) || 100,
        );
      } else {
        characters = await characterQueries.getRandomCharacters(
          Number(limit) || 100,
        );
      }

      const formattedCharacters = characters.map(
        (char: PlazaCharacterData) => ({
          upload_id: char.id,
          creator_name: char.name,
          creation_time: char.created_at,
          edit_time:
            char.last_edited_at !== char.created_at
              ? char.last_edited_at
              : null,
          location: {
            country: char.country,
            region: char.region,
            city: char.city,
          },
          character_data:
            typeof char.character_data === "string"
              ? JSON.parse(char.character_data)
              : char.character_data,
        }),
      );

      res.json({
        characters: formattedCharacters,
        count: formattedCharacters.length,
        filters: { country, region },
      });
    } catch (error) {
      console.error("Plaza fetch error:", error);
      res.status(500).json({ error: "Failed to fetch plaza characters" });
    }
  },
);

// GET /api/characters/:id - get specific character by ID
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = (await query(
      "SELECT id, name, character_data, country, region, city, created_at, last_edited_at FROM characters WHERE id = $1 AND is_deleted = false",
      [id],
    )) as DatabaseQueryResult<PlazaCharacterData>;

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Character not found" });
    }

    const character = result.rows[0];

    res.json({
      character: {
        upload_id: character.id,
        creator_name: character.name,
        creation_time: character.created_at,
        edit_time:
          character.last_edited_at !== character.created_at
            ? character.last_edited_at
            : null,
        location: {
          country: character.country,
          region: character.region,
          city: character.city,
        },
        character_data:
          typeof character.character_data === "string"
            ? JSON.parse(character.character_data)
            : character.character_data,
      },
    });
  } catch (error) {
    console.error("Get character by ID error:", error);
    res.status(500).json({ error: "Failed to retrieve character" });
  }
});

// helper func to check if user can edit character
async function canUserEditCharacter(
  characterId: string,
  userId: string,
): Promise<boolean> {
  try {
    const result = (await query(
      "SELECT can_user_edit_character($1, $2) as can_edit",
      [characterId, userId],
    )) as DatabaseQueryResult<CanEditResult>;
    return result.rows[0].can_edit;
  } catch (error) {
    console.error("Check edit permissions error:", error);
    return false;
  }
}

export default router;
