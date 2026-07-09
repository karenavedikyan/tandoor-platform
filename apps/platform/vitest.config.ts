import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(here, "client/src"),
      "@shared": path.resolve(here, "shared"),
    },
  },
  test: {
    environment: "node",
    setupFiles: [path.resolve(here, "vitest.setup.ts")],
    include: [
      "server/**/*.spec.ts",
      "shared/**/*.spec.ts",
      "api/**/*.spec.ts",
      "api/**/__tests__/**/*.test.ts",
      "tests/**/*.test.ts",
      "__tests__/**/*.test.ts",
      "__tests__/**/*.test.tsx",
      "client/**/*.test.ts",
      "client/**/*.test.tsx",
      "scripts/**/__tests__/**/*.test.mjs",
    ],
  },
});
