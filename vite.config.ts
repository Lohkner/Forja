/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // En GitHub Pages la web vive en una subcarpeta (/Forja/): el workflow pasa BASE_PATH.
  base: process.env.BASE_PATH ?? "/",
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // En desarrollo, /api va al servidor Express (server/index.mjs).
    proxy: { "/api": "http://localhost:8787" },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
