import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
export default defineConfig({
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  plugins: [
    tanstackStart(),
    nitro({ preset: process.env.NITRO_PRESET || (process.env.VERCEL ? "vercel" : "node-server") }),
    react(),
  ],
  server: { host: "127.0.0.1", port: 3000 },
});
