#!/bin/bash

# Ensure we have the right environment variables
if [ ! -f .env ]; then
  echo "Error: .env file not found. Please create it first."
  exit 1
fi

# Set up directories needed
mkdir -p recordings downloads

# Install Playwright browsers if needed
if ! npx playwright --version &>/dev/null; then
  echo "Installing Playwright browsers..."
  npx playwright install chromium
fi

# Get URL from .env file
URL=$(grep UNIFI_URL .env | cut -d '=' -f2)

# Launch codegen
echo "Starting Playwright Codegen..."
echo "URL: $URL"
echo ""
echo "Instructions:"
echo "1. A browser window will open where you can interact with your Unifi Controller"
echo "2. Another window will open showing the code generated from your actions"
echo "3. Perform the steps to download the CSV file, then close the browser"
echo "4. The generated code will be saved to generated-script.js"
echo ""

npx playwright codegen --ignore-https-errors "$URL" -o generated-script.js

echo ""
echo "Codegen complete! The generated script is saved to: generated-script.js"
echo ""
echo "You can modify src/unifi-downloader.js to incorporate the relevant parts of this generated code." 