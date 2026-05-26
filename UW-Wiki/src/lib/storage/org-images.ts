import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  OrgImage,
  OrgImageKind,
  OrgImageStatus,
} from "@/types/domain";

/**
 * Supabase Storage bucket shared with the editor's inline-image upload.
 * Kept as a constant so we change it in one place if we ever move org
 * images to a dedicated bucket.
 */
export const ORG_IMAGES_BUCKET = "wiki-images";

/**
 * Convert a storage path (`orgs/<orgId>/<uuid>.<ext>`) into the public URL
 * the browser will load. Uses the admin client so the resolution works on
 * the server even when no auth context is present (e.g. unauthenticated
 * page-load of a wiki article).
 */
export function resolveOrgImageUrl(storagePath: string): string {
  const admin = createAdminClient();
  const {
    data: { publicUrl },
  } = admin.storage.from(ORG_IMAGES_BUCKET).getPublicUrl(storagePath);
  return publicUrl;
}

type OrgImageRow = {
  id: string;
  org_id: string;
  kind: OrgImageKind;
  status: OrgImageStatus;
  storage_path: string;
  alt: string;
  caption: string | null;
  uploaded_by: string | null;
  decided_by: string | null;
  decided_at: string | null;
  rejection_reason: string | null;
  created_at: string;
};

/** Convert a snake_case Supabase row to the camelCase domain type. */
export function mapOrgImage(row: OrgImageRow): OrgImage {
  return {
    id: row.id,
    orgId: row.org_id,
    kind: row.kind,
    status: row.status,
    storagePath: row.storage_path,
    url: resolveOrgImageUrl(row.storage_path),
    alt: row.alt,
    caption: row.caption,
    uploadedBy: row.uploaded_by,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
  };
}

/**
 * Latest accepted `kind='header'` row for an org, or null. Used by
 * `getWikiPage` to surface the banner above The Pulse.
 */
export async function getLatestHeaderImage(
  orgId: string,
): Promise<OrgImage | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("org_images")
    .select(
      "id, org_id, kind, status, storage_path, alt, caption, uploaded_by, decided_by, decided_at, rejection_reason, created_at",
    )
    .eq("org_id", orgId)
    .eq("kind", "header")
    .eq("status", "accepted")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return mapOrgImage(data as OrgImageRow);
}
