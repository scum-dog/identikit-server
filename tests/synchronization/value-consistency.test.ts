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

    it("should have matching accessory structure between types and validation", () => {
      const glassesAccessory = {
        asset_id: 123,
        offset_y: 0,
        scale: 1.0,
      };

      const mustacheAccessory = {
        asset_id: 123,
        offset_y: 0,
        scale: 1.0,
      };

      const miscAccessory = {
        asset_id: 123,
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
        },
        character_data: {
          info: {
            name: "Test",
            sex: "male" as const,
            date_of_birth: "1990-01-01",
            height_in: 70,
            weight_lb: 150,
            location: {
              country: "United States",
              region: "California",
              city: "Los Angeles",
            },
          },
          static: {
            head: {
              asset_id: 1,
              skin_color: "medium" as const,
            },
            hair: {
              asset_id: 1,
              hair_color: "brown" as const,
            },
            beard: {
              asset_id: 1,
              facial_hair_color: "brown" as const,
            },
            age_lines: {
              asset_id: 1,
            },
          },
          placeable_movable: {
            eyes: {
              asset_id: 1,
              eye_color: "brown" as const,
              offset_x: 0,
              offset_y: 0,
              scale: 1.0,
              rotation: 0,
            },
            eyebrows: {
              asset_id: 1,
              offset_x: 0,
              offset_y: 0,
              scale: 1.0,
              rotation: 0,
            },
            nose: {
              asset_id: 1,
              offset_y: 0,
              scale: 1.0,
            },
            lips: {
              asset_id: 1,
              offset_y: 0,
              scale: 1.0,
            },
            glasses: glassesAccessory,
            mustache: mustacheAccessory,
            misc: miscAccessory,
          },
        },
      };

      const result = fullCharacterSchema.safeParse(mockCharacterData);
      expect(result.success).toBe(true);

      if (result.success) {
        const placeableMovable = result.data.character_data.placeable_movable;
        expect(placeableMovable.glasses).toBeDefined();
        expect(placeableMovable.mustache).toBeDefined();
        expect(placeableMovable.misc).toBeDefined();
      }
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
          },
          character_data: {
            info: {
              name: "Test",
              sex: "male" as const,
              date_of_birth: "1990-01-01",
              height_in: height,
              weight_lb: 150,
              location: { country: "United States" },
            },
            static: {
              head: { asset_id: 1, skin_color: "medium" as const },
              hair: { asset_id: 1, hair_color: "brown" as const },
              beard: { asset_id: 1, facial_hair_color: "brown" as const },
              age_lines: { asset_id: 1 },
            },
            placeable_movable: {
              eyes: {
                asset_id: 1,
                eye_color: "brown" as const,
                offset_x: 0,
                offset_y: 0,
                scale: 1.0,
                rotation: 0,
              },
              eyebrows: {
                asset_id: 1,
                offset_x: 0,
                offset_y: 0,
                scale: 1.0,
                rotation: 0,
              },
              nose: { asset_id: 1, offset_y: 0, scale: 1.0 },
              lips: { asset_id: 1, offset_y: 0, scale: 1.0 },
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
          },
          character_data: {
            info: {
              name: "Test",
              sex: "male" as const,
              date_of_birth: "1990-01-01",
              height_in: 70,
              weight_lb: weight,
              location: { country: "United States" },
            },
            static: {
              head: { asset_id: 1, skin_color: "medium" as const },
              hair: { asset_id: 1, hair_color: "brown" as const },
              beard: { asset_id: 1, facial_hair_color: "brown" as const },
              age_lines: { asset_id: 1 },
            },
            placeable_movable: {
              eyes: {
                asset_id: 1,
                eye_color: "brown" as const,
                offset_x: 0,
                offset_y: 0,
                scale: 1.0,
                rotation: 0,
              },
              eyebrows: {
                asset_id: 1,
                offset_x: 0,
                offset_y: 0,
                scale: 1.0,
                rotation: 0,
              },
              nose: { asset_id: 1, offset_y: 0, scale: 1.0 },
              lips: { asset_id: 1, offset_y: 0, scale: 1.0 },
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
          },
          character_data: {
            info: {
              name: "Test",
              sex: "male" as const,
              date_of_birth: "1990-01-01",
              height_in: 70,
              weight_lb: 150,
              location: { country: "United States" },
            },
            static: {
              head: { asset_id: 1, skin_color: "medium" as const },
              hair: { asset_id: 1, hair_color: "brown" as const },
              beard: { asset_id: 1, facial_hair_color: "brown" as const },
              age_lines: { asset_id: 1 },
            },
            placeable_movable: {
              eyes: {
                asset_id: 1,
                eye_color: "brown" as const,
                offset_x: 0,
                offset_y: offset,
                scale: 1.0,
                rotation: 0,
              },
              eyebrows: {
                asset_id: 1,
                offset_x: 0,
                offset_y: 0,
                scale: 1.0,
                rotation: 0,
              },
              nose: { asset_id: 1, offset_y: 0, scale: 1.0 },
              lips: { asset_id: 1, offset_y: 0, scale: 1.0 },
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
          },
          character_data: {
            info: {
              name: "Test",
              sex: "male" as const,
              date_of_birth: "1990-01-01",
              height_in: 70,
              weight_lb: 150,
              location: { country: "United States" },
            },
            static: {
              head: { asset_id: 1, skin_color: "medium" as const },
              hair: { asset_id: 1, hair_color: "brown" as const },
              beard: { asset_id: 1, facial_hair_color: "brown" as const },
              age_lines: { asset_id: 1 },
            },
            placeable_movable: {
              eyes: {
                asset_id: 1,
                eye_color: "brown" as const,
                offset_x: 0,
                offset_y: 0,
                scale: scale,
                rotation: 0,
              },
              eyebrows: {
                asset_id: 1,
                offset_x: 0,
                offset_y: 0,
                scale: 1.0,
                rotation: 0,
              },
              nose: { asset_id: 1, offset_y: 0, scale: 1.0 },
              lips: { asset_id: 1, offset_y: 0, scale: 1.0 },
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
