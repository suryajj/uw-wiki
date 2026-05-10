import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/guards";
import { loadProposalDetail } from "@/lib/proposals/service";
import { formatLongDate } from "@/lib/utils/time";

type PageProps = { params: Promise<{ slug: string; id: string }> };

export const dynamic = "force-dynamic";

export default async function ContributorProposalPage({ params }: PageProps) {
  const user = await requireUser();
  const { slug, id } = await params;
  const detail = await loadProposalDetail(id);
  if (!detail) notFound();
  const proposal = detail.proposal;
  const page = Array.isArray(proposal.pages) ? proposal.pages[0] : proposal.pages;
  if (!page || page.slug !== slug) notFound();
  const canView =
    proposal.contributor_id === user.id ||
    user.role === "reviewer" ||
    user.role === "admin";
  if (!canView) redirect(`/wiki/${slug}`);

  const sectionDiffs = (detail.currentPatchset?.sectionDiffs ?? []) as Array<{
    sectionSlug: string;
    mergeabilityStatus: string;
    diffJson: Array<{ kind: string; text: string }>;
  }>;

  return (
    <main className="flex min-h-screen w-full flex-col gap-6 px-6 py-10 md:px-10 lg:px-16">
      <Button asChild variant="ghost">
        <Link href="/my/contributions">Back to Contributions</Link>
      </Button>
      <h1 className="mt-4 text-3xl font-bold">Proposal Status</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Status: {proposal.status} · Mergeability: {proposal.mergeability_status} · Submitted{" "}
        {formatLongDate(proposal.created_at)}
      </p>
      {proposal.reviewer_comment ? (
        <section className="mt-6 rounded-lg border border-border bg-card p-4">
          <h2 className="font-semibold">Reviewer Comment</h2>
          <p className="mt-2 text-sm text-muted-foreground">{proposal.reviewer_comment}</p>
        </section>
      ) : null}
      <section className="mt-6 space-y-4">
        {sectionDiffs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No current patchset found.</p>
        ) : (
          sectionDiffs.map((diff) => (
            <article key={diff.sectionSlug} className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">{diff.sectionSlug}</h2>
                <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  {diff.mergeabilityStatus}
                </span>
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
