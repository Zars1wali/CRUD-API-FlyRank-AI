const fs = require("fs");
const path = require("path");
const client = require("./client");

const PROMPT_PATH = path.join(__dirname, "../../prompts/triage-v1.md");
let cachedPrompt = null;

function loadPrompt() {
  if (!cachedPrompt) {
    cachedPrompt = fs.readFileSync(PROMPT_PATH, "utf8");
  }
  return cachedPrompt;
}

function isTransientError(err) {
  // Never retry 400, 401, 403 (bad request or invalid credentials must fail fast)
  if (err.status === 400 || err.status === 401 || err.status === 403) {
    return false;
  }
  // Retry timeouts, 429 rate limits, and 5xx upstream server errors
  if (err.status === 429 || (err.status >= 500 && err.status <= 599)) {
    return true;
  }
  if (
    err.code === "ETIMEDOUT" ||
    err.code === "ECONNABORTED" ||
    err.name === "APIConnectionTimeoutError" ||
    (err.message && err.message.toLowerCase().includes("timeout"))
  ) {
    return true;
  }
  return false;
}

function calculateBackoff(attempt, retryAfterHeader) {
  if (retryAfterHeader) {
    const seconds = parseInt(retryAfterHeader, 10);
    if (!isNaN(seconds)) return seconds * 1000;
  }
  // Exponential backoff with jitter: 1s, 2s, 4s + random 0-500ms jitter
  const base = Math.pow(2, attempt) * 1000;
  const jitter = Math.floor(Math.random() * 500);
  return base + jitter;
}

async function callWithRetry(fn, maxRetries = 2) {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= maxRetries || !isTransientError(err)) {
        throw err;
      }
      const retryAfter = err.headers ? err.headers["retry-after"] : null;
      const delay = calculateBackoff(attempt, retryAfter);
      console.warn(
        `[RETRY] Transient failure (${err.status || err.code || err.name}). Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt++;
    }
  }
}

async function executeModelCall(messages, model) {
  const startTime = Date.now();
  const response = await callWithRetry(async () => {
    return await client.chat.completions.create({
      model: model,
      temperature: 0.2,
      messages: messages,
    });
  });
  const durationMs = Date.now() - startTime;

  return {
    content: response.choices[0].message.content,
    usage: response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    durationMs,
    model,
  };
}

function logCostMetrics({ model, promptVersion, usage, durationMs, repairCount }) {
  const logLine = {
    timestamp: new Date().toISOString(),
    event: "llm_call_metrics",
    prompt_version: promptVersion || "triage-v1",
    model: model || "unknown",
    prompt_tokens: usage?.prompt_tokens || 0,
    completion_tokens: usage?.completion_tokens || 0,
    total_tokens: usage?.total_tokens || 0,
    duration_ms: durationMs,
    repair_count: repairCount || 0,
  };
  console.log(JSON.stringify(logLine));
}

async function callModel(text) {
  const systemPrompt = loadPrompt();
  const model = process.env.LLM_MODEL || "gemini-3.5-flash-lite";

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: JSON.stringify({ message: text }) },
  ];

  return await executeModelCall(messages, model);
}

module.exports = {
  loadPrompt,
  callModel,
  executeModelCall,
  callWithRetry,
  logCostMetrics,
  isTransientError,
};
