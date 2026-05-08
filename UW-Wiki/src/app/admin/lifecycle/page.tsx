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
    <main className="mx-auto min-h-screen max-w-5xl p-6 md:p-10">
      <h1 className="text-3xl font-bold">Lifecycle Config</h1>
      <LifecycleEditor rows={data ?? []} />
    </main>
  );
}
