import { DirectorySearch } from "@/components/directory/directory-search";
import { DirectoryView } from "@/components/directory/directory-view";
import { HeroText } from "@/components/home/hero-text";
import { listDirectoryOrgs } from "@/lib/wiki/data";

export default async function HomePage() {
  const orgs = await listDirectoryOrgs();

  return (
    <main className="flex min-h-screen w-full flex-col gap-10 px-6 py-10 md:px-10 lg:px-16">
      <header className="flex flex-col gap-6 pt-4">
        <HeroText />
      </header>

      <DirectorySearch />
      <DirectoryView orgs={orgs} />
    </main>
  );
}
