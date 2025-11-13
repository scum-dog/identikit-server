import { z } from "zod";
import { Request, Response, NextFunction } from "express";
import { log } from "./logger";

const assetIdSchema = () => z.number().int().min(1).max(999);

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
]);

export const hairColorEnum = z.enum([
  "bald",
  "black",
  "blonde",
  "blue",
  "brown",
  "gray",
  "green",
  "orange",
  "pink",
  "purple",
  "red",
  "sandy",
  "white",
]);

export const skinColorEnum = z.enum([
  "pale",
  "light",
  "medium",
  "medium-tan",
  "tan",
  "dark",
  "very-dark",
]);

export const sexEnum = z.enum(["male", "female", "other"]);

const glassesSchema = z.object({
  asset_id: z.number().int().min(1).max(999),
  offset_y: offsetSchema.default(0),
  scale: scaleSchema.default(1.0),
});

const mustacheSchema = z.object({
  asset_id: z.number().int().min(1).max(999),
  offset_y: offsetSchema.default(0),
  scale: scaleSchema.default(1.0),
});

const miscSchema = z.object({
  asset_id: z.number().int().min(1).max(999),
  offset_x: offsetSchema.default(0).optional(),
  offset_y: offsetSchema.default(0),
  scale: scaleSchema.default(1.0).optional(),
});

export const characterDataSchema = z.object({
  info: z
    .object({
      name: z.string().min(1).max(100),
      sex: sexEnum,
      date_of_birth: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
        .refine((date) => {
          const d = new Date(date);
          return d >= new Date("1900-01-01") && d <= new Date();
        }, "Date must be between 1900-01-01 and today"),
      height_in: z.number().int().min(24).max(96), // 2-8 feet
      weight_lb: z.number().int().min(50).max(500), // pounds
      location: z.object({
        country: z.string().min(1).max(100),
        region: z.string().min(1).max(100).optional(),
      }),
    })
    .strict(),
  static: z
    .object({
      head: z.object({
        asset_id: assetIdSchema(),
        skin_color: skinColorEnum,
      }),
      hair: z.object({
        asset_id: assetIdSchema(),
        hair_color: hairColorEnum,
      }),
      beard: z
        .object({
          asset_id: assetIdSchema(),
          facial_hair_color: hairColorEnum,
        })
        .optional(),
      age_lines: z
        .object({
          asset_id: assetIdSchema(),
        })
        .optional(),
    })
    .strict(),
  placeable_movable: z.object({
    eyes: z.object({
      asset_id: assetIdSchema(),
      eye_color: eyeColorEnum,
      offset_x: offsetXSchema.default(0),
      offset_y: offsetSchema.default(0),
      scale: scaleSchema.default(1.0),
      rotation: eyeRotationSchema.default(0),
    }),
    eyebrows: z.object({
      asset_id: assetIdSchema(),
      offset_x: offsetXSchema.default(0),
      offset_y: offsetSchema.default(0),
      scale: scaleSchema.default(1.0),
      rotation: eyebrowRotationSchema.default(0),
    }),
    nose: z.object({
      asset_id: assetIdSchema(),
      offset_y: offsetSchema.default(0),
      scale: scaleSchema.default(1.0),
    }),
    lips: z.object({
      asset_id: assetIdSchema(),
      offset_y: offsetSchema.default(0),
      scale: scaleSchema.default(1.0),
    }),
    glasses: glassesSchema.optional(),
    mustache: mustacheSchema.optional(),
    misc: miscSchema.optional(),
  }),
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
          name: z.string().min(1).max(100).optional(),
          sex: sexEnum.optional(),
          date_of_birth: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
            .refine((date) => {
              const d = new Date(date);
              return d >= new Date("1900-01-01") && d <= new Date();
            }, "Date must be between 1900-01-01 and today")
            .optional(),
          height_in: z.number().int().min(24).max(96).optional(),
          weight_lb: z.number().int().min(50).max(500).optional(),
          location: z
            .object({
              country: z.string().min(1).max(100).optional(),
              region: z.string().min(1).max(100).or(z.literal("")).optional(),
            })
            .optional(),
        })
        .optional(),
      static: z
        .object({
          head: z
            .object({
              asset_id: assetIdSchema().optional(),
              skin_color: skinColorEnum.optional(),
            })
            .optional(),
          hair: z
            .object({
              asset_id: assetIdSchema().optional(),
              hair_color: hairColorEnum.optional(),
            })
            .optional(),
          beard: z
            .object({
              asset_id: assetIdSchema(),
              facial_hair_color: hairColorEnum,
            })
            .optional(),
          age_lines: z
            .object({
              asset_id: assetIdSchema(),
            })
            .optional(),
        })
        .optional(),
      placeable_movable: z
        .object({
          eyes: z
            .object({
              asset_id: assetIdSchema().optional(),
              eye_color: eyeColorEnum.optional(),
              offset_x: offsetXSchema.optional(),
              offset_y: offsetSchema.optional(),
              scale: scaleSchema.optional(),
              rotation: eyeRotationSchema.optional(),
            })
            .optional(),
          eyebrows: z
            .object({
              asset_id: assetIdSchema().optional(),
              offset_x: offsetXSchema.optional(),
              offset_y: offsetSchema.optional(),
              scale: scaleSchema.optional(),
              rotation: eyebrowRotationSchema.optional(),
            })
            .optional(),
          nose: z
            .object({
              asset_id: assetIdSchema().optional(),
              offset_y: offsetSchema.optional(),
              scale: scaleSchema.optional(),
            })
            .optional(),
          lips: z
            .object({
              asset_id: assetIdSchema().optional(),
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

export const characterUploadSchema = fullCharacterSchema;

export const characterUpdateSchema = characterDataUpdateSchema.refine(
  (data) => Object.keys(data).length > 0,
  {
    message: "At least one field must be provided for update",
  },
);

export const plazaSearchSchema = z
  .object({
    country: z.union([z.string(), z.undefined()]).optional(),
    region: z.union([z.string(), z.undefined()]).optional(),
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
      region: data.region && data.region !== "" ? data.region : undefined,
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
  region?: string;
  limit?: string;
  random?: string;
};

export type PlazaSearch = {
  country: string | undefined;
  region: string | undefined;
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
