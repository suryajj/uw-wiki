import { DirectoryView } from "@/components/directory/directory-view";
import { listDirectoryOrgs } from "@/lib/wiki/data";

export const dynamic = "force-dynamic";

export default async function OrgsPage() {
  const orgs = await listDirectoryOrgs();

  return (
    <main className="flex min-h-screen w-full flex-col gap-10 px-6 py-10 md:px-10 lg:px-16">
      <header className="flex flex-col gap-2 pt-4">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Teams &amp; Organizations
        </h1>
        <p className="text-sm text-muted-foreground">
          Browse UW design teams, engineering clubs, and other campus orgs.
        </p>
      </header>

      <DirectoryView orgs={orgs} />
    </main>
  );
}
