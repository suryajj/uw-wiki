import { notFound } from "next/navigation";

import { requireReviewer } from "@/lib/auth/guards";
import {
  loadProposalDetail,
  reviewerAffiliationForProposal,
} from "@/lib/proposals/service";

import { ReviewerActions } from "./reviewer-actions";

type PageProps = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export default async function ReviewDetailPage({ params }: PageProps) {
  const { id } = await params;
  const reviewer = await requireReviewer({ returnTo: `/admin/reviews/${id}` });
  const detail = await loadProposalDetail(id);
  if (!detail) notFound();

  const proposal = detail.proposal;
  const patchset = detail.currentPatchset;
  const sectionDiffs = (patchset?.sectionDiffs ?? []) as Array<{
    sectionSlug: string;
    mergeabilityStatus: string;
    // `originalSectionJson === null` → addition (no live counterpart).
    // `proposedSectionJson === null` → deletion (contributor removed the
    // section entirely). Both nulls would be malformed and rejected by
    // the server, so they can't reach this surface.
    originalSectionJson: unknown | null;
    proposedSectionJson: unknown | null;
    diffJson: Array<{ kind: string; text: string }>;
  }>;

  const isReviewerAffiliated = await reviewerAffiliationForProposal(id, reviewer.id);
  // Admins can self-accept (their decision is logged as affiliated when
  // appropriate). Regular reviewers are still blocked from reviewing their own
  // proposals — a basic conflict-of-interest guard.
  const isAdmin = reviewer.role === "admin";
  const isOwnProposal = proposal.contributor_id === reviewer.id;
  const isBlockedSelfReview = isOwnProposal && !isAdmin;
  const overallMergeable = proposal.mergeability_status === "mergeable";

  return (
    <main className="flex min-h-screen w-full flex-col gap-6 px-6 py-10 md:px-10 lg:px-16">
      <h1 className="text-3xl font-bold">Proposal Review</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Status: {proposal.status} · Mergeability: {proposal.mergeability_status}
      </p>

      {isReviewerAffiliated ? (
        <div className="mt-6 rounded-lg border border-border bg-[color:var(--surface-2)] p-4 text-sm">
          <p className="font-medium text-foreground">
            You are affiliated with this organization.
          </p>
          <p className="mt-1 text-muted-foreground">
            Your decision will be logged with your affiliation status. All
            actions remain enabled per FRD-4 §5.3 (disclosure-only).
          </p>
        </div>
      ) : null}

      {isOwnProposal && isAdmin ? (
        <div className="mt-6 rounded-lg border border-border bg-[color:var(--surface-2)] p-4 text-sm text-muted-foreground">
          You authored this proposal. As an admin, you can still accept,
          reject, or request changes — your decision will be logged.
        </div>
      ) : null}
      {isBlockedSelfReview ? (
        <div className="mt-6 rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          You authored this proposal. Reviewer actions are disabled.
        </div>
      ) : null}

      <ReviewerActions
        proposalId={id}
        canAct={!isBlockedSelfReview}
        // Accept whenever the proposal is in an actionable state AND fully
        // mergeable. `changes_requested` is a soft pause — if the
        // contributor (or a rebase) brings the proposal back to mergeable,
        // the admin should be able to land it without first asking the
        // contributor to re-submit.
        canAccept={
          !isBlockedSelfReview &&
          (proposal.status === "pending" || proposal.status === "changes_requested") &&
          overallMergeable
        }
        canRequestChanges={!isBlockedSelfReview && proposal.status === "pending"}
        canReject={
          !isBlockedSelfReview &&
          (proposal.status === "pending" || proposal.status === "changes_requested")
        }
      />

      <section className="mt-6 space-y-4">
        {sectionDiffs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No current patchset found.</p>
        ) : (
          sectionDiffs.map((diff) => (
            <article
              key={diff.sectionSlug}
              className="rounded-lg border border-border bg-card p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="font-semibold">{diff.sectionSlug}</h2>
                <div className="flex items-center gap-2">
                  {diff.proposedSectionJson === null ? (
                    <span className="inline-flex items-center rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-destructive">
                      Will delete
                    </span>
                  ) : diff.originalSectionJson === null ? (
                    <span className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-emerald-500">
                      New section
                    </span>
                  ) : null}
                  <MergeabilityBadge status={diff.mergeabilityStatus} />
                </div>
              </div>
              <p className="text-sm leading-6">
                {(diff.diffJson ?? []).map((segment, index) => (
                  <span
                    key={`${segment.kind}-${index}`}
                    className={
                      segment.kind === "added"
                        ? "bg-green-900/40 text-green-100"
                        : segment.kind === "removed"
                          ? "bg-red-900/40 text-red-100 line-through"
                          : ""
                    }
                  >
                    {segment.text}
                  </span>
                ))}
              </p>
            </article>
          ))
        )}
      </section>
    </main>
  );
}

function MergeabilityBadge({ status }: { status: string }) {
  const className =
    status === "mergeable"
      ? "border-green-600 text-green-300"
      : status === "needs_rebase"
        ? "border-border text-muted-foreground"
        : status === "conflict"
          ? "border-red-600 text-red-300"
          : "border-border text-muted-foreground";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs ${className}`}>
      {status}
    </span>
  );
}
