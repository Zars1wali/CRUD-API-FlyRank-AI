const fs = require("fs");
const path = require("path");
const { TriageOutputSchema } = require("./schema");
const client = require("./client");
const { loadPrompt } = require("./service");

const LOGS_DIR = path.join(__dirname, "../../logs");
const QUARANTINE_FILE = path.join(LOGS_DIR, "quarantine.jsonl");

function stripCodeFence(raw) {
  if (typeof raw !== "string") return "";
  let text = raw.trim();

  // Strip markdown code fences if present
  if (text.startsWith("```")) {
    text = text.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").trim();
  }

  // Extract content between first { and last }
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
    text = text.substring(firstBrace, lastBrace + 1);
  }

  return text;
}

function parseAndValidate(rawText) {
  const cleaned = stripCodeFence(rawText);
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    return {
      success: false,
      error: `JSON parse error: ${err.message}`,
      raw: rawText,
    };
  }

  const result = TriageOutputSchema.safeParse(parsed);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((i) => `${i.path.join(".") || "root"}: ${i.message}`)
      .join("; ");
    return {
      success: false,
      error: `Schema validation error: ${errorDetails}`,
      parsed,
      raw: rawText,
    };
  }

  return {
    success: true,
    data: result.data,
  };
}

async function runRepairAttempt(userInput, brokenRaw, errorMessage) {
  const systemPrompt = loadPrompt();
  const model = process.env.LLM_MODEL || "gemini-3.5-flash-lite";

  const response = await client.chat.completions.create({
    model: model,
    temperature: 0.1,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: JSON.stringify({ message: userInput }) },
      { role: "assistant", content: brokenRaw },
      {
        role: "user",
        content: `Your previous answer was rejected for this reason: ${errorMessage}. Return only corrected JSON matching the schema.`,
      },
    ],
  });

  const repairText = response.choices[0].message.content;
  const validation = parseAndValidate(repairText);

  return {
    ...validation,
    rawText: repairText,
    usage: response.usage,
  };
}

function logToQuarantine(input, rawOutput, error) {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }

  const logEntry = {
    timestamp: new Date().toISOString(),
    prompt_version: "triage-v1",
    input,
    raw_output: rawOutput,
    error,
  };

  fs.appendFileSync(QUARANTINE_FILE, JSON.stringify(logEntry) + "\n", "utf8");
}

module.exports = {
  stripCodeFence,
  parseAndValidate,
  runRepairAttempt,
  logToQuarantine,
  QUARANTINE_FILE,
};
