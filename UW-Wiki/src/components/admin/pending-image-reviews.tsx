"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { toast } from "@/lib/ui/toast";
import { useAction } from "@/lib/ui/use-action";

export type PendingImage = {
  id: string;
  orgName: string;
  orgSlug: string;
  url: string;
  alt: string;
  caption: string | null;
  uploaderDisplayName: string | null;
  createdAt: string;
};

/**
 * Inline accept/reject for a single pending image. Two `useAction`-backed
 * buttons; reject opens a tiny inline reason input. After either decision
 * the surrounding server-component reloads so the row drops out of the
 * queue.
 */
export function PendingImageReviewRow({ image }: { image: PendingImage }) {
  const router = useRouter();
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState("");

  const moderate = useAction<{ action: "accept" | "reject"; reason?: string }>(
    async (input) => {
      if (!input) throw new Error("Missing action.");
      const res = await fetch(`/api/admin/org-images/${image.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Could not update image.");
    },
    {
      successMessage: (_result, input) =>
        input?.action === "accept" ? "Image published." : "Image rejected.",
      onSuccess: () => router.refresh(),
    },
  );

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row">
      {/* `object-contain` so the moderator sees the full uploaded image
          (matching how it'll render on the wiki page once accepted).
          surface-2 background fills the letterbox area. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.url}
        alt={image.alt}
        className="aspect-[16/9] w-full max-w-[280px] rounded-md border border-border bg-[color:var(--surface-2)] object-contain"
        loading="lazy"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div>
          <p className="font-medium text-foreground">{image.orgName}</p>
          <p className="text-xs text-muted-foreground">
            By {image.uploaderDisplayName ?? "Anonymous"}
          </p>
        </div>
        <div className="text-sm">
          <p>
            <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Alt:{" "}
            </span>
            <span className="text-foreground">{image.alt}</span>
          </p>
          {image.caption ? (
            <p className="mt-1">
              <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Caption:{" "}
              </span>
              <span className="text-foreground italic">{image.caption}</span>
            </p>
          ) : null}
        </div>

        {showReason ? (
          <div className="flex flex-col gap-2 rounded-md border border-border bg-[color:var(--surface-2)] p-2">
            <textarea
              placeholder="Optional reason for rejection (shown to the uploader)…"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={280}
              rows={2}
              className="w-full resize-none bg-transparent text-sm text-foreground outline-none"
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowReason(false);
                  setReason("");
                }}
                disabled={moderate.pending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                loading={moderate.pending}
                onClick={() => void moderate.run({ action: "reject", reason: reason.trim() || undefined })}
              >
                Confirm reject
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              loading={moderate.pending && !showReason}
              onClick={() => {
                if (!image.alt.trim()) {
                  toast.error("Alt text missing on this row — cannot accept.");
                  return;
                }
                void moderate.run({ action: "accept" });
              }}
            >
              Accept
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowReason(true)}
              disabled={moderate.pending}
            >
              Reject
            </Button>
            <a
              href={`/wiki/${image.orgSlug}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              View article
            </a>
          </div>
        )}
      </div>
    </article>
  );
}
