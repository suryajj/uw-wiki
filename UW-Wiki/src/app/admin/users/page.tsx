import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { UsersAdmin } from "./ui";

export const dynamic = "force-dynamic";

export default async function UsersAdminPage() {
  await requireAdmin({ returnTo: "/admin/users" });
  const admin = createAdminClient();
  const [{ data: users }, { data: orgs }] = await Promise.all([
    admin.from("users").select("id,email,display_name,role,created_at").order("created_at", { ascending: false }).limit(100),
    admin.from("organizations").select("id,org_name,category").order("org_name", { ascending: true }),
  ]);
  return (
    <main className="flex min-h-screen w-full flex-col gap-6 px-6 py-10 md:px-10 lg:px-16">
      <h1 className="text-3xl font-bold">Users</h1>
      <UsersAdmin users={users ?? []} orgs={orgs ?? []} />
    </main>
  );
}
