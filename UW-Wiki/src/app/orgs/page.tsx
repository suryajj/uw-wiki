import { DirectoryView } from "@/components/directory/directory-view";
import { listDirectoryOrgs } from "@/lib/wiki/data";

export const dynamic = "force-dynamic";

export default async function OrgsPage() {
  const orgs = await listDirectoryOrgs();

  return (
    <main className="flex min-h-screen w-full flex-col gap-10 px-6 py-10 md:px-10 lg:px-16">
      <header className="flex flex-col items-center gap-2 pt-4 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Articles
        </h1>
        <p className="text-sm text-muted-foreground">
          Every UW design team, club, and university program in the wiki.
        </p>
      </header>

      <DirectoryView orgs={orgs} />
    </main>
  );
}
