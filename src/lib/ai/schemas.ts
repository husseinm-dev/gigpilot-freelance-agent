import { z } from "zod";

export const evaluationSchema = z.object({
  score: z.number().int().min(0).max(100)
    .describe("Overall opportunity quality 0-100"),
  recommendation: z.enum(["pursue", "maybe", "skip"]),
  reasons: z.array(z.string()).max(6),
  risks: z.array(z.string()).max(6),
  estimated_hours: z.number().min(0).max(1000),
  suggested_bid_usd: z.number().min(0),
  confidence: z.enum(["low", "medium", "high"]),
  technology_match: z.number().int().min(0).max(100),
  scope_clarity: z.number().int().min(0).max(100),
  client_credibility: z.enum(["unknown", "weak", "moderate", "strong"])
    .describe("Based ONLY on data provided; 'unknown' when no client data exists"),
});

export type Evaluation = z.infer<typeof evaluationSchema>;

export const proposalSchema = z.object({
  cover_letter: z.string().describe("The complete proposal text, 100-180 words unless the project warrants otherwise"),
  bid_amount_usd: z.number().min(0),
  bid_type: z.enum(["fixed", "hourly"]),
  estimated_days: z.number().int().min(1).max(120),
  clarifying_question: z.string().nullable()
    .describe("One useful question for the client, or null if none needed"),
});

export type ProposalDraft = z.infer<typeof proposalSchema>;
