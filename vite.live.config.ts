import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  base: "/sfumato/",
  publicDir: fileURLToPath(new URL("./public", import.meta.url)),
  plugins: [tailwindcss(), viteReact()],
  resolve: {
    alias: [
      {
        find: "@/lib/travellers-api",
        replacement: fileURLToPath(new URL("./src/lib/travellers-api.live.ts", import.meta.url)),
      },
      { find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
    ],
  },
  build: {
    outDir: fileURLToPath(new URL("./dist-live", import.meta.url)),
    emptyOutDir: true,
    assetsDir: "assets",
    sourcemap: false,
    rollupOptions: {
      input: fileURLToPath(new URL("./live/index.html", import.meta.url)),
    },
  },
  envDir: root,
});
