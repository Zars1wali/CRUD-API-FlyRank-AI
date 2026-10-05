require("dotenv").config();
const fs = require("fs");
const path = require("path");
const express = require("express");

const CASES_PATH = path.join(__dirname, "cases.json");
const cases = JSON.parse(fs.readFileSync(CASES_PATH, "utf8"));

async function runEval() {
  console.log("\n=======================================================");
  console.log("  W7 LLM TRIAGE BENCHMARK EVALUATION HARNESS");
  console.log(`  Model: ${process.env.LLM_MODEL || "gemini-3.5-flash-lite"}`);
  console.log(`  Date: ${new Date().toISOString()}`);
  console.log(`  Test Cases: ${cases.length}`);
  console.log("=======================================================\n");

  const app = express();
  app.use(express.json());
  app.use("/triage", require("../src/routes/triage"));

  const port = 3091;
  const server = app.listen(port);

  let passedCount = 0;
  const failures = [];
  const results = [];

  try {
    for (const testCase of cases) {
      const startTime = Date.now();
      const res = await fetch(`http://localhost:${port}/triage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: testCase.text }),
      });
      const duration = Date.now() - startTime;
      const data = await res.json();

      const categoryMatch = data.category === testCase.expected.category;
      if (categoryMatch) {
        passedCount++;
      } else {
        failures.push({
          id: testCase.id,
          text: testCase.text,
          expected: testCase.expected.category,
          actual: data.category,
          reason: data.reason,
        });
      }

      results.push({
        id: testCase.id,
        expected: testCase.expected.category,
        actual: data.category,
        urgency: data.urgency,
        confidence: data.confidence,
        status: categoryMatch ? "PASS" : "FAIL",
        duration_ms: duration,
      });

      console.log(
        `Case #${testCase.id} [${categoryMatch ? "✓ PASS" : "✗ FAIL"}] Expected: '${testCase.expected.category}' | Actual: '${data.category}' (confidence: ${data.confidence}) (${duration}ms)`
      );
    }

    const accuracy = ((passedCount / cases.length) * 100).toFixed(1);

    console.log("\n-------------------------------------------------------");
    console.log(`FINAL BENCHMARK SCORE: ${passedCount}/${cases.length} (${accuracy}%)`);
    console.log("-------------------------------------------------------");

    if (failures.length > 0) {
      console.log("\nMismatched Cases:");
      failures.forEach((f) => {
        console.log(`  - Case #${f.id}: Expected '${f.expected}', got '${f.actual}'`);
        console.log(`    Input: "${f.text}"`);
        console.log(`    Model reasoning: "${f.reason}"\n`);
      });
    } else {
      console.log("\nAll test cases passed with 100% categorical accuracy!\n");
    }

    return { passedCount, total: cases.length, accuracy, failures };
  } finally {
    server.close();
  }
}

if (require.main === module) {
  runEval()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Eval runner failed:", err);
      process.exit(1);
    });
}

module.exports = { runEval };
