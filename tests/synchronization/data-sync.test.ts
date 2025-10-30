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

    it("should generate valid asset IDs that match schema patterns", () => {
      for (let i = 0; i < 50; i++) {
        const mockData = generateMockCharacterData();

        expect(mockData.character_data.static.head.shape_id).toMatch(
          /^HE_\d{3}$/,
        );

        expect(mockData.character_data.static.hair.style_id).toMatch(
          /^H_\d{3}$/,
        );

        if (mockData.character_data.static.beard) {
          expect(mockData.character_data.static.beard.shape_id).toMatch(
            /^B_\d{3}$/,
          );
        }

        expect(mockData.character_data.placeable_movable.eyes.shape_id).toMatch(
          /^EY_\d{3}$/,
        );
        expect(
          mockData.character_data.placeable_movable.eyebrows.shape_id,
        ).toMatch(/^EB_\d{3}$/);
        expect(mockData.character_data.placeable_movable.nose.shape_id).toMatch(
          /^N_\d{3}$/,
        );
        expect(mockData.character_data.placeable_movable.lips.shape_id).toMatch(
          /^L_\d{3}$/,
        );
        if (mockData.character_data.placeable_movable.age_lines) {
          expect(
            mockData.character_data.placeable_movable.age_lines.shape_id,
          ).toMatch(/^A_\d{3}$/);
        }

        const accessories =
          mockData.character_data.placeable_movable.accessories;
        [accessories.slot_1, accessories.slot_2, accessories.slot_3].forEach(
          (accessory) => {
            if (accessory) {
              if (accessory.type === "glasses") {
                expect(accessory.asset_id).toMatch(/^G_\d{3}$/);
              } else if (accessory.type === "mustache") {
                expect(accessory.asset_id).toMatch(/^M_\d{3}$/);
              } else if (accessory.type === "misc") {
                expect(accessory.asset_id).toMatch(/^MI_\d{3}$/);
              }
            }
          },
        );
      }
    });

    it("should generate accessory structures that match schema requirements", () => {
      for (let i = 0; i < 100; i++) {
        const mockData = generateMockCharacterData();
        const accessories =
          mockData.character_data.placeable_movable.accessories;

        [accessories.slot_1, accessories.slot_2, accessories.slot_3].forEach(
          (accessory) => {
            if (accessory) {
              expect(typeof accessory.offset_y).toBe("number");
              expect(accessory.offset_y).toBeGreaterThanOrEqual(-1);
              expect(accessory.offset_y).toBeLessThanOrEqual(1);

              if (
                accessory.type === "glasses" ||
                accessory.type === "mustache"
              ) {
                expect(typeof accessory.scale).toBe("number");
                expect(accessory.scale).toBeGreaterThanOrEqual(0.5);
                expect(accessory.scale).toBeLessThanOrEqual(1.5);

                expect(accessory).not.toHaveProperty("offset_x");
                expect(accessory).not.toHaveProperty("rotation");
                expect(accessory).not.toHaveProperty("distance");
              }

              if (accessory.type === "misc") {
                if (
                  "offset_x" in accessory &&
                  accessory.offset_x !== undefined
                ) {
                  expect(typeof accessory.offset_x).toBe("number");
                  expect(accessory.offset_x).toBeGreaterThanOrEqual(-1);
                  expect(accessory.offset_x).toBeLessThanOrEqual(1);
                }

                if ("scale" in accessory && accessory.scale !== undefined) {
                  expect(typeof accessory.scale).toBe("number");
                  expect(accessory.scale).toBeGreaterThanOrEqual(0.5);
                  expect(accessory.scale).toBeLessThanOrEqual(1.5);
                }

                expect(accessory).not.toHaveProperty("rotation");
                expect(accessory).not.toHaveProperty("distance");
              }
            }
          },
        );
      }
    });

    it("should generate age_lines with correct structure when present", () => {
      for (let i = 0; i < 50; i++) {
        const mockData = generateMockCharacterData();
        const ageLines = mockData.character_data.placeable_movable.age_lines;

        if (ageLines) {
          expect(ageLines.shape_id).toMatch(/^A_\d{3}$/);

          expect(ageLines).not.toHaveProperty("offset_y");
          expect(ageLines).not.toHaveProperty("scale");
          expect(ageLines).not.toHaveProperty("rotation");
          expect(ageLines).not.toHaveProperty("distance");
        }
      }
    });

    it("should generate numeric values within validation ranges", () => {
      for (let i = 0; i < 50; i++) {
        const mockData = generateMockCharacterData();
        const staticData = mockData.character_data.static;
        const placeableData = mockData.character_data.placeable_movable;

        // height and weight ranges
        expect(staticData.height_in).toBeGreaterThanOrEqual(24);
        expect(staticData.height_in).toBeLessThanOrEqual(96);
        expect(staticData.weight_lb).toBeGreaterThanOrEqual(50);
        expect(staticData.weight_lb).toBeLessThanOrEqual(500);

        // offset values
        expect(placeableData.eyes.offset_y).toBeGreaterThanOrEqual(-1);
        expect(placeableData.eyes.offset_y).toBeLessThanOrEqual(1);
        expect(placeableData.eyebrows.offset_y).toBeGreaterThanOrEqual(-1);
        expect(placeableData.eyebrows.offset_y).toBeLessThanOrEqual(1);
        expect(placeableData.nose.offset_y).toBeGreaterThanOrEqual(-1);
        expect(placeableData.nose.offset_y).toBeLessThanOrEqual(1);
        expect(placeableData.lips.offset_y).toBeGreaterThanOrEqual(-1);
        expect(placeableData.lips.offset_y).toBeLessThanOrEqual(1);

        // scale values
        expect(placeableData.eyes.scale).toBeGreaterThanOrEqual(0.5);
        expect(placeableData.eyes.scale).toBeLessThanOrEqual(1.5);
        expect(placeableData.eyebrows.scale).toBeGreaterThanOrEqual(0.5);
        expect(placeableData.eyebrows.scale).toBeLessThanOrEqual(1.5);
        expect(placeableData.nose.scale).toBeGreaterThanOrEqual(0.5);
        expect(placeableData.nose.scale).toBeLessThanOrEqual(1.5);
        expect(placeableData.lips.scale).toBeGreaterThanOrEqual(0.5);
        expect(placeableData.lips.scale).toBeLessThanOrEqual(1.5);

        // rotation values
        expect(placeableData.eyes.rotation).toBeGreaterThanOrEqual(0);
        expect(placeableData.eyes.rotation).toBeLessThanOrEqual(359);
        expect(placeableData.eyebrows.rotation).toBeGreaterThanOrEqual(0);
        expect(placeableData.eyebrows.rotation).toBeLessThanOrEqual(359);

        // distance values
        expect(placeableData.eyes.distance).toBeGreaterThanOrEqual(0);
        expect(placeableData.eyes.distance).toBeLessThanOrEqual(1);
        expect(placeableData.eyebrows.distance).toBeGreaterThanOrEqual(0);
        expect(placeableData.eyebrows.distance).toBeLessThanOrEqual(1);
      }
    });

    it("should generate valid date formats", () => {
      for (let i = 0; i < 20; i++) {
        const mockData = generateMockCharacterData();
        const dateOfBirth = mockData.character_data.static.date_of_birth;

        expect(dateOfBirth).toMatch(/^\d{4}-\d{2}-\d{2}$/);

        const date = new Date(dateOfBirth);
        expect(date).toBeInstanceOf(Date);
        expect(date.getTime()).not.toBeNaN();
        expect(date.getFullYear()).toBeGreaterThanOrEqual(1900);
        expect(date.getFullYear()).toBeLessThanOrEqual(
          new Date().getFullYear(),
        );
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
          expect(beard).toHaveProperty("shape_id");
          expect(beard).toHaveProperty("facial_hair_color");
          expect(beard.shape_id).toMatch(/^B_\d{3}$/);
        }
      }
    });

    it("should not generate beards for female characters", () => {
      for (let i = 0; i < 100; i++) {
        const mockData = generateMockCharacterData();

        if (mockData.character_data.static.sex === "female") {
          expect(mockData.character_data.static.beard).toBeUndefined();
        }
      }
    });
  });
});
