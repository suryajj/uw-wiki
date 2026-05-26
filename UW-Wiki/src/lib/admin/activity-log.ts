import "server-only";

import { logServerError } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminAction =
  | "accept_proposal"
  | "reject_proposal"
  | "request_changes"
  | "hide_comment"
  | "unhide_comment"
  | "dismiss_report"
  | "seed_official_section"
  | "rerun_cold_start"
  | "update_lifecycle"
  | "change_user_role"
  | "add_affiliation"
  | "revoke_affiliation"
  | "publish_cold_start"
  | "update_org_metadata"
  | "accept_org_image"
  | "reject_org_image";

export async function logAdminActivity(input: {
  actorId: string | null;
  action: AdminAction;
  entityType: string;
  entityId?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from("admin_activity_log").insert({
    actor_id: input.actorId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    summary: input.summary ?? null,
    metadata: input.metadata ?? {},
  });
  if (error) {
    // FRD-7 audit failures must be non-blocking.
    logServerError("admin.activity-log", error);
  }
}
