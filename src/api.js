/**
 * API Server for Unifi Insights Traffic Flows Exporter
 * Provides REST endpoints for Grafana integration
 */

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const db = require("./database");
const importer = require("./import");
const path = require("path");
const swaggerUi = require("swagger-ui-express");
const fs = require("fs");
require("dotenv").config();

// Configuration
const config = {
  port: process.env.API_PORT || 3000,
  apiKey: process.env.API_KEY || "default-key-change-me",
  apiVersion: "1.0.0",
};

// Load OpenAPI spec
let openApiSpec = null;
try {
  const openApiPath = path.join(__dirname, "../openapi.json");
  if (fs.existsSync(openApiPath)) {
    openApiSpec = JSON.parse(fs.readFileSync(openApiPath, "utf8"));
    console.log("OpenAPI spec loaded successfully");
  } else {
    console.warn("OpenAPI spec file not found at", openApiPath);
  }
} catch (error) {
  console.error("Error loading OpenAPI spec:", error.message);
}

// Initialize Express
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, "../public")));

// API documentation
if (openApiSpec) {
  // Serve openapi.json directly
  app.get("/api/openapi.json", (req, res) => {
    res.json(openApiSpec);
  });

  // Serve Swagger UI
  app.use("/api/docs/swagger", swaggerUi.serve, swaggerUi.setup(openApiSpec));

  // Redirect /api/docs to RapiDoc
  app.get("/api/docs", (req, res) => {
    res.redirect("/api-docs.html");
  });
}

// Simple API key auth middleware
const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers["x-api-key"] || req.query.apiKey;

  // Skip auth if API_KEY_AUTH is disabled
  if (process.env.API_KEY_AUTH === "false") {
    return next();
  }

  if (apiKey === config.apiKey) {
    return next();
  }

  return res.status(401).json({ error: "Unauthorized - Invalid API key" });
};

// Basic status route - no auth required
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date() });
});

// Apply auth middleware to protected routes
app.use("/api", apiKeyAuth);

