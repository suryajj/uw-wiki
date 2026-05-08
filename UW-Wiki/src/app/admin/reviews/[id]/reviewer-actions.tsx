"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

type Props = {
  proposalId: string;
  canAct: boolean;
  canAccept: boolean;
  canRequestChanges: boolean;
  canReject: boolean;
};

type ActionState =
  | { kind: "idle" }
  | { kind: "submitting"; action: "accept" | "reject" | "request-changes" | "mergeability" }
  | { kind: "error"; message: string }
  | { kind: "success"; message: string };

export function ReviewerActions({
  proposalId,
  canAct,
  canAccept,
  canRequestChanges,
  canReject,
}: Props) {
  const router = useRouter();
  const [state, setState] = useState<ActionState>({ kind: "idle" });
  const [comment, setComment] = useState("");

  async function call(
    action: "accept" | "reject" | "request-changes" | "mergeability",
    body: Record<string, unknown> = {},
  ) {
    setState({ kind: "submitting", action });
    const res = await fetch(`/api/proposals/${proposalId}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as {
      message?: string;
      error?: string;
    };
    if (!res.ok) {
      setState({ kind: "error", message: json.error ?? "Action failed." });
      return;
    }
    setState({ kind: "success", message: json.message ?? "Done." });
    router.refresh();
  }

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
          disabled={!canAccept || state.kind === "submitting"}
          onClick={() => void call("accept")}
        >
          Accept
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!canRequestChanges || state.kind === "submitting" || comment.length < 10}
          onClick={() => void call("request-changes", { message: comment })}
        >
          Request Changes
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!canReject || state.kind === "submitting" || comment.length < 10}
          onClick={() => void call("reject", { reviewerComment: comment })}
        >
          Reject
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={state.kind === "submitting"}
          onClick={() => void call("mergeability")}
        >
          Refresh Mergeability
        </Button>
      </div>
      {state.kind === "error" ? (
        <p className="mt-3 text-sm text-destructive">{state.message}</p>
      ) : null}
      {state.kind === "success" ? (
        <p className="mt-3 text-sm text-muted-foreground">{state.message}</p>
      ) : null}
    </section>
  );
}
