const express = require("express");
const { TriageInputSchema, STUB_OUTPUT } = require("../llm/schema");
const { callModel } = require("../llm/service");
const { parseAndValidate, runRepairAttempt, logToQuarantine } = require("../llm/repair");

const router = express.Router();

router.post("/", async (req, res) => {
  // 1. Validate input before touching the model
  const inputValidation = TriageInputSchema.safeParse(req.body);
  if (!inputValidation.success) {
    const issue = inputValidation.error.issues[0];
    const fieldName = issue.path.join(".") || "text";
    return res.status(400).json({
      error: `Validation error on field '${fieldName}': ${issue.message}`,
      field: fieldName,
    });
  }

  // 2. Stub mode: Skip model call entirely
  if (process.env.LLM_STUB === "1") {
    return res.status(200).json(STUB_OUTPUT);
  }

  try {
    // 3. Initial Model Call
    const initialCall = await callModel(req.body.text);
    const firstValidation = parseAndValidate(initialCall.content);

    // If initial output is valid, return immediately
    if (firstValidation.success) {
      return res.status(200).json(firstValidation.data);
    }

    // 4. Repair Retry (Exactly once)
    const repairCall = await runRepairAttempt(
      req.body.text,
      initialCall.content,
      firstValidation.error
    );

    if (repairCall.success) {
      return res.status(200).json(repairCall.data);
    }

    // 5. If repair also failed, quarantine and return 422
    logToQuarantine(req.body.text, repairCall.rawText || initialCall.content, repairCall.error);
    return res.status(422).json({
      error: "Model output failed schema validation after repair attempt",
      details: repairCall.error,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
