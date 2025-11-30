import {
  validateRequest,
  validateQuery,
  validatePlazaQuery,
  characterUploadSchema,
  plazaSearchSchema,
} from "../../src/utils/validation";
import { generateMockCharacterData } from "../../src/utils/mockData";
import {
  createMockRequest,
  createMockResponse,
  mockNext,
  resetMocks,
} from "../helpers/testUtils";

describe("Validation Middleware (Logic Tests)", () => {
  beforeEach(() => {
    resetMocks();
  });

  describe("validateRequest", () => {
    const validateCharacterUpload = validateRequest(characterUploadSchema);

    it("should validate and transform valid request body", () => {
      const validCharacterData = generateMockCharacterData();
      const req = createMockRequest({
        body: { character_data: validCharacterData.character_data },
      });
      const res = createMockResponse();

      validateCharacterUpload(req as any, res as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(req.body.character_data).toBeDefined();
    });

    it("should reject invalid request body", () => {
      const req = createMockRequest({
        body: { character_data: { invalid: "data" } },
      });
      const res = createMockResponse();

      validateCharacterUpload(req as any, res as any, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Validation failed",
          details: expect.arrayContaining([
            expect.objectContaining({
              field: expect.any(String),
              message: expect.any(String),
            }),
          ]),
        }),
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should handle empty request body", () => {
      const req = createMockRequest({
        body: {},
      });
      const res = createMockResponse();

      validateCharacterUpload(req as any, res as any, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Validation failed",
        }),
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should provide detailed validation error messages", () => {
      const req = createMockRequest({
        body: {
          character_data: {
            info: {
              name: "", // should fail
              sex: "invalid",
              height_in: 0, // too small
              race: "invalid",
              location: "INVALID_COUNTRY",
            },
            static: {
              head: {
                asset_id: "INVALID_FORMAT",
              },
            },
          },
        },
      });
      const res = createMockResponse();

      validateCharacterUpload(req as any, res as any, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Validation failed",
          details: expect.arrayContaining([
            expect.objectContaining({
              field: expect.stringContaining("character_data.info.name"),
              message: expect.stringContaining("character"),
            }),
          ]),
        }),
      );
    });
  });

  describe("validateQuery", () => {
    const validatePlaza = validatePlazaQuery;

    it("should validate and transform valid query parameters", () => {
      const req = createMockRequest({
        query: {
          country: "United States",
          limit: "50",
          random: "true",
        },
      });
      const res = createMockResponse();

      validatePlaza(req as any, res as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect((req as any).validatedQuery).toEqual({
        country: "United States",
        limit: 50,
        offset: 0,
        view: undefined,
        random: true,
      });
    });

    it("should handle empty query parameters", () => {
      const req = createMockRequest({
        query: {},
      });
      const res = createMockResponse();

      validatePlaza(req as any, res as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect((req as any).validatedQuery).toEqual({
        country: undefined,
        limit: 100,
        offset: 0,
        view: undefined,
        random: true,
      });
    });

    it("should transform string numbers to actual numbers", () => {
      const req = createMockRequest({
        query: {
          limit: "25",
        },
      });
      const res = createMockResponse();

      validatePlaza(req as any, res as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect((req as any).validatedQuery.limit).toBe(25);
      expect(typeof (req as any).validatedQuery.limit).toBe("number");
    });

    it("should transform string booleans to actual booleans", () => {
      const req = createMockRequest({
        query: {
          random: "false",
        },
      });
      const res = createMockResponse();

      validatePlaza(req as any, res as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect((req as any).validatedQuery.random).toBe(false);
      expect(typeof (req as any).validatedQuery.random).toBe("boolean");
    });
  });

  describe("validatePlazaQuery", () => {
    it("should validate plaza search parameters", () => {
      const req = createMockRequest({
        query: {
          country: "Canada",
          limit: "25",
        },
      }) as any;
      const res = createMockResponse();

      validatePlazaQuery(req, res as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(req.validatedQuery).toEqual({
        country: "Canada",
        limit: 25,
        offset: 0,
        view: undefined,
        random: true,
      });
    });

    it("should handle empty query parameters with defaults", () => {
      const req = createMockRequest({
        query: {},
      }) as any;
      const res = createMockResponse();

      validatePlazaQuery(req, res as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(req.validatedQuery).toEqual({
        country: undefined,
        limit: 100,
        offset: 0,
        view: undefined,
        random: true,
      });
    });

    it("should handle string boolean values correctly", () => {
      const req = createMockRequest({
        query: {
          random: "false",
        },
      }) as any;
      const res = createMockResponse();

      validatePlazaQuery(req, res as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(req.validatedQuery.random).toBe(false);
    });

    it("should enforce limit boundaries", () => {
      const req = createMockRequest({
        query: {
          limit: "1000",
        },
      }) as any;
      const res = createMockResponse();

      validatePlazaQuery(req, res as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(req.validatedQuery.limit).toBe(500);
    });

    it("should handle empty strings as undefined", () => {
      const req = createMockRequest({
        query: {
          country: "",
        },
      }) as any;
      const res = createMockResponse();

      validatePlazaQuery(req, res as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(req.validatedQuery.country).toBeUndefined();
    });
  });

  describe("error handling", () => {
    it("should handle validation errors gracefully", () => {
      const validator = validateRequest(characterUploadSchema);
      const req = createMockRequest({
        body: null,
      });
      const res = createMockResponse();

      validator(req as any, res as any, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Validation failed",
        }),
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should provide meaningful error messages for different validation failures", () => {
      const validator = validateRequest(characterUploadSchema);
      const req = createMockRequest({
        body: {
          character_data: {
            info: {
              name: "Invalid123", // should fail due to regex
            },
          },
        },
      });
      const res = createMockResponse();

      validator(req as any, res as any, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Validation failed",
          details: expect.arrayContaining([
            expect.objectContaining({
              field: expect.any(String),
              message: expect.any(String),
            }),
          ]),
        }),
      );
    });
  });
});
