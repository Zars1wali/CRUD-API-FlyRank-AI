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

async function callModel(text) {
  const systemPrompt = loadPrompt();
  const model = process.env.LLM_MODEL || "gemini-3.8-flash";

  const response = await client.chat.completions.create({
    model: model,
    temperature: 0.2,
    messages: [
      { role: "system", content: systemPrompt },
      // Send untrusted user input as a distinct user message, JSON-encoded to mitigate injection
      { role: "user", content: JSON.stringify({ message: text }) },
    ],
  });

  return {
    content: response.choices[0].message.content,
    usage: response.usage,
    model: model,
  };
}

module.exports = {
  loadPrompt,
  callModel,
};
