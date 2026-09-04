import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import react from "ultracite/oxlint/react";
import vitest from "ultracite/oxlint/vitest";
import antiSlop from "ultracite/oxlint/anti-slop";

export default defineConfig({
  extends: [core, react, vitest, antiSlop],
  ignorePatterns: core.ignorePatterns,
  jsPlugins: ["oxlint-plugin-complexity"],
  options: {
    denyWarnings: true,
    reportUnusedDisableDirectives: "error",
    typeAware: true,
  },
  rules: {
    "complexity/complexity": [
      "error",
      {
        cognitive: 20,
        cyclomatic: 15,
      },
    ],
    "max-depth": ["error", { max: 4 }],
    "max-lines": [
      "error",
      {
        max: 500,
        skipBlankLines: true,
        skipComments: true,
      },
    ],
    "max-lines-per-function": [
      "error",
      {
        IIFEs: true,
        max: 80,
        skipBlankLines: true,
        skipComments: true,
      },
    ],
    "max-nested-callbacks": ["error", { max: 3 }],
    "max-params": ["error", { countThis: "except-void", max: 6 }],
    "max-statements": ["error", { max: 50 }],
    "react/only-export-components": ["error", { allowConstantExport: true }],
  },
});
