/**
 * GeoIP module for Unifi Insights Traffic Flows Exporter
 * Provides geolocation lookup for IP addresses using free APIs
 */

const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
const https = require("https");

// Load environment variables
dotenv.config();

// Configuration for API services
const config = {
  enabled: process.env.GEOIP_ENABLED !== "false",
  cacheDir:
    process.env.GEOIP_CACHE_DIR || path.join(__dirname, "../geoip/cache"),
  // Rate limits
  ipapiRateLimit: 30000 / 30, // 30,000 per month ≈ 1,000 per day ≈ 42 per hour
  ipApiRateLimit: 45, // 45 per minute
  // Counters and timestamps for rate limiting
  ipapiCount: 0,
  ipapiResetTime: Date.now(),
  ipApiCount: 0,
  ipApiResetTime: Date.now(),
  // Cache settings
  cacheTTL: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
  // Cache map (for in-memory caching)
  cache: new Map(),
};

// Ensure cache directory exists
if (config.enabled) {
  try {
    if (!fs.existsSync(config.cacheDir)) {
      fs.mkdirSync(config.cacheDir, { recursive: true });
    }
    console.log(`GeoIP cache directory: ${config.cacheDir}`);
    console.log("Using ipapi.co and ip-api.com for geolocation lookups");
  } catch (error) {
    console.error("Error creating GeoIP cache directory:", error);
  }
}

/**
 * Look up geolocation information for an IP address
 * @param {string} ip - IP address to look up
 * @returns {Promise<Object|null>} - Geolocation data or null if lookup fails
 */
async function lookupIp(ip) {
  // Skip lookup for invalid IPs or private/internal IPs
  if (!ip || isPrivateIp(ip) || ip === "127.0.0.1" || ip === "localhost") {
    return null;
  }

  // If feature is disabled, return null
  if (!config.enabled) {
    return null;
  }

  // Check in-memory cache first
  if (config.cache.has(ip)) {
    return config.cache.get(ip);
  }

  // Check file cache
  const cachedResult = checkFileCache(ip);
  if (cachedResult) {
    // Update in-memory cache
    config.cache.set(ip, cachedResult);
    return cachedResult;
  }

  // Try the first API service (ipapi.co)
  try {
    // Check rate limit for ipapi.co
    const now = Date.now();
    if (now - config.ipapiResetTime >= 3600000) {
      // Reset counter every hour
      config.ipapiCount = 0;
      config.ipapiResetTime = now;
    }

    if (config.ipapiCount < config.ipapiRateLimit) {
      config.ipapiCount++;
      const result = await lookupWithIpapi(ip);
      if (result) {
        // Cache the result
        cacheResult(ip, result);
        return result;
      }
    }

    // Fallback to the second API service (ip-api.com)
    // Check rate limit for ip-api.com
    if (now - config.ipApiResetTime >= 60000) {
      // Reset counter every minute
      config.ipApiCount = 0;
      config.ipApiResetTime = now;
    }

    if (config.ipApiCount < config.ipApiRateLimit) {
      config.ipApiCount++;
      const result = await lookupWithIpApi(ip);
      if (result) {
        // Cache the result
        cacheResult(ip, result);
        return result;
      }
    }

    // Both services failed or rate limits exceeded
    console.warn(`Rate limits reached or APIs failed for IP: ${ip}`);
    return null;
  } catch (error) {
    console.error(`Error looking up IP ${ip}:`, error.message);
    return null;
  }
}

/**
 * Look up IP using ipapi.co API
 * @param {string} ip - IP address to look up
 * @returns {Promise<Object|null>} - Geolocation data
 */
function lookupWithIpapi(ip) {
  return new Promise((resolve, reject) => {
    https
      .get(`https://ipapi.co/${ip}/json/`, (res) => {
        if (res.statusCode !== 200) {
          resolve(null); // Don't reject, just return null to try fallback
          return;
        }

        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          try {
            const response = JSON.parse(data);

            // Check if response contains an error
            if (response.error) {
              resolve(null);
              return;
            }

            const result = {
              ip,
              latitude: response.latitude,
              longitude: response.longitude,
              country: response.country_code,
              city: response.city,
              isp: response.org,
              asn: response.asn,
            };

            resolve(result);
          } catch (error) {
            resolve(null);
          }
        });
      })
      .on("error", () => {
        resolve(null);
      });
  });
}

/**
 * Look up IP using ip-api.com API
 * @param {string} ip - IP address to look up
 * @returns {Promise<Object|null>} - Geolocation data
 */
function lookupWithIpApi(ip) {
  return new Promise((resolve, reject) => {
    https
      .get(
        `http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,city,lat,lon,isp,as`,
        (res) => {
          if (res.statusCode !== 200) {
            resolve(null);
            return;
          }

          let data = "";
          res.on("data", (chunk) => {
            data += chunk;
          });

          res.on("end", () => {
            try {
              const response = JSON.parse(data);

              // Check if response status is success
              if (response.status !== "success") {
                resolve(null);
                return;
              }

              const result = {
                ip,
                latitude: response.lat,
                longitude: response.lon,
                country: response.countryCode,
                city: response.city,
                isp: response.isp,
                asn: response.as,
              };

              resolve(result);
            } catch (error) {
              resolve(null);
            }
          });
        }
      )
      .on("error", () => {
        resolve(null);
      });
  });
}

/**
 * Check if a cached result exists for the IP
 * @param {string} ip - IP address
 * @returns {Object|null} - Cached result or null
 */
function checkFileCache(ip) {
  try {
    const cachePath = path.join(config.cacheDir, `${ip}.json`);
    if (fs.existsSync(cachePath)) {
      const cacheData = JSON.parse(fs.readFileSync(cachePath, "utf8"));

      // Check if cache is still valid
      if (Date.now() - cacheData.timestamp < config.cacheTTL) {
        return cacheData.data;
      } else {
        // Cache expired, delete the file
        fs.unlinkSync(cachePath);
      }
    }
  } catch (error) {
    console.error(`Error reading cache for IP ${ip}:`, error.message);
  }
  return null;
}

/**
 * Cache a geolocation result
 * @param {string} ip - IP address
 * @param {Object} result - Geolocation data
 */
function cacheResult(ip, result) {
  // Add to in-memory cache
  config.cache.set(ip, result);

  // Add to file cache
  try {
    const cachePath = path.join(config.cacheDir, `${ip}.json`);
    const cacheData = {
      timestamp: Date.now(),
      data: result,
    };

    fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2));
  } catch (error) {
    console.error(`Error caching result for IP ${ip}:`, error.message);
  }
}

/**
 * Check if an IP address is in a private range
 * @param {string} ip - IP address to check
 * @returns {boolean} - True if the IP is in a private range
 */
function isPrivateIp(ip) {
  // Check for IPv4 private ranges
  if (ip.match(/^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|127\.|0\.)/)) {
    return true;
  }

  // Check for IPv6 private ranges
  if (ip.match(/^(::1|fe80:|fc00:|fd00:|::ffff:)/i)) {
    return true;
  }

  return false;
}

module.exports = {
  lookupIp,
  isEnabled: config.enabled,
};
