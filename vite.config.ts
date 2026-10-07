import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
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
