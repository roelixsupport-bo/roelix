import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tanstackStart(),
    nitro({
      preset: "vercel"
    }),
    viteReact(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  server: {
    host: "127.0.0.1",
    port: 8081,
    strictPort: false,
  },
});