import Link from "next/link";

import { requireReviewer } from "@/lib/auth/guards";
import { listProposalQueue } from "@/lib/proposals/service";
import { formatRelativeTime } from "@/lib/utils/time";

export default async function ReviewsPage() {
  await requireReviewer({ returnTo: "/admin/reviews" });
  const proposals = await listProposalQueue();

  return (
    <main className="flex min-h-screen w-full flex-col gap-6 px-6 py-10 md:px-10 lg:px-16">
      <h1 className="text-3xl font-bold">Reviewer Queue</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Section-scoped proposals are ordered FIFO with mergeability badges.
      </p>
      <div className="mt-6 space-y-3">
        {proposals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending proposals.</p>
        ) : (
          proposals.map((proposal) => (
            <Link
              key={proposal.id}
              href={`/admin/reviews/${proposal.id}`}
              className="block rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{proposal.orgName}</p>
                  <p className="text-sm text-muted-foreground">
                    Sections: {proposal.sectionSlugs.join(", ")}
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>{proposal.status}</p>
                  <p>{proposal.mergeabilityStatus}</p>
                  <p>{formatRelativeTime(proposal.createdAt)}</p>
                </div>
              </div>
              {proposal.isFromAffiliatedContributor ? (
                <p className="mt-2 text-xs text-primary">
                  Submitted by affiliated contributor
                </p>
              ) : null}
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
