import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BookmarkButton } from "@/components/bookmarks/bookmark-button";
import { Button } from "@/components/ui/button";
import { LifecycleBanner } from "@/components/wiki/lifecycle-banner";
import { PulseSidebar } from "@/components/wiki/pulse-sidebar";
import { TableOfContents, type TocEntry } from "@/components/wiki/table-of-contents";
import { WikiArticleShell } from "@/components/wiki/wiki-article-shell";
import { getBookmarkState } from "@/lib/actions/bookmarks";
import { getCurrentUser } from "@/lib/auth/current-user";
import { extractPlainText, extractSections } from "@/lib/prosemirror/sections";
import { formatRelativeTime } from "@/lib/utils/time";
import { getWikiPage } from "@/lib/wiki/data";

// FRD-2 §2.5/§2.6 + CONSTRAINTS §8: the wiki page is the SEO-critical route
// and must be SSR-fresh.
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getWikiPage(slug);
  if (!page) return { title: "Page not found -- UW Wiki" };
  const sections = extractSections(page.contentJson);
  const overview =
    sections.find((section) => section.slug === "overview") ?? sections[0];
  const description = overview
    ? extractPlainText({ type: "doc", content: overview.body }).slice(0, 160)
    : `Student-sourced information about ${page.orgName} at the University of Waterloo.`;

  return {
    title: `${page.orgName} -- UW Wiki`,
    description,
    openGraph: {
      title: `${page.orgName} -- UW Wiki`,
      description,
    },
  };
}

export default async function WikiPage({ params }: PageProps) {
  const { slug } = await params;
  const page = await getWikiPage(slug);
  if (!page) notFound();
  const user = await getCurrentUser();
  const bookmarkState = await getBookmarkState(user?.id ?? null, page.pageId);

  const sections = extractSections(page.contentJson);
  const tocEntries: TocEntry[] = [];
  for (const section of sections) {
    tocEntries.push({ id: section.slug, title: section.title, level: 2 });
    for (const child of section.body) {
      if (
        child.type === "heading" &&
        child.attrs?.level === 3 &&
        typeof child.attrs?.slug === "string" &&
        child.attrs.slug
      ) {
        tocEntries.push({
          id: child.attrs.slug as string,
          title: extractPlainText(child),
          level: 3,
        });
      }
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 p-6 md:p-10">
      <header className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-primary/40 px-2 py-0.5 text-xs text-primary">
              {page.category}
            </span>
            {page.isAdminSeeded ? (
              <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                Admin seeded
              </span>
            ) : null}
          </div>
          <h1 className="text-4xl font-bold tracking-tight">{page.orgName}</h1>
          {page.tagline ? (
            <p className="mt-2 text-muted-foreground">{page.tagline}</p>
          ) : null}
          <p className="mt-2 text-sm text-muted-foreground">
            Last updated {formatRelativeTime(page.lastModifiedAt)}
          </p>
        </div>
        <div className="flex gap-2">
          <BookmarkButton
            pageId={page.pageId}
            initialState={bookmarkState}
            isSignedIn={!!user}
            returnTo={`/wiki/${page.pageSlug}`}
          />
          <Button asChild variant="outline">
            <Link href={`/wiki/${page.pageSlug}/history`}>View History</Link>
          </Button>
        </div>
      </header>

      {page.isColdStart ? (
        <div className="rounded-lg border border-yellow-600 bg-yellow-950/30 p-4 text-sm">
          This content was AI-generated and is pending human review. Propose an
          edit to improve it.
        </div>
      ) : null}

      <LifecycleBanner
        status={page.lifecycleStatus}
        config={page.lifecycleConfig}
        onProposeHref="#wiki-content"
      />

      <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)_300px]">
        {/* Mobile-first ordering: Pulse sidebar appears below the content
            on screens <1024px (FRD-2 §2.2 collapsed layout) and the TOC
            collapses to a dropdown rendered inside the table-of-contents
            component itself. */}
        <TableOfContents entries={tocEntries} />
        <WikiArticleShell
          pageId={page.pageId}
          pageVersionId={page.currentVersionId}
          initialContent={page.contentJson}
        />
        <div className="lg:order-none order-first">
          <PulseSidebar
            orgId={page.orgId}
            aggregates={page.pulseAggregates}
            healthStatus={page.lifecycleStatus}
            externalLinks={page.externalLinks}
          />
        </div>
      </div>
    </main>
  );
}
