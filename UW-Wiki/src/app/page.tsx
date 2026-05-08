import { DirectorySearch } from "@/components/directory/directory-search";
import { DirectoryView } from "@/components/directory/directory-view";
import { listDirectoryOrgs } from "@/lib/wiki/data";

export default async function HomePage() {
  const orgs = await listDirectoryOrgs();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 p-6 md:p-10">
      <header className="flex flex-col gap-3">
        <h1 className="text-5xl font-bold tracking-tight text-primary">
          UW Wiki
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Honest, student-edited knowledge base for UW extracurriculars,
          design teams, societies, clubs, and campus organizations.
        </p>
      </header>

      <DirectorySearch />
      <DirectoryView orgs={orgs} />
    </main>
  );
}
