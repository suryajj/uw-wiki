"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function RerunButton({ jobId, disabled }: { jobId: string; disabled: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function rerun() {
    setLoading(true);
    await fetch(`/api/admin/cold-start/jobs/${jobId}/rerun`, { method: "POST" });
    setLoading(false);
    router.refresh();
  }
  return (
    <Button size="sm" variant="outline" disabled={disabled || loading} onClick={rerun}>
      Re-run
    </Button>
  );
}
