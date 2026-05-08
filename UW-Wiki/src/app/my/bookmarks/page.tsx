import Link from "next/link";

import { RemoveBookmarkButton } from "@/components/bookmarks/remove-bookmark-button";
import { requireUser } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatRelativeTime } from "@/lib/utils/time";

export default async function MyBookmarksPage() {
  const user = await requireUser({ returnTo: "/my/bookmarks" });
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("bookmarks")
    .select(
      "page_id,created_at,pages(id,slug,last_modified_at,organizations(org_name,org_slug,category,tagline))",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const bookmarks = (data ?? []).map((row) => {
    const page = Array.isArray(row.pages) ? row.pages[0] : row.pages;
    const org = Array.isArray(page?.organizations)
      ? page?.organizations[0]
      : page?.organizations;
    return { row, page, org };
  }).filter((item) => item.page && item.org);

  return (
    <main className="mx-auto min-h-screen max-w-4xl p-6 md:p-10">
      <h1 className="text-3xl font-bold">My Bookmarks</h1>
      <p className="mt-2 text-muted-foreground">Saved wiki pages, newest first.</p>
      <div className="mt-6 space-y-3">
        {bookmarks.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6">
            <p className="font-medium">No bookmarks yet.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Bookmark wiki pages from their page header to keep them here.
            </p>
          </div>
        ) : (
          bookmarks.map(({ row, page, org }) => (
            <article key={row.page_id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link href={`/wiki/${page!.slug}`} className="text-lg font-semibold hover:underline">
                    {org!.org_name}
                  </Link>
                  <p className="mt-1 text-sm text-muted-foreground">{org!.category}</p>
                  {org!.tagline ? (
                    <p className="mt-2 text-sm text-muted-foreground">{org!.tagline}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Bookmarked {formatRelativeTime(row.created_at)} · Last edited{" "}
                    {formatRelativeTime(page!.last_modified_at)}
                  </p>
                </div>
                <RemoveBookmarkButton pageId={row.page_id} />
              </div>
            </article>
          ))
        )}
      </div>
    </main>
  );
}
