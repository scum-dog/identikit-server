import { z } from "zod";
import { Request, Response, NextFunction } from "express";
import { log } from "./logger";
import { COUNTRIES } from "./constants";

const headAssetIdSchema = () => z.number().int().min(0).max(28);
const hairAssetIdSchema = () => z.number().int().min(0).max(193);
const beardAssetIdSchema = () => z.number().int().min(0).max(12);
const ageLinesAssetIdSchema = () => z.number().int().min(0).max(14);
const eyesAssetIdSchema = () => z.number().int().min(0).max(99);
const eyebrowsAssetIdSchema = () => z.number().int().min(0).max(15);
const noseAssetIdSchema = () => z.number().int().min(0).max(32);
const lipsAssetIdSchema = () => z.number().int().min(0).max(36);
const glassesAssetIdSchema = () => z.number().int().min(0).max(17);
const mustacheAssetIdSchema = () => z.number().int().min(0).max(12);
const miscAssetIdSchema = () => z.number().int().min(0).max(4);

const offsetSchema = z
  .number()
  .min(-1)
  .max(1)
  .transform((val) => Math.round(val * 10) / 10);

const eyeRotationSchema = z
  .number()
  .min(-35)
  .max(35)
  .int()
  .refine((val) => val % 5 === 0, "Rotation must be in 5-degree increments");
const eyebrowRotationSchema = z
  .number()
  .min(-45)
  .max(45)
  .int()
  .refine((val) => val % 5 === 0, "Rotation must be in 5-degree increments");

const offsetXSchema = z
  .number()
  .min(0)
  .max(1)
  .transform((val) => Math.round(val * 10) / 10);

const scaleSchema = z
  .number()
  .min(0.5)
  .max(1.5)
  .transform((val) => Math.round(val * 10) / 10);

export const eyeColorEnum = z.enum([
  "black",
  "blue",
  "brown",
  "gray",
  "green",
  "hazel",
  "maroon",
  "pink",
]);

export const hairColorEnum = z.enum([
  "bald",
  "black",
  "blond",
  "brown",
  "gray",
  "red",
  "sandy",
  "white",
]);

export const raceEnum = z.enum([
  "ai_an",
  "asian",
  "black",
  "nh_pi",
  "white",
  "other",
]);

export const ethnicityEnum = z.enum(["hispanic_latino", "not_hispanic_latino"]);

export const countryEnum = z.enum(COUNTRIES);

export const sortRaces = (
  races: Array<z.infer<typeof raceEnum>>,
): Array<z.infer<typeof raceEnum>> => {
  return [...races].sort((a, b) => {
    if (a === "other") return 1;
    if (b === "other") return -1;

    return a.localeCompare(b);
  });
};

export const raceArraySchema = z
  .array(raceEnum)
  .min(1, "At least one race must be selected")
  .max(2, "Maximum of two races allowed")
  .refine(
    (races) => new Set(races).size === races.length,
    "Duplicate races not allowed",
  )
  .transform(sortRaces);

export const sexEnum = z.enum(["male", "female", "other"]);

const glassesSchema = z.object({
  asset_id: glassesAssetIdSchema(),
  offset_y: offsetSchema.default(0),
  scale: scaleSchema.default(1.0),
});

const mustacheSchema = z.object({
  asset_id: mustacheAssetIdSchema(),
  offset_y: offsetSchema.default(0),
  scale: scaleSchema.default(1.0),
});

const miscSchema = z.object({
  asset_id: miscAssetIdSchema(),
  offset_x: offsetSchema.default(0).optional(),
  offset_y: offsetSchema.default(0),
  scale: scaleSchema.default(1.0).optional(),
});

