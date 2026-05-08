import Link from "next/link";

import { requireUser } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatRelativeTime } from "@/lib/utils/time";
import type { ProposalStatus } from "@/types/domain";

export default async function MyContributionsPage() {
  const user = await requireUser({ returnTo: "/my/contributions" });
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("edit_proposals")
    .select(
      "id,status,section_slugs,rationale,created_at,updated_at,pages(slug,organizations(org_name,org_slug,category))",
    )
    .eq("contributor_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const proposals = (data ?? []).map((row) => {
    const page = Array.isArray(row.pages) ? row.pages[0] : row.pages;
    const org = Array.isArray(page?.organizations)
      ? page?.organizations[0]
      : page?.organizations;
    return { row, page, org };
  }).filter((item) => item.page && item.org);

  return (
    <main className="mx-auto min-h-screen max-w-5xl p-6 md:p-10">
      <h1 className="text-3xl font-bold">My Contributions</h1>
      <p className="mt-2 text-muted-foreground">Your attributed edit proposals and review status.</p>
      <div className="mt-6 space-y-3">
        {proposals.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6">
            <p className="font-medium">No attributed proposals yet.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Propose an edit while signed in to track it here.
            </p>
          </div>
        ) : (
          proposals.map(({ row, page, org }) => (
            <article key={row.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/wiki/${page!.slug}/proposals/${row.id}`}
                    className="text-lg font-semibold hover:underline"
                  >
                    {org!.org_name}
                  </Link>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Sections: {(row.section_slugs ?? []).join(", ") || "General"}
                  </p>
                  {row.rationale ? (
                    <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{row.rationale}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Submitted {formatRelativeTime(row.created_at)}
                  </p>
                </div>
                <StatusBadge status={row.status as ProposalStatus} />
              </div>
            </article>
          ))
        )}
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: ProposalStatus }) {
  const className =
    status === "accepted"
      ? "border-green-600 text-green-300"
      : status === "rejected" || status === "withdrawn"
        ? "border-red-600 text-red-300"
        : status === "changes_requested" || status === "needs_rebase"
          ? "border-yellow-600 text-yellow-300"
          : "border-blue-600 text-blue-300";
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${className}`}>
      {status.replace("_", " ")}
    </span>
  );
}
