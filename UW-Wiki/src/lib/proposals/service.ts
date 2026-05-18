import "server-only";

import { z } from "zod";

import { reembedSections } from "@/lib/ai/embeddings";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { logServerError } from "@/lib/api/errors";
import { updateAnchorStatusForPage } from "@/lib/comments/update-anchors";
import { diffSections } from "@/lib/prosemirror/diff";
import { emitNotification } from "@/lib/notifications/service";
import { hashSection } from "@/lib/prosemirror/hash";
import {
  extractSections,
  findSectionBySlug,
  preserveOfficialAttributes,
  replaceSection,
  sectionToProseMirrorDoc,
} from "@/lib/prosemirror/sections";
import { validateProposalDoc } from "@/lib/prosemirror/validate";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CurrentUser } from "@/lib/auth/current-user";
import type {
  EditProposalPatchsetRow,
  MergeabilityStatus,
  ProseMirrorDoc,
  ProposalSummary,
  SectionDiffEntry,
} from "@/types/domain";

export const createProposalSchema = z.object({
  pageId: z.string().uuid(),
  basePageVersionId: z.string().uuid(),
  proposedContentJson: z.unknown(),
  sectionSlugs: z.array(z.string().min(1)).min(1).optional(),
  rationale: z.string().trim().min(20).max(500),
  isAnonymous: z.boolean().default(true),
});

export async function createProposal(
  input: z.infer<typeof createProposalSchema>,
  user: CurrentUser | null,
) {
  const validation = validateProposalDoc(input.proposedContentJson);
  if (!validation.ok) {
    throw new ProposalError("INVALID_CONTENT", validation.error);
  }

  const admin = createAdminClient();
  const page = await loadPage(input.pageId);
  if (!page) throw new ProposalError("NOT_FOUND", "Page not found.");
  if (page.current_version_id !== input.basePageVersionId) {
    throw new ProposalError("CONFLICT", "Page changed. Refresh before proposing edits.");
  }

  const currentDoc = page.content_json as ProseMirrorDoc;
  const proposedDoc = input.proposedContentJson as ProseMirrorDoc;
  const selectedSlugs =
    input.sectionSlugs ?? extractChangedSectionSlugs(currentDoc, proposedDoc);
  if (selectedSlugs.length === 0) {
    throw new ProposalError("VALIDATION_FAILED", "No changed sections found.");
  }

  const sectionDiffs = buildSectionDiffs(currentDoc, proposedDoc, selectedSlugs);
  const mergeability = computeOverallMergeability(sectionDiffs);
  const isAffiliated = user
    ? await isUserAffiliated(user.id, page.organizations.id)
    : false;

  const { data: proposal, error } = await admin
    .from("edit_proposals")
    .insert({
      page_id: input.pageId,
      base_version_id: input.basePageVersionId,
      base_page_version_id: input.basePageVersionId,
      contributor_id: user ? user.id : null,
      is_anonymous: input.isAnonymous || !user,
      is_from_affiliated_contributor: isAffiliated,
      section_slugs: selectedSlugs,
      proposed_content_json: proposedDoc,
      rationale: input.rationale,
      status: "pending",
      mergeability_status: mergeability,
      current_patchset_number: 1,
    })
    .select("id")
    .single();
  if (error || !proposal) {
    throw new ProposalError("UNEXPECTED", "Could not create proposal.");
  }

  const { error: patchsetError } = await admin.from("edit_proposal_patchsets").insert({
    proposal_id: proposal.id,
    patchset_number: 1,
    base_page_version_id: input.basePageVersionId,
    section_diffs: serializeSectionDiffs(sectionDiffs),
    rationale: input.rationale,
    is_current: true,
    contributor_id: user ? user.id : null,
  });
  if (patchsetError) {
    await admin.from("edit_proposals").delete().eq("id", proposal.id);
    throw new ProposalError("UNEXPECTED", "Could not create proposal patchset.");
  }

  return { proposalId: proposal.id, sectionSlugs: selectedSlugs, mergeability };
}

