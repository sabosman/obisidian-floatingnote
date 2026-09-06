module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  ignorePatterns: ["main.js", "node_modules/"],
  reportUnusedDisableDirectives: true,
  overrides: [
    {
      files: ["main.ts"],
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: __dirname,
      },
      rules: {
        "@typescript-eslint/no-unsafe-assignment": "error",
        "@typescript-eslint/no-floating-promises": "error",
      },
    },
    {
      files: ["tests/**/*.ts"],
      env: {
        jest: true,
      },
    },
  ],
  rules: {
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        caughtErrors: "none",
      },
    ],
  },
};
