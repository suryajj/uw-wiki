import { z } from "zod";

import { ORG_CATEGORIES } from "@/types/domain";

export const identifyInputSchema = z.object({
  input: z.string().trim().min(2).max(300),
  categoryHint: z.enum(ORG_CATEGORIES).optional(),
});

export const orgMetadataSchema = z.object({
  name: z.string().min(2),
  slug: z.string().optional(),
  oneLiner: z.string().optional(),
  website: z.string().url().optional(),
  category: z.enum(ORG_CATEGORIES),
  confidence: z.enum(["low", "medium", "high"]).default("medium"),
  sources: z.array(z.string()).default([]),
});

export const generateInputSchema = z.object({
  jobId: z.string().uuid(),
  orgMetadata: orgMetadataSchema,
});

export const updateDraftSchema = z.object({
  contentJson: z.unknown(),
});

export const publishSchema = z.object({
  contentJson: z.unknown().optional(),
});

export type OrgMetadataInput = z.infer<typeof orgMetadataSchema>;
