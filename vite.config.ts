import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from '@tailwindcss/vite'
import wasm from "vite-plugin-wasm";
import { fileURLToPath } from "node:url";
import { URL } from "node:url";

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [
    react(),
    tailwindcss(),
    wasm(),
  ],
  resolve: {
    alias: [
      {
        find: "@features/wallet",
        replacement: fileURLToPath(new URL("./src/features/wallet", import.meta.url)),
      },
      {
        find: "@features",
        replacement: fileURLToPath(new URL("./src/areas/main/features", import.meta.url)),
      },
      {
        find: "@core",
        replacement: fileURLToPath(new URL("./src/core", import.meta.url)),
      },
      {
        find: "@pages",
        replacement: fileURLToPath(new URL("./src/areas/main/pages", import.meta.url)),
      },
      {
        find: "@shared",
        replacement: fileURLToPath(new URL("./src/shared", import.meta.url)),
      },
      {
        find: "@login",
        replacement: fileURLToPath(new URL("./src/areas/login", import.meta.url)),
      },
      {
        find: "@main",
        replacement: fileURLToPath(new URL("./src/areas/main", import.meta.url)),
      },
      {
        find: "@",
        replacement: fileURLToPath(new URL("./src", import.meta.url)),
      },
    ],
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
        protocol: "ws",
        host,
        port: 1421,
      }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
