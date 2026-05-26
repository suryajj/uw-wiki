import {
  apiError,
  apiSuccess,
  logServerError,
} from "@/lib/api/errors";
import { getCurrentUser } from "@/lib/auth/current-user";
import { checkRateLimit, createRateLimiter } from "@/lib/rate-limit";
import {
  ORG_IMAGES_BUCKET,
  mapOrgImage,
} from "@/lib/storage/org-images";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// 5 MB matches the inline-editor upload cap (src/lib/editor/upload.ts).
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);
const MAX_ALT = 280;
const MAX_CAPTION = 280;
const ALLOWED_KINDS = new Set(["header", "inline"]);

const uploadLimiter = createRateLimiter(10, "10 m");

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * POST /api/orgs/[id]/images
 *
 * Multipart form upload for an org image. Anyone signed-in may submit;
 * admin uploads skip the queue and publish immediately, everyone else
 * starts `status='pending'` and shows up in /admin/reviews until an
 * admin accepts or rejects.
 *
 * Required fields: `file`, `alt`. Optional: `caption`, `kind` (defaults
 * to `header`).
 *
 * On success, returns the freshly-created row mapped to the camelCase
 * domain shape (including resolved public URL).
 */
export async function POST(req: Request, { params }: RouteCtx) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHORIZED", "Sign in to upload an image.");

  const { id: orgId } = await params;
  if (!isUuid(orgId)) return apiError("VALIDATION_FAILED", "Invalid org id.");

  const limit = await checkRateLimit(
    uploadLimiter,
    `org-images:upload:${user.id}`,
  );
  if (!limit.success) {
    return apiError("RATE_LIMITED", "Too many uploads — wait a moment.");
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return apiError(
      "VALIDATION_FAILED",
      "Expected multipart/form-data with a file field.",
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return apiError("VALIDATION_FAILED", "Missing 'file' field.");
  }
  if (file.size === 0) return apiError("VALIDATION_FAILED", "File is empty.");
  if (file.size > MAX_BYTES) {
    return apiError(
      "VALIDATION_FAILED",
      `File is too large (max ${MAX_BYTES / (1024 * 1024)} MB).`,
    );
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return apiError(
      "VALIDATION_FAILED",
      "File must be PNG, JPEG, WebP, or GIF.",
    );
  }

  const alt = String(form.get("alt") ?? "").trim();
  if (!alt) return apiError("VALIDATION_FAILED", "Alt text is required.");
  if (alt.length > MAX_ALT) {
    return apiError(
      "VALIDATION_FAILED",
      `Alt text is too long (max ${MAX_ALT} chars).`,
    );
  }

  const captionRaw = String(form.get("caption") ?? "").trim();
  const caption = captionRaw.length > 0 ? captionRaw : null;
  if (caption && caption.length > MAX_CAPTION) {
    return apiError(
      "VALIDATION_FAILED",
      `Caption is too long (max ${MAX_CAPTION} chars).`,
    );
  }

  const kindRaw = String(form.get("kind") ?? "header");
  if (!ALLOWED_KINDS.has(kindRaw)) {
    return apiError("VALIDATION_FAILED", "Invalid 'kind' value.");
  }
  const kind = kindRaw as "header" | "inline";

  const admin = createAdminClient();

  // Confirm the org exists so we don't dump orphan files into storage.
  const { data: orgRow } = await admin
    .from("organizations")
    .select("id")
    .eq("id", orgId)
    .maybeSingle();
  if (!orgRow) return apiError("NOT_FOUND", "Org not found.");

  // Path scheme: orgs/<orgId>/<uuid>.<ext>. Keeping orgId in the path
  // means a future "delete all images for org" sweep is one prefix
  // delete, and storage browser UIs group by org out of the box.
  const ext = mimeExtension(file.type);
  const storagePath = `orgs/${orgId}/${crypto.randomUUID()}.${ext}`;
  const buffer = await file.arrayBuffer();
  const { error: uploadError } = await admin.storage
    .from(ORG_IMAGES_BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });
  if (uploadError) {
    logServerError("org-images.upload.storage", uploadError);
    return apiError("UNEXPECTED", "Could not upload file.");
  }

  // Admins skip the review queue. Everyone else creates a pending row
  // that surfaces in /admin/reviews.
  const isAdmin = user.role === "admin";
  const status = isAdmin ? "accepted" : "pending";
  const now = new Date().toISOString();
  const { data: inserted, error: insertError } = await admin
    .from("org_images")
    .insert({
      org_id: orgId,
      kind,
      status,
      storage_path: storagePath,
      alt,
      caption,
      uploaded_by: user.id,
      decided_by: isAdmin ? user.id : null,
      decided_at: isAdmin ? now : null,
    })
    .select(
      "id, org_id, kind, status, storage_path, alt, caption, uploaded_by, decided_by, decided_at, rejection_reason, created_at",
    )
    .maybeSingle();

  if (insertError || !inserted) {
    logServerError("org-images.upload.insert", insertError);
    // Best-effort cleanup of the uploaded file so storage doesn't leak.
    await admin.storage.from(ORG_IMAGES_BUCKET).remove([storagePath]);
    return apiError("UNEXPECTED", "Could not record image upload.");
  }

  return apiSuccess({ image: mapOrgImage(inserted) }, { status: 201 });
}

function mimeExtension(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "jpg";
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}
