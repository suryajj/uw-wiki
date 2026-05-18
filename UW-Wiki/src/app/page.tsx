import { DirectoryView } from "@/components/directory/directory-view";
import { SearchHero } from "@/components/home/search-hero";
import { listDirectoryOrgs } from "@/lib/wiki/data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const orgs = await listDirectoryOrgs();

  // The browse-orgs section is passed as a prop into <SearchHero> so the
  // client component can conditionally render it: visible on the empty hero,
  // hidden once the user starts a RAG conversation (so the answer view owns
  // the page). Server-rendered HTML is preserved — only the visibility flips.
  return (
    <main className="flex w-full flex-col">
      <SearchHero
        browseSection={
          <section
            id="browse-orgs"
            className="flex flex-col gap-6 border-t border-border px-6 py-16 md:px-10 lg:px-16 scroll-mt-20"
          >
            <header className="flex flex-col items-center gap-2 text-center">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                Browse organizations
              </h2>
              <p className="text-sm text-muted-foreground">
                Every UW design team, club, and program in the wiki.
              </p>
            </header>
            <DirectoryView orgs={orgs} />
          </section>
        }
      />
    </main>
  );
}
