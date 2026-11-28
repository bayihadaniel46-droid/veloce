import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    target: "chrome80",
    cssTarget: "chrome80",
  },
  esbuild: {
    target: "chrome80",
  },
  server: {
    proxy: {
      "/api/forge-market": { target: "http://localhost:4000", changeOrigin: false },
    },
  },
});
