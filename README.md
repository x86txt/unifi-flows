<p align="center">
  <img alt="Ubiquiti Logo" src="assets/ubiquiti-blue.svg" width="80" height="80">
</p>

<h1 align="center">
  Unifi Insights Traffic Flows Exporter
</h1>

<p align="center">
  <a href="https://github.com/x86txt/unifi-flows/actions/workflows/njsscan.yml"><img src="https://github.com/x86txt/unifi-flows/actions/workflows/njsscan.yml/badge.svg" alt="sast scan"></a>
  <a href="https://github.com/x86txt/unifi-flows/actions/workflows/node-build.yml"><img src="https://github.com/x86txt/unifi-flows/actions/workflows/node-build.yml/badge.svg" alt="node.js Build"></a>
  <a href="#prerequisites"><img src="https://img.shields.io/badge/node-22.x-brightgreen" alt="Node.js Version"></a>
  <a href="#prerequisites"><img src="https://img.shields.io/badge/bun-1.9.x-orange" alt="Bun Version"></a>
</p>

This project will allow you to export the Traffic Flows (Blocked & Threats) from your Unifi Console either:

1. to a CSV for ingestion into other platforms - i.e. your SIEM, MongoDB to visualize with Grafana, etc.
2. Run in api-server mode and allow you to directly query against it, backed by an InfluxDB which has direct Grafana support (includes a dashboard with GeoIP enrichment!)

## ✨ Features

- 🔐 Automates login to Unifi Controller
- 📊 Navigates to the Insights page
- 📥 Downloads CSV report with configurable time range
- 🛡️ Optionally downloads threat data
- 🔧 Configurable via environment variables
- 🔒 Handles self-signed certificates for local controllers

## 📋 Prerequisites

- 🟢 **Built with:** Node.js 22.x and Bun 1.9.x
- ⚠️ While this project is likely to work with older/different versions, compatibility is not guaranteed.

## 🖥️ Platform Support

This tool has been tested and verified to work on:

- **Windows**: Windows 10/11
- **Linux**: Ubuntu, Debian
- **macOS**: x86, ARM64, Apple M-series

## 🔄 Unifi Software Compatibility

Tested and verified with the following Unifi versions:

- Network: **9.1.118**
- UniFi OS: **4.2.8**

> ℹ️ The tool may work with other versions, but these are the ones explicitly tested.

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
UNIFI_URL=https://<ip.of.your.unifi.controller.or.cloudkey>
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

The application can run in two modes:

### Mode 1: CSV Export Mode

This mode downloads CSV files to disk for manual processing or importing into other systems.

```bash
# Run the downloader only
bun run download

# Or use the npm script
npm run download
```

### Mode 2: API Server Mode with InfluxDB

This mode runs a complete stack with API server, InfluxDB for storage, and GeoIP enrichment.

```bash
# Start only the API server (requires InfluxDB running separately)
bun run api

# Start the complete application (downloader + importer + API server)
bun run start:all

# Or use Docker Compose to run the entire stack (recommended)
docker-compose up -d
```

### 🛡️ Downloading Threats Data

Set `DOWNLOAD_THREATS=true` in your `.env` file to also download a second CSV file with threats data.

### ⚡ Direct Import Mode

Set `DIRECT_IMPORT=true` in your `.env` file to skip saving CSV files and import directly to InfluxDB.

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
- **🗺️ Geomap Issues**: If you don't see data on the world map, verify that your data contains valid latitude/longitude coordinates

## 📊 InfluxDB Integration

This project can store data directly in InfluxDB for better performance and direct Grafana integration.

### Quick Start with Docker Compose

The easiest way to get started with the full stack (InfluxDB, Grafana, and optionally the application itself) is to use Docker Compose:

```bash
# Start the entire stack
docker-compose up -d

# To also build and run the application in Docker
docker-compose up -d --build
```

This will:

1. Start InfluxDB on port 8086
2. Start Grafana on port 3000
3. Optionally build and run the application (uncomment the relevant section in docker-compose.yml)

## 🔌 Accessing Services

Once the stack is running, you can access the various services at these URLs:

### Grafana Dashboard

- **URL**: http://localhost:3000
- **Default Credentials**:
  - Username: `admin`
  - Password: `admin`
- **Dashboards**: After logging in, you can import the dashboard from `grafana-dashboard.json`

#### Importing the Dashboard

1. Navigate to http://localhost:3000 and log in with admin/admin
2. Go to Dashboards → Import
3. Either:
   - Upload the `grafana-dashboard.json` file, or
   - Copy and paste the contents of the file
4. Select your InfluxDB data source
5. Click Import

The dashboard includes:

- Network traffic volume over time
- Top protocols and applications
- Geographic traffic visualization
- Threat monitoring panels

#### Connecting Grafana to InfluxDB

⚠️ **Important**: When setting up the InfluxDB data source in Grafana using Docker Compose, use `influxdb:8086` as the URL, not `localhost:8086`. This is because in Docker networking, containers refer to each other by service name.

Configuration steps:

1. In Grafana, go to Configuration → Data Sources → Add data source
2. Select "InfluxDB"
3. Use these settings:
   - URL: `http://influxdb:8086` (must use service name, not localhost)
   - Query Language: Flux
   - Organization: unifi-flows
   - Token: my-super-secret-auth-token
   - Default Bucket: network-data
