/**
 * Main integration script for Unifi Insights Traffic Flows Exporter
 * Combines downloading, importing, and API server
 */

const path = require("path");
const { spawn } = require("child_process");
const api = require("./api");
const importer = require("./import");
const influxdb = require("./influxdb");
require("dotenv").config();

// Configuration
const config = {
  // Run modes
  runDownloader: process.env.RUN_DOWNLOADER !== "false",
  runImporter: process.env.RUN_IMPORTER !== "false",
  runApiServer: process.env.RUN_API_SERVER !== "false",
  useInfluxDb: process.env.USE_INFLUXDB === "true",
  directImport: process.env.DIRECT_IMPORT === "true",

  // Scheduler
  schedulerEnabled: process.env.SCHEDULER_ENABLED === "true",
  schedulerInterval: parseInt(process.env.SCHEDULER_INTERVAL || 60) * 60 * 1000, // Convert minutes to ms

  // Paths
  downloadsDir:
    process.env.DOWNLOAD_DIR || path.join(__dirname, "../downloads"),
};

// Start the downloader script
async function runDownloader() {
  return new Promise((resolve, reject) => {
    console.log("Starting Unifi CSV downloader...");

    // Always use Bun for running the downloader
    const executable = "bun";
    const downloaderPath = path.join(__dirname, "unifi-downloader.js");

    const downloader = spawn(executable, [downloaderPath], {
      stdio: "inherit",
      env: process.env,
    });

    downloader.on("close", (code) => {
      if (code === 0) {
        console.log("Downloader completed successfully");
        resolve();
      } else {
        console.error(`Downloader exited with code ${code}`);
        reject(new Error(`Downloader exited with code ${code}`));
      }
    });

    downloader.on("error", (err) => {
      console.error("Downloader failed to start:", err);
      reject(err);
    });
  });
}

// Run the automated workflow (download, import, etc.)
async function runWorkflow() {
  try {
    console.log("Starting automated workflow...");
    console.log("Current time:", new Date().toISOString());

    // Step 1: Download CSV files
    if (config.runDownloader) {
      await runDownloader();
    }

    // Step 2: Import CSV files if needed
    // Note: In direct import mode, this step is handled by the downloader
    if (config.runImporter && !config.directImport) {
      console.log("Importing downloaded CSV files...");
      await importer.importDirectory(config.downloadsDir);
    }

    console.log("Workflow completed successfully");
  } catch (error) {
    console.error("Workflow error:", error);
  }
}

// Schedule automated runs
function startScheduler() {
  console.log(
    `Scheduler enabled, running every ${
      config.schedulerInterval / (60 * 1000)
    } minutes`
  );

  // Run immediately on startup
  runWorkflow();

  // Then schedule recurring runs
  const intervalId = setInterval(runWorkflow, config.schedulerInterval);

  // Return the interval ID for possible cleanup
  return intervalId;
}

// Cleanup function for graceful shutdown
async function cleanup() {
  console.log("Cleaning up before exit...");

  // Close InfluxDB connections if enabled
  if (config.useInfluxDb) {
    await influxdb.close();
  }

  console.log("Cleanup completed");
}

// Handle termination signals
function setupExitHandlers(server, schedulerIntervalId) {
  async function handleExit(signal) {
    console.log(`\nReceived ${signal}, shutting down gracefully...`);

    // Clear scheduler if running
    if (schedulerIntervalId) {
      clearInterval(schedulerIntervalId);
    }

    // Close server if running
    if (server) {
      console.log("Closing API server...");
      server.close();
    }

    // Run cleanup
    await cleanup();

    console.log("Shutdown complete");
    process.exit(0);
  }

  // Register handlers for different termination signals
  process.on("SIGINT", () => handleExit("SIGINT"));
  process.on("SIGTERM", () => handleExit("SIGTERM"));
  process.on("SIGHUP", () => handleExit("SIGHUP"));
}

// Main function
async function main() {
  console.log("Starting Unifi Insights Traffic Flows Exporter");
  console.log(`Mode: ${config.directImport ? "Direct Import" : "Standard"}`);

  if (config.useInfluxDb) {
    console.log("InfluxDB integration enabled");
  }

  let server = null;
  let schedulerIntervalId = null;

  // Start API server
  if (config.runApiServer) {
    server = api.startServer();
  }

  // Start scheduler if enabled
  if (config.schedulerEnabled) {
    schedulerIntervalId = startScheduler();
  } else if (!config.runApiServer) {
    // If neither API server nor scheduler is enabled, run once and exit
    await runWorkflow();
    console.log("One-time workflow completed, cleaning up...");
    await cleanup();
    console.log("Exiting");
    process.exit(0);
  }

  // Setup exit handlers for graceful shutdown
  setupExitHandlers(server, schedulerIntervalId);
}

// Run the main function if this script is run directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  runWorkflow,
  runDownloader,
  startScheduler,
  main,
  cleanup,
};
