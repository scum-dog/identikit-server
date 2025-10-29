import { z } from "zod";
import { fullCharacterSchema } from "../../src/utils/validation";
import {
  CharacterDataStructure,
  CharacterStatic,
  CharacterPlaceableMovable,
  AccessorySlot,
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
          canEdit: true,
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
          static: {
            name: "John Doe",
            sex: "male",
            date_of_birth: "1990-01-01",
            height_in: 72,
            weight_lb: 180,
            head: {
              shape_id: "HE_001",
              skin_color: "medium",
            },
            hair: {
              style_id: "H_001",
              hair_color: "brown",
            },
            beard: {
              shape_id: "B_001",
              facial_hair_color: "brown",
            },
          },
          placeable_movable: {
            eyes: {
              shape_id: "EY_001",
              eye_color: "brown",
              offset_y: 0.1,
              scale: 1.0,
              rotation: 45,
              distance: 0.5,
            },
            eyebrows: {
              shape_id: "EB_001",
              offset_y: -0.2,
              scale: 1.1,
              rotation: 10,
              distance: 0.3,
            },
            nose: {
              shape_id: "N_001",
              offset_y: 0.0,
              scale: 0.9,
            },
            lips: {
              shape_id: "L_001",
              offset_y: 0.2,
              scale: 1.2,
            },
            age_lines: {
              shape_id: "A_001",
            },
            accessories: {
              slot_1: {
                type: "glasses",
                asset_id: "G_123",
                offset_y: 0.1,
                scale: 1.0,
              },
              slot_2: {
                type: "mustache",
                asset_id: "M_456",
                offset_y: -0.1,
                scale: 0.9,
              },
              slot_3: {
                type: "misc",
                asset_id: "MI_789",
                offset_x: 0.2,
                offset_y: 0.3,
                scale: 1.1,
              },
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

    it("should validate AccessorySlot type variations", () => {
      const glassesAccessory: AccessorySlot = {
        type: "glasses",
        asset_id: "G_123",
        offset_y: 0.1,
        scale: 1.0,
      };

      const mustacheAccessory: AccessorySlot = {
        type: "mustache",
        asset_id: "M_456",
        offset_y: -0.1,
        scale: 0.9,
      };

      const miscAccessory: AccessorySlot = {
        type: "misc",
        asset_id: "MI_789",
        offset_x: 0.2,
        offset_y: 0.3,
        scale: 1.1,
      };

      const miscAccessoryMinimal: AccessorySlot = {
        type: "misc",
        asset_id: "MI_999",
        offset_y: 0.0,
      };

      const testData = {
        metadata: {
          upload_id: "123e4567-e89b-12d3-a456-426614174000",
          user_id: "123e4567-e89b-12d3-a456-426614174001",
          created_at: "2024-01-01T00:00:00.000Z",
          last_edited_at: null,
          is_edited: false,
          canEdit: true,
          is_deleted: false,
          deleted_at: null,
          deleted_by: null,
          location: {
            country: "United States",
          },
        },
        character_data: {
          static: {
            name: "Test",
            sex: "male" as const,
            date_of_birth: "1990-01-01",
            height_in: 70,
            weight_lb: 150,
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

      const result1 = fullCharacterSchema.safeParse(testData);
      expect(result1.success).toBe(true);

      testData.character_data.placeable_movable.accessories.slot_3 =
        miscAccessoryMinimal;
      const result2 = fullCharacterSchema.safeParse(testData);
      expect(result2.success).toBe(true);

      (testData.character_data.placeable_movable.accessories as any) = {
        slot_1: undefined,
        slot_2: undefined,
        slot_3: undefined,
      };
      const result3 = fullCharacterSchema.safeParse(testData);
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
          canEdit: true,
          is_deleted: false,
          deleted_at: null,
          deleted_by: null,
          location: {
            country: "United States",
            // region and city are optional
          },
        },
        character_data: {
          static: {
            name: "Test",
            sex: "male" as const,
            date_of_birth: "1990-01-01",
            height_in: 70,
            weight_lb: 150,
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
          canEdit: true,
          is_deleted: false,
          deleted_at: null,
          deleted_by: null,
          location: {
            country: "United States",
          },
        },
        character_data: {
          static: {
            name: "Test",
            sex: "male" as const,
            date_of_birth: "1990-01-01",
            height_in: 70,
            weight_lb: 150,
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
        expect(result.data.character_data.static.beard.shape_id).toBe("B_001");
        expect(result.data.character_data.static.beard.facial_hair_color).toBe(
          "brown",
        );
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
          canEdit: true,
          is_deleted: false,
          deleted_at: null,
          deleted_by: null,
          location: {
            country: "United States",
          },
        },
        character_data: {
          static: {
            name: "Test",
            sex: "male",
            date_of_birth: "1990-01-01",
            height_in: 70,
            weight_lb: 150,
            head: {
              shape_id: "HE_001",
              skin_color: "medium",
            },
            hair: {
              style_id: "H_001",
              hair_color: "brown",
            },
            facial_hair: {
              shape_id: "B_001",
              facial_hair_color: "brown",
            },
          },
          placeable_movable: {
            eyes: {
              shape_id: "EY_001",
              eye_color: "brown",
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
        expect(errors.some((e) => e.path.includes("beard"))).toBe(true);
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