4. Click "Save & Test"

### API Server

- **URL**: http://localhost:3001/api
- **Documentation**:
  - RapiDoc UI: http://localhost:3001/api/docs
  - Swagger UI: http://localhost:3001/api/docs/swagger
  - OpenAPI Spec: http://localhost:3001/api/openapi.json
- **Health Check**: http://localhost:3001/api/health

### InfluxDB

- **URL**: http://localhost:8086
- **Default Credentials**:
  - URL
  - Query Language: `Flux`
  - Username: `admin`
  - Password: `password123`
  - Organization: `unifi-flows`
  - Bucket: `network-data`
  - Token: `my-super-secret-auth-token`

> **Note**: For production use, you should change all default passwords in the docker-compose.yml and .env files.

### Manual Setup: InfluxDB with Docker

If you prefer to set up components individually:

```bash
# Start InfluxDB container
docker run -d --name influxdb \
  -p 8086:8086 \
  -v influxdb-data:/var/lib/influxdb2 \
  -v influxdb-config:/etc/influxdb2 \
  -e DOCKER_INFLUXDB_INIT_MODE=setup \
  -e DOCKER_INFLUXDB_INIT_USERNAME=admin \
  -e DOCKER_INFLUXDB_INIT_PASSWORD=password123 \
  -e DOCKER_INFLUXDB_INIT_ORG=unifi-flows \
  -e DOCKER_INFLUXDB_INIT_BUCKET=network-data \
  -e DOCKER_INFLUXDB_INIT_ADMIN_TOKEN=my-super-secret-auth-token \
  influxdb:2.7

# To view the UI
# Visit http://localhost:8086 in your browser
# Login with admin/password123
```

### Running in InfluxDB Mode

Set the following in your `.env` file:

```
USE_INFLUXDB=true
INFLUXDB_URL=http://localhost:8086
INFLUXDB_TOKEN=my-super-secret-auth-token
INFLUXDB_ORG=unifi-flows
INFLUXDB_BUCKET=network-data
DIRECT_IMPORT=false
```

Set `DIRECT_IMPORT=true` to skip saving CSV files and import directly to InfluxDB.

### Setting up Grafana with InfluxDB

1. **Install Grafana**:

   ```bash
   # Run Grafana container
   docker run -d --name grafana \
     -p 3000:3000 \
     -v grafana-storage:/var/lib/grafana \
     grafana/grafana:latest
   ```

2. **Configure InfluxDB Data Source**:

   - Open Grafana at http://localhost:3000 (default login: admin/admin)
   - Go to Configuration > Data Sources > Add data source
   - Select InfluxDB
   - Set URL to `http://influxdb:8086` (or use `http://localhost:8086` if not using Docker networking)
   - In the Auth section, set your Organization, Token, and Default Bucket
   - Test connection and Save

3. **Import the Dashboard**:
   - Go to Dashboards > Import
   - Copy the contents of `grafana-dashboard.json` file
   - Click "Load" and then "Import"
   - You should now see the Unifi Network Traffic Dashboard with your data

The dashboard uses Grafana's native Geomap Panel for geographical visualization. No additional plugins are required.

![Geomap Visualization](assets/geomap-preview.png)

## 🔌 GeoIP Integration

This project can enrich your network traffic data with geolocation information for better visualization and analysis using Grafana's native Geomap Panel.

### IP Geolocation Services

The application uses free geolocation APIs to look up IP address information:

1. **Primary: ipapi.co**

   - 30,000 lookups per month
   - Comprehensive geolocation data
   - No API key required for basic usage

2. **Secondary (Fallback): ip-api.com**
   - 45 lookups per minute
   - Used as fallback if ipapi.co rate limit is reached
   - No API key required for basic usage

The system implements intelligent caching to minimize API calls:

- In-memory cache for fast lookups
- File-based cache with 30-day TTL
- Rate limiting to respect API service limits

### How GeoIP Enrichment Works

The application will:

1. Look up the geographical location of source and destination IP addresses
2. Add country, city, latitude, longitude, and ISP information to the data
3. Store this enriched data in InfluxDB
4. Visualize the traffic on a world map in Grafana

This allows you to:

- See where your network traffic is coming from and going to
- Identify traffic patterns by country or region
- Detect unusual connections to unexpected locations

![Geomap Visualization](assets/geomap-preview.png)

## 📄 API Documentation

The project includes a RESTful API with comprehensive documentation:

- **RapiDoc UI**: `/api/docs` - Interactive API documentation with modern UI
- **Swagger UI**: `/api/docs/swagger` - Traditional Swagger interface
- **OpenAPI Spec**: `/api/openapi.json` - Raw OpenAPI 3.1.0 specification

### API Endpoints

- **System**: Health check and system status
- **Flows**: Query network traffic flow data
- **Threats**: View detected threats
- **Metrics**: Get traffic metrics and statistics
- **Import**: Trigger data imports

### Authentication

All protected endpoints require an API key that can be set in your `.env` file:

```
API_KEY=your-secure-key-here
```

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
