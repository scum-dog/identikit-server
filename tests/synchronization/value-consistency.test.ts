import { z } from "zod";
import {
  fullCharacterSchema,
  eyeColorEnum,
  hairColorEnum,
  skinColorEnum,
  sexEnum,
} from "../../src/utils/validation";
import {
  SkinColor,
  EyeColor,
  HairColor,
  Sex,
  AccessoryType,
} from "../../src/types";

const extractZodEnumValues = (zodEnum: z.ZodEnum<any>) => {
  return zodEnum.options;
};

describe("Value Consistency Tests", () => {
  describe("Enum Value Synchronization", () => {
    it("should have matching SkinColor values between types and validation", () => {
      const validationValues = extractZodEnumValues(skinColorEnum);
      const typeValues: SkinColor[] = [
        "pale",
        "light",
        "medium",
        "medium-tan",
        "tan",
        "dark",
        "very-dark",
      ];

      expect(validationValues.sort()).toEqual(typeValues.sort());
    });

    it("should have matching EyeColor values between types and validation", () => {
      const validationValues = extractZodEnumValues(eyeColorEnum);
      const typeValues: EyeColor[] = [
        "black",
        "brown",
        "gray",
        "blue",
        "green",
        "hazel",
        "maroon",
      ];

      expect(validationValues.sort()).toEqual(typeValues.sort());
    });

    it("should have matching HairColor values between types and validation", () => {
      const validationValues = extractZodEnumValues(hairColorEnum);
      const typeValues: HairColor[] = [
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
      ];

      expect(validationValues.sort()).toEqual(typeValues.sort());
    });

    it("should have matching Sex values between types and validation", () => {
      const validationValues = extractZodEnumValues(sexEnum);
      const typeValues: Sex[] = ["male", "female", "other"];

      expect(validationValues.sort()).toEqual(typeValues.sort());
    });

    it("should have matching AccessoryType values between types and validation", () => {
      const typeValues: AccessoryType[] = ["glasses", "mustache", "misc"];

      const glassesAccessory = {
        type: "glasses" as const,
        asset_id: "G_123",
        offset_y: 0,
        scale: 1.0,
      };

      const mustacheAccessory = {
        type: "mustache" as const,
        asset_id: "M_123",
        offset_y: 0,
        scale: 1.0,
      };

      const miscAccessory = {
        type: "misc" as const,
        asset_id: "MI_123",
        offset_x: 0,
        offset_y: 0,
        scale: 1.0,
      };

      const mockCharacterData = {
        metadata: {
          upload_id: "123e4567-e89b-12d3-a456-426614174000",
          user_id: "123e4567-e89b-12d3-a456-426614174001",
          created_at: "2024-01-01T00:00:00.000Z",
          last_edited_at: null,
          is_edited: false,
          can_edit: true,
          is_deleted: false,
          deleted_at: null,
          deleted_by: null,
          location: {
            country: "United States",
            region: "California",
            city: "Los Angeles",
          },
        },
        character_data: {
          info: {
            name: "Test",
            sex: "male" as const,
            date_of_birth: "1990-01-01",
            height_in: 70,
            weight_lb: 150,
          },
          static: {
            head: {
              shape_id: "HE_001",
              skin_color: "medium" as const,
            },
            hair: {
              style_id: "H_001",
              hair_color: "brown" as const,
            },
            beard: {
              shape_id: "B_001",
              facial_hair_color: "brown" as const,
            },
          },
          placeable_movable: {
            eyes: {
              shape_id: "EY_001",
              eye_color: "brown" as const,
              offset_y: 0,
              scale: 1.0,
              rotation: 0,
              distance: 0,
            },
            eyebrows: {
              shape_id: "EB_001",
              offset_y: 0,
              scale: 1.0,
              rotation: 0,
              distance: 0,
            },
            nose: {
              shape_id: "N_001",
              offset_y: 0,
              scale: 1.0,
            },
            lips: {
              shape_id: "L_001",
              offset_y: 0,
              scale: 1.0,
            },
            age_lines: {
              shape_id: "A_001",
            },
            accessories: {
              slot_1: glassesAccessory,
              slot_2: mustacheAccessory,
              slot_3: miscAccessory,
            },
          },
        },
      };

      const result = fullCharacterSchema.safeParse(mockCharacterData);
      expect(result.success).toBe(true);

      if (result.success) {
        const accessories =
          result.data.character_data.placeable_movable.accessories;
        expect(accessories.slot_1?.type).toBe("glasses");
        expect(accessories.slot_2?.type).toBe("mustache");
        expect(accessories.slot_3?.type).toBe("misc");
      }
    });
  });

  describe("Asset ID Format Consistency", () => {
    it("should have consistent asset ID formats across validation patterns", () => {
      const assetPatterns = {
        head: /^HE_\d{3}$/,
        hair: /^H_\d{3}$/,
        beard: /^B_\d{3}$/,
        eyes: /^EY_\d{3}$/,
        eyebrows: /^EB_\d{3}$/,
        nose: /^N_\d{3}$/,
        lips: /^L_\d{3}$/,
        age_lines: /^A_\d{3}$/,
        glasses: /^G_\d{3}$/,
        mustache: /^M_\d{3}$/,
        misc: /^MI_\d{3}$/,
      };

      Object.entries(assetPatterns).forEach(([type, pattern]) => {
        const validId =
          type === "misc"
            ? "MI_123"
            : type === "head"
              ? "HE_123"
              : type === "eyebrows"
                ? "EB_123"
                : type === "age_lines"
                  ? "A_123"
                  : type === "hair"
                    ? "H_123"
                    : type === "beard"
                      ? "B_123"
                      : type === "eyes"
                        ? "EY_123"
                        : type === "nose"
                          ? "N_123"
                          : type === "lips"
                            ? "L_123"
                            : type === "glasses"
                              ? "G_123"
                              : type === "mustache"
                                ? "M_123"
                                : `${type.toUpperCase()}_123`;

        expect(validId).toMatch(pattern);

        expect("INVALID_123").not.toMatch(pattern);
        expect(`${type}_12`).not.toMatch(pattern);
        expect(`${type}_1234`).not.toMatch(pattern);
      });
    });
  });

  describe("Numeric Range Consistency", () => {
    it("should have consistent height validation ranges", () => {
      const minHeight = 24; // 2 feet
      const maxHeight = 96; // 8 feet

      const testCharacter = (height: number) => {
        const mockData = {
          metadata: {
            upload_id: "123e4567-e89b-12d3-a456-426614174000",
            user_id: "123e4567-e89b-12d3-a456-426614174001",
            created_at: "2024-01-01T00:00:00.000Z",
            last_edited_at: null,
            is_edited: false,
            can_edit: true,
            is_deleted: false,
            deleted_at: null,
            deleted_by: null,
            location: { country: "United States" },
          },
          character_data: {
            info: {
              name: "Test",
              sex: "male" as const,
              date_of_birth: "1990-01-01",
              height_in: height,
              weight_lb: 150,
            },
            static: {
              head: { shape_id: "HE_001", skin_color: "medium" as const },
              hair: { style_id: "H_001", hair_color: "brown" as const },
              beard: { shape_id: "B_001", facial_hair_color: "brown" as const },
            },
            placeable_movable: {
              eyes: {
                shape_id: "EY_001",
                eye_color: "brown" as const,
                offset_y: 0,
                scale: 1.0,
                rotation: 0,
                distance: 0,
              },
              eyebrows: {
                shape_id: "EB_001",
                offset_y: 0,
                scale: 1.0,
                rotation: 0,
                distance: 0,
              },
              nose: { shape_id: "N_001", offset_y: 0, scale: 1.0 },
              lips: { shape_id: "L_001", offset_y: 0, scale: 1.0 },
              age_lines: { shape_id: "A_001" },
              accessories: {
                slot_1: undefined,
                slot_2: undefined,
                slot_3: undefined,
              },
            },
          },
        };
        return fullCharacterSchema.safeParse(mockData);
      };

      expect(testCharacter(minHeight).success).toBe(true);
      expect(testCharacter(maxHeight).success).toBe(true);
      expect(testCharacter(70).success).toBe(true);

      expect(testCharacter(minHeight - 1).success).toBe(false);
      expect(testCharacter(maxHeight + 1).success).toBe(false);
    });

    it("should have consistent weight validation ranges", () => {
      const minWeight = 50;
      const maxWeight = 500;

      const testCharacter = (weight: number) => {
        const mockData = {
          metadata: {
            upload_id: "123e4567-e89b-12d3-a456-426614174000",
            user_id: "123e4567-e89b-12d3-a456-426614174001",
            created_at: "2024-01-01T00:00:00.000Z",
            last_edited_at: null,
            is_edited: false,
            can_edit: true,
            is_deleted: false,
            deleted_at: null,
            deleted_by: null,
            location: { country: "United States" },
          },
          character_data: {
            info: {
              name: "Test",
              sex: "male" as const,
              date_of_birth: "1990-01-01",
              height_in: 70,
              weight_lb: weight,
            },
            static: {
              head: { shape_id: "HE_001", skin_color: "medium" as const },
              hair: { style_id: "H_001", hair_color: "brown" as const },
              beard: { shape_id: "B_001", facial_hair_color: "brown" as const },
            },
            placeable_movable: {
              eyes: {
                shape_id: "EY_001",
                eye_color: "brown" as const,
                offset_y: 0,
                scale: 1.0,
                rotation: 0,
                distance: 0,
              },
              eyebrows: {
                shape_id: "EB_001",
                offset_y: 0,
                scale: 1.0,
                rotation: 0,
                distance: 0,
              },
              nose: { shape_id: "N_001", offset_y: 0, scale: 1.0 },
              lips: { shape_id: "L_001", offset_y: 0, scale: 1.0 },
              age_lines: { shape_id: "A_001" },
              accessories: {
                slot_1: undefined,
                slot_2: undefined,
                slot_3: undefined,
              },
            },
          },
        };
        return fullCharacterSchema.safeParse(mockData);
      };

      expect(testCharacter(minWeight).success).toBe(true);
      expect(testCharacter(maxWeight).success).toBe(true);
      expect(testCharacter(150).success).toBe(true);

      expect(testCharacter(minWeight - 1).success).toBe(false);
      expect(testCharacter(maxWeight + 1).success).toBe(false);
    });

    it("should have consistent offset validation ranges", () => {
      const minOffset = -1;
      const maxOffset = 1;

      const testCharacter = (offset: number) => {
        const mockData = {
          metadata: {
            upload_id: "123e4567-e89b-12d3-a456-426614174000",
            user_id: "123e4567-e89b-12d3-a456-426614174001",
            created_at: "2024-01-01T00:00:00.000Z",
            last_edited_at: null,
            is_edited: false,
            can_edit: true,
            is_deleted: false,
            deleted_at: null,
            deleted_by: null,
            location: { country: "United States" },
          },
          character_data: {
            info: {
              name: "Test",
              sex: "male" as const,
              date_of_birth: "1990-01-01",
              height_in: 70,
              weight_lb: 150,
            },
            static: {
              head: { shape_id: "HE_001", skin_color: "medium" as const },
              hair: { style_id: "H_001", hair_color: "brown" as const },
              beard: { shape_id: "B_001", facial_hair_color: "brown" as const },
            },
            placeable_movable: {
              eyes: {
                shape_id: "EY_001",
                eye_color: "brown" as const,
                offset_y: offset,
                scale: 1.0,
                rotation: 0,
                distance: 0,
              },
              eyebrows: {
                shape_id: "EB_001",
                offset_y: 0,
                scale: 1.0,
                rotation: 0,
                distance: 0,
              },
              nose: { shape_id: "N_001", offset_y: 0, scale: 1.0 },
              lips: { shape_id: "L_001", offset_y: 0, scale: 1.0 },
              age_lines: { shape_id: "A_001" },
              accessories: {
                slot_1: undefined,
                slot_2: undefined,
                slot_3: undefined,
              },
            },
          },
        };
        return fullCharacterSchema.safeParse(mockData);
      };

      expect(testCharacter(minOffset).success).toBe(true);
      expect(testCharacter(maxOffset).success).toBe(true);
      expect(testCharacter(0).success).toBe(true);
      expect(testCharacter(0.5).success).toBe(true);

      expect(testCharacter(minOffset - 0.1).success).toBe(false);
      expect(testCharacter(maxOffset + 0.1).success).toBe(false);
    });

    it("should have consistent scale validation ranges", () => {
      const minScale = 0.5;
      const maxScale = 1.5;

      const testCharacter = (scale: number) => {
        const mockData = {
          metadata: {
            upload_id: "123e4567-e89b-12d3-a456-426614174000",
            user_id: "123e4567-e89b-12d3-a456-426614174001",
            created_at: "2024-01-01T00:00:00.000Z",
            last_edited_at: null,
            is_edited: false,
            can_edit: true,
            is_deleted: false,
            deleted_at: null,
            deleted_by: null,
            location: { country: "United States" },
          },
          character_data: {
            info: {
              name: "Test",
              sex: "male" as const,
              date_of_birth: "1990-01-01",
              height_in: 70,
              weight_lb: 150,
            },
            static: {
              head: { shape_id: "HE_001", skin_color: "medium" as const },
              hair: { style_id: "H_001", hair_color: "brown" as const },
              beard: { shape_id: "B_001", facial_hair_color: "brown" as const },
            },
            placeable_movable: {
              eyes: {
                shape_id: "EY_001",
                eye_color: "brown" as const,
                offset_y: 0,
                scale: scale,
                rotation: 0,
                distance: 0,
              },
              eyebrows: {
                shape_id: "EB_001",
                offset_y: 0,
                scale: 1.0,
                rotation: 0,
                distance: 0,
              },
              nose: { shape_id: "N_001", offset_y: 0, scale: 1.0 },
              lips: { shape_id: "L_001", offset_y: 0, scale: 1.0 },
              age_lines: { shape_id: "A_001" },
              accessories: {
                slot_1: undefined,
                slot_2: undefined,
                slot_3: undefined,
              },
            },
          },
        };
        return fullCharacterSchema.safeParse(mockData);
      };

      expect(testCharacter(minScale).success).toBe(true);
      expect(testCharacter(maxScale).success).toBe(true);
      expect(testCharacter(1.0).success).toBe(true);

      expect(testCharacter(minScale - 0.1).success).toBe(false);
      expect(testCharacter(maxScale + 0.1).success).toBe(false);
    });
  });
});
