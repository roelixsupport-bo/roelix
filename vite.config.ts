import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tanstackStart({
      spa: {
        enabled: true,
        // Emit the client shell as index.html so Vercel SPA rewrites work.
        prerender: {
          outputPath: "/index.html",
        },
      },
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
