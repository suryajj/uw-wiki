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
    <main className="flex min-h-screen w-full flex-col gap-8 px-6 py-10 md:px-10 lg:px-16">
      <header className="flex flex-col gap-2 border-b border-border pb-6">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">My Bookmarks</h1>
        <p className="text-muted-foreground">Saved wiki pages, newest first.</p>
      </header>
      <div className="flex flex-col">
        {bookmarks.length === 0 ? (
          <div className="border border-dashed border-border p-10 text-center">
            <p className="font-medium text-foreground">No bookmarks yet.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Bookmark wiki pages from their page header to keep them here.
            </p>
          </div>
        ) : (
          bookmarks.map(({ row, page, org }) => (
            <article key={row.page_id} className="flex flex-col gap-2 border-b border-border py-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <Link href={`/wiki/${page!.slug}`} className="text-lg font-medium text-foreground transition-colors duration-150 hover:underline">
                    {org!.org_name}
                  </Link>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{org!.category}</p>
                  {org!.tagline ? (
                    <p className="mt-1 text-sm text-muted-foreground">{org!.tagline}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">
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
