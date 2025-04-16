/**
 * Playwright Codegen for Unifi Controller
 *
 * This script launches Playwright's codegen tool to record your interactions with the
 * Unifi Controller and generate code automatically.
 */

const { chromium } = require("playwright");
require("dotenv").config();

(async () => {
  // Launch the browser with the same settings as our main script
  const browser = await chromium.launch({
    headless: false, // Must be false for codegen
    slowMo: 100, // Slow down actions to make recording easier to follow
    ignoreDefaultArgs: ["--disable-extensions"],
  });

  // Create a context with the same settings
  const context = await browser.newContext({
    recordVideo: { dir: "recordings" },
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true, // Ignore SSL certificate warnings
  });

  // Create a page
  const page = await context.newPage();

  // Start the codegen session
  // This will open another browser window where you can see the generated code as you interact
  const baseUrl = process.env.UNIFI_URL || "https://10.5.22.112";

  console.log("Starting recording session...");
  console.log("---------------------------------------");
  console.log(
    "1. A browser window will open where you can interact with your Unifi Controller"
  );
  console.log("2. Another window will open showing the generated code");
  console.log("3. Perform the steps to download the CSV file");
  console.log("4. Copy the relevant code from the codegen window when done");
  console.log("---------------------------------------");

  // Navigate to the Unifi login page
  await page.goto(baseUrl);

  // Start recording with codegen
  await chromium.launch({
    headless: false,
    args: ["--remote-debugging-port=9222"],
  });
})();
