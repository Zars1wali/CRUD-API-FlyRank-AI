require("dotenv").config();
const OpenAI = require("openai");

const client = new OpenAI({
  baseURL: process.env.LLM_BASE_URL || "https://openrouter.ai/api/v1",
  apiKey: process.env.LLM_API_KEY || "ollama",
  timeout: 30000, // 30 seconds explicit client timeout
  maxRetries: 0, // Disable silent SDK retries so we handle retry policies explicitly
});

module.exports = client;
