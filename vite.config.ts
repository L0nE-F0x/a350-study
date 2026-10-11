import react from "@vitejs/plugin-react";
import { defineConfig, type UserConfig } from "vite";

// Vitest 2.1 reads `test` from this file, but its types augment Vite 5.
// The app pins Vite 6, so the field is asserted onto Vite 6's config.
const config = {
  base: "./",
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
} as UserConfig;

export default defineConfig(config);
