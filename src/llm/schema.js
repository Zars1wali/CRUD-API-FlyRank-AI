const { z } = require("zod");

// Input Schema: text must be a string between 1 and 2000 characters
const TriageInputSchema = z.object({
  text: z
    .string({
      required_error: "field 'text' is required",
      invalid_type_error: "field 'text' must be a string",
    })
    .min(1, "field 'text' must not be empty")
    .max(2000, "field 'text' must not exceed 2000 characters"),
});

// Category & Urgency Enums
const CategoryEnum = z.enum(["billing", "bug", "feature", "other"], {
  errorMap: () => ({ message: "category must be one of: billing, bug, feature, other" }),
});

const UrgencyEnum = z.enum(["low", "normal", "high"], {
  errorMap: () => ({ message: "urgency must be one of: low, normal, high" }),
});

// Output Schema
const TriageOutputSchema = z.object({
  category: CategoryEnum,
  urgency: UrgencyEnum,
  confidence: z
    .number({
      required_error: "confidence is required",
      invalid_type_error: "confidence must be a number",
    })
    .min(0.0, "confidence must be between 0.0 and 1.0")
    .max(1.0, "confidence must be between 0.0 and 1.0"),
  reason: z.string().min(1, "reason must not be empty"),
});

// Deterministic Stub output satisfying schema
const STUB_OUTPUT = {
  category: "billing",
  urgency: "normal",
  confidence: 0.95,
  reason: "Customer inquiry regarding invoice charges and tax calculations.",
};

module.exports = {
  TriageInputSchema,
  TriageOutputSchema,
  CategoryEnum,
  UrgencyEnum,
  STUB_OUTPUT,
};
