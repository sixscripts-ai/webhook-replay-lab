import { z } from "zod";

// Generic JSON schema (allows arbitrary nested JSON)
const jsonLiteral = z.union([z.string(), z.number(), z.boolean(), z.null()]);
type Json = z.infer<typeof jsonLiteral> | { [k: string]: Json } | Json[];
export const jsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([jsonLiteral, z.array(jsonSchema), z.record(jsonSchema)])
);

// Webhook ingestion: we accept anything as the payload, since we want to
// store unknown shapes too. We only normalize a small wrapper.
export const webhookIngestSchema = z.object({
  payload: jsonSchema,
  eventType: z.string().min(1).max(200).optional(),
});

const backoffStrategyEnum = z.enum(["none", "fixed", "exponential"]);
const signatureAlgorithmEnum = z.enum(["hmac-sha256"]);
const httpStatusArray = z
  .array(z.number().int().min(100).max(599))
  .max(20);

const retryPolicyFields = {
  isRetryEnabled: z.boolean().optional(),
  maxAttempts: z.number().int().min(1).max(5).optional(),
  backoffStrategy: backoffStrategyEnum.optional(),
  backoffBaseMs: z.number().int().min(100).max(10_000).optional(),
  timeoutMs: z.number().int().min(1_000).max(30_000).optional(),
  retryOnStatuses: httpStatusArray.optional(),
};

const signatureFields = {
  isSignatureVerificationEnabled: z.boolean().optional(),
  signatureHeaderName: z
    .string()
    .max(120)
    .regex(/^[A-Za-z0-9_-]*$/, "Header name may only contain letters, digits, dashes, underscores")
    .optional(),
  signatureAlgorithm: signatureAlgorithmEnum.optional(),
  signingSecretEnvVar: z
    .string()
    .max(200)
    .regex(/^[A-Z0-9_]*$/, "Env var name must be uppercase letters, digits, or underscores")
    .optional(),
};

export const replayTargetCreateSchema = z.object({
  name: z.string().min(1).max(120),
  provider: z.string().min(1).max(120),
  url: z.string().url(),
  isActive: z.boolean().optional().default(true),
  ...retryPolicyFields,
  ...signatureFields,
});

export const replayTargetUpdateSchema = replayTargetCreateSchema.partial();

export const replayRequestSchema = z.object({
  targetId: z.string().min(1).optional(),
  // optionally override headers/payload at replay time, but never mutate the original
  headerOverrides: z.record(z.string()).optional(),
});

const assertionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("statusEquals"),
    expected: z.number().int().min(100).max(599),
  }),
  z.object({
    type: z.literal("bodyIncludes"),
    expected: z.string().min(1).max(2000),
  }),
  z.object({
    type: z.literal("responseTimeLessThanMs"),
    expected: z.number().int().min(1).max(60_000),
  }),
]);

export const evalTestCaseCreateSchema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(1000).optional(),
  eventId: z.string().min(1).optional(),
  targetId: z.string().min(1).optional(),
  expectedStatus: z.number().int().min(100).max(599),
  expectedBodyIncludes: z.string().max(500).optional(),
  expectedMaxDurationMs: z.number().int().min(1).max(60_000).optional(),
  assertions: z.array(assertionSchema).max(10).optional(),
  isActive: z.boolean().optional().default(true),
});

export const evalTestCaseUpdateSchema = evalTestCaseCreateSchema.partial();

export type WebhookIngestInput = z.infer<typeof webhookIngestSchema>;
export type ReplayTargetCreateInput = z.infer<typeof replayTargetCreateSchema>;
export type ReplayRequestInput = z.infer<typeof replayRequestSchema>;
export type EvalTestCaseCreateInput = z.infer<typeof evalTestCaseCreateSchema>;
export type Assertion = z.infer<typeof assertionSchema>;
