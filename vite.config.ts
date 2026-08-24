import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "web", "src"),
    },
  },
  root: path.resolve(import.meta.dirname, "web"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist", "web"),
    emptyOutDir: true,
  },
  server: {
    port: 5175,
    proxy: {
      "/api": {
        target: "http://localhost:4701",
        changeOrigin: true,
      },
    },
  },
});
