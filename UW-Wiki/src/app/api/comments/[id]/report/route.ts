import { z } from "zod";

import { apiError, apiSuccess, logServerError, parseJson } from "@/lib/api/errors";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createAdminClient } from "@/lib/supabase/admin";

const reportSchema = z.object({
  reason: z.enum(["spam", "harassment", "misinformation", "other"]),
  details: z.string().max(1000).optional(),
});

type RouteCtx = {
  params: Promise<{ id: string }>;
};

export async function POST(req: Request, { params }: RouteCtx) {
  const user = await getCurrentUser();
  const { id } = await params;
  const parsed = await parseJson(req, reportSchema);
  if (!parsed.ok) return parsed.response;

  const admin = createAdminClient();
  const { error } = await admin.from("comment_reports").insert({
    comment_id: id,
    reporter_id: user?.id ?? null,
    reason: parsed.data.reason,
    details: parsed.data.details ?? null,
    status: "pending",
  });
  if (error) {
    logServerError("comments.report", error);
    return apiError("UNEXPECTED", "Could not submit report.");
  }
  return apiSuccess({ message: "Report submitted." }, { status: 201 });
}
