/**
 * Helper script to integrate the generated Playwright code into our downloader
 */

const fs = require("fs");
const path = require("path");

// Paths to our files
const generatedPath = path.resolve(__dirname, "generated-script.js");
const templatePath = path.resolve(__dirname, "src/downloader-template.js");
const outputPath = path.resolve(__dirname, "src/unifi-downloader.js");

// Check if generated script exists
if (!fs.existsSync(generatedPath)) {
  console.error(
    "Error: generated-script.js not found. Please run record.js first."
  );
  process.exit(1);
}

console.log("Reading generated code...");
const generatedCode = fs.readFileSync(generatedPath, "utf8");

// Extract the main part of the generated code (everything between the context creation and browser closing)
const codeRegex = /\/\/ Navigate to.*?(?=\/\/ -----------)/s;
const match = generatedCode.match(codeRegex);

if (!match) {
  console.error("Could not find navigation code in the generated script.");
  process.exit(1);
}

// Get only the navigation and interaction code
const navigationCode = match[0].trim();

// Create a backup of the current downloader script if it exists
if (fs.existsSync(outputPath)) {
  const backupPath = `${outputPath}.backup-${Date.now()}`;
  fs.copyFileSync(outputPath, backupPath);
  console.log(`Backup created at: ${backupPath}`);
}

// Output the extracted code so the user can review it
console.log("\nExtracted navigation code:");
console.log("--------------------------------");
console.log(navigationCode);
console.log("--------------------------------\n");

console.log("This is the code that was recorded from your actions.");
console.log("To integrate it into the downloader script:");
console.log("");
console.log("1. Edit src/unifi-downloader.js");
console.log("2. Replace the navigation/interaction code with the above");
console.log(
  "3. Make sure to keep the error handling and download handling logic"
);
console.log("");
console.log("The code has been saved to: generated-script.js");
