"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useAction } from "@/lib/ui/use-action";

export function RemoveBookmarkButton({ pageId }: { pageId: string }) {
  const router = useRouter();

  const removeAction = useAction(
    async () => {
      const res = await fetch("/api/bookmarks/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_id: pageId, desired_state: "unbookmarked" }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Could not remove bookmark.");
      }
    },
    {
      successMessage: "Bookmark removed.",
      onSuccess: () => router.refresh(),
    },
  );

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      loading={removeAction.pending}
      onClick={() => removeAction.run()}
    >
      Remove
    </Button>
  );
}
