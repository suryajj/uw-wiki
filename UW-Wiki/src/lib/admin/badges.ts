import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export async function getAdminBadgeCounts() {
  const admin = createAdminClient();
  const [proposals, reports, jobs] = await Promise.all([
    admin
      .from("edit_proposals")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "changes_requested"]),
    admin
      .from("comment_reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    admin
      .from("cold_start_jobs")
      .select("id", { count: "exact", head: true })
      .in("status", ["failed", "ready_for_preview"]),
  ]);

  return {
    proposals: proposals.count ?? 0,
    reports: reports.count ?? 0,
    coldStart: jobs.count ?? 0,
  };
}
