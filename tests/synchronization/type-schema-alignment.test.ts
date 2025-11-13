import { z } from "zod";
import { fullCharacterSchema } from "../../src/utils/validation";
import {
  CharacterDataStructure,
  CharacterStatic,
  CharacterPlaceableMovable,
  CharacterMetadata,
} from "../../src/types";

describe("Type-Schema Alignment Tests", () => {
  describe("Schema Structure vs TypeScript Types", () => {
    it("should validate that schema accepts all valid TypeScript character data", () => {
      const validTypedData: {
        metadata: CharacterMetadata;
        character_data: CharacterDataStructure;
      } = {
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
            name: "John Doe",
            sex: "male",
            date_of_birth: "1990-01-01",
            height_in: 72,
            weight_lb: 180,
            location: {
              country: "United States",
              region: "California",
            },
          },
          static: {
            head: {
              asset_id: 1,
              skin_color: "medium",
            },
            hair: {
              asset_id: 1,
              hair_color: "brown",
            },
            beard: {
              asset_id: 1,
              facial_hair_color: "brown",
            },
            age_lines: {
              asset_id: 1,
            },
          },
          placeable_movable: {
            eyes: {
              asset_id: 1,
              eye_color: "brown",
              offset_x: 0.5,
              offset_y: 0.1,
              scale: 1.0,
              rotation: 30,
            },
            eyebrows: {
              asset_id: 1,
              offset_x: 0.3,
              offset_y: -0.2,
              scale: 1.1,
              rotation: 10,
            },
            nose: {
              asset_id: 1,
              offset_y: 0.0,
              scale: 0.9,
            },
            lips: {
              asset_id: 1,
              offset_y: 0.2,
              scale: 1.2,
            },
            glasses: {
              asset_id: 123,
              offset_y: 0.1,
              scale: 1.0,
            },
            mustache: {
              asset_id: 456,
              offset_y: -0.1,
              scale: 0.9,
            },
            misc: {
              asset_id: 789,
              offset_x: 0.2,
              offset_y: 0.3,
              scale: 1.1,
            },
          },
        },
      };

      const result = fullCharacterSchema.safeParse(validTypedData);

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.metadata).toBeDefined();
        expect(result.data.character_data).toBeDefined();
        expect(result.data.character_data.static).toBeDefined();
        expect(result.data.character_data.placeable_movable).toBeDefined();
      }
    });

    it("should validate accessory type variations", () => {
      const glassesAccessory = {
        asset_id: 123,
        offset_y: 0.1,
        scale: 1.0,
      };

      const mustacheAccessory = {
        asset_id: 456,
        offset_y: -0.1,
        scale: 0.9,
      };

      const miscAccessory = {
        asset_id: 789,
        offset_x: 0.2,
        offset_y: 0.3,
        scale: 1.1,
      };

      const miscAccessoryMinimal = {
        asset_id: 999,
        offset_y: 0.0,
      };

      const testData = {
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

      const result1 = fullCharacterSchema.safeParse(testData);
      expect(result1.success).toBe(true);

      testData.character_data.placeable_movable.misc = {
        ...miscAccessoryMinimal,
        offset_x: 0,
        scale: 1.0,
      };
      const result2 = fullCharacterSchema.safeParse(testData);
      expect(result2.success).toBe(true);

      const testDataNoAccessories = { ...testData };
      testDataNoAccessories.character_data.placeable_movable = {
        ...testDataNoAccessories.character_data.placeable_movable,
      };
      delete (testDataNoAccessories.character_data.placeable_movable as any)
        .glasses;
      delete (testDataNoAccessories.character_data.placeable_movable as any)
        .mustache;
      delete (testDataNoAccessories.character_data.placeable_movable as any)
        .misc;
      const result3 = fullCharacterSchema.safeParse(testDataNoAccessories);
      expect(result3.success).toBe(true);
    });

    it("should validate optional fields match between types and schema", () => {
      const minimalData = {
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
            accessories: {
              slot_1: undefined,
              slot_2: undefined,
              slot_3: undefined,
            },
          },
        },
      };

      const result = fullCharacterSchema.safeParse(minimalData);
      expect(result.success).toBe(true);
    });

    it("should validate field naming consistency between types and schema", () => {
      const testData = {
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
            accessories: {
              slot_1: undefined,
              slot_2: undefined,
              slot_3: undefined,
            },
          },
        },
      };

      const result = fullCharacterSchema.safeParse(testData);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.character_data.static.beard).toBeDefined();
        if (result.data.character_data.static.beard) {
          expect(result.data.character_data.static.beard.asset_id).toBe(1);
          expect(
            result.data.character_data.static.beard.facial_hair_color,
          ).toBe("brown");
        }
      }
    });

    it("should reject data with old facial_hair field name", () => {
      const testDataWithOldFieldName = {
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
          static: {
            name: "Test",
            sex: "male",
            date_of_birth: "1990-01-01",
            height_in: 70,
            weight_lb: 150,
            location: {
              country: "United States",
            },
            head: {
              asset_id: 1,
              skin_color: "medium",
            },
            hair: {
              asset_id: 1,
              hair_color: "brown",
            },
            beard: {
              asset_id: 1,
              facial_hair_color: "brown",
            },
            facial_hair: {
              asset_id: 2,
              facial_hair_color: "black",
            },
          },
          placeable_movable: {
            eyes: {
              asset_id: 1,
              eye_color: "brown",
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
            accessories: {
              slot_1: undefined,
              slot_2: undefined,
              slot_3: undefined,
            },
          },
        },
      };

      const result = fullCharacterSchema.safeParse(testDataWithOldFieldName);
      expect(result.success).toBe(false);

      if (!result.success) {
        const errors = result.error.errors;
        expect(
          errors.some(
            (e) =>
              e.path.includes("facial_hair") ||
              e.message.includes("facial_hair"),
          ),
        ).toBe(true);
      }
    });
  });

  describe("Schema Inference Type Compatibility", () => {
    it("should ensure schema inferred types are compatible with defined types", () => {
      type SchemaInferred = z.infer<typeof fullCharacterSchema>;

      const testFunction = (
        data: SchemaInferred,
      ): {
        metadata: CharacterMetadata;
        character_data: CharacterDataStructure;
      } => {
        return data;
      };

      expect(testFunction).toBeDefined();
    });
  });
});
