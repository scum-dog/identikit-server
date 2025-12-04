import {
  characterDataSchema,
  fullCharacterSchema,
  plazaSearchSchema,
  adminActionSchema,
  oauthCallbackSchema,
  newgroundsAuthSchema,
  itchTokenSchema,
} from "../../src/utils/validation";
import { generateMockCharacterData } from "../../src/utils/mockData";

describe("Validation Schemas", () => {
  describe("characterDataSchema", () => {
    it("should validate valid character data", () => {
      const mockData = generateMockCharacterData();
      const result = characterDataSchema.safeParse(mockData.character_data);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.info.name).toBeDefined();
        expect(result.data.placeable_movable.eyes).toBeDefined();
      }
    });

    it("should reject invalid UUIDs", () => {
      const mockData = generateMockCharacterData();
      const invalidData = {
        character_data: mockData.character_data,
        metadata: {
          user_id: "also-invalid",
          created_at: mockData.created_at,
          last_edited_at: mockData.last_edited_at,
          can_edit: mockData.can_edit,
          is_deleted: mockData.is_deleted,
          deleted_at: mockData.deleted_at,
          deleted_by: mockData.deleted_by,
        },
      };

      const result = fullCharacterSchema.safeParse(invalidData);

      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.errors;
        expect(errors.some((e) => e.path.includes("user_id"))).toBe(true);
      }
    });

    it("should reject empty character name", () => {
      const data = generateMockCharacterData();
      data.character_data.info.name = "";

      const result = characterDataSchema.safeParse(data.character_data);

      expect(result.success).toBe(false);
      if (!result.success) {
        const nameError = result.error.errors.find(
          (e) => e.path.includes("name") && e.message.includes("least 1"),
        );
        expect(nameError).toBeDefined();
      }
    });

    it("should reject character name longer than 32 characters", () => {
      const data = generateMockCharacterData();
      data.character_data.info.name =
        "ThisNameIsWayTooLongAndExceedsThirtyTwoCharacterLimit";

      const result = characterDataSchema.safeParse(data.character_data);

      expect(result.success).toBe(false);
      if (!result.success) {
        const nameError = result.error.errors.find(
          (e) => e.path.includes("name") && e.message.includes("32"),
        );
        expect(nameError).toBeDefined();
      }
    });

    it("should accept valid character names with letters, spaces, hyphens, and apostrophes", () => {
      const validNames = [
        "John",
        "Mary Jane",
        "O'Connor",
        "Jean-Pierre",
        "Mary-Jane O'Sullivan",
        "Anna-Maria",
        "D'Angelo",
      ];

      validNames.forEach((name) => {
        const data = generateMockCharacterData();
        data.character_data.info.name = name;

        const result = characterDataSchema.safeParse(data.character_data);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.info.name).toBe(name);
        }
      });
    });

    it("should reject character names with invalid characters", () => {
      const invalidNames = [
        "John123",
        "Test@User",
        "名前",
        "Test_User",
        "John.Doe",
        "User#1",
        "Test*Name",
        "John+Mary",
        "Test/Name",
        "User\\Name",
        "Test=Name",
        "User%Name",
        "Test&Name",
        "John(Doe)",
        "Test[Name]",
        "User{Name}",
        "Test<Name>",
        "User|Name",
        "Test?Name",
        "User!Name",
        "Test;Name",
        "User:Name",
        "Test,Name",
        "User$Name",
        "John🙂",
      ];

      invalidNames.forEach((name) => {
        const data = generateMockCharacterData();
        data.character_data.info.name = name;

        const result = characterDataSchema.safeParse(data.character_data);

        expect(result.success).toBe(false);
        if (!result.success) {
          const nameError = result.error.errors.find(
            (e) =>
              e.path.includes("name") &&
              e.message.includes("must start with a letter"),
          );
          expect(nameError).toBeDefined();
        }
      });
    });

    it("should reject character names with only spaces, hyphens, or apostrophes", () => {
      const invalidNames = [
        "   ",
        "---",
        "'''",
        " - ",
        " ' ",
        "- '",
        "  -  '  ",
        "-'-",
        " ' - ' ",
      ];

      invalidNames.forEach((name) => {
        const data = generateMockCharacterData();
        data.character_data.info.name = name;

        const result = characterDataSchema.safeParse(data.character_data);

        expect(result.success).toBe(false);
        if (!result.success) {
          const nameError = result.error.errors.find(
            (e) =>
              e.path.includes("name") &&
              e.message.includes("must start with a letter"),
          );
          expect(nameError).toBeDefined();
        }
      });
    });

    it("should reject character names with leading or trailing whitespace", () => {
      const invalidNames = [
        " John",
        "Mary ",
        "  Jane",
        "Robert  ",
        " O'Connor ",
        "  Jean-Pierre  ",
        "\tJohn",
        "Mary\n",
      ];

      invalidNames.forEach((name) => {
        const data = generateMockCharacterData();
        data.character_data.info.name = name;

        const result = characterDataSchema.safeParse(data.character_data);

        expect(result.success).toBe(false);
        if (!result.success) {
          const nameError = result.error.errors.find(
            (e) =>
              e.path.includes("name") &&
              e.message.includes("must start with a letter"),
          );
          expect(nameError).toBeDefined();
        }
      });
    });

    it("should reject character names with multiple consecutive spaces", () => {
      const invalidNames = [
        "John  Mary",
        "Anne   Smith",
        "Mary    Jane",
        "O'Connor  O'Sullivan",
        "Jean  Pierre  Marie",
      ];

      invalidNames.forEach((name) => {
        const data = generateMockCharacterData();
        data.character_data.info.name = name;

        const result = characterDataSchema.safeParse(data.character_data);

        expect(result.success).toBe(false);
        if (!result.success) {
          const nameError = result.error.errors.find(
            (e) =>
              e.path.includes("name") &&
              e.message.includes("must start with a letter"),
          );
          expect(nameError).toBeDefined();
        }
      });
    });

    it("should reject character names with multiple consecutive hyphens", () => {
      const invalidNames = [
        "Mary--Jane",
        "Jean---Pierre",
        "Anne----Marie",
        "O'Connor--Smith",
      ];

      invalidNames.forEach((name) => {
        const data = generateMockCharacterData();
        data.character_data.info.name = name;

        const result = characterDataSchema.safeParse(data.character_data);

        expect(result.success).toBe(false);
        if (!result.success) {
          const nameError = result.error.errors.find(
            (e) =>
              e.path.includes("name") &&
              e.message.includes("must start with a letter"),
          );
          expect(nameError).toBeDefined();
        }
      });
    });

    it("should reject character names with multiple consecutive apostrophes", () => {
      const invalidNames = [
        "O''Connor",
        "D'''Angelo",
        "Mary''Jane",
        "L''''Amour",
      ];

      invalidNames.forEach((name) => {
        const data = generateMockCharacterData();
        data.character_data.info.name = name;

        const result = characterDataSchema.safeParse(data.character_data);

        expect(result.success).toBe(false);
        if (!result.success) {
          const nameError = result.error.errors.find(
            (e) =>
              e.path.includes("name") &&
              e.message.includes("must start with a letter"),
          );
          expect(nameError).toBeDefined();
        }
      });
    });

    it("should reject character names with invalid punctuation placement", () => {
      const invalidNames = [
        "-John",
        "Mary-",
        "'Connor",
        "John'",
        " -Mary",
        "Jane- ",
        "Mary - Jane",
        "O' Connor",
        "Jean - Pierre",
      ];

      invalidNames.forEach((name) => {
        const data = generateMockCharacterData();
        data.character_data.info.name = name;

        const result = characterDataSchema.safeParse(data.character_data);

        expect(result.success).toBe(false);
        if (!result.success) {
          const nameError = result.error.errors.find(
            (e) =>
              e.path.includes("name") &&
              e.message.includes("must start with a letter"),
          );
          expect(nameError).toBeDefined();
        }
      });
    });

    it("should accept character name exactly 32 characters long", () => {
      const data = generateMockCharacterData();
      data.character_data.info.name = "Jean-Pierre Alexandre O'Sullivan"; // exactly 32 characters

      const result = characterDataSchema.safeParse(data.character_data);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.info.name).toBe("Jean-Pierre Alexandre O'Sullivan");
      }
    });

    it("should reject invalid shape ID values", () => {
      const data = generateMockCharacterData();
      data.character_data.static.head.asset_id = -1; // below minimum

      const result = characterDataSchema.safeParse(data.character_data);

      expect(result.success).toBe(false);
      if (!result.success) {
        const shapeError = result.error.errors.find((e) =>
          e.path.includes("asset_id"),
        );
        expect(shapeError).toBeDefined();
      }
    });

    it("should reject invalid height values", () => {
      const data = generateMockCharacterData();
      data.character_data.info.height_in = 10;

      const result = characterDataSchema.safeParse(data.character_data);

      expect(result.success).toBe(false);
      if (!result.success) {
        const heightError = result.error.errors.find((e) =>
          e.path.includes("height_in"),
        );
        expect(heightError).toBeDefined();
      }
    });

    it("should reject invalid weight values", () => {
      const data = generateMockCharacterData();
      data.character_data.info.weight_lb = 1000;

      const result = characterDataSchema.safeParse(data.character_data);

      expect(result.success).toBe(false);
      if (!result.success) {
        const weightError = result.error.errors.find((e) =>
          e.path.includes("weight_lb"),
        );
        expect(weightError).toBeDefined();
      }
    });

    it("should validate offset transformations", () => {
      const data = generateMockCharacterData();
      data.character_data.placeable_movable.eyes.offset_y = 0.12345;

      const result = characterDataSchema.safeParse(data.character_data);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.placeable_movable.eyes.offset_y).toBe(0.1);
      }
    });

    it("should validate scale transformations", () => {
      const data = generateMockCharacterData();
      data.character_data.placeable_movable.eyes.scale = 1.23456;

      const result = characterDataSchema.safeParse(data.character_data);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.placeable_movable.eyes.scale).toBe(1.2);
      }
    });

    it("should validate accessory slots", () => {
      const data = generateMockCharacterData();

      data.character_data.placeable_movable.glasses = {
        asset_id: 15,
        offset_y: 0.5,
        scale: 1.0,
      };

      const result = characterDataSchema.safeParse(data.character_data);

      expect(result.success).toBe(true);
      if (result.success) {
        const glasses = result.data.placeable_movable.glasses;
        expect(glasses).toBeDefined();
        expect(glasses!.asset_id).toBe(15);
      }
    });

    it("should reject invalid accessory asset IDs", () => {
      const data = generateMockCharacterData();
      data.character_data.placeable_movable.glasses = {
        asset_id: -1, // below minimum
        offset_y: 0,
        scale: 1.0,
      };

      const result = characterDataSchema.safeParse(data.character_data);

      expect(result.success).toBe(false);
      if (!result.success) {
        const assetError = result.error.errors.find((e) =>
          e.path.includes("asset_id"),
        );
        expect(assetError).toBeDefined();
      }
    });

    it("should validate hair asset ID 0 with bald hair color", () => {
      const data = generateMockCharacterData();
      data.character_data.info.hair_color = "bald";
      data.character_data.static.hair.asset_id = 0;

      const result = characterDataSchema.safeParse(data.character_data);

      expect(result.success).toBe(true);
    });

    it("should validate hair asset ID 0 with non-bald hair color", () => {
      const data = generateMockCharacterData();
      data.character_data.info.hair_color = "brown";
      data.character_data.static.hair.asset_id = 0;

      const result = characterDataSchema.safeParse(data.character_data);

      expect(result.success).toBe(true);
    });

    it("should reject bald hair color with non-zero asset ID", () => {
      const data = generateMockCharacterData();
      data.character_data.info.hair_color = "bald";
      data.character_data.static.hair.asset_id = 123;

      const result = characterDataSchema.safeParse(data.character_data);

      expect(result.success).toBe(false);
    });

    it("should validate non-bald hair color with non-zero asset ID", () => {
      const data = generateMockCharacterData();
      data.character_data.info.hair_color = "brown";
      data.character_data.static.hair.asset_id = 123;

      const result = characterDataSchema.safeParse(data.character_data);

      expect(result.success).toBe(true);
    });

    it("should reject invalid country in character creation", () => {
      const data = generateMockCharacterData();
      data.character_data.info.location = "Invalid Country" as any;

      const result = characterDataSchema.safeParse(data.character_data);

      expect(result.success).toBe(false);
      if (!result.success) {
        const locationError = result.error.errors.find((e) =>
          e.path.includes("location"),
        );
        expect(locationError).toBeDefined();
      }
    });

    it("should accept valid countries", () => {
      const data = generateMockCharacterData();
      data.character_data.info.location = "United States";

      const result = characterDataSchema.safeParse(data.character_data);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.info.location).toBe("United States");
      }
    });
  });

  describe("plazaSearchSchema", () => {
    it("should transform string limit to number", () => {
      const searchData = {
        country: "United States",
        limit: "50",
        random: "true",
      };

      const result = plazaSearchSchema.safeParse(searchData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
        expect(result.data.random).toBe(true);
        expect(result.data.country).toBe("United States");
      }
    });

    it("should enforce limit boundaries", () => {
      const searchData = {
        limit: "1000",
      };

      const result = plazaSearchSchema.safeParse(searchData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(500);
      }
    });

    it("should handle empty strings as undefined", () => {
      const searchData = {
        country: "",
      };

      const result = plazaSearchSchema.safeParse(searchData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.country).toBeUndefined();
      }
    });
  });

  describe("adminActionSchema", () => {
    it("should validate admin delete action", () => {
      const actionData = {
        action: "delete_character",
        characterId: "123e4567-e89b-12d3-a456-426614174000",
        reason: "Inappropriate content",
      };

      const result = adminActionSchema.safeParse(actionData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.action).toBe("delete_character");
        expect(result.data.characterId).toBe(
          "123e4567-e89b-12d3-a456-426614174000",
        );
        expect(result.data.reason).toBe("Inappropriate content");
      }
    });

    it("should reject invalid character ID format", () => {
      const actionData = {
        action: "delete_character",
        characterId: "invalid-uuid",
        reason: "Test reason",
      };

      const result = adminActionSchema.safeParse(actionData);

      expect(result.success).toBe(false);
      if (!result.success) {
        const uuidError = result.error.errors.find((e) =>
          e.path.includes("characterId"),
        );
        expect(uuidError).toBeDefined();
      }
    });

    it("should reject empty reason", () => {
      const actionData = {
        action: "delete_character",
        characterId: "123e4567-e89b-12d3-a456-426614174000",
        reason: "",
      };

      const result = adminActionSchema.safeParse(actionData);

      expect(result.success).toBe(false);
      if (!result.success) {
        const reasonError = result.error.errors.find((e) =>
          e.path.includes("reason"),
        );
        expect(reasonError).toBeDefined();
      }
    });
  });

  describe("oauthCallbackSchema", () => {
    it("should validate OAuth callback data", () => {
      const callbackData = {
        platform: "google",
        code: "auth_code_12345",
        state: "state_token",
      };

      const result = oauthCallbackSchema.safeParse(callbackData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.platform).toBe("google");
        expect(result.data.code).toBe("auth_code_12345");
        expect(result.data.state).toBe("state_token");
      }
    });

    it("should reject invalid platform", () => {
      const callbackData = {
        platform: "invalid_platform",
        code: "auth_code_12345",
      };

      const result = oauthCallbackSchema.safeParse(callbackData);

      expect(result.success).toBe(false);
      if (!result.success) {
        const platformError = result.error.errors.find((e) =>
          e.path.includes("platform"),
        );
        expect(platformError).toBeDefined();
      }
    });
  });

  describe("newgroundsAuthSchema", () => {
    it("should validate Newgrounds session data", () => {
      const authData = {
        session_id: "ng_session_12345",
      };

      const result = newgroundsAuthSchema.safeParse(authData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.session_id).toBe("ng_session_12345");
      }
    });

    it("should reject empty session ID", () => {
      const authData = {
        session_id: "",
      };

      const result = newgroundsAuthSchema.safeParse(authData);

      expect(result.success).toBe(false);
      if (!result.success) {
        const sessionError = result.error.errors.find((e) =>
          e.path.includes("session_id"),
        );
        expect(sessionError).toBeDefined();
      }
    });
  });

  describe("itchTokenSchema", () => {
    it("should validate Itch.io token data", () => {
      const tokenData = {
        access_token: "itch_token_12345",
        state: "state_token",
      };

      const result = itchTokenSchema.safeParse(tokenData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.access_token).toBe("itch_token_12345");
        expect(result.data.state).toBe("state_token");
      }
    });

    it("should reject empty access token", () => {
      const tokenData = {
        access_token: "",
      };

      const result = itchTokenSchema.safeParse(tokenData);

      expect(result.success).toBe(false);
      if (!result.success) {
        const tokenError = result.error.errors.find((e) =>
          e.path.includes("access_token"),
        );
        expect(tokenError).toBeDefined();
      }
    });
  });
});
