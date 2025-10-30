import {
  fullCharacterSchema,
  characterDataSchema,
  FullCharacter,
} from "../../src/utils/validation";
import { generateMockCharacterData } from "../../src/utils/mockData";
import {
  DatabaseCharacter,
  MockCharacter,
  AdminCharacter,
  PlazaCharacterData,
  CharacterDataStructure,
  FullCharacterData,
} from "../../src/types";

describe("Interface Consistency Tests", () => {
  describe("DatabaseCharacter Interface", () => {
    it("should accept stringified character data that validates against schema", () => {
      const mockData = generateMockCharacterData();
      const result = fullCharacterSchema.safeParse(mockData);

      expect(result.success).toBe(true);

      if (result.success) {
        const validatedData: FullCharacter = result.data;
        const databaseCharacter: DatabaseCharacter = {
          id: "db-char-123",
          user_id: "user-456",
          character_data: JSON.stringify(validatedData.character_data),
          country: validatedData.metadata.location.country,
          region: validatedData.metadata.location.region,
          city: validatedData.metadata.location.city,
          created_at: "2024-01-01T00:00:00Z",
          last_edited_at: null,
          is_edited: false,
          is_deleted: false,
          deleted_at: null,
          deleted_by: null,
        };

        expect(databaseCharacter.character_data).toBeDefined();

        const parsedData = JSON.parse(
          databaseCharacter.character_data as string,
        );
        const validationResult = characterDataSchema.safeParse(parsedData);

        expect(validationResult.success).toBe(true);
      }
    });

    it("should accept structured character data directly", () => {
      const mockData = generateMockCharacterData();
      const result = fullCharacterSchema.safeParse(mockData);

      expect(result.success).toBe(true);

      if (result.success) {
        const databaseCharacter: DatabaseCharacter = {
          id: "db-char-456",
          user_id: "user-789",
          character_data: result.data.character_data,
          country: result.data.metadata.location.country,
          region: result.data.metadata.location.region,
          city: result.data.metadata.location.city,
          created_at: "2024-01-01T00:00:00Z",
          last_edited_at: null,
          is_edited: false,
          is_deleted: false,
          deleted_at: null,
          deleted_by: null,
        };

        expect(databaseCharacter.character_data).toBeDefined();
        expect(typeof databaseCharacter.character_data).toBe("object");

        if (typeof databaseCharacter.character_data === "object") {
          expect(databaseCharacter.character_data.static).toBeDefined();
          expect(
            databaseCharacter.character_data.placeable_movable,
          ).toBeDefined();
        }
      }
    });

    it("should handle character data serialization/deserialization consistently", () => {
      for (let i = 0; i < 10; i++) {
        const mockData = generateMockCharacterData();
        const validationResult = fullCharacterSchema.safeParse(mockData);

        expect(validationResult.success).toBe(true);

        if (validationResult.success) {
          const serialized = JSON.stringify(
            validationResult.data.character_data,
          );

          const deserialized = JSON.parse(serialized);

          const revalidationResult =
            characterDataSchema.safeParse(deserialized);

          expect(revalidationResult.success).toBe(true);
        }
      }
    });
  });

  describe("MockCharacter Interface", () => {
    it("should use properly typed character data structure", () => {
      const mockData = generateMockCharacterData();
      const result = fullCharacterSchema.safeParse(mockData);

      expect(result.success).toBe(true);

      if (result.success) {
        const mockCharacter: MockCharacter = {
          upload_id: "mock-upload-123",
          user_id: "mock-user-456",
          created_at: "2024-01-01T00:00:00Z",
          last_edited_at: null,
          character_data: result.data.character_data,
          country: result.data.metadata.location.country,
          region: result.data.metadata.location.region,
          city: result.data.metadata.location.city,
          is_edited: false,
          is_deleted: false,
          deleted_at: null,
          deleted_by: null,
        };

        expect(mockCharacter.character_data).toBeDefined();
        expect(mockCharacter.character_data.static).toBeDefined();
        expect(mockCharacter.character_data.placeable_movable).toBeDefined();

        expect(mockCharacter.character_data.static.name).toBeDefined();
        if (mockCharacter.character_data.placeable_movable.age_lines) {
          expect(
            mockCharacter.character_data.placeable_movable.age_lines.shape_id,
          ).toBeDefined();

          expect(
            mockCharacter.character_data.placeable_movable.age_lines,
          ).not.toHaveProperty("offset_y");
          expect(
            mockCharacter.character_data.placeable_movable.age_lines,
          ).not.toHaveProperty("scale");
        }
      }
    });

    it("should validate all generated mock characters against interface", () => {
      for (let i = 0; i < 20; i++) {
        const mockData = generateMockCharacterData();
        const validationResult = fullCharacterSchema.safeParse(mockData);

        expect(validationResult.success).toBe(true);

        if (validationResult.success) {
          const mockCharacter: MockCharacter = {
            upload_id: `mock-${i}`,
            user_id: "test-user",
            created_at: new Date().toISOString(),
            last_edited_at: null,
            character_data: validationResult.data.character_data,
            country: validationResult.data.metadata.location.country,
            region: validationResult.data.metadata.location.region,
            city: validationResult.data.metadata.location.city,
            is_edited: false,
            is_deleted: false,
            deleted_at: null,
            deleted_by: null,
          };

          if (mockCharacter.character_data.static.beard) {
            expect(mockCharacter.character_data.static.beard.shape_id).toMatch(
              /^B_\d{3}$/,
            );
          }
        }
      }
    });
  });

  describe("AdminCharacter Interface", () => {
    it("should handle both string and structured character data", () => {
      const mockData = generateMockCharacterData();
      const result = fullCharacterSchema.safeParse(mockData);

      expect(result.success).toBe(true);

      if (result.success) {
        const adminCharacterStructured: AdminCharacter = {
          id: "admin-char-123",
          user_id: "user-456",
          character_data: result.data.character_data,
          created_at: "2024-01-01T00:00:00Z",
          last_edited_at: null,
          is_edited: false,
          is_deleted: false,
          deleted_at: null,
          deleted_by: null,
        };

        const adminCharacterString: AdminCharacter = {
          id: "admin-char-456",
          user_id: "user-789",
          character_data: JSON.stringify(result.data.character_data),
          created_at: "2024-01-01T00:00:00Z",
          last_edited_at: null,
          is_edited: false,
          is_deleted: false,
          deleted_at: null,
          deleted_by: null,
        };

        expect(adminCharacterStructured.character_data).toBeDefined();
        expect(adminCharacterString.character_data).toBeDefined();
      }
    });
  });

  describe("PlazaCharacterData Interface", () => {
    it("should handle character data for public display", () => {
      const mockData = generateMockCharacterData();
      const result = fullCharacterSchema.safeParse(mockData);

      expect(result.success).toBe(true);

      if (result.success) {
        const plazaCharacterStructured: PlazaCharacterData = {
          id: "plaza-char-123",
          created_at: "2024-01-01T00:00:00Z",
          last_edited_at: null,
          character_data: result.data.character_data,
        };

        const plazaCharacterString: PlazaCharacterData = {
          id: "plaza-char-456",
          created_at: "2024-01-01T00:00:00Z",
          last_edited_at: null,
          character_data: JSON.stringify(result.data.character_data),
        };

        expect(plazaCharacterStructured.character_data).toBeDefined();
        expect(plazaCharacterString.character_data).toBeDefined();

        if (typeof plazaCharacterStructured.character_data === "object") {
          expect(plazaCharacterStructured.character_data.static).toBeDefined();
          expect(
            plazaCharacterStructured.character_data.placeable_movable,
          ).toBeDefined();
        }
      }
    });
  });

  describe("Cross-Interface Type Compatibility", () => {
    it("should allow conversion between different character interfaces", () => {
      const mockData = generateMockCharacterData();
      const result = fullCharacterSchema.safeParse(mockData);

      expect(result.success).toBe(true);

      if (result.success) {
        const fullCharacter: FullCharacterData = {
          metadata: result.data.metadata,
          character_data: result.data.character_data,
        };

        const databaseCharacter: DatabaseCharacter = {
          id: "converted-db-char",
          user_id: fullCharacter.metadata.user_id,
          character_data: fullCharacter.character_data,
          country: fullCharacter.metadata.location.country,
          region: fullCharacter.metadata.location.region,
          city: fullCharacter.metadata.location.city,
          created_at: fullCharacter.metadata.created_at,
          last_edited_at: fullCharacter.metadata.last_edited_at,
          is_edited: fullCharacter.metadata.is_edited,
          is_deleted: fullCharacter.metadata.is_deleted,
          deleted_at: fullCharacter.metadata.deleted_at,
          deleted_by: fullCharacter.metadata.deleted_by,
        };

        const mockCharacter: MockCharacter = {
          upload_id: fullCharacter.metadata.upload_id,
          user_id: fullCharacter.metadata.user_id,
          created_at: fullCharacter.metadata.created_at,
          last_edited_at: fullCharacter.metadata.last_edited_at,
          character_data: fullCharacter.character_data,
          country: fullCharacter.metadata.location.country,
          region: fullCharacter.metadata.location.region,
          city: fullCharacter.metadata.location.city,
          is_edited: fullCharacter.metadata.is_edited,
          is_deleted: fullCharacter.metadata.is_deleted,
          deleted_at: fullCharacter.metadata.deleted_at,
          deleted_by: fullCharacter.metadata.deleted_by,
        };

        const plazaCharacter: PlazaCharacterData = {
          id: "converted-plaza-char",
          created_at: fullCharacter.metadata.created_at,
          last_edited_at: fullCharacter.metadata.last_edited_at,
          character_data: fullCharacter.character_data,
        };

        expect(databaseCharacter.character_data).toBeDefined();
        expect(mockCharacter.character_data).toBeDefined();
        expect(plazaCharacter.character_data).toBeDefined();
      }
    });

    it("should maintain data integrity across interface conversions", () => {
      for (let i = 0; i < 5; i++) {
        const mockData = generateMockCharacterData();
        const validationResult = fullCharacterSchema.safeParse(mockData);

        expect(validationResult.success).toBe(true);

        if (validationResult.success) {
          const originalData = validationResult.data.character_data;

          const mockChar: MockCharacter = {
            upload_id: "test",
            user_id: "test",
            created_at: "2024-01-01T00:00:00Z",
            last_edited_at: null,
            character_data: originalData,
            country: validationResult.data.metadata.location.country,
            region: validationResult.data.metadata.location.region,
            city: validationResult.data.metadata.location.city,
            is_edited: false,
            is_deleted: false,
            deleted_at: null,
            deleted_by: null,
          };

          const dbChar: DatabaseCharacter = {
            id: "test",
            user_id: "test",
            character_data: mockChar.character_data,
            country: validationResult.data.metadata.location.country,
            region: validationResult.data.metadata.location.region,
            city: validationResult.data.metadata.location.city,
            created_at: "2024-01-01T00:00:00Z",
            last_edited_at: null,
            is_edited: false,
            is_deleted: false,
            deleted_at: null,
            deleted_by: null,
          };

          if (typeof dbChar.character_data === "object") {
            if (
              dbChar.character_data.static.beard &&
              originalData.static.beard
            ) {
              expect(dbChar.character_data.static.beard.shape_id).toBe(
                originalData.static.beard.shape_id,
              );
            }
            if (
              dbChar.character_data.placeable_movable.age_lines &&
              originalData.placeable_movable.age_lines
            ) {
              expect(
                dbChar.character_data.placeable_movable.age_lines.shape_id,
              ).toBe(originalData.placeable_movable.age_lines.shape_id);
            }
          }
        }
      }
    });
  });

  describe("Type Safety Validation", () => {
    it("should prevent assignment of invalid character data structures", () => {
      const validMockData = generateMockCharacterData();
      const validationResult = fullCharacterSchema.safeParse(validMockData);

      expect(validationResult.success).toBe(true);

      if (validationResult.success) {
        const validMockChar: MockCharacter = {
          upload_id: "valid",
          user_id: "valid",
          created_at: "2024-01-01T00:00:00Z",
          last_edited_at: null,
          character_data: validationResult.data.character_data,
          country: validationResult.data.metadata.location.country,
          region: validationResult.data.metadata.location.region,
          city: validationResult.data.metadata.location.city,
          is_edited: false,
          is_deleted: false,
          deleted_at: null,
          deleted_by: null,
        };

        expect(validMockChar.character_data).toBeDefined();

        if (validMockChar.character_data.placeable_movable.age_lines) {
          expect(
            validMockChar.character_data.placeable_movable.age_lines,
          ).toHaveProperty("shape_id");
          expect(
            validMockChar.character_data.placeable_movable.age_lines,
          ).not.toHaveProperty("offset_y");
          expect(
            validMockChar.character_data.placeable_movable.age_lines,
          ).not.toHaveProperty("scale");
        }
      }
    });
  });
});
