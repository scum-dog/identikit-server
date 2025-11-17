import { fullCharacterSchema } from "../../src/utils/validation";

describe("Rotation Range Validation", () => {
  const baseCharacterData = {
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
        name: "John",
        sex: "male" as const,
        date_of_birth: "1990-01-01",
        height_in: 70,
        weight_lb: 150,
        eye_color: "brown" as const,
        hair_color: "brown" as const,
        race: ["white"] as const,
        ethnicity: "not_hispanic_latino" as const,
        location: { country: "United States", region: "California" },
      },
      static: {
        head: { asset_id: 1 },
        hair: { asset_id: 1 },
      },
      placeable_movable: {
        eyes: {
          asset_id: 1,
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
        accessories: {},
      },
    },
  };

  describe("Eye rotation validation", () => {
    it("should accept eye rotation values within -35 to +35 range in 5-degree increments", () => {
      const validRotations = [
        -35, -30, -25, -20, -15, -10, -5, 0, 5, 10, 15, 20, 25, 30, 35,
      ];

      validRotations.forEach((rotation) => {
        const testData = {
          ...baseCharacterData,
          character_data: {
            ...baseCharacterData.character_data,
            placeable_movable: {
              ...baseCharacterData.character_data.placeable_movable,
              eyes: {
                ...baseCharacterData.character_data.placeable_movable.eyes,
                rotation,
              },
            },
          },
        };

        const result = fullCharacterSchema.safeParse(testData);
        expect(result.success).toBe(true);
      });
    });

    it("should reject eye rotation values outside -35 to +35 range or not in 5-degree increments", () => {
      const invalidRotations = [
        -36, -180, 36, 45, 180, 360, -34, -31, -1, 1, 3, 7, 23, 31, 34,
      ];

      invalidRotations.forEach((rotation) => {
        const testData = {
          ...baseCharacterData,
          character_data: {
            ...baseCharacterData.character_data,
            placeable_movable: {
              ...baseCharacterData.character_data.placeable_movable,
              eyes: {
                ...baseCharacterData.character_data.placeable_movable.eyes,
                rotation,
              },
            },
          },
        };

        const result = fullCharacterSchema.safeParse(testData);
        expect(result.success).toBe(false);
      });
    });
  });

  describe("Eyebrow rotation validation", () => {
    it("should accept eyebrow rotation values within -45 to +45 range in 5-degree increments", () => {
      const validRotations = [
        -45, -40, -35, -30, -25, -20, -15, -10, -5, 0, 5, 10, 15, 20, 25, 30,
        35, 40, 45,
      ];

      validRotations.forEach((rotation) => {
        const testData = {
          ...baseCharacterData,
          character_data: {
            ...baseCharacterData.character_data,
            placeable_movable: {
              ...baseCharacterData.character_data.placeable_movable,
              eyebrows: {
                ...baseCharacterData.character_data.placeable_movable.eyebrows,
                rotation,
              },
            },
          },
        };

        const result = fullCharacterSchema.safeParse(testData);
        expect(result.success).toBe(true);
      });
    });

    it("should reject eyebrow rotation values outside -45 to +45 range or not in 5-degree increments", () => {
      const invalidRotations = [
        -46, -180, 46, 90, 180, 360, -44, -41, -1, 1, 3, 7, 23, 41, 44,
      ];

      invalidRotations.forEach((rotation) => {
        const testData = {
          ...baseCharacterData,
          character_data: {
            ...baseCharacterData.character_data,
            placeable_movable: {
              ...baseCharacterData.character_data.placeable_movable,
              eyebrows: {
                ...baseCharacterData.character_data.placeable_movable.eyebrows,
                rotation,
              },
            },
          },
        };

        const result = fullCharacterSchema.safeParse(testData);
        expect(result.success).toBe(false);
      });
    });
  });
});
