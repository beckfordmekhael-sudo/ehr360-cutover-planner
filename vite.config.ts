/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5199,
    proxy: { "/api": "http://localhost:5177" },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
