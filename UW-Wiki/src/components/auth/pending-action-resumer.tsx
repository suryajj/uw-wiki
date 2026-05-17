"use client";

import { useEffect } from "react";

import { clearPendingAction, loadPendingAction } from "@/lib/pending-actions/storage";
import { toast } from "@/lib/ui/toast";

export function PendingActionResumer({ isSignedIn }: { isSignedIn: boolean }) {
  useEffect(() => {
    if (!isSignedIn) return;
    const pending = loadPendingAction();
    if (!pending) return;

    async function replay() {
      if (!pending) return;
      let res: Response | null = null;
      if (pending.type === "pulse.vote") {
        const payload = pending.payload as {
          votes?: Array<{ orgId: string; metric: string; value: string }>;
          orgId?: string;
          metric?: string;
          value?: string;
        };
        const votes =
          payload.votes ??
          (payload.orgId && payload.metric && payload.value
            ? [{ orgId: payload.orgId, metric: payload.metric, value: payload.value }]
            : []);
        const results = await Promise.all(
          votes.map((vote) =>
            fetch("/api/pulse/vote", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(vote),
            }),
          ),
        );
        res = results.find((item) => !item.ok) ?? results[0] ?? null;
      } else if (pending.type === "comment.vote") {
        const payload = pending.payload as { commentId: string; voteType: "up" | "down" };
        res = await fetch(`/api/comments/${payload.commentId}/vote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ voteType: payload.voteType }),
        });
      } else if (pending.type === "bookmark.toggle") {
        const payload = pending.payload as {
          pageId: string;
          desiredState?: "bookmarked" | "unbookmarked";
        };
        res = await fetch("/api/bookmarks/toggle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            page_id: payload.pageId,
            desired_state: payload.desiredState ?? "bookmarked",
          }),
        });
      }

      if (res?.ok) {
        clearPendingAction();
        toast.success("Your saved action was completed.");
      } else {
        toast.error("We could not replay your saved action. Try again.");
      }
    }

    void replay();
  }, [isSignedIn]);

  return null;
}
