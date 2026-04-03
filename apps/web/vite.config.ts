import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [react()],
  fmt: {
    ignorePatterns: ["dist/**"],
  },
  lint: {
    ignorePatterns: ["dist/**"],
  },
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
