<p align="center">
  <img alt="Ubiquiti Logo" src="assets/ubiquiti-blue.svg" width="80" height="80">
</p>

<h1 align="center">
  Unifi Insights Traffic Flows Exporter
</h1>

This project will allow you to export the Traffic Flows (Blocked & Threats) from your Unifi Console to a CSV for ingestion into other platforms - your SIEM, MongoDB to visualize with Grafana, etc.

## ✨ Features

- 🔐 Automates login to Unifi Controller
- 📊 Navigates to the Insights page
- 📥 Downloads CSV report with configurable time range
- 🛡️ Optionally downloads threat data
- 🔧 Configurable via environment variables
- 🔒 Handles self-signed certificates for local controllers

## 📋 Prerequisites

- 🟢 **Built with:** Node.js 22.x and Bun 1.9.x
- ⚠️ While the script may work with older versions, compatibility is not guaranteed, so beware!

## 🚀 Installation

1. Clone this repository
2. Install dependencies:

```bash
# With npm
npm install

# Or with Bun
bun install
```

3. Copy the example environment file and update with your credentials:

```bash
cp .env.example .env
# Edit .env with your details
```

## ⚙️ Configuration

Configure the script by editing the `.env` file with your:

- 👤 Unifi Controller credentials
- 🌐 Controller URL
- ⏱️ Time range for report (THIRTY_MINUTES, HOUR, DAY, WEEK, MONTH)
- 📁 Download location
- 🖥️ Browser settings (headless mode, etc.)

### Example Configuration

```
UNIFI_USERNAME=playwright
UNIFI_PASSWORD=your_password
UNIFI_URL=https://10.5.22.112
TIME_RANGE=HOUR
DOWNLOAD_THREATS=false
```

## 👩‍💻 Setting Up a Local Unifi User

Before using this tool, you should create a dedicated user in your Unifi Controller:

1. Click on **Settings** -> **Admins & Users**
2. Click **Admins**
3. Click **Create New Admin**
4. Check the **"Restrict to Local Access Only"** box
5. Username: `playwright`
6. Password: `<secure password>`
7. Select **"Use a Predefined Role"**
8. Role: **Super Admin**
9. Click **Create**

## 🏃‍♂️ Usage

Run the script with:

```bash
# With npm
npm run start

# Or with Bun
bun run start
```

### 🛡️ Downloading Threats Data

Set `DOWNLOAD_THREATS=true` in your `.env` file to also download a second CSV file with threats data.

### ⏰ Scheduling

For automated regular downloads, you can use:

#### Linux/macOS (cron)

Add a cron job:

```bash
# Example: Run daily at 2 AM
0 2 * * * cd /path/to/unifi-flows && node src/unifi-downloader.js >> logs/downloads.log 2>&1
```

#### Windows (Task Scheduler)

Create a batch file `run-download.bat`:

```batch
cd C:\path\to\unifi-flows
node src\unifi-downloader.js
```

Then set up a scheduled task to run this batch file.

## 🔍 Troubleshooting

- **🔑 Login Issues**: Verify your credentials in the .env file
- **🔄 Selector Issues**: The script may need updates if Unifi UI changes
- **🐞 Debug Mode**: Set `HEADLESS=false` and `SLOW_MO=50` in .env to watch the automation in action
- **🔐 SSL Errors**: For local controllers with self-signed certificates, ensure `IGNORE_HTTPS_ERRORS=true` is set

## 🎥 Re-recording the Automation

If the UI changes and the script stops working, you can re-record the automation:

1. Run the recording script:

```bash
./record.sh
```

2. Perform the steps in the browser to download the CSV
3. The generated code will be saved to `generated-script.js`
4. Update `src/unifi-downloader.js` with the new selectors

## 📜 License

MIT
