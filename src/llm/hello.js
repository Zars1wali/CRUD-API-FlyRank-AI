require("dotenv").config();
const OpenAI = require("openai");

const client = new OpenAI({
  baseURL: process.env.LLM_BASE_URL || "https://openrouter.ai/api/v1",
  apiKey: process.env.LLM_API_KEY || "ollama",
});

async function main() {
  const model = process.env.LLM_MODEL || "openrouter/free";
  console.log(`Connecting to ${client.baseURL} with model ${model}...`);

  const res = await client.chat.completions.create({
    model: model,
    messages: [{ role: "user", content: "Reply with exactly the word: ready" }],
  });

  const reply = res.choices[0].message.content.trim();
  console.log("Model response:", reply);
}

main().catch((err) => {
  console.error("LLM connection error:", err.message);
  process.exit(1);
});
