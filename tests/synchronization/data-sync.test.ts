import { generateMockCharacterData } from "../../src/utils/mockData";
import { fullCharacterSchema } from "../../src/utils/validation";

describe("Data Synchronization Tests", () => {
  describe("Mock Data vs Validation Schema", () => {
    it("should validate 100 randomly generated mock characters", () => {
      const failures: Array<{ index: number; errors: any[] }> = [];

      for (let i = 0; i < 100; i++) {
        const mockData = generateMockCharacterData();
        const result = fullCharacterSchema.safeParse(mockData);

        if (!result.success) {
          failures.push({
            index: i,
            errors: result.error.errors,
          });
        }
      }

      expect(failures).toEqual([]);
    });

    it("should generate accessory structures with correct properties", () => {
      for (let i = 0; i < 100; i++) {
        const mockData = generateMockCharacterData();
        const placeableMovable = mockData.character_data.placeable_movable;

        if (placeableMovable.glasses) {
          expect(placeableMovable.glasses).not.toHaveProperty("offset_x");
          expect(placeableMovable.glasses).not.toHaveProperty("rotation");
          expect(placeableMovable.glasses).not.toHaveProperty("distance");
        }

        if (placeableMovable.mustache) {
          expect(placeableMovable.mustache).not.toHaveProperty("offset_x");
          expect(placeableMovable.mustache).not.toHaveProperty("rotation");
          expect(placeableMovable.mustache).not.toHaveProperty("distance");
        }

        if (placeableMovable.misc) {
          expect(placeableMovable.misc).not.toHaveProperty("rotation");
          expect(placeableMovable.misc).not.toHaveProperty("distance");
        }
      }
    });

    it("should generate age_lines with correct structure when present", () => {
      for (let i = 0; i < 50; i++) {
        const mockData = generateMockCharacterData();
        const ageLines = mockData.character_data.static.age_lines;

        if (ageLines) {
          expect(ageLines).not.toHaveProperty("offset_y");
          expect(ageLines).not.toHaveProperty("scale");
          expect(ageLines).not.toHaveProperty("rotation");
          expect(ageLines).not.toHaveProperty("distance");
        }
      }
    });
  });

  describe("Consistent Beard Naming", () => {
    it("should use 'beard' field name consistently when present", () => {
      for (let i = 0; i < 10; i++) {
        const mockData = generateMockCharacterData();

        expect(mockData.character_data.static).not.toHaveProperty(
          "facial_hair",
        );

        const beard = mockData.character_data.static.beard;
        if (beard) {
          expect(beard).toHaveProperty("asset_id");
          expect(beard).toHaveProperty("facial_hair_color");
          expect(typeof beard.asset_id).toBe("number");
          expect(beard.asset_id).toBeGreaterThanOrEqual(1);
          expect(beard.asset_id).toBeLessThanOrEqual(999);
        }
      }
    });

    it("should not generate beards for female characters", () => {
      for (let i = 0; i < 100; i++) {
        const mockData = generateMockCharacterData();

        if (mockData.character_data.info.sex === "female") {
          expect(mockData.character_data.static.beard).toBeUndefined();
        }
      }
    });
  });
});
