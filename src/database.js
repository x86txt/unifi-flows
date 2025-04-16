/**
 * Database module for Unifi Insights Traffic Flows Exporter
 * Uses NeDB as a lightweight, embedded NoSQL database
 */

const path = require("path");
const Datastore = require("nedb-promises");
const fs = require("fs");
const dotenv = require("dotenv");
const { parse } = require("csv-parse");

// Load environment variables
dotenv.config();

// Database directory
const dbDir = process.env.DB_DIR || "./data";

// Ensure database directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize database
const flowsDb = Datastore.create({
  filename: path.join(dbDir, "flows.db"),
  autoload: true,
  timestampData: true,
});

// Create indexes for better query performance
flowsDb.ensureIndex({ fieldName: "timestamp" });
flowsDb.ensureIndex({ fieldName: "sourceAddress" });
flowsDb.ensureIndex({ fieldName: "destinationAddress" });
flowsDb.ensureIndex({ fieldName: "application" });

/**
 * Convert CSV row to a structured document
 * @param {Object} row - CSV row as an object
 * @returns {Object} Formatted document for storage
 */
function formatFlowDocument(row) {
  // Convert timestamp to Date object
  const timestamp = new Date(row.timestamp);

  // Parse numeric fields
  const bytes = parseInt(row.bytes || 0, 10);
  const packets = parseInt(row.packets || 0, 10);

  return {
    timestamp,
    sourceAddress: row.sourceAddress,
    destinationAddress: row.destinationAddress,
    sourcePort: parseInt(row.sourcePort || 0, 10),
    destinationPort: parseInt(row.destinationPort || 0, 10),
    protocol: row.protocol,
    application: row.application,
    category: row.category,
    bytes,
    packets,
    direction: row.direction,
    clientName: row.clientName,
    sessionId: row.sessionId,
    importedAt: new Date(),
  };
}

/**
 * Import flows from a CSV file
 * @param {string} filePath - Path to CSV file
 * @returns {Promise<number>} Number of imported records
 */
async function importFlowsFromCsv(filePath) {
  console.log(`Importing flows from ${filePath}`);

  return new Promise((resolve, reject) => {
    const records = [];
    let count = 0;

    fs.createReadStream(filePath)
      .pipe(
        parse({
          columns: true,
          skip_empty_lines: true,
        })
      )
      .on("data", (row) => {
        records.push(formatFlowDocument(row));
        count++;

        // Batch insert every 1000 records to avoid memory issues
        if (records.length >= 1000) {
          flowsDb
            .insert(records.splice(0, records.length))
            .catch((err) => console.error("Error inserting batch:", err));
        }
      })
      .on("end", async () => {
        // Insert any remaining records
        if (records.length > 0) {
          await flowsDb.insert(records);
        }
        console.log(`Imported ${count} flow records from ${filePath}`);
        resolve(count);
      })
      .on("error", (err) => {
        console.error("Error importing flows:", err);
        reject(err);
      });
  });
}

/**
 * Get stats for the dashboard
 * @returns {Promise<Object>} Stats object
 */
async function getStats() {
  // Count total flows
  const totalFlows = await flowsDb.count({});

  // Get newest and oldest flow timestamp
  const newest = await flowsDb
    .findOne({})
    .sort({ timestamp: -1 })
    .limit(1)
    .exec();
  const oldest = await flowsDb
    .findOne({})
    .sort({ timestamp: 1 })
    .limit(1)
    .exec();

  // Get top applications by bytes
  const topApps = await flowsDb.aggregate([
    { $group: { _id: "$application", bytes: { $sum: "$bytes" } } },
    { $sort: { bytes: -1 } },
    { $limit: 10 },
  ]);

  return {
    totalFlows,
    timeRange: {
      from: oldest?.timestamp || null,
      to: newest?.timestamp || null,
    },
    topApplications: topApps.map((app) => ({
      application: app._id,
      bytes: app.bytes,
    })),
  };
}

/**
 * Query flows with optional filters
 * @param {Object} filters - Query filters
 * @param {Object} options - Query options (limit, skip, sort)
 * @returns {Promise<Array>} Array of flow documents
 */
async function queryFlows(filters = {}, options = {}) {
  const query = {};

  // Process time range filters
  if (filters.from && filters.to) {
    query.timestamp = {
      $gte: new Date(filters.from),
      $lte: new Date(filters.to),
    };
  } else if (filters.from) {
    query.timestamp = { $gte: new Date(filters.from) };
  } else if (filters.to) {
    query.timestamp = { $lte: new Date(filters.to) };
  }

  // Process other filters
  if (filters.sourceAddress) query.sourceAddress = filters.sourceAddress;
  if (filters.destinationAddress)
    query.destinationAddress = filters.destinationAddress;
  if (filters.application) query.application = filters.application;
  if (filters.protocol) query.protocol = filters.protocol;
  if (filters.clientName) query.clientName = filters.clientName;

  // Process options
  const limit = options.limit || 100;
  const skip = options.skip || 0;
  const sort = options.sort || { timestamp: -1 };

  // Execute query
  return flowsDb.find(query).sort(sort).skip(skip).limit(limit).exec();
}

/**
 * Get top flows aggregated by the specified field
 * @param {string} field - Field to aggregate by
 * @param {Object} filters - Query filters
 * @param {number} limit - Number of results to return
 * @returns {Promise<Array>} Array of aggregated results
 */
async function getTopByField(field, filters = {}, limit = 10) {
  const query = {};

  // Process time range filters
  if (filters.from && filters.to) {
    query.timestamp = {
      $gte: new Date(filters.from),
      $lte: new Date(filters.to),
    };
  } else if (filters.from) {
    query.timestamp = { $gte: new Date(filters.from) };
  } else if (filters.to) {
    query.timestamp = { $lte: new Date(filters.to) };
  }

  // Add other filters
  if (filters.sourceAddress) query.sourceAddress = filters.sourceAddress;
  if (filters.destinationAddress)
    query.destinationAddress = filters.destinationAddress;
  if (filters.protocol) query.protocol = filters.protocol;

  const pipeline = [
    { $match: query },
    {
      $group: {
        _id: `$${field}`,
        bytes: { $sum: "$bytes" },
        packets: { $sum: "$packets" },
        count: { $sum: 1 },
      },
    },
    { $sort: { bytes: -1 } },
    { $limit: limit },
  ];

  return flowsDb.aggregate(pipeline);
}

module.exports = {
  flowsDb,
  importFlowsFromCsv,
  queryFlows,
  getStats,
  getTopByField,
};
