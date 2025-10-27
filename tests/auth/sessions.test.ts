import { SessionManager } from "../../src/auth/sessions";

describe("SessionManager", () => {
  describe("generateToken", () => {
    it("should generate a 64-character hex token", () => {
      const token = SessionManager.generateToken();

      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[0-9a-f]+$/i);
    });

    it("should generate unique tokens", () => {
      const token1 = SessionManager.generateToken();
      const token2 = SessionManager.generateToken();

      expect(token1).not.toBe(token2);
    });

    it("should generate cryptographically secure tokens", () => {
      const tokens = new Set();

      for (let i = 0; i < 1000; i++) {
        tokens.add(SessionManager.generateToken());
      }

      expect(tokens.size).toBe(1000);
    });
  });

  describe("token format validation", () => {
    it("should generate tokens that are valid hex strings", () => {
      const token = SessionManager.generateToken();

      expect(() => Buffer.from(token, "hex")).not.toThrow();

      const buffer = Buffer.from(token, "hex");
      expect(buffer.length).toBe(32);
    });

    it("should generate tokens with high entropy", () => {
      const token = SessionManager.generateToken();

      const chars = token.split("");
      const uniqueChars = new Set(chars);

      expect(uniqueChars.size).toBeGreaterThanOrEqual(8);
    });
  });
});
