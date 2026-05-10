import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatRelativeTime } from "@/lib/utils/time";
import { RerunButton } from "./rerun-button";

export const dynamic = "force-dynamic";

export default async function ColdStartJobsPage() {
  await requireAdmin({ returnTo: "/admin/cold-start/jobs" });
  const admin = createAdminClient();
  const { data } = await admin
    .from("cold_start_jobs")
    .select("id,input_text,status,current_step,error,created_at,completed_at,org_metadata")
    .order("created_at", { ascending: false })
    .limit(50);
  const jobs = data ?? [];
  return (
    <main className="flex min-h-screen w-full flex-col gap-6 px-6 py-10 md:px-10 lg:px-16">
      <h1 className="text-3xl font-bold">Cold Start Jobs</h1>
      <div className="mt-6 space-y-3">
        {jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No jobs yet.</p>
        ) : (
          jobs.map((job) => {
            const org = job.org_metadata as { name?: string } | null;
            return (
              <article key={job.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{org?.name ?? job.input_text}</p>
                    <p className="text-sm text-muted-foreground">
                      {job.status} · {job.current_step ?? "no step"} · {formatRelativeTime(job.created_at)}
                    </p>
                  </div>
                  <RerunButton jobId={job.id} disabled={job.status !== "failed"} />
                </div>
                {job.error ? <p className="mt-2 text-sm text-destructive">{job.error}</p> : null}
              </article>
            );
          })
        )}
      </div>
    </main>
  );
}
