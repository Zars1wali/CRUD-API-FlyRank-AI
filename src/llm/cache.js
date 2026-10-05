const crypto = require("crypto");

const cache = new Map();
const TTL_MS = 60 * 60 * 1000; // 1-hour in-memory cache TTL

function getCacheKey(promptVersion, text) {
  return crypto
    .createHash("sha256")
    .update(`${promptVersion}:${text.trim().toLowerCase()}`)
    .digest("hex");
}

function getCachedResponse(promptVersion, text) {
  const key = getCacheKey(promptVersion, text);
  const entry = cache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > TTL_MS) {
    cache.delete(key);
    return null;
  }

  return entry.data;
}

function setCachedResponse(promptVersion, text, data) {
  const key = getCacheKey(promptVersion, text);
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

function clearCache() {
  cache.clear();
}

module.exports = {
  getCachedResponse,
  setCachedResponse,
  clearCache,
};
