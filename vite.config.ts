import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  base: process.env.VITE_SITE_BASE || "/",
  define: { __STATIC_SITE__: JSON.stringify(process.env.VITE_STATIC_SITE === "true") },
  plugins: [react()],
  server: {
    fs: {
      deny: [
        ".env",
        ".env.*",
        "*.{crt,pem}",
        "**/.git/**",
        "**/.data/**",
        "**/*.sqlite",
        "**/*.sqlite-*",
        "**/registration-code",
      ],
    },
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${process.env.FOLIO_API_PORT || 3001}`,
        changeOrigin: false,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: { charts: ["recharts"] },
      },
    },
  },
});
