import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatRelativeTime } from "@/lib/utils/time";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  await requireAdmin({ returnTo: "/admin/activity" });
  const { data } = await createAdminClient()
    .from("admin_activity_log")
    .select("id,actor_id,action,entity_type,entity_id,summary,metadata,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  return (
    <main className="mx-auto min-h-screen max-w-5xl p-6 md:p-10">
      <h1 className="text-3xl font-bold">Activity Log</h1>
      <div className="mt-6 space-y-3">
        {(data ?? []).map((row) => (
          <article key={row.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium">{row.action}</p>
              <span className="text-xs text-muted-foreground">
                {formatRelativeTime(row.created_at)}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {row.summary ?? `${row.entity_type} ${row.entity_id ?? ""}`}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Actor: {row.actor_id ?? "system"}</p>
          </article>
        ))}
        {(data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No activity yet.</p> : null}
      </div>
    </main>
  );
}
