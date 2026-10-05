import { fixupConfigRules } from "@eslint/compat";
import eslint from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  globalIgnores(["dist", "docs", "src/public"]),
  eslint.configs.recommended,
  tseslint.configs.recommended,
  // eslint-plugin-react doesn't support ESLint 10's context API yet
  fixupConfigRules([
    react.configs.flat.recommended,
    react.configs.flat["jsx-runtime"],
  ]),
  reactHooks.configs.flat.recommended,
  reactRefresh.configs.vite,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },

    settings: {
      react: {
        version: "detect",
      },
    },

    rules: {
      "react/no-unescaped-entities": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "react-refresh/only-export-components": [
        "warn",
        {
          allowConstantExport: true,
        },
      ],
    },
  },
  {
    files: ["*.config.{ts,mjs}"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
);
