import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/tests"],
  testMatch: ["**/?(*.)+(test|spec).ts"],
  testTimeout: 30000,
  clearMocks: true,
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/index.ts",
    "!src/db/seed.ts",
    "!src/db/migrationRunner.ts",
  ],
};

export default config;