export async function createPatchset(
  proposalId: string,
  input: z.infer<typeof createProposalSchema>,
  user: CurrentUser,
) {
  const admin = createAdminClient();
  const detail = await loadProposalDetail(proposalId);
  if (!detail?.proposal) throw new ProposalError("NOT_FOUND", "Proposal not found.");
  if (!detail.proposal.contributor_id) {
    throw new ProposalError("FORBIDDEN", "Anonymous proposals cannot receive patchsets.");
  }
  if (detail.proposal.contributor_id !== user.id) {
    throw new ProposalError("FORBIDDEN", "Only the contributor can submit patchsets.");
  }
  if (!["changes_requested", "needs_rebase"].includes(detail.proposal.status)) {
    throw new ProposalError("INVALID_STATE", "Proposal is not awaiting a patchset.");
  }

  const validation = validateProposalDoc(input.proposedContentJson);
  if (!validation.ok) throw new ProposalError("INVALID_CONTENT", validation.error);
  const page = await loadPage(input.pageId);
  if (!page) throw new ProposalError("NOT_FOUND", "Page not found.");

  const currentDoc = page.content_json as ProseMirrorDoc;
  const proposedDoc = input.proposedContentJson as ProseMirrorDoc;
  const selectedSlugs = input.sectionSlugs ?? (detail.proposal.section_slugs as string[]);
  const sectionDiffs = buildSectionDiffs(currentDoc, proposedDoc, selectedSlugs);
  const mergeability = computeOverallMergeability(sectionDiffs);
  const nextPatchsetNumber = Number(detail.proposal.current_patchset_number ?? 1) + 1;

  await admin
    .from("edit_proposal_patchsets")
    .update({ is_current: false })
    .eq("proposal_id", proposalId);
  const { error } = await admin.from("edit_proposal_patchsets").insert({
    proposal_id: proposalId,
    patchset_number: nextPatchsetNumber,
    base_page_version_id: page.current_version_id,
    section_diffs: serializeSectionDiffs(sectionDiffs),
    rationale: input.rationale,
    is_current: true,
    contributor_id: user.id,
  });
  if (error) throw new ProposalError("UNEXPECTED", "Could not submit patchset.");

  await admin
    .from("edit_proposals")
    .update({
      status: "pending",
      current_patchset_number: nextPatchsetNumber,
      base_page_version_id: page.current_version_id,
      base_version_id: page.current_version_id,
      section_slugs: selectedSlugs,
      proposed_content_json: proposedDoc,
      rationale: input.rationale,
      mergeability_status: mergeability,
      updated_at: new Date().toISOString(),
    })
    .eq("id", proposalId);

  return { proposalId, patchsetNumber: nextPatchsetNumber, mergeability };
}

export async function listProposalQueue(): Promise<ProposalSummary[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("edit_proposals")
    .select(
      "id,page_id,section_slugs,status,mergeability_status,is_anonymous,is_from_affiliated_contributor,contributor_id,rationale,created_at,pages(slug,organizations(org_name,org_slug,category)),contributor:users!edit_proposals_contributor_id_fkey(display_name)",
    )
    .in("status", ["pending", "changes_requested", "needs_rebase"])
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown[]).map(mapProposalSummary);
}

