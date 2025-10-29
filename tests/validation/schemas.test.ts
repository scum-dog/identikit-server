import {
  characterDataSchema,
  fullCharacterSchema,
  characterUpdateSchema,
  plazaSearchSchema,
  adminActionSchema,
  oauthCallbackSchema,
  newgroundsAuthSchema,
  itchTokenSchema,
} from "../../src/utils/validation";
import { invalidCharacterData } from "../helpers/mockData";
import { generateMockCharacterData } from "../../src/utils/mockData";

describe("Validation Schemas", () => {
  describe("characterDataSchema", () => {
    it("should validate valid character data", () => {
      const validData = generateMockCharacterData();
      const result = fullCharacterSchema.safeParse(validData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.metadata.upload_id).toBeDefined();
        expect(result.data.character_data.static.name).toBeDefined();
        expect(result.data.character_data.placeable_movable.eyes).toBeDefined();
      }
    });

    it("should reject invalid UUIDs", () => {
      const result = fullCharacterSchema.safeParse(invalidCharacterData);

      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.errors;
        expect(errors.some((e) => e.path.includes("upload_id"))).toBe(true);
        expect(errors.some((e) => e.path.includes("user_id"))).toBe(true);
      }
    });

    it("should reject empty character name", () => {
      const data = generateMockCharacterData();
      data.character_data.static.name = "";

      const result = fullCharacterSchema.safeParse(data);

      expect(result.success).toBe(false);
      if (!result.success) {
        const nameError = result.error.errors.find(
          (e) => e.path.includes("name") && e.message.includes("least 1"),
        );
        expect(nameError).toBeDefined();
      }
    });

    it("should reject invalid shape ID formats", () => {
      const data = generateMockCharacterData();
      data.character_data.static.head.shape_id = "INVALID_FORMAT";

      const result = fullCharacterSchema.safeParse(data);

      expect(result.success).toBe(false);
      if (!result.success) {
        const shapeError = result.error.errors.find((e) =>
          e.path.includes("shape_id"),
        );
        expect(shapeError).toBeDefined();
      }
    });

    it("should reject invalid height values", () => {
      const data = generateMockCharacterData();
      data.character_data.static.height_in = 10;

      const result = fullCharacterSchema.safeParse(data);

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
      data.character_data.static.weight_lb = 1000;

      const result = fullCharacterSchema.safeParse(data);

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

      const result = fullCharacterSchema.safeParse(data);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.character_data.placeable_movable.eyes.offset_y).toBe(
          0.1,
        );
      }
    });

    it("should validate scale transformations", () => {
      const data = generateMockCharacterData();
      data.character_data.placeable_movable.eyes.scale = 1.23456;

      const result = fullCharacterSchema.safeParse(data);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.character_data.placeable_movable.eyes.scale).toBe(
          1.2,
        );
      }
    });

    it("should validate accessory slots", () => {
      const data = generateMockCharacterData();

      data.character_data.placeable_movable.accessories = {};

      data.character_data.placeable_movable.accessories.slot_1 = {
        type: "glasses",
        asset_id: "G_123",
        offset_y: 0.5,
        scale: 1.0,
      };

      const result = fullCharacterSchema.safeParse(data);

      expect(result.success).toBe(true);
      if (result.success) {
        const accessory =
          result.data.character_data.placeable_movable.accessories.slot_1;
        expect(accessory).toBeDefined();
        expect(accessory!.type).toBe("glasses");
      }
    });

    it("should reject invalid accessory asset IDs", () => {
      const data = generateMockCharacterData();
      data.character_data.placeable_movable.accessories.slot_1 = {
        type: "glasses",
        asset_id: "INVALID_ID",
        offset_y: 0,
        scale: 1.0,
      };

      const result = fullCharacterSchema.safeParse(data);

      expect(result.success).toBe(false);
      if (!result.success) {
        const assetError = result.error.errors.find((e) =>
          e.path.includes("asset_id"),
        );
        expect(assetError).toBeDefined();
      }
    });
  });

  describe("characterUpdateSchema", () => {
    it("should validate partial character updates", () => {
      const updateData = {
        character_data: {
          static: {
            name: "Updated Name",
          },
        },
      };

      const result = characterUpdateSchema.safeParse(updateData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.character_data?.static?.name).toBe("Updated Name");
      }
    });

    it("should reject empty update objects", () => {
      const result = characterUpdateSchema.safeParse({});

      expect(result.success).toBe(false);
      if (!result.success) {
        const error = result.error.errors.find((e) =>
          e.message.includes("At least one field must be provided"),
        );
        expect(error).toBeDefined();
      }
    });

    it("should validate location updates", () => {
      const updateData = {
        metadata: {
          location: {
            country: "Canada",
            region: "Ontario",
          },
        },
      };

      const result = characterUpdateSchema.safeParse(updateData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.metadata?.location?.country).toBe("Canada");
        expect(result.data.metadata?.location?.region).toBe("Ontario");
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
        region: "",
      };

      const result = plazaSearchSchema.safeParse(searchData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.country).toBeUndefined();
        expect(result.data.region).toBeUndefined();
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
