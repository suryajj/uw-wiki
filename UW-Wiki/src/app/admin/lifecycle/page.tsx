import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { LifecycleEditor } from "./ui";

export const dynamic = "force-dynamic";

export default async function LifecyclePage() {
  await requireAdmin({ returnTo: "/admin/lifecycle" });
  const { data } = await createAdminClient()
    .from("lifecycle_config")
    .select("category,needs_update_days,stale_days,defunct_days")
    .order("category", { ascending: true });
  return (
    <main className="flex min-h-screen w-full flex-col gap-6 px-6 py-10 md:px-10 lg:px-16">
      <h1 className="text-3xl font-bold">Lifecycle Config</h1>
      <LifecycleEditor rows={data ?? []} />
    </main>
  );
}
