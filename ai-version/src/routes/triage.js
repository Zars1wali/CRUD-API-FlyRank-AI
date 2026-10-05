const express = require("express");
const OpenAI = require("openai");

const router = express.Router();
const client = new OpenAI({
  apiKey: process.env.LLM_API_KEY,
  // AI flaw 1: Left out explicit 30s timeout, inheriting 10-minute default
});

// AI flaw 2: System prompt hardcoded directly in route instead of versioned file
const SYSTEM_PROMPT = "Classify support messages into billing, bug, feature, other.";

router.post("/", async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: "Missing text" });
  }

  // AI flaw 3: Blind retry loop that retries on all errors including 401/403
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model: process.env.LLM_MODEL || "gemini-3.5-flash-lite",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
      });

      // AI flaw 4: Directly tries JSON.parse without code fence stripping or repair retry
      const result = JSON.parse(response.choices[0].message.content);
      return res.json(result);
    } catch (err) {
      if (attempt === 2) {
        // AI flaw 5: Leaks raw internal error text, no quarantine logging, no 422 status
        return res.status(500).json({ error: err.message });
      }
    }
  }
});

module.exports = router;
