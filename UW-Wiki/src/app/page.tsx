import { DirectoryView } from "@/components/directory/directory-view";
import { SearchHero } from "@/components/home/search-hero";
import { listDirectoryOrgs } from "@/lib/wiki/data";

export default async function HomePage() {
  const orgs = await listDirectoryOrgs();

  return (
    <main className="flex w-full flex-col">
      <SearchHero />

      <section className="flex flex-col gap-6 border-t border-border px-6 py-16 md:px-10 lg:px-16">
        <header className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Browse organizations
          </h2>
          <p className="text-sm text-muted-foreground">
            Every UW design team, club, and program in the wiki.
          </p>
        </header>
        <DirectoryView orgs={orgs} />
      </section>
    </main>
  );
}
