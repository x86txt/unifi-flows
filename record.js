/**
 * This script runs Playwright's codegen directly via CLI
 * It will launch a browser window where you can interact with the application
 * and another window that shows the generated code
 */

const { execSync } = require("child_process");
require("dotenv").config();

const url = process.env.UNIFI_URL || "https://10.5.22.112";
const outputPath = "./generated-script.js";

console.log("Starting Playwright codegen...");
console.log(`URL: ${url}`);
console.log(`Output will be saved to: ${outputPath}`);
console.log("");
console.log("Instructions:");
console.log("1. Perform the steps to log in and download the CSV file");
console.log("2. The generated code will appear in the recorder window");
console.log("3. When finished, close the browser windows");
console.log("4. The code will be saved to generated-script.js");

try {
  // Execute the Playwright codegen command
  execSync(
    `npx playwright codegen --ignore-https-errors ${url} -o ${outputPath}`,
    { stdio: "inherit" }
  );
} catch (error) {
  console.error("Error running codegen:", error.message);
}