export async function loadProposalDetail(id: string) {
  const admin = createAdminClient();
  const { data: proposal, error } = await admin
    .from("edit_proposals")
    .select(
      "*,pages(id,slug,content_json,current_version_id,organizations(id,university_id,org_name,org_slug,category)),contributor:users!edit_proposals_contributor_id_fkey(display_name)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!proposal) return null;
  const { data: patchsets } = await admin
    .from("edit_proposal_patchsets")
    .select("*")
    .eq("proposal_id", id)
    .order("patchset_number", { ascending: false });
  const normalizedPatchsets = ((patchsets ?? []) as unknown[]).map(mapPatchset);
  return {
    proposal,
    currentPatchset: normalizedPatchsets.find(
      (patchset) => patchset.isCurrent,
    ) ?? null,
    patchsets: normalizedPatchsets,
  };
}

export async function refreshMergeability(id: string): Promise<MergeabilityStatus> {
  const detail = await loadProposalDetail(id);
  if (!detail?.currentPatchset) throw new ProposalError("NOT_FOUND", "Proposal not found.");
  const admin = createAdminClient();
  const page = Array.isArray(detail.proposal.pages)
    ? detail.proposal.pages[0]
    : detail.proposal.pages;
  const currentDoc = page.content_json as ProseMirrorDoc;
  const diffs = (detail.currentPatchset.sectionDiffs ?? []) as SectionDiffEntry[];
  const refreshed = diffs.map((diff) => {
    const currentSection = findSectionBySlug(currentDoc, diff.sectionSlug);
    const status: MergeabilityStatus = !currentSection
      ? "conflict"
      : hashSection(sectionToProseMirrorDoc(currentSection)) === diff.baseSectionHash
        ? "mergeable"
        : "needs_rebase";
    return { ...diff, mergeabilityStatus: status };
  });
  const overall = computeOverallMergeability(refreshed);
  await admin
    .from("edit_proposal_patchsets")
    .update({ section_diffs: serializeSectionDiffs(refreshed) })
    .eq("id", detail.currentPatchset.id);
  await admin
    .from("edit_proposals")
    .update({ mergeability_status: overall })
    .eq("id", id);
  return overall;
}

export async function acceptProposal(id: string, reviewer: CurrentUser) {
  const detail = await loadProposalDetail(id);
  if (!detail?.currentPatchset) throw new ProposalError("NOT_FOUND", "Proposal not found.");
  // Admins are allowed to self-accept; regular reviewers are still blocked
  // from reviewing their own proposals (conflict-of-interest guard).
  if (
    detail.proposal.contributor_id === reviewer.id &&
    reviewer.role !== "admin"
  ) {
    throw new ProposalError("FORBIDDEN", "Reviewers cannot accept their own proposal.");
  }
  if (detail.proposal.status !== "pending") {
    throw new ProposalError("INVALID_STATE", "Only pending proposals can be accepted.");
  }
  const overall = await refreshMergeability(id);
  if (overall !== "mergeable") {
    const admin = createAdminClient();
    await admin
      .from("edit_proposals")
      .update({ status: "needs_rebase", mergeability_status: overall })
      .eq("id", id);
    throw new ProposalError("CONFLICT", "Proposal needs rebase before accept.");
  }

  const admin = createAdminClient();
  const page = Array.isArray(detail.proposal.pages)
    ? detail.proposal.pages[0]
    : detail.proposal.pages;
  const org = Array.isArray(page.organizations)
    ? page.organizations[0]
    : page.organizations;
  let mergedDoc = page.content_json as ProseMirrorDoc;
  const sectionSlugs = detail.proposal.section_slugs as string[];
  const diffs = detail.currentPatchset.sectionDiffs as SectionDiffEntry[];

  // FRD-4 §6.1 step 5: every targeted section must still exist on the live
  // page. Silently skipping a missing slug would commit a "successful"
  // accept that didn't apply the contributor's intended edits.
  for (const diff of diffs) {
    const current = findSectionBySlug(mergedDoc, diff.sectionSlug);
    if (!current) {
      await admin
        .from("edit_proposals")
        .update({ status: "needs_rebase", mergeability_status: "conflict" })
        .eq("id", id);
      throw new ProposalError(
        "CONFLICT",
        `Section "${diff.sectionSlug}" is no longer on the page. Rebase required.`,
      );
    }
    const proposedSection = extractSections(diff.proposedSectionJson)[0];
    if (!proposedSection) {
      throw new ProposalError(
        "VALIDATION_FAILED",
        `Patchset section "${diff.sectionSlug}" has no content.`,
      );
    }
    mergedDoc = replaceSection(
      mergedDoc,
      current,
      preserveOfficialAttributes(current, proposedSection.heading),
      proposedSection.body,
    );
  }

  const isReviewerAffiliated = await isUserAffiliated(reviewer.id, org.id);

  const { data: result, error } = await admin.rpc("accept_proposal_commit", {
    p_proposal_id: id,
    p_page_id: detail.proposal.page_id,
    p_new_content: mergedDoc,
    p_reviewer_id: reviewer.id,
    p_summary: detail.currentPatchset.rationale,
    p_is_admin_seeded: false,
  });
  if (error) {
    logServerError("proposals.accept.rpc", error);
    throw new ProposalError("UNEXPECTED", "Could not accept proposal.");
  }
  const newVersion = Array.isArray(result) ? result[0] : result;

  await admin
    .from("edit_proposals")
    .update({
      last_decision_log: {
        action: "accept",
        reviewer_id: reviewer.id,
        is_reviewer_affiliated: isReviewerAffiliated,
        decided_at: new Date().toISOString(),
      },
    })
    .eq("id", id);

  await logAdminActivity({
    actorId: reviewer.id,
    action: "accept_proposal",
    entityType: "edit_proposal",
    entityId: id,
    summary: "Accepted proposal",
    metadata: { is_reviewer_affiliated: isReviewerAffiliated },
  });

  if (detail.proposal.contributor_id) {
    await emitNotification({
      recipientId: detail.proposal.contributor_id,
      type: "pr.accepted",
      payload: {
        title: "Your proposal was accepted",
        body: "A reviewer accepted your UW Wiki edit proposal.",
        href: `/wiki/${org.org_slug}/proposals/${id}`,
        proposalId: id,
        pageId: detail.proposal.page_id,
        orgSlug: org.org_slug,
      },
    }).catch((err) => logServerError("notifications.pr.accepted", err));
  }

  const { data: rebasedProposals } = await admin
    .from("edit_proposals")
    .select("id,contributor_id")
    .neq("id", id)
    .eq("page_id", detail.proposal.page_id)
    .in("status", ["pending", "changes_requested"])
    .overlaps("section_slugs", sectionSlugs);

  await admin
    .from("edit_proposals")
    .update({ status: "needs_rebase", mergeability_status: "needs_rebase" })
    .neq("id", id)
    .eq("page_id", detail.proposal.page_id)
    .in("status", ["pending", "changes_requested"])
    .overlaps("section_slugs", sectionSlugs);

  for (const proposal of rebasedProposals ?? []) {
    if (!proposal.contributor_id) continue;
    await emitNotification({
      recipientId: proposal.contributor_id,
      type: "pr.needs_rebase",
      payload: {
        title: "Your proposal needs a rebase",
        body: "Another accepted edit changed the same section. Refresh your proposal before review.",
        href: `/wiki/${org.org_slug}/proposals/${proposal.id}`,
        proposalId: proposal.id,
        pageId: detail.proposal.page_id,
        orgSlug: org.org_slug,
      },
    }).catch((err) => logServerError("notifications.pr.needs_rebase", err));
  }

  await reembedSections(
    detail.proposal.page_id,
    sectionSlugs,
    {
      universityId: org.university_id,
      orgId: org.id,
      orgName: org.org_name,
      orgSlug: org.org_slug,
      category: org.category,
      pageVersionId: newVersion?.new_version_id ?? null,
    },
    mergedDoc,
  ).catch((err) => logServerError("proposals.accept.reembed", err));
  await updateAnchorStatusForPage(detail.proposal.page_id, mergedDoc).catch(
    (err) => logServerError("proposals.accept.reanchor", err),
  );

  return {
    pageId: detail.proposal.page_id,
    newVersion,
    isReviewerAffiliated,
  };
}

export class ProposalError extends Error {
  constructor(
    readonly code:
      | "INVALID_CONTENT"
      | "VALIDATION_FAILED"
      | "NOT_FOUND"
      | "CONFLICT"
      | "FORBIDDEN"
      | "INVALID_STATE"
      | "UNEXPECTED",
    message: string,
  ) {
    super(message);
  }
}

async function loadPage(pageId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("pages")
    .select("id,content_json,current_version_id,organizations(id,university_id,org_name,org_slug,category)")
    .eq("id", pageId)
    .maybeSingle();
  if (!data) return null;
  const org = Array.isArray(data.organizations)
    ? data.organizations[0]
    : data.organizations;
  return { ...data, organizations: org };
}

function extractChangedSectionSlugs(
  currentDoc: ProseMirrorDoc,
  proposedDoc: ProseMirrorDoc,
): string[] {
  const current = extractSections(currentDoc);
  const proposed = extractSections(proposedDoc);
  return proposed
    .filter((section) => {
      const match = current.find((base) => base.slug === section.slug);
      return (
        !match ||
        hashSection(sectionToProseMirrorDoc(match)) !==
          hashSection(sectionToProseMirrorDoc(section))
      );
    })
    .map((section) => section.slug);
}

function buildSectionDiffs(
  currentDoc: ProseMirrorDoc,
  proposedDoc: ProseMirrorDoc,
  sectionSlugs: string[],
): SectionDiffEntry[] {
  return sectionSlugs.map((slug) => {
    const original = findSectionBySlug(currentDoc, slug);
    const proposed = findSectionBySlug(proposedDoc, slug);
    if (!proposed) throw new ProposalError("VALIDATION_FAILED", `Missing proposed section ${slug}.`);
    const originalDoc = original ? sectionToProseMirrorDoc(original) : null;
    const proposedDocSection = sectionToProseMirrorDoc(proposed);
    return {
      sectionSlug: slug,
      baseSectionHash: originalDoc ? hashSection(originalDoc) : "",
      originalSectionJson: originalDoc,
      proposedSectionJson: proposedDocSection,
      diffJson: diffSections(originalDoc, proposedDocSection),
      mergeabilityStatus: original ? "mergeable" : "conflict",
    };
  });
}

function serializeSectionDiffs(diffs: SectionDiffEntry[]) {
  return diffs.map((diff) => ({
    section_slug: diff.sectionSlug,
    base_section_hash: diff.baseSectionHash,
    original_section_json: diff.originalSectionJson,
    proposed_section_json: diff.proposedSectionJson,
    diff_json: diff.diffJson,
    mergeability_status: diff.mergeabilityStatus,
  }));
}

function computeOverallMergeability(diffs: SectionDiffEntry[]): MergeabilityStatus {
  if (diffs.length > 0 && diffs.every((diff) => diff.mergeabilityStatus === "conflict")) {
    return "conflict";
  }
  if (diffs.some((diff) => diff.mergeabilityStatus !== "mergeable")) {
    return "needs_rebase";
  }
  return "mergeable";
}

async function isUserAffiliated(userId: string, orgId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("user_affiliations")
    .select("id")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .eq("is_active", true)
    .maybeSingle();
  return !!data;
}

export async function reviewerAffiliationForProposal(
  proposalId: string,
  reviewerId: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("edit_proposals")
    .select("page_id,pages(organizations(id))")
    .eq("id", proposalId)
    .maybeSingle();
  if (!data) return false;
  const page = Array.isArray(data.pages) ? data.pages[0] : data.pages;
  if (!page) return false;
  const org = Array.isArray(page.organizations)
    ? page.organizations[0]
    : page.organizations;
  if (!org?.id) return false;
  return isUserAffiliated(reviewerId, org.id);
}

export async function recordDecisionLog(
  proposalId: string,
  payload: {
    action: "accept" | "reject" | "request_changes" | "withdraw";
    reviewerId: string | null;
    isReviewerAffiliated?: boolean;
    note?: string;
  },
) {
  const admin = createAdminClient();
  await admin
    .from("edit_proposals")
    .update({
      last_decision_log: {
        ...payload,
        decided_at: new Date().toISOString(),
      },
    })
    .eq("id", proposalId);
}

function mapProposalSummary(row: unknown): ProposalSummary {
  const value = row as {
    id: string;
    page_id: string;
    section_slugs: string[];
    status: ProposalSummary["status"];
    mergeability_status: ProposalSummary["mergeabilityStatus"];
    is_anonymous: boolean;
    is_from_affiliated_contributor: boolean;
    rationale: string | null;
    created_at: string;
    pages: { slug: string; organizations: { org_name: string; org_slug: string; category: ProposalSummary["category"] } | Array<{ org_name: string; org_slug: string; category: ProposalSummary["category"] }> } | Array<{ slug: string; organizations: { org_name: string; org_slug: string; category: ProposalSummary["category"] } | Array<{ org_name: string; org_slug: string; category: ProposalSummary["category"] }> }>;
    contributor: { display_name: string | null } | Array<{ display_name: string | null }> | null;
  };
  const page = Array.isArray(value.pages) ? value.pages[0] : value.pages;
  const org = Array.isArray(page.organizations)
    ? page.organizations[0]
    : page.organizations;
  const user = Array.isArray(value.contributor) ? value.contributor[0] : value.contributor;
  return {
    id: value.id,
    pageId: value.page_id,
    pageSlug: page.slug,
    orgName: org.org_name,
    orgSlug: org.org_slug,
    category: org.category,
    sectionSlugs: value.section_slugs ?? [],
    status: value.status,
    mergeabilityStatus: value.mergeability_status,
    isAnonymous: value.is_anonymous,
    isFromAffiliatedContributor: value.is_from_affiliated_contributor,
    contributorDisplayName: value.is_anonymous ? null : user?.display_name ?? null,
    rationale: value.rationale,
    createdAt: value.created_at,
  };
}

function mapPatchset(row: unknown): EditProposalPatchsetRow {
  const value = row as {
    id: string;
    proposal_id: string;
    patchset_number: number;
    base_page_version_id: string;
    section_diffs: Array<{
      section_slug: string;
      base_section_hash: string;
      original_section_json: ProseMirrorDoc | null;
      proposed_section_json: ProseMirrorDoc;
      diff_json: unknown;
      mergeability_status: MergeabilityStatus;
    }>;
    rationale: string;
    is_current: boolean;
    contributor_id: string | null;
    created_at: string;
  };
  return {
    id: value.id,
    proposalId: value.proposal_id,
    patchsetNumber: value.patchset_number,
    basePageVersionId: value.base_page_version_id,
    sectionDiffs: (value.section_diffs ?? []).map((diff) => ({
      sectionSlug: diff.section_slug,
      baseSectionHash: diff.base_section_hash,
      originalSectionJson: diff.original_section_json,
      proposedSectionJson: diff.proposed_section_json,
      diffJson: diff.diff_json,
      mergeabilityStatus: diff.mergeability_status,
    })),
    rationale: value.rationale,
    isCurrent: value.is_current,
    contributorId: value.contributor_id,
    createdAt: value.created_at,
  };
}
