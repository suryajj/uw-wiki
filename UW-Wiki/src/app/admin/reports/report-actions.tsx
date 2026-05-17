"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { toast } from "@/lib/ui/toast";
import { useAction } from "@/lib/ui/use-action";

type Props = {
  reportId: string;
  commentId: string | null;
  isHidden: boolean;
  status: string;
};

type ReportAction = "hide" | "unhide" | "dismiss";

const SUCCESS_LABELS: Record<ReportAction, string> = {
  hide: "Comment hidden.",
  unhide: "Comment unhidden.",
  dismiss: "Report dismissed.",
};

export function ReportActions({ reportId, commentId, isHidden, status }: Props) {
  const router = useRouter();
  const [active, setActive] = useState<ReportAction | null>(null);

  const action = useAction(
    async (which: ReportAction) => {
      if (which !== "dismiss" && !commentId) {
        throw new Error("Comment is missing.");
      }
      setActive(which);
      const url =
        which === "dismiss"
          ? `/api/admin/reports/${reportId}/dismiss`
          : `/api/admin/comments/${commentId}/${which}`;
      const res = await fetch(url, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Action failed.");
      return which;
    },
    {
      successMessage: (which) => SUCCESS_LABELS[which],
      onSuccess: () => {
        setActive(null);
        router.refresh();
      },
      onError: () => setActive(null),
    },
  );

  // Helper to keep callsites tidy
  const run = (which: ReportAction) => {
    void action.run(which).catch(() => {
      // useAction already toasts; nothing else to do
      void toast;
    });
  };

  if (status !== "pending") {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <span>Status: {status}</span>
        {isHidden ? (
          <Button
            size="sm"
            variant="outline"
            loading={active === "unhide" && action.pending}
            disabled={action.pending}
            onClick={() => run("unhide")}
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
        loading={active === "hide" && action.pending}
        disabled={action.pending || isHidden}
        onClick={() => run("hide")}
      >
        Hide Comment
      </Button>
      <Button
        size="sm"
        variant="outline"
        loading={active === "dismiss" && action.pending}
        disabled={action.pending}
        onClick={() => run("dismiss")}
      >
        Dismiss Report
      </Button>
      {isHidden ? (
        <Button
          size="sm"
          variant="outline"
          loading={active === "unhide" && action.pending}
          disabled={action.pending}
          onClick={() => run("unhide")}
        >
          Unhide
        </Button>
      ) : null}
    </div>
  );
}
