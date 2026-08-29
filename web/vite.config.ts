import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { devHead } from "./src/dev-head";

export default defineConfig({
  plugins: [react(), devHead(import.meta.dirname)],
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
