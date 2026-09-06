/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  roots: ["<rootDir>/tests"],
  moduleNameMapper: {
    "^obsidian$": "<rootDir>/__mocks__/obsidian.ts",
    "^electron$": "<rootDir>/__mocks__/electron.ts",
    "^@electron/remote$": "<rootDir>/__mocks__/electronRemote.ts",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          // Override options incompatible with ts-jest / CommonJS
          module: "CommonJS",
          verbatimModuleSyntax: false,
          allowImportingTsExtensions: true,
          moduleResolution: "node",
          noEmit: false,
        },
      },
    ],
  },
};
