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
    <main className="flex min-h-screen w-full flex-col gap-8 px-6 py-10 md:px-10 lg:px-16">
      <header className="flex flex-col gap-2 border-b border-border pb-6">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">My Contributions</h1>
        <p className="text-muted-foreground">Your attributed edit proposals and review status.</p>
      </header>
      <div className="flex flex-col">
        {proposals.length === 0 ? (
          <div className="border border-dashed border-border p-10 text-center">
            <p className="font-medium text-foreground">No attributed proposals yet.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Propose an edit while signed in to track it here.
            </p>
          </div>
        ) : (
          proposals.map(({ row, page, org }) => (
            <article key={row.id} className="flex flex-col gap-2 border-b border-border py-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <Link
                    href={`/wiki/${page!.slug}/proposals/${row.id}`}
                    className="text-lg font-medium text-foreground transition-colors duration-150 hover:underline"
                  >
                    {org!.org_name}
                  </Link>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Sections · {(row.section_slugs ?? []).join(", ") || "General"}
                  </p>
                  {row.rationale ? (
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{row.rationale}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">
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
  return (
    <span className="rounded-full border border-border px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
      {status.replace("_", " ")}
    </span>
  );
}
