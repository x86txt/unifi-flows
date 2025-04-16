/**
 * InfluxDB module for Unifi Insights Traffic Flows Exporter
 * Provides integration with InfluxDB for time-series data storage
 */

const { InfluxDB, Point } = require("@influxdata/influxdb-client");
const dotenv = require("dotenv");
const geoip = require("./geoip");

// Load environment variables
dotenv.config();

// InfluxDB configuration
const config = {
  url: process.env.INFLUXDB_URL || "http://localhost:8086",
  token: process.env.INFLUXDB_TOKEN,
  org: process.env.INFLUXDB_ORG || "unifi-flows",
  bucket: process.env.INFLUXDB_BUCKET || "network-data",
  enabled: process.env.USE_INFLUXDB === "true",
  geoipEnabled: process.env.GEOIP_ENABLED !== "false" && geoip.isEnabled,
};

// Initialize InfluxDB client if enabled
let influxDB = null;
let writeApi = null;

if (config.enabled) {
  if (!config.token) {
    console.error(
      "InfluxDB token is required when USE_INFLUXDB is enabled. Check your .env file."
    );
    process.exit(1);
  }

  influxDB = new InfluxDB({ url: config.url, token: config.token });
  writeApi = influxDB.getWriteApi(config.org, config.bucket, "ns");

  console.log(`InfluxDB connected to ${config.url}, bucket: ${config.bucket}`);

  if (config.geoipEnabled) {
    console.log("GeoIP enrichment enabled for network flow data");
  }
}

/**
 * Write a network flow record to InfluxDB
 * @param {Object} flow - Flow record object
 * @returns {Promise<void>}
 */
async function writeFlowPoint(flow) {
  if (!config.enabled || !writeApi) return;

  const point = new Point("network_flow")
    .timestamp(flow.timestamp || new Date())
    .tag("sourceAddress", flow.sourceIP || flow.sourceAddress || "unknown")
    .tag(
      "destinationAddress",
      flow.destinationIP || flow.destinationAddress || "unknown"
    )
    .tag("protocol", flow.protocol || "unknown")
    .tag("application", flow.application || "unknown");

  // Add GeoIP information for source IP if enabled
  if (config.geoipEnabled) {
    const sourceIP = flow.sourceIP || flow.sourceAddress;
    const destIP = flow.destinationIP || flow.destinationAddress;

    // Look up source IP geolocation
    if (sourceIP) {
      const sourceGeo = geoip.lookupIp(sourceIP);
      if (sourceGeo && sourceGeo.latitude && sourceGeo.longitude) {
        point.tag("sourceCountry", sourceGeo.country || "unknown");
        point.floatField("sourceLatitude", sourceGeo.latitude);
        point.floatField("sourceLongitude", sourceGeo.longitude);
        if (sourceGeo.city) point.tag("sourceCity", sourceGeo.city);
        if (sourceGeo.isp) point.tag("sourceISP", sourceGeo.isp);
      }
    }

    // Look up destination IP geolocation
    if (destIP) {
      const destGeo = geoip.lookupIp(destIP);
      if (destGeo && destGeo.latitude && destGeo.longitude) {
        point.tag("destCountry", destGeo.country || "unknown");
        point.floatField("destLatitude", destGeo.latitude);
        point.floatField("destLongitude", destGeo.longitude);
        if (destGeo.city) point.tag("destCity", destGeo.city);
        if (destGeo.isp) point.tag("destISP", destGeo.isp);
      }
    }
  }

  // Add numeric values as fields
  if (flow.bytes) point.intField("bytes", parseInt(flow.bytes, 10) || 0);
  if (flow.packets) point.intField("packets", parseInt(flow.packets, 10) || 0);
  if (flow.sourcePort)
    point.intField("sourcePort", parseInt(flow.sourcePort, 10) || 0);
  if (flow.destinationPort)
    point.intField("destinationPort", parseInt(flow.destinationPort, 10) || 0);
  if (flow.duration)
    point.floatField("duration", parseFloat(flow.duration) || 0);

  // Additional metadata as string fields
  if (flow.direction) point.stringField("direction", flow.direction);
  if (flow.clientName) point.stringField("clientName", flow.clientName);
  if (flow.category) point.stringField("category", flow.category);
  if (flow.action) point.stringField("action", flow.action);

  writeApi.writePoint(point);
}

