"use client";

import { useEffect, useState } from "react";

import { clearPendingAction, loadPendingAction } from "@/lib/pending-actions/storage";

export function PendingActionResumer({ isSignedIn }: { isSignedIn: boolean }) {
  const [message, setMessage] = useState<string | null>(null);

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
        const payload = pending.payload as { pageId: string };
        res = await fetch("/api/bookmarks/toggle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageId: payload.pageId }),
        });
      }

      if (res?.ok) {
        clearPendingAction();
        setMessage("Your saved action was completed.");
      } else {
        setMessage("We could not replay your saved action. Try again.");
      }
    }

    void replay();
  }, [isSignedIn]);

  if (!message) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 rounded-md border border-border bg-card px-4 py-3 text-sm shadow">
      {message}
    </div>
  );
}
