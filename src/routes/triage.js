const express = require("express");
const { TriageInputSchema, TriageOutputSchema, STUB_OUTPUT } = require("../llm/schema");
const { callModel } = require("../llm/service");

const router = express.Router();

router.post("/", async (req, res) => {
  // 1. Validate input with Zod before anything else happens
  const inputValidation = TriageInputSchema.safeParse(req.body);
  if (!inputValidation.success) {
    const issue = inputValidation.error.issues[0];
    const fieldName = issue.path.join(".") || "text";
    return res.status(400).json({
      error: `Validation error on field '${fieldName}': ${issue.message}`,
      field: fieldName,
    });
  }

  // 2. Stub mode: When LLM_STUB=1 is set, return hard-coded schema-valid object
  if (process.env.LLM_STUB === "1") {
    return res.status(200).json(STUB_OUTPUT);
  }

  // 3. Stage 2: Call model with versioned prompt
  try {
    const result = await callModel(req.body.text);
    return res.status(200).send(result.content);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
