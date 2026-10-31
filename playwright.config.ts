import { defineConfig } from "@playwright/test";
process.env.DO_NOT_TRACK = "1";
process.env.SUPABASE_TELEMETRY_DISABLED = "1";
import chromium from "@sparticuz/chromium";
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90000,
  workers: 1,
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/e2e-results.json" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:3174",
    headless: true,
    launchOptions: {
      ...(process.platform === "linux"
        ? { executablePath: await chromium.executablePath() }
        : { channel: "chrome" }),
      args: process.platform === "linux" ? chromium.args.filter(
        (a) =>
          ![
            "--single-process",
            "--disable-web-security",
            "--allow-running-insecure-content",
          ].includes(a),
      ) : [],
    },
  },
  webServer: {
    command: "npm run dev -- --port 3174",
    url: "http://127.0.0.1:3174/login",
    timeout: 60000,
    reuseExistingServer: false,
  },
  projects: [
    {
      name: "mobile",
      use: {
        viewport: { width: 360, height: 800 },
        isMobile: true,
        hasTouch: true,
        userAgent:
          "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36",
      },
    },
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
  ],
});
