import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BookmarkButton } from "@/components/bookmarks/bookmark-button";
import {
  ProposeEditButton,
  ViewHistoryButton,
} from "@/components/wiki/article-header-actions";
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
    <main className="flex min-h-screen w-full flex-col px-6 py-8 md:px-10 lg:px-16">
      <div className="grid w-full gap-12 lg:grid-cols-[200px_minmax(0,1fr)]">
        {/* Left section nav (Grokipedia style) */}
        <aside className="lg:order-1">
          <TableOfContents entries={tocEntries} />
        </aside>

        {/* Article column — Pulse floats inside so body text wraps under it */}
        <article className="min-w-0 lg:order-2">
          <p className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="19.07" x2="19.07" y2="4.93" />
            </svg>
            <span>Last updated {formatRelativeTime(page.lastModifiedAt)}</span>
          </p>

          <header className="mb-6 flex items-start justify-between gap-4">
            <h1 className="flex-1 text-5xl font-semibold tracking-tight text-foreground">
              {page.orgName}
            </h1>
            <div className="flex shrink-0 items-center gap-1.5 pt-2">
              <BookmarkButton
                pageId={page.pageId}
                initialState={bookmarkState}
                isSignedIn={!!user}
                returnTo={`/wiki/${page.pageSlug}`}
              />
              <ViewHistoryButton href={`/wiki/${page.pageSlug}/history`} />
              <ProposeEditButton />
            </div>
          </header>

          {/* Float Pulse to the right so article text wraps beneath it */}
          <aside className="mb-4 w-full lg:float-right lg:ml-8 lg:w-[320px]">
            <PulseSidebar
              orgId={page.orgId}
              aggregates={page.pulseAggregates}
              externalLinks={page.externalLinks}
              category={page.category}
              isAdminSeeded={page.isAdminSeeded}
            />
          </aside>

          <LifecycleBanner
            status={page.lifecycleStatus}
            config={page.lifecycleConfig}
            onProposeHref="#wiki-content"
          />

          <WikiArticleShell
            pageId={page.pageId}
            pageVersionId={page.currentVersionId}
            initialContent={page.contentJson}
          />
        </article>
      </div>
    </main>
  );
}
