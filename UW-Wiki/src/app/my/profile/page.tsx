import Link from "next/link";

import { requireUser } from "@/lib/auth/guards";
import { ensureNotificationPreferences } from "@/lib/notifications/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatRelativeTime } from "@/lib/utils/time";
import type { ProposalStatus } from "@/types/domain";
import { AffiliationManager, NotificationPreferencesForm } from "./profile-ui";

export default async function ProfilePage() {
  const user = await requireUser({ returnTo: "/my/profile" });
  const admin = createAdminClient();
  const [
    { data: orgs },
    { data: affiliations },
    notificationPreferences,
    { data: proposalsData },
  ] = await Promise.all([
    admin
      .from("organizations")
      .select("id,org_name,org_slug,category")
      .order("org_name", { ascending: true }),
    admin
      .from("user_affiliations")
      .select("id,role_label,is_active,organizations(id,org_name,org_slug,category)")
      .eq("user_id", user.id)
      .eq("is_active", true),
    ensureNotificationPreferences(user.id),
    admin
      .from("edit_proposals")
      .select(
        "id,status,section_slugs,rationale,created_at,updated_at,pages(slug,organizations(org_name,org_slug,category))",
      )
      .eq("contributor_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const proposals = (proposalsData ?? [])
    .map((row) => {
      const page = Array.isArray(row.pages) ? row.pages[0] : row.pages;
      const org = Array.isArray(page?.organizations)
        ? page?.organizations[0]
        : page?.organizations;
      return { row, page, org };
    })
    .filter((item) => item.page && item.org);

  return (
    <main className="flex min-h-screen w-full flex-col gap-6 px-6 py-6 md:px-10 lg:px-16">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Personal Profile
        </h1>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <AffiliationManager orgs={orgs ?? []} initialAffiliations={affiliations ?? []} />
        <NotificationPreferencesForm initialPreferences={notificationPreferences} />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Contributions
        </h2>
        <div className="flex flex-col">
          {proposals.length === 0 ? (
            <div className="border border-dashed border-border p-6 text-center">
              <p className="font-medium text-foreground">No attributed proposals yet.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Propose an edit while signed in to track it here.
              </p>
            </div>
          ) : (
            proposals.map(({ row, page, org }) => (
              <article
                key={row.id}
                className="flex flex-col gap-1.5 py-3 first:pt-0"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-col gap-0.5">
                    <Link
                      href={`/wiki/${page!.slug}/proposals/${row.id}`}
                      className="text-base font-medium text-foreground transition-colors duration-150 hover:underline"
                    >
                      {org!.org_name}
                    </Link>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      Sections · {(row.section_slugs ?? []).join(", ") || "General"}
                    </p>
                    {row.rationale ? (
                      <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
                        {row.rationale}
                      </p>
                    ) : null}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Submitted {formatRelativeTime(row.created_at)}
                    </p>
                  </div>
                  <StatusBadge status={row.status as ProposalStatus} />
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

function StatusBadge({ status }: { status: ProposalStatus }) {
  return (
    <span className="rounded-full border border-border px-2.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
      {status.replace("_", " ")}
    </span>
  );
}
