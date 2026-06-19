import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

function buildVersionMetaPlugin(): Plugin {
  const commit = process.env.VERCEL_GIT_COMMIT_SHA ?? "dev";
  const deployment = process.env.VERCEL_DEPLOYMENT_ID ?? "dev";
  return {
    name: "tandoor-build-version-meta",
    transformIndexHtml(html) {
      return html
        .replace(/__BUILD_COMMIT__/g, commit)
        .replace(/__BUILD_DEPLOYMENT__/g, deployment);
    },
  };
}

export default defineConfig({
  plugins: [react(), buildVersionMetaPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "client", "src"),
      "@shared": path.resolve(rootDir, "shared"),
      "@assets": path.resolve(rootDir, "attached_assets"),
    },
  },
  root: path.resolve(rootDir, "client"),
  base: "./",
  build: {
    outDir: path.resolve(rootDir, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("tandoor-real-catalog-seed.generated")) {
            return "catalog-real-seed";
          }
          return undefined;
        },
      },
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});
