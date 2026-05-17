"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useAction } from "@/lib/ui/use-action";

export function RerunButton({ jobId, disabled }: { jobId: string; disabled: boolean }) {
  const router = useRouter();
  const action = useAction(
    async () => {
      const res = await fetch(`/api/admin/cold-start/jobs/${jobId}/rerun`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Could not re-run cold start.");
      }
    },
    {
      successMessage: "Cold start re-run started.",
      onSuccess: () => router.refresh(),
    },
  );
  return (
    <Button
      size="sm"
      variant="outline"
      loading={action.pending}
      disabled={disabled}
      onClick={() => action.run()}
    >
      Re-run
    </Button>
  );
}
