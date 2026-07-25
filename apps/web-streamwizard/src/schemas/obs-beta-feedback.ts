import { z } from "zod";

export const betaResultSchema = z.enum(["pass", "fail", "partial", "blocked", "skipped"]);

export const betaCaseAnswerSchema = z.object({
  result: betaResultSchema.optional(),
  notes: z.string().max(4000).optional(),
});

export const betaFeedbackSchema = z.object({
  tester_info: z.record(z.string(), z.string().max(500)),
  responses: z.record(z.string(), betaCaseAnswerSchema),
  overall: z.record(z.string(), z.string().max(4000)),
});

export type BetaResult = z.infer<typeof betaResultSchema>;
export type BetaCaseAnswer = z.infer<typeof betaCaseAnswerSchema>;
export type BetaFeedbackValues = z.infer<typeof betaFeedbackSchema>;
