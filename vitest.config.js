import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

process.env.NODE_ENV = "development";

// Single environment: React plugin must transform JSX in components imported from tests.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.js"],
    include: ["src/**/*.test.{js,jsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage/frontend",
      include: ["src/**/*.{js,jsx}"],
      exclude: ["src/**/*.test.{js,jsx}", "src/main.jsx"],
    },
  },
});
