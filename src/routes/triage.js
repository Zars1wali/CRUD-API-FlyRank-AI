const express = require("express");
const { TriageInputSchema, STUB_OUTPUT } = require("../llm/schema");
const { callModel, logCostMetrics } = require("../llm/service");
const { parseAndValidate, runRepairAttempt, logToQuarantine } = require("../llm/repair");
const { getCachedResponse, setCachedResponse } = require("../llm/cache");

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

  // 2. Kill switch: When LLM_ENABLED=false, skip model call and return safe deterministic fallback
  if (process.env.LLM_ENABLED === "false" || process.env.LLM_ENABLED === "0") {
    return res.status(503).json({
      status: "degraded",
      message: "AI triage is temporarily disabled by administrative kill switch.",
      fallback: {
        category: "other",
        urgency: "normal",
        confidence: 0.0,
        reason: "Kill switch active (LLM_ENABLED=false). Safe deterministic fallback applied.",
      },
    });
  }

  // 3. Stub mode: Skip model call entirely
  if (process.env.LLM_STUB === "1") {
    return res.status(200).json(STUB_OUTPUT);
  }

  // 4. In-Memory Request Cache: Return saved answer on duplicate requests
  const cachedData = getCachedResponse("triage-v1", req.body.text);
  if (cachedData) {
    return res.status(200).json({ ...cachedData, cached: true });
  }

  try {
    // 5. Initial Model Call with explicit timeout and retry policy
    const initialCall = await callModel(req.body.text);
    const firstValidation = parseAndValidate(initialCall.content);

    // If initial output satisfies schema, cache, log cost, and return 200
    if (firstValidation.success) {
      setCachedResponse("triage-v1", req.body.text, firstValidation.data);
      logCostMetrics({
        model: initialCall.model,
        promptVersion: "triage-v1",
        usage: initialCall.usage,
        durationMs: initialCall.durationMs,
        repairCount: 0,
      });
      return res.status(200).json(firstValidation.data);
    }

    // 6. Repair Retry (Exactly once)


    const repairCall = await runRepairAttempt(
      req.body.text,
      initialCall.content,
      firstValidation.error
    );

    const totalDuration = initialCall.durationMs + (repairCall.durationMs || 0);
    const combinedUsage = {
      prompt_tokens: (initialCall.usage?.prompt_tokens || 0) + (repairCall.usage?.prompt_tokens || 0),
      completion_tokens:
        (initialCall.usage?.completion_tokens || 0) + (repairCall.usage?.completion_tokens || 0),
      total_tokens: (initialCall.usage?.total_tokens || 0) + (repairCall.usage?.total_tokens || 0),
    };

    if (repairCall.success) {
      logCostMetrics({
        model: initialCall.model,
        promptVersion: "triage-v1",
        usage: combinedUsage,
        durationMs: totalDuration,
        repairCount: 1,
      });
      return res.status(200).json(repairCall.data);
    }

    // 6. Quarantine unrepairable output and return 422
    logToQuarantine(req.body.text, repairCall.rawText || initialCall.content, repairCall.error);
    logCostMetrics({
      model: initialCall.model,
      promptVersion: "triage-v1",
      usage: combinedUsage,
      durationMs: totalDuration,
      repairCount: 1,
    });

    return res.status(422).json({
      error: "Model output failed schema validation after repair attempt",
      details: repairCall.error,
    });
  } catch (err) {
    // Check for explicit timeout
    if (
      err.name === "APIConnectionTimeoutError" ||
      err.code === "ETIMEDOUT" ||
      (err.message && err.message.toLowerCase().includes("timeout"))
    ) {
      return res.status(504).json({
        error: "Gateway Timeout: Upstream LLM request exceeded 30 seconds limit.",
      });
    }

    // Non-retriable auth error
    if (err.status === 401) {
      return res.status(401).json({ error: "Invalid or unauthorized LLM API key." });
    }

    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
