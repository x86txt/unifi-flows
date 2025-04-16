/**
 * CSV Import Module for Unifi Insights Traffic Flows Exporter
 * Parses CSV files and stores data in the database
 */

const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const { v4: uuidv4 } = require("uuid");
const db = require("./database");
const influxdb = require("./influxdb");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// Check if direct import mode is enabled
const directImportMode = process.env.DIRECT_IMPORT === "true";

// Create UUID module or use a simple alternative
function generateId() {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

/**
 * Parse a CSV file and store in the database
 * @param {string} filePath - Path to the CSV file
 * @param {string} type - Type of data ('flows' or 'threats')
 * @returns {Promise<Object>} - Import results
 */
async function importCsvFile(filePath, type = "flows") {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  return new Promise((resolve, reject) => {
    const results = {
      total: 0,
      imported: 0,
      errors: 0,
      type,
    };

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", async (data) => {
        try {
          results.total++;

          // Transform CSV data based on type
          const record = transformRecord(data, type);

          // Store in InfluxDB if enabled
          if (influxdb.isEnabled) {
            try {
              if (type === "flows") {
                await influxdb.writeFlowPoint(record);
              } else if (type === "threats") {
                await influxdb.writeThreatPoint(record);
              }
              results.imported++;
            } catch (error) {
              console.error("Error writing to InfluxDB:", error);
              results.errors++;
            }
          } else {
            // Store in NeDB database
            if (type === "flows") {
              await db.saveFlow(record);
            } else if (type === "threats") {
              await db.saveThreat(record);
            }
            results.imported++;
          }
        } catch (error) {
          console.error("Error importing record:", error);
          results.errors++;
        }
      })
      .on("end", async () => {
        try {
          // Update system status with import information
          await db.updateStatus({
            lastImport: {
              file: path.basename(filePath),
              timestamp: new Date(),
              results,
            },
          });

          console.log(
            `Import completed: ${results.imported} of ${results.total} records imported successfully.`
          );
          resolve(results);
        } catch (error) {
          reject(error);
        }
      })
      .on("error", (error) => {
        reject(error);
      });
  });
}

/**
 * Transform CSV record to database format
 * @param {Object} record - Raw CSV record
 * @param {string} type - Type of data
 * @returns {Object} - Transformed record
 */
function transformRecord(record, type) {
  // Generate a unique ID if not present
  const id = record.id || generateId();

  if (type === "flows") {
    // Basic flow record structure
    return {
      id,
      timestamp: parseTimestamp(
        record.timestamp || record.Timestamp || record.Time
      ),
      sourceIP: record.sourceIP || record.SourceIP || record["Source Address"],
      sourcePort: parseInt(
        record.sourcePort || record.SourcePort || record["Source Port"] || 0
      ),
      destinationIP:
        record.destinationIP ||
        record.DestinationIP ||
        record["Destination Address"],
      destinationPort: parseInt(
        record.destinationPort ||
          record.DestinationPort ||
          record["Destination Port"] ||
          0
      ),
      protocol: record.protocol || record.Protocol,
      application: record.application || record.Application,
      bytes: parseInt(
        record.bytes || record.Bytes || record["Data Transferred"] || 0
      ),
      packets: parseInt(record.packets || record.Packets || 0),
      duration: parseFloat(record.duration || record.Duration || 0),
      action: record.action || record.Action || "unknown",
      // Keep the raw record for reference
      raw: record,
    };
  } else if (type === "threats") {
    // Basic threat record structure
    return {
      id,
      timestamp: parseTimestamp(
        record.timestamp || record.Timestamp || record.Time
      ),
      sourceIP: record.sourceIP || record.SourceIP || record["Source Address"],
      sourcePort: parseInt(
        record.sourcePort || record.SourcePort || record["Source Port"] || 0
      ),
      destinationIP:
        record.destinationIP ||
        record.DestinationIP ||
        record["Destination Address"],
      destinationPort: parseInt(
        record.destinationPort ||
          record.DestinationPort ||
          record["Destination Port"] ||
          0
      ),
      protocol: record.protocol || record.Protocol,
      threatType:
        record.threatType ||
        record.ThreatType ||
        record["Threat Type"] ||
        "unknown",
      threatCategory:
        record.threatCategory ||
        record.ThreatCategory ||
        record["Threat Category"] ||
        "unknown",
      severity: record.severity || record.Severity || "medium",
      action: record.action || record.Action || "blocked",
      // Keep the raw record for reference
      raw: record,
    };
  }

  // Default case - return with ID
  return {
    id,
    ...record,
  };
}