/**
 * Write a threat record to InfluxDB
 * @param {Object} threat - Threat record object
 * @returns {Promise<void>}
 */
async function writeThreatPoint(threat) {
  if (!config.enabled || !writeApi) return;

  const point = new Point("network_threat")
    .timestamp(threat.timestamp || new Date())
    .tag("sourceAddress", threat.sourceIP || "unknown")
    .tag("destinationAddress", threat.destinationIP || "unknown")
    .tag("protocol", threat.protocol || "unknown")
    .tag("threatType", threat.threatType || "unknown")
    .tag("threatCategory", threat.threatCategory || "unknown")
    .tag("severity", threat.severity || "medium");

  // Add GeoIP information if enabled
  if (config.geoipEnabled) {
    const sourceIP = threat.sourceIP;
    const destIP = threat.destinationIP;

    // Look up source IP geolocation
    if (sourceIP) {
      const sourceGeo = geoip.lookupIp(sourceIP);
      if (sourceGeo && sourceGeo.latitude && sourceGeo.longitude) {
        point.tag("sourceCountry", sourceGeo.country || "unknown");
        point.floatField("sourceLatitude", sourceGeo.latitude);
        point.floatField("sourceLongitude", sourceGeo.longitude);
        if (sourceGeo.city) point.tag("sourceCity", sourceGeo.city);
        if (sourceGeo.isp) point.tag("sourceISP", sourceGeo.isp);
      }
    }

    // Look up destination IP geolocation
    if (destIP) {
      const destGeo = geoip.lookupIp(destIP);
      if (destGeo && destGeo.latitude && destGeo.longitude) {
        point.tag("destCountry", destGeo.country || "unknown");
        point.floatField("destLatitude", destGeo.latitude);
        point.floatField("destLongitude", destGeo.longitude);
        if (destGeo.city) point.tag("destCity", destGeo.city);
        if (destGeo.isp) point.tag("destISP", destGeo.isp);
      }
    }
  }

  // Add numeric values as fields
  if (threat.sourcePort)
    point.intField("sourcePort", parseInt(threat.sourcePort, 10) || 0);
  if (threat.destinationPort)
    point.intField(
      "destinationPort",
      parseInt(threat.destinationPort, 10) || 0
    );

  // Additional metadata as string fields
  if (threat.action) point.stringField("action", threat.action);

  writeApi.writePoint(point);
}

/**
 * Store a batch of flow records in InfluxDB
 * @param {Array<Object>} records - Array of flow records
 * @returns {Promise<number>} - Number of records written
 */
async function storeFlowRecords(records) {
  if (!config.enabled || !writeApi) return 0;

  let count = 0;

  for (const record of records) {
    await writeFlowPoint(record);
    count++;
  }

  // Flush to make sure all points are written
  await writeApi.flush();

  return count;
}

/**
 * Store a batch of threat records in InfluxDB
 * @param {Array<Object>} records - Array of threat records
 * @returns {Promise<number>} - Number of records written
 */
async function storeThreatRecords(records) {
  if (!config.enabled || !writeApi) return 0;

  let count = 0;

  for (const record of records) {
    await writeThreatPoint(record);
    count++;
  }

  // Flush to make sure all points are written
  await writeApi.flush();

  return count;
}

/**
 * Close InfluxDB connections
 */
async function close() {
  if (writeApi) {
    try {
      await writeApi.close();
      console.log("InfluxDB connection closed");
    } catch (e) {
      console.error("Error closing InfluxDB connection:", e);
    }
  }
}

module.exports = {
  isEnabled: config.enabled,
  writeFlowPoint,
  writeThreatPoint,
  storeFlowRecords,
  storeThreatRecords,
  close,
};