export const characterDataSchema = z
  .object({
    info: z
      .object({
        name: z
          .string()
          .min(1)
          .max(32)
          .regex(
            /^(?=.*[A-Za-z])[A-Za-z]+(?:\.[A-Za-z])*(?:\. [A-Za-z]+|[A-Za-z]\. [A-Za-z]+|[' -][A-Za-z]+)*$/,
            "Name must start with a letter, contain only letters/spaces/hyphens/apostrophes/periods, and have no consecutive punctuation or leading/trailing spaces",
          )
          .refine(
            (name) =>
              !/[ ]{2,}|[-]{2,}|['][ ']/.test(name) &&
              !(
                name.includes("..") ||
                name.includes("--") ||
                name.includes("''") ||
                /[ ]{2,}/.test(name)
              ),
            "Name cannot have consecutive punctuation or spaces",
          )
          .refine((name) => {
            const periodPattern = /\./;
            if (!periodPattern.test(name)) return true;

            const invalidPeriodPattern = /[a-z]{2,}\.[a-z]/;
            return !invalidPeriodPattern.test(name);
          }, "Periods can only be used for abbreviations (e.g., 'H. W.' or 'J.K.')"),
        sex: sexEnum,
        date_of_birth: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
          .refine((date) => {
            const d = new Date(date);
            const today = new Date();
            const maxDate = new Date(
              today.getFullYear() - 13,
              today.getMonth(),
              today.getDate(),
            );
            return d >= new Date("1900-01-01") && d <= maxDate;
          }, "Character must be at least 13 years old"),
        height_in: z.number().int().min(48).max(96), // 4-8 feet
        weight_lb: z.number().int().min(50).max(500), // pounds
        eye_color: eyeColorEnum,
        hair_color: hairColorEnum,
        race: raceArraySchema,
        ethnicity: ethnicityEnum,
        location: countryEnum,
      })
      .strict(),
    static: z
      .object({
        head: z.object({
          asset_id: headAssetIdSchema(),
        }),
        hair: z.object({
          asset_id: hairAssetIdSchema(),
        }),
        beard: z
          .object({
            asset_id: beardAssetIdSchema(),
          })
          .optional(),
        age_lines: z
          .object({
            asset_id: ageLinesAssetIdSchema(),
          })
          .optional(),
      })
      .strict(),
    placeable_movable: z.object({
      eyes: z.object({
        asset_id: eyesAssetIdSchema(),
        offset_x: offsetXSchema.default(0),
        offset_y: offsetSchema.default(0),
        scale: scaleSchema.default(1.0),
        rotation: eyeRotationSchema.default(0),
      }),
      eyebrows: z.object({
        asset_id: eyebrowsAssetIdSchema(),
        offset_x: offsetXSchema.default(0),
        offset_y: offsetSchema.default(0),
        scale: scaleSchema.default(1.0),
        rotation: eyebrowRotationSchema.default(0),
      }),
      nose: z.object({
        asset_id: noseAssetIdSchema(),
        offset_y: offsetSchema.default(0),
        scale: scaleSchema.default(1.0),
      }),
      lips: z.object({
        asset_id: lipsAssetIdSchema(),
        offset_y: offsetSchema.default(0),
        scale: scaleSchema.default(1.0),
      }),
      glasses: glassesSchema.optional(),
      mustache: mustacheSchema.optional(),
      misc: miscSchema.optional(),
    }),
  })
  .refine((data) => {
    const hairAssetId = data.static.hair.asset_id;
    const hairColor = data.info.hair_color;

    if (hairAssetId === 0) {
      return true;
    } else {
      return hairColor !== "bald";
    }
  });

export const characterMetadataSchema = z.object({
  upload_id: z.string().uuid(),
  user_id: z.string().uuid(),
  created_at: z.string().datetime(),
  last_edited_at: z.string().datetime().nullable(),
  is_edited: z.boolean().default(false),
  can_edit: z.boolean(),
  is_deleted: z.boolean().default(false),
  deleted_at: z.string().datetime().nullable(),
  deleted_by: z.string().uuid().nullable(),
});

export const fullCharacterSchema = z.object({
  character_data: characterDataSchema,
  metadata: characterMetadataSchema,
});

export const characterDataUpdateSchema = z.object({
  character_data: z
    .object({
      info: z
        .object({
          name: z
            .string()
            .min(1)
            .max(32)
            .regex(
              /^(?=.*[A-Za-z])[A-Za-z]+(?:\.[A-Za-z])*(?:\. [A-Za-z]+|[A-Za-z]\. [A-Za-z]+|[' -][A-Za-z]+)*$/,
              "Name must start with a letter, contain only letters/spaces/hyphens/apostrophes/periods, and have no consecutive punctuation or leading/trailing spaces",
            )
            .refine(
              (name) =>
                !/[ ]{2,}|[-]{2,}|['][ ']/.test(name) &&
                !(
                  name.includes("..") ||
                  name.includes("--") ||
                  name.includes("''") ||
                  /[ ]{2,}/.test(name)
                ),
              "Name cannot have consecutive punctuation or spaces",
            )
            .refine((name) => {
              const periodPattern = /\./;
              if (!periodPattern.test(name)) return true;

              const invalidPeriodPattern = /[a-z]{2,}\.[a-z]/;
              return !invalidPeriodPattern.test(name);
            }, "Periods can only be used for abbreviations (e.g., 'H. W.' or 'J.K.')")
            .optional(),
          sex: sexEnum.optional(),
          date_of_birth: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
            .refine((date) => {
              const d = new Date(date);
              const today = new Date();
              const maxDate = new Date(
                today.getFullYear() - 13,
                today.getMonth(),
                today.getDate(),
              );
              return d >= new Date("1900-01-01") && d <= maxDate;
            }, "Character must be at least 13 years old")
            .optional(),
          height_in: z.number().int().min(48).max(96).optional(),
          weight_lb: z.number().int().min(50).max(500).optional(),
          eye_color: eyeColorEnum.optional(),
          hair_color: hairColorEnum.optional(),
          race: raceArraySchema.optional(),
          ethnicity: ethnicityEnum.optional(),
          location: countryEnum.optional(),
        })
        .optional(),
      static: z
        .object({
          head: z
            .object({
              asset_id: headAssetIdSchema().optional(),
            })
            .optional(),
          hair: z
            .object({
              asset_id: hairAssetIdSchema().optional(),
            })
            .optional(),
          beard: z
            .object({
              asset_id: beardAssetIdSchema(),
            })
            .optional(),
          age_lines: z
            .object({
              asset_id: ageLinesAssetIdSchema(),
            })
            .optional(),
        })
        .optional(),
      placeable_movable: z
        .object({
          eyes: z
            .object({
              asset_id: eyesAssetIdSchema().optional(),
              offset_x: offsetXSchema.optional(),
              offset_y: offsetSchema.optional(),
              scale: scaleSchema.optional(),
              rotation: eyeRotationSchema.optional(),
            })
            .optional(),
          eyebrows: z
            .object({
              asset_id: eyebrowsAssetIdSchema().optional(),
              offset_x: offsetXSchema.optional(),
              offset_y: offsetSchema.optional(),
              scale: scaleSchema.optional(),
              rotation: eyebrowRotationSchema.optional(),
            })
            .optional(),
          nose: z
            .object({
              asset_id: noseAssetIdSchema().optional(),
              offset_y: offsetSchema.optional(),
              scale: scaleSchema.optional(),
            })
            .optional(),
          lips: z
            .object({
              asset_id: lipsAssetIdSchema().optional(),
              offset_y: offsetSchema.optional(),
              scale: scaleSchema.optional(),
            })
            .optional(),
          glasses: glassesSchema.optional(),
          mustache: mustacheSchema.optional(),
          misc: miscSchema.optional(),
        })
        .optional(),
    })
    .optional(),
  metadata: z.object({}).optional(),
});

export const characterUploadSchema = z.object({
  character_data: characterDataSchema,
});

export const characterUpdateSchema = characterDataUpdateSchema
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  })
  .refine((data) => {
    const hairColor = data.character_data?.info?.hair_color;
    const hairAssetId = data.character_data?.static?.hair?.asset_id;

    if (hairColor === undefined || hairAssetId === undefined) {
      return true;
    }

    if (hairAssetId === 0) {
      return true;
    } else {
      return hairColor !== "bald";
    }
  });

export const plazaSearchSchema = z
  .object({
    country: z.union([z.string(), z.undefined()]).optional(),
    limit: z.union([z.string(), z.number(), z.undefined()]).optional(),
    random: z.union([z.string(), z.boolean(), z.undefined()]).optional(),
  })
  .transform((data) => {
    let limit = 100;
    if (data.limit !== undefined) {
      if (typeof data.limit === "number") {
        limit = data.limit;
      } else if (typeof data.limit === "string" && data.limit !== "") {
        const parsed = parseInt(data.limit, 10);
        if (!isNaN(parsed)) {
          limit = parsed;
        }
      }
    }
    limit = Math.min(Math.max(limit, 1), 500);

    let random = true;
    if (data.random !== undefined) {
      if (typeof data.random === "boolean") {
        random = data.random;
      } else if (typeof data.random === "string") {
        random = data.random.toLowerCase() === "true";
      }
    }

    return {
      country: data.country && data.country !== "" ? data.country : undefined,
      limit,
      random,
    };
  });

export const adminActionSchema = z.object({
  action: z.literal("delete_character"),
  characterId: z.string().uuid("Invalid character ID format"),
  reason: z
    .string()
    .trim()
    .min(1, "Reason is required")
    .max(500, "Reason must be 500 characters or less"),
});

export const oauthCallbackSchema = z.object({
  platform: z.enum(["itch", "google"]),
  code: z.string().min(1, "Authorization code is required"),
  state: z.string().optional(),
});

export const newgroundsAuthSchema = z.object({
  session_id: z.string().min(1, "Session ID is required"),
});

export const itchTokenSchema = z.object({
  access_token: z.string().min(1, "Access token is required"),
  state: z.string().optional(),
});

export type CharacterData = z.infer<typeof characterDataSchema>;
export type CharacterMetadata = z.infer<typeof characterMetadataSchema>;
export type FullCharacter = z.infer<typeof fullCharacterSchema>;
export type CharacterUpload = z.infer<typeof characterUploadSchema>;
export type CharacterUpdate = z.infer<typeof characterUpdateSchema>;
export type PlazaSearchInput = {
  country?: string;
  limit?: string;
  random?: string;
};

export type PlazaSearch = {
  country: string | undefined;
  limit: number;
  random: boolean;
};
export type AdminAction = z.infer<typeof adminActionSchema>;
export type OAuthCallback = z.infer<typeof oauthCallbackSchema>;
export type ItchToken = z.infer<typeof itchTokenSchema>;

export const validateRequest = <T>(schema: z.ZodSchema<T>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = schema.parse(req.body);
      req.body = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Validation failed",
          details: error.errors.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        });
      }

      return res.status(400).json({
        error: "Validation failed",
        details: [{ field: "unknown", message: "Invalid input data" }],
      });
    }
  };
};

export const validateQuery = <T>(schema: z.ZodSchema<T>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = schema.parse(req.query);
      req.query = validatedData as Record<
        string,
        string | string[] | undefined
      >;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Query validation failed",
          details: error.errors.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        });
      }

      return res.status(400).json({
        error: "Query validation failed",
        details: [{ field: "unknown", message: "Invalid query parameters" }],
      });
    }
  };
};

export const validatePlazaQuery = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const validatedData = plazaSearchSchema.parse(req.query);
    (
      req as Request & { validatedQuery: z.infer<typeof plazaSearchSchema> }
    ).validatedQuery = validatedData;
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Query validation failed",
        details: error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        })),
      });
    }

    return res.status(400).json({
      error: "Query validation failed",
      details: [{ field: "unknown", message: "Invalid query parameters" }],
    });
  }
};

export const validateCharacterOwnership = async (
  userId: string,
  characterId: string,
) => {
  const { query } = await import("../database");

  try {
    const result = await query(
      "SELECT id FROM characters WHERE id = $1 AND user_id = $2 AND is_deleted = false",
      [characterId, userId],
    );

    return result.rows.length > 0;
  } catch (error) {
    log.error("Error validating character ownership:", { error });
    return false;
  }
};
