// Application-layer types and constants used throughout the app.

export const ORG_CATEGORIES = [
  "Design Teams",
  "Engineering Clubs",
  "Non-Engineering Clubs",
  "Academic Programs",
  "Student Societies",
  "Campus Organizations",
] as const;

export type OrgCategory = (typeof ORG_CATEGORIES)[number];

export const PULSE_METRICS = [
  "selectivity",
  "vibe_check",
  "coop_boost",
  "tech_stack",
] as const;

export type PulseMetric = (typeof PULSE_METRICS)[number];

export type ChunkType = "content" | "comment";

export type ProseMirrorTextNode = {
  type: "text";
  text?: string;
};

export type ProseMirrorNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: ProseMirrorNode[];
  text?: string;
};

export type ProseMirrorDoc = {
  type: "doc";
  content?: ProseMirrorNode[];
};

export type OrgMeta = {
  universityId: string;
  orgId: string;
  orgName: string;
  orgSlug: string;
  category: OrgCategory | string;
  pageVersionId?: string | null;
};

export type CommentData = {
  body: string;
  anchoredSection: string | null;
  createdAt: string;
  referencesPreviousVersion?: boolean;
};

export type ChunkResult = {
  id: string;
  content: string;
  orgName: string;
  orgSlug: string;
  sectionTitle: string | null;
  sectionSlug: string | null;
  chunkType: ChunkType;
  category: string;
  anchoredSection: string | null;
  referencesPreviousVersion: boolean;
  createdAt: string;
  similarityScore: number;
  rrfScore: number;
};

export type FallbackPage = {
  orgName: string;
  orgSlug: string;
};
