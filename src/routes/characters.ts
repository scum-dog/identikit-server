import { Router, Request, Response } from "express";
import { characterQueries, query } from "../database";
import {
  validateRequest,
  validatePlazaQuery,
  characterUploadSchema,
  characterUpdateSchema,
} from "../utils/validation";
import { authenticateUser } from "../auth/middleware";
import rateLimit from "express-rate-limit";
import { addCharacterProcessingJob } from "../queue";
import { JobPriority } from "../types";
import { log } from "../utils/logger";
import {
  notFoundResponse,
  conflictResponse,
  internalServerErrorResponse,
} from "../utils/responseHelpers";
import {
  PlazaQueryRequest,
  PlazaCharacterData,
  PlazaCharacterResult,
  DatabaseQueryResult,
  CharacterDataStructure,
} from "../types";

const router = Router();
const characterRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Too many requests, please try again later" },
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

const uploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: "Upload limit exceeded, please try again later" },
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: (req) => {
    const user = req.user;
    return user?.isAdmin || req.headers["x-bulk-operation"] === "true";
  },
});

const plazaRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: "Too many plaza requests, please slow down" },
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

// GET /characters/me - get current user's character
router.get("/me", authenticateUser, async (req: Request, res: Response) => {
  try {
    const character = await characterQueries.findByUserId(req.user!.id);

    if (!character) {
      return notFoundResponse(res, "Character");
    }

    const parsedCharacterData =
      character.character_data as CharacterDataStructure;

    const canEdit = await query<{ can_user_edit_character: boolean }>(
      "SELECT can_user_edit_character($1, $2) as can_user_edit_character",
      [character.id, req.user!.id],
    ).then((result) => result.rows[0]?.can_user_edit_character || false);

    res.json({
      character_data: parsedCharacterData,
      metadata: {
        upload_id: character.id,
        user_id: character.user_id,
        created_at: character.created_at,
        last_edited_at: character.last_edited_at,
        location: parsedCharacterData.info.location || "",
        is_edited: character.is_edited,
        is_deleted: character.is_deleted,
        deleted_at: character.deleted_at,
        deleted_by: character.deleted_by,
      },
      can_edit: canEdit,
    });
  } catch (error) {
    log.error("Get character error:", { error });
    internalServerErrorResponse(res, "Failed to retrieve character");
  }
});

// POST /characters - create new character
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
        return conflictResponse(
          res,
          "User already has a character. Use PUT to update.",
        );
      }

      const job = await addCharacterProcessingJob(
        {
          userId: req.user!.id,
          action: "create",
          characterData: req.body.character_data,
          metadata: {
            userAgent: req.get("User-Agent"),
            ipAddress: req.ip,
            timestamp: new Date(),
          },
        },
        JobPriority.NORMAL,
      );

      res.status(202).location(`/characters/${job}`).json({
        message: "Character creation queued successfully",
        jobId: job,
        status: "processing",
      });
    } catch (error) {
      log.error("Create character error:", { error });
      internalServerErrorResponse(res, "Failed to create character");
    }
  },
);

// PUT /characters/me - update current user's character
router.put(
  "/me",
  authenticateUser,
  characterRateLimit,
  validateRequest(characterUpdateSchema),
  async (req: Request, res: Response) => {
    try {
      const character = await characterQueries.findByUserId(req.user!.id);

      if (!character) {
        return notFoundResponse(res, "Character");
      }

      const job = await addCharacterProcessingJob(
        {
          userId: req.user!.id,
          characterId: character.id,
          action: "update",
          characterData: req.body.character_data,
          metadata: {
            userAgent: req.get("User-Agent"),
            ipAddress: req.ip,
            timestamp: new Date(),
          },
        },
        JobPriority.HIGH,
      );

      res.status(202).location(`/characters/${job}`).json({
        message: "Character update queued successfully",
        jobId: job,
        status: "processing",
      });
    } catch (error) {
      log.error("Update character error:", { error });

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

// GET /characters?view=plaza - get characters for plaza display
router.get(
  "/",
  plazaRateLimit,
  validatePlazaQuery,
  async (req: Request, res: Response) => {
    if (req.query.view !== "plaza") {
      return res.status(404).json({ error: "Route not found" });
    }
    try {
      log.debug("starting request", { query: req.query });

      const { country, limit, offset } =
        (req as PlazaQueryRequest).validatedQuery || req.query;

      log.debug("extracted params", { country, limit, offset });

      let characters;

      if (country) {
        log.debug("searching by location", { country });
        characters = await characterQueries.searchByLocation(
          country as string,
          Number(limit) || 100,
          Number(offset) || 0,
        );
      } else {
        log.debug("getting characters by age", {
          limit: Number(limit) || 100,
          offset: Number(offset) || 0,
        });
        characters = await characterQueries.getCharactersByAge(
          Number(limit) || 100,
          Number(offset) || 0,
        );
      }

      log.debug("got characters from DB", {
        characterCount: characters?.length,
      });

      log.debug("starting character formatting");
      const formattedCharacters = characters.map(
        (char: PlazaCharacterResult, index: number) => {
          try {
            log.debug(`Processing character ${index}`, {
              charId: char.id,
              dataType: typeof char.character_data,
              hasInfo:
                char.character_data &&
                typeof char.character_data === "object" &&
                "info" in char.character_data,
            });

            const parsedCharacterData =
              char.character_data as CharacterDataStructure;

            return {
              upload_id: char.id,
              creation_time: char.created_at,
              edit_time:
                char.last_edited_at !== char.created_at
                  ? char.last_edited_at
                  : null,
              location: parsedCharacterData.info.location || "",
              character_data: parsedCharacterData,
            };
          } catch (charError) {
            log.error(`Error processing character ${index}:`, {
              charId: char.id,
              dataType: typeof char.character_data,
              data: char.character_data,
              error: charError instanceof Error ? charError.message : charError,
            });
            throw charError;
          }
        },
      );

      log.debug("characters formatted successfully", {
        count: formattedCharacters.length,
      });

      log.debug("getting total count");
      const totalCount = await characterQueries.getTotalCount(
        country as string,
      );
      log.debug("got total count", { totalCount });

      res.json({
        characters: formattedCharacters,
        count: formattedCharacters.length,
        total: totalCount,
        filters: { country },
      });
    } catch (error) {
      log.error("full details:", {
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : typeof error,
        errorObject: error,
        query: req.query,
        url: req.url,
      });
      res.status(500).json({ error: "Failed to fetch plaza characters" });
    }
  },
);

// GET /characters/:id - get specific character by ID
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = (await query(
      "SELECT id, character_data, created_at, last_edited_at FROM characters WHERE id = $1 AND is_deleted = false",
      [id],
    )) as DatabaseQueryResult<PlazaCharacterData>;

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Character not found" });
    }

    const character = result.rows[0];
    const parsedCharacterData =
      character.character_data as CharacterDataStructure;

    res.json({
      character_data: parsedCharacterData,
      metadata: {
        upload_id: character.id,
        creation_time: character.created_at,
        edit_time:
          character.last_edited_at !== character.created_at
            ? character.last_edited_at
            : null,
        location: parsedCharacterData.info.location || "",
      },
    });
  } catch (error) {
    log.error("Get character by ID error:", { error });
    res.status(500).json({ error: "Failed to retrieve character" });
  }
});

export default router;
