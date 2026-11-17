import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tanstackStart(),
    nitro({
      preset: "vercel",
      serverDir: "./server",
      serverEntry: { handler: "./src/server.ts", format: "web" },
      renderer: false,
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
