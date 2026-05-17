"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";
import { useState } from "react";

import { AuthModal } from "@/components/auth/auth-modal";
import { Tooltip } from "@/components/ui/tooltip";
import { useAction } from "@/lib/ui/use-action";
import { savePendingAction } from "@/lib/pending-actions/storage";

export function BookmarkButton({
  pageId,
  initialState,
  isSignedIn,
  returnTo,
}: {
  pageId: string;
  initialState: "bookmarked" | "unbookmarked";
  isSignedIn: boolean;
  returnTo: string;
}) {
  const [state, setState] = useState(initialState);
  const [authOpen, setAuthOpen] = useState(false);
  const bookmarked = state === "bookmarked";
  const label = bookmarked ? "Remove bookmark" : "Bookmark page";

  const toggleAction = useAction(
    async (desiredState: "bookmarked" | "unbookmarked") => {
      const res = await fetch("/api/bookmarks/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_id: pageId, desired_state: desiredState }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        state?: "bookmarked" | "unbookmarked";
        error?: string;
      };
      if (!res.ok || !body.state) {
        throw new Error(body.error ?? "Could not update bookmark.");
      }
      return body.state;
    },
    {
      quietSuccess: true,
      // Optimistic: flip the icon instantly; revert on failure.
      optimistic: {
        apply: () => setState((s) => (s === "bookmarked" ? "unbookmarked" : "bookmarked")),
        revert: () => setState((s) => (s === "bookmarked" ? "unbookmarked" : "bookmarked")),
      },
    },
  );

  function toggle() {
    const desiredState = bookmarked ? "unbookmarked" : "bookmarked";
    if (!isSignedIn) {
      savePendingAction("bookmark.toggle", { pageId, desiredState }, returnTo);
      setAuthOpen(true);
      return;
    }
    toggleAction.run(desiredState);
  }

  return (
    <>
      <Tooltip label={label}>
        <button
          type="button"
          onClick={toggle}
          disabled={toggleAction.pending}
          aria-label={label}
          aria-busy={toggleAction.pending || undefined}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors duration-150 hover:border-foreground hover:text-foreground disabled:opacity-60"
        >
          {bookmarked ? (
            <BookmarkCheck className="size-4 text-foreground" />
          ) : (
            <Bookmark className="size-4" />
          )}
        </button>
      </Tooltip>
      <AuthModal
        open={authOpen}
        returnTo={returnTo}
        onClose={() => setAuthOpen(false)}
      />
    </>
  );
}
