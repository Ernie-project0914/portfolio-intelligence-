import { defineConfig } from "@playwright/test";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:5175",
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_PATH ||
        (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
      args: ["--no-sandbox"],
    },
  },
  webServer: {
    command: "npm run dev -- --port 5175 --strictPort",
    url: "http://127.0.0.1:5175/api/health",
    reuseExistingServer: false,
    env: {
      FOLIO_API_PORT: "3002",
      FOLIO_AI_API_KEY: "",
      FOLIO_MARKET_API_KEY: "",
      FOLIO_T212_AUTHORIZATION: "",
      FOLIO_DATA_DIR: mkdtempSync(join(tmpdir(), "folio-browser-")),
      FOLIO_REGISTRATION_CODE: "browser-fixture-registration-code",
    },
  },
  workers: 1,
});