// Flow data endpoints
app.get("/api/flows", async (req, res) => {
  try {
    // Parse query parameters
    const query = {};
    const options = {
      limit: parseInt(req.query.limit) || 100,
      skip: parseInt(req.query.skip) || 0,
    };

    // Add sorting
    if (req.query.sort) {
      options.sort = { [req.query.sort]: req.query.order === "desc" ? -1 : 1 };
    } else {
      options.sort = { timestamp: -1 }; // Default sort by timestamp desc
    }

    // Add filters
    if (req.query.sourceIP) {
      query.sourceIP = req.query.sourceIP;
    }

    if (req.query.destinationIP) {
      query.destinationIP = req.query.destinationIP;
    }

    if (req.query.protocol) {
      query.protocol = req.query.protocol;
    }

    // Date range filter
    if (req.query.from || req.query.to) {
      query.timestamp = {};

      if (req.query.from) {
        query.timestamp.$gte = new Date(req.query.from);
      }

      if (req.query.to) {
        query.timestamp.$lte = new Date(req.query.to);
      }
    }

    const flows = await db.getFlows(query, options);
    res.json(flows);
  } catch (error) {
    console.error("Error fetching flows:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/flows/:id", async (req, res) => {
  try {
    const flow = await db.getFlowById(req.params.id);

    if (!flow) {
      return res.status(404).json({ error: "Flow not found" });
    }

    res.json(flow);
  } catch (error) {
    console.error("Error fetching flow:", error);
    res.status(500).json({ error: error.message });
  }
});

// Threat data endpoints
app.get("/api/threats", async (req, res) => {
  try {
    // Parse query parameters
    const query = {};
    const options = {
      limit: parseInt(req.query.limit) || 100,
      skip: parseInt(req.query.skip) || 0,
    };

    // Add sorting
    if (req.query.sort) {
      options.sort = { [req.query.sort]: req.query.order === "desc" ? -1 : 1 };
    } else {
      options.sort = { timestamp: -1 }; // Default sort by timestamp desc
    }

    // Add filters
    if (req.query.sourceIP) {
      query.sourceIP = req.query.sourceIP;
    }

    if (req.query.threatType) {
      query.threatType = req.query.threatType;
    }

    // Date range filter
    if (req.query.from || req.query.to) {
      query.timestamp = {};

      if (req.query.from) {
        query.timestamp.$gte = new Date(req.query.from);
      }

      if (req.query.to) {
        query.timestamp.$lte = new Date(req.query.to);
      }
    }

    const threats = await db.getThreats(query, options);
    res.json(threats);
  } catch (error) {
    console.error("Error fetching threats:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/threats/:id", async (req, res) => {
  try {
    const threat = await db.getThreatById(req.params.id);

    if (!threat) {
      return res.status(404).json({ error: "Threat not found" });
    }

    res.json(threat);
  } catch (error) {
    console.error("Error fetching threat:", error);
    res.status(500).json({ error: error.message });
  }
});

// Metrics endpoints for Grafana
app.get("/api/metrics/flows/count", async (req, res) => {
  try {
    // Get flow count by time interval
    const interval = req.query.interval || "day";
    const days = parseInt(req.query.days) || 7;

    // Calculate start date based on requested days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Query all flows within the time range
    const flows = await db.getFlows({
      timestamp: { $gte: startDate },
    });

    // Group by time interval
    const timeGroups = {};

    flows.forEach((flow) => {
      let groupKey;
      const timestamp = new Date(flow.timestamp);

      // Group by appropriate interval
      switch (interval) {
        case "hour":
          groupKey = `${timestamp.getFullYear()}-${
            timestamp.getMonth() + 1
          }-${timestamp.getDate()} ${timestamp.getHours()}:00`;
          break;
        case "day":
          groupKey = `${timestamp.getFullYear()}-${
            timestamp.getMonth() + 1
          }-${timestamp.getDate()}`;
          break;
        case "week":
          // Get week number
          const weekNumber = Math.ceil(
            (timestamp.getDate() +
              new Date(
                timestamp.getFullYear(),
                timestamp.getMonth(),
                1
              ).getDay()) /
              7
          );
          groupKey = `${timestamp.getFullYear()}-${
            timestamp.getMonth() + 1
          }-W${weekNumber}`;
          break;
        default:
          groupKey = `${timestamp.getFullYear()}-${
            timestamp.getMonth() + 1
          }-${timestamp.getDate()}`;
      }

      // Increment count for this time period
      timeGroups[groupKey] = (timeGroups[groupKey] || 0) + 1;
    });

    // Convert to array for Grafana
    const result = Object.entries(timeGroups).map(([time, count]) => ({
      time,
      count,
    }));

    // Sort by time
    result.sort((a, b) => a.time.localeCompare(b.time));

    res.json(result);
  } catch (error) {
    console.error("Error fetching flow metrics:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/metrics/flows/volume", async (req, res) => {
  try {
    // Get traffic volume by time interval
    const interval = req.query.interval || "day";
    const days = parseInt(req.query.days) || 7;

    // Calculate start date based on requested days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Query all flows within the time range
    const flows = await db.getFlows({
      timestamp: { $gte: startDate },
    });

    // Group by time interval
    const timeGroups = {};

    flows.forEach((flow) => {
      let groupKey;
      const timestamp = new Date(flow.timestamp);

      // Group by appropriate interval
      switch (interval) {
        case "hour":
          groupKey = `${timestamp.getFullYear()}-${
            timestamp.getMonth() + 1
          }-${timestamp.getDate()} ${timestamp.getHours()}:00`;
          break;
        case "day":
          groupKey = `${timestamp.getFullYear()}-${
            timestamp.getMonth() + 1
          }-${timestamp.getDate()}`;
          break;
        case "week":
          // Get week number
          const weekNumber = Math.ceil(
            (timestamp.getDate() +
              new Date(
                timestamp.getFullYear(),
                timestamp.getMonth(),
                1
              ).getDay()) /
              7
          );
          groupKey = `${timestamp.getFullYear()}-${
            timestamp.getMonth() + 1
          }-W${weekNumber}`;
          break;
        default:
          groupKey = `${timestamp.getFullYear()}-${
            timestamp.getMonth() + 1
          }-${timestamp.getDate()}`;
      }

      // Add bytes for this time period
      timeGroups[groupKey] = (timeGroups[groupKey] || 0) + (flow.bytes || 0);
    });

    // Convert to array for Grafana
    const result = Object.entries(timeGroups).map(([time, bytes]) => ({
      time,
      bytes,
      // Add MB and GB for convenience
      megabytes: Math.round((bytes / (1024 * 1024)) * 100) / 100,
      gigabytes: Math.round((bytes / (1024 * 1024 * 1024)) * 100) / 100,
    }));

    // Sort by time
    result.sort((a, b) => a.time.localeCompare(b.time));

    res.json(result);
  } catch (error) {
    console.error("Error fetching volume metrics:", error);
    res.status(500).json({ error: error.message });
  }
});

// Import triggering endpoint
app.post("/api/import", async (req, res) => {
  try {
    const { file, type, directory } = req.body;

    // If directory is specified, import all files in directory
    if (directory) {
      const dirPath = path.resolve(directory);
      const result = await importer.importDirectory(dirPath);
      return res.json({
        status: "success",
        message: "Directory import completed",
        result,
      });
    }

    // Otherwise import a specific file
    if (!file) {
      return res.status(400).json({ error: "File path is required" });
    }

    const filePath = path.resolve(file);
    const result = await importer.importFile(filePath, type || "flows");

    res.json({ status: "success", message: "Import completed", result });
  } catch (error) {
    console.error("Error during import:", error);
    res.status(500).json({ error: error.message });
  }
});

// System status endpoint
app.get("/api/status", async (req, res) => {
  try {
    const status = await db.getStatus();

    // Add some system metrics
    status.apiVersion = "1.0.0";
    status.uptime = process.uptime();
    status.memoryUsage = process.memoryUsage();

    res.json(status);
  } catch (error) {
    console.error("Error fetching status:", error);
    res.status(500).json({ error: error.message });
  }
});

// Grafana SimpleJSON datasource compatibility endpoints
app.post("/api/search", (req, res) => {
  // Return available metrics for Grafana
  res.json([
    "flows.count",
    "flows.volume",
    "threats.count",
    "sourceIPs",
    "destinationIPs",
    "protocols",
  ]);
});

app.post("/api/query", async (req, res) => {
  try {
    const results = [];

    // Process each target in the request
    for (const target of req.body.targets) {
      const targetName = target.target;

      // Extract time range from request
      const from = new Date(req.body.range.from);
      const to = new Date(req.body.range.to);

      // Handle different metrics
      if (targetName === "flows.count") {
        const flows = await db.getFlows({
          timestamp: { $gte: from, $lte: to },
        });

        // Group by day for simplicity
        const timeGroups = {};

        flows.forEach((flow) => {
          const timestamp = new Date(flow.timestamp);
          const groupKey = `${timestamp.getFullYear()}-${
            timestamp.getMonth() + 1
          }-${timestamp.getDate()}`;
          timeGroups[groupKey] = (timeGroups[groupKey] || 0) + 1;
        });

        // Format for Grafana
        const datapoints = Object.entries(timeGroups).map(([time, count]) => {
          // Convert time to timestamp for Grafana
          const timestamp = new Date(time).getTime();
          return [count, timestamp];
        });

        results.push({
          target: "Flow Count",
          datapoints,
        });
      } else if (targetName === "flows.volume") {
        const flows = await db.getFlows({
          timestamp: { $gte: from, $lte: to },
        });

        // Group by day
        const timeGroups = {};

        flows.forEach((flow) => {
          const timestamp = new Date(flow.timestamp);
          const groupKey = `${timestamp.getFullYear()}-${
            timestamp.getMonth() + 1
          }-${timestamp.getDate()}`;
          timeGroups[groupKey] =
            (timeGroups[groupKey] || 0) + (flow.bytes || 0);
        });

        // Format for Grafana
        const datapoints = Object.entries(timeGroups).map(([time, bytes]) => {
          // Convert to MB and time to timestamp
          const mbytes = bytes / (1024 * 1024);
          const timestamp = new Date(time).getTime();
          return [mbytes, timestamp];
        });

        results.push({
          target: "Traffic Volume (MB)",
          datapoints,
        });
      }
      // Add more metric handlers as needed
    }

    res.json(results);
  } catch (error) {
    console.error("Error handling Grafana query:", error);
    res.status(500).json({ error: error.message });
  }
});

// Start the server
function startServer() {
  const server = app.listen(config.port, () => {
    console.log(`API server running on port ${config.port}`);
  });

  return server;
}

// CLI handling
if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  startServer,
};
