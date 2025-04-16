/**
 * Unifi Flows CSV Downloader
 *
 * This script automates the process of logging into a Unifi Controller
 * and downloading the Flows CSV data.
 */

const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const importer = require("./import");
// Check if direct import mode is enabled
const directImportMode = importer.directImportMode;

// Configuration
const config = {
  // Replace these with your actual Unifi Controller credentials
  username: process.env.UNIFI_USERNAME,
  password: process.env.UNIFI_PASSWORD,

  // Your Unifi Controller URL
  baseUrl: process.env.UNIFI_URL || "https://10.5.22.112",

  // Download directory
  downloadDir: process.env.DOWNLOAD_DIR || path.join(__dirname, "../downloads"),

  // Date range options: "THIRTY_MINUTES", "HOUR", "DAY", "WEEK", "MONTH", "CUSTOM"
  timeRange: process.env.TIME_RANGE || "HOUR",

  // Dry run mode - don't actually download files
  dryRun: process.env.DRY_RUN === "true" || process.argv.includes("--dry-run"),

  // Debugging
  debug: process.env.DEBUG === "true",
};

// Helper function to take debug screenshots
async function debugScreenshot(page, name) {
  if (config.debug) {
    const screenshotPath = path.join(config.downloadDir, `${name}.png`);
    await page.screenshot({ path: screenshotPath });
    console.log(`Saved debug screenshot to ${screenshotPath}`);
  }
}

