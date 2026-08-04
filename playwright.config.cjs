const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/browser",
  timeout: 30_000,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4177",
    browserName: "chromium",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
    { name: "tablet-touch", use: { viewport: { width: 820, height: 900 }, hasTouch: true } },
    { name: "mobile-touch", use: { viewport: { width: 390, height: 844 }, hasTouch: true } },
  ],
  webServer: {
    command: "node scripts/serve.mjs",
    url: "http://127.0.0.1:4177/examples/basic/",
    reuseExistingServer: true,
  },
});
