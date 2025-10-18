import { z } from "zod";
import { Request, Response, NextFunction } from "express";

const shapeIdSchema = (prefix: string) =>
  z
    .string()
    .regex(
      new RegExp(`^${prefix}_\\d{3}$`),
      `Invalid ${prefix} shape ID format`,
    );

const offsetSchema = z
  .number()
  .min(-1)
  .max(1)
  .transform((val) => Math.round(val * 10) / 10);

const eyeColorEnum = z.enum([
  "brown",
  "blue",
  "green",
  "hazel",
  "gray",
  "amber",
  "violet",
]);

const accessorySlotSchema = z
  .object({
    type: z.enum([
      "glasses",
      "hat",
      "earrings",
      "mustache",
      "beard",
      "piercing",
      "scar",
      "tattoo",
      "makeup",
      "none",
    ]),
    asset_id: z
      .string()
      .regex(/^A_\d{3}$/)
      .nullable(),
    offset_y: offsetSchema.nullable(),
  })
  .refine(
    (data) => {
      if (data.type === "none") {
        return data.asset_id === null && data.offset_y === null;
      } else {
        return data.asset_id !== null && data.offset_y !== null;
      }
    },
    {
      message:
        "When type is 'none', asset_id and offset_y must be null. Otherwise, they must be provided.",
    },
  );

export const characterDataSchema = z.object({
  placeable_movable: z.object({
    lips: z.object({
      shape_id: shapeIdSchema("L"),
      offset_y: offsetSchema,
    }),
    nose: z.object({
      shape_id: shapeIdSchema("N"),
      offset_y: offsetSchema,
    }),
    eyebrows: z.object({
      shape_id: shapeIdSchema("EB"),
      offset_y: offsetSchema,
    }),
    eyes: z.object({
      shape_id: shapeIdSchema("E"),
      offset_y: offsetSchema,
      eye_color: eyeColorEnum,
    }),
    accessories: z.object({
      slot_1: accessorySlotSchema,
      slot_2: accessorySlotSchema,
      slot_3: accessorySlotSchema,
    }),
  }),
  static: z.object({
    hair: z.object({
      style_id: shapeIdSchema("H"),
      hair_color: z.enum([
        "black",
        "brown",
        "blonde",
        "red",
        "gray",
        "white",
        "blue",
        "green",
        "purple",
        "pink",
      ]),
    }),
    head_shape: z.object({
      shape_id: shapeIdSchema("HD"),
      skin_color: z.enum([
        "pale",
        "light",
        "medium",
        "medium-tan",
        "tan",
        "dark",
        "very-dark",
      ]),
    }),
    height_cm: z.number().int().min(50).max(250),
    weight_kg: z.number().int().min(20).max(300),
    sex: z.enum(["male", "female", "other"]),
  }),
});

export const characterDataUpdateSchema = z.object({
  placeable_movable: z
    .object({
      lips: z
        .object({
          shape_id: shapeIdSchema("L"),
          offset_y: offsetSchema,
        })
        .optional(),
      nose: z
        .object({
          shape_id: shapeIdSchema("N"),
          offset_y: offsetSchema,
        })
        .optional(),
      eyebrows: z
        .object({
          shape_id: shapeIdSchema("EB"),
          offset_y: offsetSchema,
        })
        .optional(),
      eyes: z
        .object({
          shape_id: shapeIdSchema("E"),
          offset_y: offsetSchema,
          eye_color: eyeColorEnum.optional(),
        })
        .optional(),
      accessories: z
        .object({
          slot_1: accessorySlotSchema.optional(),
          slot_2: accessorySlotSchema.optional(),
          slot_3: accessorySlotSchema.optional(),
        })
        .optional(),
    })
    .optional(),
  static: z
    .object({
      hair: z
        .object({
          style_id: shapeIdSchema("H"),
          hair_color: z
            .enum([
              "black",
              "brown",
              "blonde",
              "red",
              "gray",
              "white",
              "blue",
              "green",
              "purple",
              "pink",
            ])
            .optional(),
        })
        .optional(),
      head_shape: z
        .object({
          shape_id: shapeIdSchema("HD"),
          skin_color: z
            .enum([
              "pale",
              "light",
              "medium",
              "medium-tan",
              "tan",
              "dark",
              "very-dark",
            ])
            .optional(),
        })
        .optional(),
      height_cm: z.number().int().min(50).max(250).optional(),
      weight_kg: z.number().int().min(20).max(300).optional(),
      sex: z.enum(["male", "female", "other"]).optional(),
    })
    .optional(),
});

export const characterUploadSchema = z.object({
  creator_name: z
    .string()
    .trim()
    .min(1, "Creator name is required")
    .max(100, "Creator name must be 100 characters or less"),

  location: z
    .object({
      country: z.string().trim().max(100).optional(),
      region: z.string().trim().max(100).optional(),
      city: z.string().trim().max(100).optional(),
    })
    .optional(),

  character_data: characterDataSchema,

  date_of_birth: z.coerce
    .date()
    .min(new Date("1900-01-01"))
    .max(new Date())
    .optional(),
});

export const characterUpdateSchema = z
  .object({
    creator_name: z.string().trim().min(1).max(100).optional(),
    date_of_birth: z.coerce
      .date()
      .min(new Date("1900-01-01"))
      .max(new Date())
      .optional(),
    location: z
      .object({
        country: z.string().trim().max(100).or(z.literal("")).optional(),
        region: z.string().trim().max(100).or(z.literal("")).optional(),
        city: z.string().trim().max(100).or(z.literal("")).optional(),
      })
      .optional(),
    character_data: characterDataUpdateSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

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
  platform: z.enum(["newgrounds", "itch", "google"]),
  code: z.string().min(1, "Authorization code is required"),
  state: z.string().optional(),
});

export const itchTokenSchema = z.object({
  access_token: z.string().min(1, "Access token is required"),
  state: z.string().optional(),
});

export type CharacterData = z.infer<typeof characterDataSchema>;
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
      req.query = validatedData as any;
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
    (req as any).validatedQuery = validatedData;
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
  _userId: string,
  _characterId: string,
) => {
  // would normally check db to make sure the user owns the character
  // TODO: come back to this when DB is ready
  return true;
};

export const validateEditPermissions = async (
  _userId: string,
  _characterId: string,
) => {
  // would normally check if user can edit (30d freeze/weekly limit)
  // TODO: come back to this when DB is ready
  return true;
};
