import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { formatLongDate } from "@/lib/utils/time";
import { getPageVersionHistory, getWikiPage } from "@/lib/wiki/data";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function WikiHistoryPage({ params }: PageProps) {
  const { slug } = await params;
  const page = await getWikiPage(slug);
  if (!page) notFound();
  const versions = await getPageVersionHistory(page.pageId);

  return (
    <main className="flex min-h-screen w-full flex-col gap-6 px-6 py-10 md:px-10 lg:px-16">
      <header className="flex items-start justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="text-sm text-muted-foreground">{page.orgName}</p>
          <h1 className="text-3xl font-bold">Version History</h1>
        </div>
        <Button asChild variant="outline">
          <Link href={`/wiki/${page.pageSlug}`}>Back to page</Link>
        </Button>
      </header>

      <section className="space-y-3">
        {versions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No versions yet.</p>
        ) : (
          versions.map((version) => (
            <article
              key={version.id}
              className="rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold">v{version.versionNumber}</h2>
                <span className="text-xs text-muted-foreground">
                  {formatLongDate(version.createdAt)}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {truncate(version.summary ?? "No summary provided.", 100)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {version.isAnonymous
                  ? "Anonymous contributor"
                  : version.contributorDisplayName ?? "Unknown contributor"}
                {version.isAdminSeeded ? " · admin seeded" : ""}
                {version.isColdStart ? " · AI-generated" : ""}
              </p>
            </article>
          ))
        )}
      </section>
    </main>
  );
}

// FRD-2 §8.3: history rows show summaries truncated to 100 characters.
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}
