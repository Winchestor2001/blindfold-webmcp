import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), cloudflare(), tailwindcss()],
  // Bind IPv4 explicitly: the default binding resolved to [::1] only, which
  // Chrome could not reach when it tried 127.0.0.1 first.
  server: { host: "127.0.0.1", port: 5173 }
});
