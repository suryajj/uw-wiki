import { requireReviewer } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatRelativeTime } from "@/lib/utils/time";

import { ReportActions } from "./report-actions";

type ReportRow = {
  id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  comments: { id: string; body: string; is_hidden: boolean } | null;
};

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  await requireReviewer();
  const admin = createAdminClient();
  const { data } = await admin
    .from("comment_reports")
    .select("id,reason,details,status,created_at,comments(id,body,is_hidden)")
    .order("created_at", { ascending: false });
  const reports = ((data ?? []) as unknown as Array<
    Omit<ReportRow, "comments"> & {
      comments: ReportRow["comments"] | ReportRow["comments"][];
    }
  >).map((report) => ({
    ...report,
    comments: Array.isArray(report.comments)
      ? report.comments[0] ?? null
      : report.comments,
  }));

  return (
    <main className="mx-auto min-h-screen max-w-5xl p-6 md:p-10">
      <h1 className="text-3xl font-bold">Comment Reports</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Hide reported comments or dismiss reports. Hide writes
        <code> is_hidden = true</code> and removes the chunk from RAG.
      </p>
      <div className="mt-6 space-y-3">
        {reports.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reports yet.</p>
        ) : (
          reports.map((report) => (
            <article key={report.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium capitalize">{report.reason}</p>
                <span className="text-xs text-muted-foreground">
                  {report.status} · {formatRelativeTime(report.created_at)}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {report.comments?.body ?? "Comment unavailable"}
              </p>
              {report.details ? (
                <p className="mt-2 text-sm">{report.details}</p>
              ) : null}
              <p className="mt-2 text-xs text-muted-foreground">
                Comment ID: {report.comments?.id ?? "unknown"}
                {report.comments?.is_hidden ? " · hidden" : ""}
              </p>
              <ReportActions
                reportId={report.id}
                commentId={report.comments?.id ?? null}
                isHidden={report.comments?.is_hidden ?? false}
                status={report.status}
              />
            </article>
          ))
        )}
      </div>
    </main>
  );
}
