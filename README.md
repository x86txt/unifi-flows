# <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="30" height="30"><title>Ubiquiti</title><path d="M23.1627 0h-1.4882v1.4882h1.4882zm-5.2072 10.4226V7.4409l.0007.001h2.9755v2.9762h2.9756v.9433c0 1.0906-.0927 2.3827-.306 3.3973-.1194.5672-.3004 1.1308-.5127 1.672-.2175.5537-.468 1.0841-.7408 1.5595a11.6795 11.6795 0 0 1-1.2456 1.7762l-.0253.0294-.0417.0488c-.1148.1347-.2283.2679-.3531.398a11.7612 11.7612 0 0 1-.4494.4492c-1.9046 1.8343-4.3861 2.98-6.9808 3.243-.3122.032-.939.0652-1.2519.0652-.3139-.001-.9397-.0331-1.252-.0651-2.5946-.263-5.0761-1.4097-6.9806-3.243a11.75 11.75 0 0 1-.4495-.4494c-.131-.1356-.249-.2748-.3683-.4154l-.0006-.0004-.0512-.0603a11.6576 11.6576 0 0 1-1.2456-1.7762c-.2727-.4763-.5233-1.0058-.7408-1.5595-.2123-.5414-.3933-1.1048-.5128-1.6718C.1854 13.743.0927 12.452.0927 11.3616V.1864h5.9518v10.2362s0 .7847.0099 1.0415l.0022.0599v.0004c.0127.332.0247.6575.0594.9812.098.919.3014 1.7913.7203 2.5288.1213.213.2443.42.3915.616.8953 1.1939 2.2577 2.0901 3.9573 2.3398.2022.0294.6108.0552.8149.0552.204 0 .6125-.0258.8149-.0552 1.6996-.2497 3.062-1.146 3.9573-2.3398.148-.196.2701-.403.3914-.616.419-.7375.6224-1.6095.7204-2.5288.0346-.3243.047-.6503.0594-.9831l.0022-.0584c.0099-.2568.0099-1.0415.0099-1.0415zm.7427-8.19h2.2326v2.2319h2.9764v2.9764h-2.9764V4.4654h-2.2326V2.2328Z"/></svg> Unifi insights Traffic Flows Exporter

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
