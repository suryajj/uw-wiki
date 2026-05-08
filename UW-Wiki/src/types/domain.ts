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

export type ProseMirrorMark = {
  type: string;
  attrs?: Record<string, unknown>;
};

export type ProseMirrorNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: ProseMirrorNode[];
  marks?: ProseMirrorMark[];
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

// ---------------------------------------------------------------------
// FRD-2: pages, lifecycle, pulse, external links, affiliations
// ---------------------------------------------------------------------

export type LifecycleStatus =
  | "active"
  | "needs_update"
  | "stale"
  | "potentially_defunct";

export type LifecycleConfig = {
  category: string;
  needsUpdateDays: number;
  staleDays: number;
  defunctDays: number;
};

export type PulseAggregate = {
  metric: PulseMetric;
  aggregateValue: string;
  aggregateLabel: string;
  totalVotes: number;
};

export type ExternalLink = {
  id: string;
  label: string;
  url: string;
  displayOrder: number;
};

export type DirectoryOrg = {
  id: string;
  orgSlug: string;
  orgName: string;
  category: OrgCategory;
  tagline: string | null;
  pageSlug: string | null;
};

export type WikiPageData = {
  pageId: string;
  pageSlug: string;
  orgId: string;
  universityId: string;
  orgName: string;
  orgSlug: string;
  category: OrgCategory;
  tagline: string | null;
  contentJson: ProseMirrorDoc;
  currentVersionId: string | null;
  lastModifiedAt: string;
  isColdStart: boolean;
  isAdminSeeded: boolean;
  pulseAggregates: PulseAggregate[];
  externalLinks: ExternalLink[];
  lifecycleStatus: LifecycleStatus;
  lifecycleConfig: LifecycleConfig | null;
};

export type PageVersionSummary = {
  id: string;
  versionNumber: number;
  summary: string | null;
  createdAt: string;
  isAnonymous: boolean;
  contributorDisplayName: string | null;
  isAdminSeeded: boolean;
  isColdStart: boolean;
};

// ---------------------------------------------------------------------
// FRD-3: comments
// ---------------------------------------------------------------------

export type CommentRow = {
  id: string;
  pageId: string;
  parentCommentId: string | null;
  authorId: string | null;
  isAnonymous: boolean;
  isEdited: boolean;
  isHidden: boolean;
  sectionSlug: string;
  anchorText: string;
  body: string;
  upvotes: number;
  downvotes: number;
  createdAt: string;
  updatedAt: string;
  authorDisplayName: string | null;
  isAnchored: boolean;
};

export type CommentTree = CommentRow & {
  replies: CommentRow[];
};

export type CommentReportReason =
  | "spam"
  | "harassment"
  | "misinformation"
  | "other";