async function downloadUnifiFlowsCsv() {
  console.log("Starting Unifi Flows CSV download process...");

  // Create download directory if it doesn't exist
  if (!fs.existsSync(config.downloadDir)) {
    fs.mkdirSync(config.downloadDir, { recursive: true });
    console.log(`Created download directory: ${config.downloadDir}`);
  }

  // Launch browser
  const browser = await chromium.launch({
    headless: process.env.HEADLESS !== "false", // Set HEADLESS=false to see the browser
    slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : 0, // Slow down execution for debugging
  });

  const context = await browser.newContext({
    acceptDownloads: true, // Enable downloads
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true, // Ignore SSL certificate warnings
  });

  const page = await context.newPage();

  try {
    // Navigate to Unifi login page
    console.log(`Navigating to Unifi controller at ${config.baseUrl}...`);
    await page.goto(`${config.baseUrl}/login`);
    await debugScreenshot(page, "1-login-page");

    // Log in using the exact selectors from the recording
    console.log("Logging in...");
    try {
      await page
        .getByRole("textbox", { name: "Email or Username" })
        .fill(config.username);
      await page
        .getByRole("textbox", { name: "Password" })
        .fill(config.password);
      await page.getByRole("button", { name: "Sign In" }).click();
    } catch (error) {
      console.error("Error during login:", error.message);
      await debugScreenshot(page, "2-login-error");

      // Try alternative selectors
      console.log("Trying alternative login selectors...");
      await page.fill(
        'input[type="email"], input[name="username"], #username',
        config.username
      );
      await page.fill('input[type="password"], #password', config.password);
      await page.click(
        'button[type="submit"], input[type="submit"], #login-button, .login-button'
      );
    }

    // Wait for login to complete
    console.log("Waiting for login to complete...");
    await page.waitForLoadState("networkidle", { timeout: 30000 });
    await debugScreenshot(page, "3-after-login");

    // Navigate to the Insights page
    console.log("Navigating to Insights page...");
    try {
      await page.getByTestId("navigation-insights").click();
    } catch (error) {
      console.error("Error clicking insights navigation:", error.message);
      await debugScreenshot(page, "4-insights-nav-error");

      // Try alternative selectors or direct navigation
      console.log("Trying alternative approaches to navigate to Insights...");
      try {
        await page.getByText("Insights").click();
      } catch (e) {
        console.log("Attempting direct navigation to Insights page...");
        await page.goto(`${config.baseUrl}/insights`);
      }
    }

    await page.waitForLoadState("networkidle", { timeout: 30000 });
    await debugScreenshot(page, "5-insights-page");

    // Set time range - following exactly what was recorded in codegen
    console.log("Setting time range...");
    try {
      // First click on the predefined time range (THIRTY_MINUTES in your recording)
      await page.getByTestId("THIRTY_MINUTES").click();
      await debugScreenshot(page, "5a-after-timerange");

      // Then click on the calendar icon
      console.log("Clicking calendar icon...");
      await page.locator(".css-network-1c8lcdd > svg:nth-child(2)").click();
      await debugScreenshot(page, "5b-after-calendar-click");

      // Click on the date range
      console.log("Selecting date range...");
      await page.getByLabel("/ 3 / 2025 - 16 / 4 / 2025").click();
      await debugScreenshot(page, "5c-after-daterange");

      // Select the time range from dropdown
      console.log("Selecting 'Last Hour' from dropdown...");
      await page.getByRole("button", { name: "Last Hour" }).click();
      await debugScreenshot(page, "5d-after-lasthour");

      // Apply the selection
      console.log("Clicking Apply button...");
      await page.getByRole("button", { name: "Apply" }).click();
      await debugScreenshot(page, "5e-after-apply");
    } catch (error) {
      console.error("Error setting date/time range:", error.message);
      await debugScreenshot(page, "5f-timerange-error");
      console.log("Continuing with default time range...");
    }

    await debugScreenshot(page, "6-before-download");

    // Click download button and handle download, exactly following the codegen recording
    console.log("Initiating download...");

    // Set up download listener before clicking the button
    const downloadPromise = page.waitForEvent("download");

    // Click the download button
    console.log("Clicking Download button...");
    await page.getByRole("button", { name: "Download" }).click();
    await debugScreenshot(page, "7-download-click");

    // Handle the download
    const download = await downloadPromise;
    const fileName = `${type || "flows"}-${
      download.suggestedFilename() || "data.csv"
    }`;
    const filePath = path.join(config.downloadDir, fileName);

    if (config.dryRun) {
      console.log(`[DRY RUN] Would save flows file as: ${filePath}`);
      console.log("Dry run completed successfully!");
    } else if (directImportMode && importer) {
      // In direct import mode, don't save to disk
      console.log(`Direct import mode enabled for ${type || "flows"} data`);

      try {
        // Download to a buffer/string instead of saving to disk
        const downloadPath = await download.path();
        const csvData = fs.readFileSync(downloadPath);

        // Import directly to InfluxDB
        console.log(
          `Importing ${type || "flows"} data directly to InfluxDB...`
        );
        const importResults = await importer.importCsvData(
          csvData,
          type || "flows"
        );
        console.log(`Direct import results: ${JSON.stringify(importResults)}`);
      } catch (error) {
        console.error("Error during direct import:", error);
      }
    } else {
      console.log(`Saving flows file as: ${filePath}`);
      await download.saveAs(filePath);
      console.log("Download completed successfully!");
    }

    // Close the header after download (as in the codegen recording)
    try {
      await page
        .locator("header")
        .filter({ hasText: "Download" })
        .getByTestId("close-button")
        .click();
      console.log("Closed download dialog");
    } catch (error) {
      console.error("Error closing header:", error);
    }

    // Optional: Download a second file with different filters (threats)
    if (process.env.DOWNLOAD_THREATS === "true") {
      console.log("Downloading threats data...");

      try {
        // Block filter setting
        console.log("Setting up Threats filter...");
        await page.getByRole("button", { name: "Blocked" }).click();
        await debugScreenshot(page, "9a-blocked-dropdown");

        // Select Threats option
        await page.getByRole("option", { name: "Threats" }).click();
        await debugScreenshot(page, "9b-threats-selected");

        // Close the header (as in the codegen recording)
        await page
          .locator("header")
          .filter({ hasText: "Download" })
          .getByTestId("close-button")
          .click();
        await debugScreenshot(page, "9c-after-close");

        // Click calendar icon again
        await page
          .locator(".css-network-1c8lcdd > svg:nth-child(2) > path")
          .first()
          .click();
        await debugScreenshot(page, "9d-calendar-for-threats");

        // Set up download listener for threats file
        const download2Promise = page.waitForEvent("download");

        // Click Download button
        await page.getByRole("button", { name: "Download" }).click();
        await debugScreenshot(page, "9e-download-threats-click");

        // Handle the second download
        const download2 = await download2Promise;
        const fileName2 = `threats-${
          download2.suggestedFilename() || "data.csv"
        }`;
        const filePath2 = path.join(config.downloadDir, fileName2);

        if (config.dryRun) {
          console.log(`[DRY RUN] Would save threats file as: ${filePath2}`);
          console.log("Threats dry run completed successfully!");
        } else {
          console.log(`Saving threats file as: ${filePath2}`);
          await download2.saveAs(filePath2);
          console.log("Threats download completed successfully!");
        }
      } catch (threatsError) {
        console.error("Error downloading threats data:", threatsError.message);
        await debugScreenshot(page, "10-threats-error");
      }
    }
  } catch (error) {
    console.error("Error during download process:", error);
    // Take a screenshot to help diagnose issues
    await page.screenshot({ path: path.join(config.downloadDir, "error.png") });
  } finally {
    // Close browser
    await browser.close();
  }
}

// Run the download function
downloadUnifiFlowsCsv().catch(console.error);
