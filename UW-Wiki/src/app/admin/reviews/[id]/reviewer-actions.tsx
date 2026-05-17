"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useAction } from "@/lib/ui/use-action";

type Props = {
  proposalId: string;
  canAct: boolean;
  canAccept: boolean;
  canRequestChanges: boolean;
  canReject: boolean;
};

type ReviewAction = "accept" | "reject" | "request-changes" | "mergeability";

const SUCCESS_LABELS: Record<ReviewAction, string> = {
  accept: "Proposal accepted.",
  reject: "Proposal rejected.",
  "request-changes": "Changes requested.",
  mergeability: "Mergeability refreshed.",
};

export function ReviewerActions({
  proposalId,
  canAct,
  canAccept,
  canRequestChanges,
  canReject,
}: Props) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [activeAction, setActiveAction] = useState<ReviewAction | null>(null);

  const reviewAction = useAction(
    async (payload: { action: ReviewAction; body: Record<string, unknown> }) => {
      setActiveAction(payload.action);
      try {
        const res = await fetch(`/api/proposals/${proposalId}/${payload.action}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload.body),
        });
        const json = (await res.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        if (!res.ok) throw new Error(json.error ?? "Action failed.");
        return { action: payload.action, message: json.message };
      } finally {
        // active flag cleared in onSuccess/onError
      }
    },
    {
      successMessage: (r) => r.message ?? SUCCESS_LABELS[r.action],
      onSuccess: () => {
        setActiveAction(null);
        router.refresh();
      },
      onError: () => setActiveAction(null),
    },
  );

  if (!canAct) return null;

  return (
    <section className="mt-6 rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Reviewer Actions
      </h2>
      <textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        maxLength={2000}
        className="mt-3 min-h-20 w-full rounded-md border border-border bg-background p-2 text-sm"
        placeholder="Comment for the contributor (required for reject and request-changes)"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          loading={activeAction === "accept" && reviewAction.pending}
          disabled={!canAccept || reviewAction.pending}
          onClick={() => reviewAction.run({ action: "accept", body: {} })}
        >
          Accept
        </Button>
        <Button
          type="button"
          variant="outline"
          loading={activeAction === "request-changes" && reviewAction.pending}
          disabled={!canRequestChanges || reviewAction.pending || comment.length < 10}
          onClick={() =>
            reviewAction.run({ action: "request-changes", body: { message: comment } })
          }
        >
          Request Changes
        </Button>
        <Button
          type="button"
          variant="outline"
          loading={activeAction === "reject" && reviewAction.pending}
          disabled={!canReject || reviewAction.pending || comment.length < 10}
          onClick={() =>
            reviewAction.run({ action: "reject", body: { reviewerComment: comment } })
          }
        >
          Reject
        </Button>
        <Button
          type="button"
          variant="outline"
          loading={activeAction === "mergeability" && reviewAction.pending}
          disabled={reviewAction.pending}
          onClick={() => reviewAction.run({ action: "mergeability", body: {} })}
        >
          Refresh Mergeability
        </Button>
      </div>
    </section>
  );
}
