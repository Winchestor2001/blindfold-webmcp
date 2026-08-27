import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), cloudflare(), tailwindcss()],
  // pdfjs-dist ships its worker as a separate ESM chunk; keep it out of
  // dependency pre-bundling so the worker URL resolves correctly.
  optimizeDeps: { exclude: ["pdfjs-dist"] }
});
