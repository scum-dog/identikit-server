module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests", "<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.ts", "**/?(*.)+(spec|test).ts"],
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts", "!src/**/index.ts"],
  setupFilesAfterEnv: ["<rootDir>/tests/helpers/setup.ts"],
  testTimeout: 10000,
  modulePathIgnorePatterns: ["<rootDir>/dist/"],
};
