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

export const replayTargetCreateSchema = z.object({
  name: z.string().min(1).max(120),
  provider: z.string().min(1).max(120),
  url: z.string().url(),
  isActive: z.boolean().optional().default(true),
});

export const replayTargetUpdateSchema = replayTargetCreateSchema.partial();

export const replayRequestSchema = z.object({
  targetId: z.string().min(1).optional(),
  // optionally override headers/payload at replay time, but never mutate the original
  headerOverrides: z.record(z.string()).optional(),
});

export const evalTestCaseCreateSchema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(1000).optional(),
  eventId: z.string().min(1).optional(),
  targetId: z.string().min(1).optional(),
  expectedStatus: z.number().int().min(100).max(599),
  expectedBodyIncludes: z.string().max(500).optional(),
  isActive: z.boolean().optional().default(true),
});

export const evalTestCaseUpdateSchema = evalTestCaseCreateSchema.partial();

export type WebhookIngestInput = z.infer<typeof webhookIngestSchema>;
export type ReplayTargetCreateInput = z.infer<typeof replayTargetCreateSchema>;
export type ReplayRequestInput = z.infer<typeof replayRequestSchema>;
export type EvalTestCaseCreateInput = z.infer<typeof evalTestCaseCreateSchema>;
