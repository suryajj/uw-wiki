"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

type Props = {
  reportId: string;
  commentId: string | null;
  isHidden: boolean;
  status: string;
};

export function ReportActions({ reportId, commentId, isHidden, status }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState<"hide" | "unhide" | "dismiss" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function call(action: "hide" | "unhide" | "dismiss") {
    if (action !== "dismiss" && !commentId) {
      setMessage("Comment is missing.");
      return;
    }
    setSubmitting(action);
    setMessage(null);
    const url =
      action === "dismiss"
        ? `/api/admin/reports/${reportId}/dismiss`
        : `/api/admin/comments/${commentId}/${action}`;
    const res = await fetch(url, { method: "POST" });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setSubmitting(null);
    if (!res.ok) {
      setMessage(body.error ?? "Action failed.");
      return;
    }
    router.refresh();
  }

  if (status !== "pending") {
    return (
      <div className="mt-3 flex gap-2 text-xs text-muted-foreground">
        <span>Status: {status}</span>
        {isHidden ? (
          <Button
            size="sm"
            variant="outline"
            disabled={submitting === "unhide"}
            onClick={() => void call("unhide")}
          >
            Unhide
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <Button
        size="sm"
        disabled={submitting === "hide" || isHidden}
        onClick={() => void call("hide")}
      >
        Hide Comment
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={submitting === "dismiss"}
        onClick={() => void call("dismiss")}
      >
        Dismiss Report
      </Button>
      {isHidden ? (
        <Button
          size="sm"
          variant="outline"
          disabled={submitting === "unhide"}
          onClick={() => void call("unhide")}
        >
          Unhide
        </Button>
      ) : null}
      {message ? (
        <span className="ml-2 text-xs text-destructive">{message}</span>
      ) : null}
    </div>
  );
}
