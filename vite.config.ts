import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// Follow SERVER_PORT / WEB_PORT so a second copy of the platform can run
// next to another one without editing this file.
const apiTarget = `http://localhost:${process.env.SERVER_PORT ?? "4701"}`;

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
    port: Number(process.env.WEB_PORT ?? "5175"),
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
      },
      "/artifacts": {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
});
