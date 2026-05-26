"use client";

import { ImagePlus, Pencil, X } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { toast } from "@/lib/ui/toast";
import { useAction } from "@/lib/ui/use-action";
import type { OrgImage } from "@/types/domain";

type Props = {
  orgId: string;
  /** The currently-published header image (latest accepted), or null. */
  current: OrgImage | null;
  /**
   * The signed-in user's role. We show the upload affordance to anyone
   * signed in; admins skip the review queue and publish immediately,
   * everyone else's upload lands in /admin/reviews as a pending row.
   */
  canSubmit: boolean;
  isAdmin: boolean;
};

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];

/**
 * Banner image rendered above The Pulse on the wiki article aside.
 *
 * Rendering rules:
 *   - Visitor with no signed-in account and no image → renders nothing.
 *   - Signed-in user, no image → dashed `+ Add header image` placeholder
 *     (discoverable affordance; admins publish immediately, others land
 *     as pending review).
 *   - Image present → 16:9 framed image with optional caption below.
 *     Signed-in users see a Pencil overlay on hover to replace it.
 *
 * The image is shown via plain `<img>` (not next/image) so we don't have
 * to register the Supabase Storage public domain in next.config.mjs.
 * `object-cover` center-crops whatever aspect was uploaded to 16:9.
 */
export function ArticleHeaderImage({
  orgId,
  current,
  canSubmit,
  isAdmin,
}: Props) {
  const [editing, setEditing] = useState(false);

  if (!current && !canSubmit) return null;

  return (
    <div className="mb-4 w-full lg:w-[320px]">
      {current ? (
        <figure className="overflow-hidden rounded-md border border-border bg-[color:var(--surface)]">
          {/* Box stays a stable 16:9 so the article layout doesn't shift
              with each uploader's aspect ratio. `object-contain` shows the
              FULL image (no cropping) and leaves letterbox / pillarbox
              space painted with surface-2 so it reads as intentional
              padding rather than a broken layout. */}
          <div className="group relative aspect-[16/9] w-full bg-[color:var(--surface-2)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.url}
              alt={current.alt}
              className="h-full w-full object-contain"
              loading="lazy"
            />
            {canSubmit ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label="Replace header image"
                title="Replace header image"
                className="absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-full bg-background/80 text-foreground opacity-0 backdrop-blur transition-opacity duration-150 group-hover:opacity-100 focus:opacity-100 focus:outline-none"
              >
                <Pencil className="size-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          {current.caption ? (
            <figcaption className="px-3 py-2 text-xs italic text-muted-foreground">
              {current.caption}
            </figcaption>
          ) : null}
        </figure>
      ) : (
        // Empty-state affordance — only rendered when canSubmit is true
        // (we return null above if there's nothing to show).
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-border text-muted-foreground transition-colors duration-150 hover:border-foreground hover:text-foreground"
        >
          <ImagePlus className="size-5" aria-hidden="true" />
          <span className="text-xs font-medium">Add header image</span>
        </button>
      )}

      {editing ? (
        <UploadModal
          orgId={orgId}
          isAdmin={isAdmin}
          replacingCurrent={!!current}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </div>
  );
}

function UploadModal({
  orgId,
  isAdmin,
  replacingCurrent,
  onClose,
}: {
  orgId: string;
  isAdmin: boolean;
  replacingCurrent: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [caption, setCaption] = useState("");

  type UploadResult = { image: OrgImage };
  const action = useAction<void, UploadResult>(
    async () => {
      if (!file) throw new Error("Choose a file first.");
      if (file.size > MAX_BYTES) {
        throw new Error("Image is too large (max 5 MB).");
      }
      if (!ALLOWED_MIME.includes(file.type)) {
        throw new Error("Image must be PNG, JPEG, WebP, or GIF.");
      }
      if (!alt.trim()) throw new Error("Alt text is required for accessibility.");

      const form = new FormData();
      form.append("file", file);
      form.append("alt", alt.trim());
      if (caption.trim()) form.append("caption", caption.trim());
      form.append("kind", "header");

      const res = await fetch(`/api/orgs/${orgId}/images`, {
        method: "POST",
        body: form,
      });
      const body = (await res.json().catch(() => ({}))) as {
        image?: OrgImage;
        error?: string;
      };
      if (!res.ok || !body.image) {
        throw new Error(body.error ?? "Could not upload image.");
      }
      return { image: body.image };
    },
    {
      successMessage: () =>
        isAdmin
          ? replacingCurrent
            ? "Header image updated."
            : "Header image published."
          : "Image submitted for review.",
      onSuccess: () => {
        onClose();
        // Refresh the SSR data so the new image (if admin) or the
        // pending-review state shows on the next render.
        router.refresh();
      },
    },
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-md border border-border bg-[color:var(--surface)] p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-image-title"
      >
        <div className="mb-4 flex items-baseline justify-between">
          <h3 id="upload-image-title" className="text-lg font-semibold text-foreground">
            {replacingCurrent ? "Replace header image" : "Add header image"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        {!isAdmin ? (
          <p className="mb-4 rounded-md border border-border bg-[color:var(--surface-2)] px-3 py-2 text-xs text-muted-foreground">
            Your image will be sent to admins for review before it appears on
            the article.
          </p>
        ) : null}

        <form
          className="flex flex-col gap-4 text-sm"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            void action.run();
          }}
        >
          <FormField label="Image" hint="PNG, JPEG, WebP, or GIF. Max 5 MB.">
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_MIME.join(",")}
              onChange={(event) => {
                const next = event.target.files?.[0] ?? null;
                if (next && !alt.trim()) {
                  // Pre-fill alt with the filename stem so the user only
                  // has to confirm rather than type from scratch.
                  setAlt(
                    next.name
                      .replace(/\.[^.]+$/, "")
                      .replace(/[-_]+/g, " ")
                      .trim(),
                  );
                }
                setFile(next);
              }}
              className="block w-full text-sm text-foreground file:mr-3 file:rounded-full file:border-0 file:bg-foreground file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-background hover:file:opacity-90"
            />
            {file ? (
              <p className="text-[11px] text-muted-foreground">
                {file.name} · {(file.size / 1024).toFixed(0)} KB
              </p>
            ) : null}
          </FormField>

          <FormField
            label="Alt text"
            hint="Brief description for screen readers and broken-image fallbacks."
          >
            <input
              value={alt}
              onChange={(event) => setAlt(event.target.value)}
              required
              maxLength={280}
              placeholder="e.g. WATonomous team next to the autonomous Bolt EV"
              className="h-9 w-full rounded-md border border-border bg-transparent px-3 text-sm text-foreground outline-none focus:border-foreground"
            />
          </FormField>

          <FormField label="Caption" hint="Optional. Shown below the image.">
            <input
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              maxLength={280}
              placeholder="e.g. The team at the 2021 SAE AutoDrive Challenge."
              className="h-9 w-full rounded-md border border-border bg-transparent px-3 text-sm text-foreground outline-none focus:border-foreground"
            />
          </FormField>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={action.pending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={action.pending}
              disabled={!file || alt.trim().length === 0}
              onClick={() => {
                if (!file) toast.error("Choose a file first.");
              }}
            >
              {isAdmin ? "Publish" : "Submit for review"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </legend>
      {children}
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </fieldset>
  );
}
