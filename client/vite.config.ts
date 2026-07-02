import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Vite serves the React app and proxies API calls to the local Express server.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:4000"
    }
  }
});
