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
  const reviewer = await requireReviewer();
  const { id } = await params;
  const detail = await loadProposalDetail(id);
  if (!detail) notFound();

  const proposal = detail.proposal;
  const patchset = detail.currentPatchset;
  const sectionDiffs = (patchset?.sectionDiffs ?? []) as Array<{
    sectionSlug: string;
    mergeabilityStatus: string;
    diffJson: Array<{ kind: string; text: string }>;
  }>;

  const isReviewerAffiliated = await reviewerAffiliationForProposal(id, reviewer.id);
  const isOwnProposal = proposal.contributor_id === reviewer.id;
  const overallMergeable = proposal.mergeability_status === "mergeable";

  return (
    <main className="mx-auto min-h-screen max-w-5xl p-6 md:p-10">
      <h1 className="text-3xl font-bold">Proposal Review</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Status: {proposal.status} · Mergeability: {proposal.mergeability_status}
      </p>

      {isReviewerAffiliated ? (
        <div className="mt-6 rounded-lg border border-yellow-600 bg-yellow-950/20 p-4 text-sm">
          <p className="font-medium text-yellow-400">
            You are affiliated with this organization.
          </p>
          <p className="mt-1 text-yellow-200/80">
            Your decision will be logged with your affiliation status. All
            actions remain enabled per FRD-4 §5.3 (disclosure-only).
          </p>
        </div>
      ) : null}

      {isOwnProposal ? (
        <div className="mt-6 rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          You authored this proposal. Reviewer actions are disabled.
        </div>
      ) : null}

      <ReviewerActions
        proposalId={id}
        canAct={!isOwnProposal}
        canAccept={!isOwnProposal && proposal.status === "pending" && overallMergeable}
        canRequestChanges={!isOwnProposal && proposal.status === "pending"}
        canReject={
          !isOwnProposal &&
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
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold">{diff.sectionSlug}</h2>
                <MergeabilityBadge status={diff.mergeabilityStatus} />
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
        ? "border-yellow-600 text-yellow-300"
        : status === "conflict"
          ? "border-red-600 text-red-300"
          : "border-border text-muted-foreground";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs ${className}`}>
      {status}
    </span>
  );
}
