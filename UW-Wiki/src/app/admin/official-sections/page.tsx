import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { OfficialSeeder } from "./ui";

export const dynamic = "force-dynamic";

export default async function OfficialSectionsPage() {
  await requireAdmin({ returnTo: "/admin/official-sections" });
  const { data: orgs } = await createAdminClient()
    .from("organizations")
    .select("id,org_name,org_slug,category")
    .order("org_name", { ascending: true });
  return (
    <main className="flex min-h-screen w-full flex-col gap-6 px-6 py-10 md:px-10 lg:px-16">
      <h1 className="text-3xl font-bold">Official Section Seeder</h1>
      <p className="mt-2 text-muted-foreground">
        Seed or replace an inline Official H2 section for an organization page.
      </p>
      <OfficialSeeder orgs={orgs ?? []} />
    </main>
  );
}