/**
 * Parse various timestamp formats
 * @param {string} timestamp - Timestamp string from CSV
 * @returns {Date} - JavaScript Date object
 */
function parseTimestamp(timestamp) {
  if (!timestamp) return new Date();

  // Try to parse various formats
  let date;

  try {
    // Try as ISO string
    date = new Date(timestamp);

    // If invalid, try other formats
    if (isNaN(date.getTime())) {
      // Try MM/DD/YYYY format
      const parts = timestamp.split(/[/\-:]/);

      // MM/DD/YYYY or DD/MM/YYYY
      if (parts.length >= 3) {
        // Assume MM/DD/YYYY for American format
        const month = parseInt(parts[0]) - 1;
        const day = parseInt(parts[1]);
        const year = parseInt(parts[2]);

        date = new Date(year, month, day);
      }
    }
  } catch (error) {
    console.warn(`Unable to parse timestamp: ${timestamp}`);
    date = new Date();
  }

  return date;
}

/**
 * Import a single file
 * @param {string} filePath - Path to CSV file
 * @param {string} type - 'flows' or 'threats'
 */
async function importFile(filePath, type = "flows") {
  try {
    console.log(`Importing ${type} from ${filePath}`);
    const results = await importCsvFile(filePath, type);
    console.log("Import results:", results);
    return results;
  } catch (error) {
    console.error("Import error:", error);
    throw error;
  }
}

/**
 * Import all CSV files from a directory
 * @param {string} dirPath - Directory path
 */
async function importDirectory(dirPath = path.join(__dirname, "../downloads")) {
  try {
    if (!fs.existsSync(dirPath)) {
      console.error(`Directory not found: ${dirPath}`);
      return;
    }

    const files = fs
      .readdirSync(dirPath)
      .filter((file) => file.endsWith(".csv"));
    console.log(`Found ${files.length} CSV files in ${dirPath}`);

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      // Determine type based on filename
      const type = file.toLowerCase().includes("threat") ? "threats" : "flows";
      await importFile(filePath, type);
    }

    console.log("Directory import completed");
  } catch (error) {
    console.error("Directory import error:", error);
  }
}

/**
 * Direct import of CSV data without saving to file
 * @param {Buffer|string} csvData - CSV data buffer or string
 * @param {string} type - 'flows' or 'threats'
 * @returns {Promise<Object>} Import results
 */
async function importCsvData(csvData, type = "flows") {
  if (!influxdb.isEnabled) {
    console.error("Direct import mode requires InfluxDB to be enabled");
    throw new Error("InfluxDB must be enabled for direct import mode");
  }

  return new Promise((resolve, reject) => {
    const results = {
      total: 0,
      imported: 0,
      errors: 0,
      type,
    };

    const records = [];

    // Create a readable stream from the CSV data buffer/string
    const stream = require("stream");
    const bufferStream = new stream.PassThrough();
    bufferStream.end(Buffer.isBuffer(csvData) ? csvData : Buffer.from(csvData));

    bufferStream
      .pipe(csv())
      .on("data", (data) => {
        results.total++;
        // Transform and collect records for batch processing
        const record = transformRecord(data, type);
        records.push(record);
      })
      .on("end", async () => {
        try {
          // Process records in batch
          if (type === "flows") {
            results.imported = await influxdb.storeFlowRecords(records);
          } else if (type === "threats") {
            results.imported = await influxdb.storeThreatRecords(records);
          }

          results.errors = results.total - results.imported;

          console.log(
            `Direct import completed: ${results.imported} of ${results.total} records imported to InfluxDB.`
          );
          resolve(results);
        } catch (error) {
          console.error("Error during direct import:", error);
          reject(error);
        }
      })
      .on("error", (error) => {
        console.error("Error parsing CSV data:", error);
        reject(error);
      });
  });
}

// CLI handling
if (require.main === module) {
  // Called directly from command line
  const args = process.argv.slice(2);
  const filePath = args[0];
  const type = args[1] || "flows";

  if (filePath) {
    if (fs.existsSync(filePath) && fs.lstatSync(filePath).isDirectory()) {
      importDirectory(filePath).catch(console.error);
    } else {
      importFile(filePath, type).catch(console.error);
    }
  } else {
    // No file specified, import from default downloads directory
    importDirectory().catch(console.error);
  }
}

module.exports = {
  importFile,
  importDirectory,
  transformRecord,
  importCsvData,
  directImportMode,
};