export type CommentReportRow = {
  id: string;
  commentId: string;
  reporterId: string | null;
  reason: CommentReportReason;
  details: string | null;
  status: "pending" | "resolved" | "dismissed";
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

// ---------------------------------------------------------------------
// FRD-4: section-scoped proposals
// ---------------------------------------------------------------------

export type ProposalStatus =
  | "pending"
  | "changes_requested"
  | "needs_rebase"
  | "accepted"
  | "rejected"
  | "withdrawn";

export type MergeabilityStatus =
  | "unknown"
  | "mergeable"
  | "needs_rebase"
  | "conflict";

export type SectionDiffEntry = {
  sectionSlug: string;
  baseSectionHash: string;
  originalSectionJson: ProseMirrorDoc | null;
  proposedSectionJson: ProseMirrorDoc;
  diffJson: unknown;
  mergeabilityStatus: MergeabilityStatus;
};

export type EditProposalRow = {
  id: string;
  pageId: string;
  baseVersionId: string;
  basePageVersionId: string | null;
  contributorId: string | null;
  isAnonymous: boolean;
  isFromAffiliatedContributor: boolean;
  sectionSlugs: string[];
  status: ProposalStatus;
  mergeabilityStatus: MergeabilityStatus;
  currentPatchsetNumber: number;
  rationale: string | null;
  reviewerId: string | null;
  reviewerComment: string | null;
  decidedAt: string | null;
  createdAt: string;
};

export type EditProposalPatchsetRow = {
  id: string;
  proposalId: string;
  patchsetNumber: number;
  basePageVersionId: string;
  sectionDiffs: SectionDiffEntry[];
  rationale: string;
  isCurrent: boolean;
  contributorId: string | null;
  createdAt: string;
};

export type ProposalSummary = {
  id: string;
  pageId: string;
  pageSlug: string;
  orgName: string;
  orgSlug: string;
  category: OrgCategory;
  sectionSlugs: string[];
  status: ProposalStatus;
  mergeabilityStatus: MergeabilityStatus;
  isAnonymous: boolean;
  isFromAffiliatedContributor: boolean;
  contributorDisplayName: string | null;
  rationale: string | null;
  createdAt: string;
};

// ---------------------------------------------------------------------
// FRD-5: cold start jobs
// ---------------------------------------------------------------------

export const COLD_START_STATUSES = [
  "draft",
  "identifying",
  "awaiting_confirmation",
  "researching",
  "synthesizing",
  "ready_for_preview",
  "published",
  "failed",
  "cancelled",
] as const;

export type ColdStartStatus = (typeof COLD_START_STATUSES)[number];

export type ColdStartInputType = "name" | "url";

export type ColdStartOrgMetadata = {
  name: string;
  slug?: string;
  oneLiner?: string;
  website?: string;
  category: OrgCategory;
  confidence?: "low" | "medium" | "high";
  sources?: string[];
};

export type ColdStartPulseEstimates = {
  selectivity?: string | null;
  techStack?: string[] | null;
  vibeCheck?: null;
  coopBoost?: null;
};

export type ColdStartJob = {
  id: string;
  createdBy: string | null;
  supersedesJobId: string | null;
  inputText: string;
  inputType: ColdStartInputType;
  status: ColdStartStatus;
  categoryHint: OrgCategory | null;
  orgMetadata: ColdStartOrgMetadata | null;
  researchData: Record<string, unknown>;
  draftContentJson: ProseMirrorDoc | null;
  pulseEstimates: ColdStartPulseEstimates;
  sectionSources: Record<string, string[]>;
  sectionProgress: Array<{
    slug: string;
    title: string;
    status: "pending" | "in_progress" | "completed" | "skipped" | "failed";
    sourceCount?: number;
    message?: string;
  }>;
  tavilyCallCount: number;
  currentStep: string | null;
  error: string | null;
  publishedOrgId: string | null;
  publishedPageId: string | null;
  publishedPageVersionId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

// ---------------------------------------------------------------------
// FRD-6 / FRD-7: auth, pending actions, admin
// ---------------------------------------------------------------------

export type PendingActionType =
  | "pulse.vote"
  | "comment.vote"
  | "bookmark.toggle";

export type PendingActionEnvelope = {
  id: string;
  type: PendingActionType;
  savedAt: string;
  expiresAt: string;
  returnTo?: string;
  payload: unknown;
};

export type AdminActivity = {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type NotificationType =
  | "pr.accepted"
  | "pr.rejected"
  | "pr.changes_requested"
  | "pr.needs_rebase"
  | "comment.reply"
  | "page.updated";

export type NotificationRow = {
  id: string;
  userId: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  readAt: string | null;
  deliveredEmail: boolean;
  createdAt: string;
};

export type NotificationPreferences = {
  userId: string;
  inAppPrStatus: boolean;
  emailPrStatus: boolean;
  inAppCommentReply: boolean;
  emailCommentReply: boolean;
  inAppPageUpdate: boolean;
  emailPageUpdateDigest: boolean;
  pageUpdateDigestFrequency: "daily" | "weekly" | "never";
  lastDigestSentAt: string | null;
  updatedAt: string;
};
