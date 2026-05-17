"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useAction } from "@/lib/ui/use-action";

export function MarkAllNotificationsReadButton() {
  const router = useRouter();
  const action = useAction(
    async () => {
      const res = await fetch("/api/notifications/mark-all-read", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Could not mark notifications read.");
      }
    },
    {
      quietSuccess: true,
      onSuccess: () => router.refresh(),
    },
  );
  return (
    <Button
      type="button"
      variant="outline"
      loading={action.pending}
      onClick={() => action.run()}
    >
      Mark All Read
    </Button>
  );
}

export function MarkNotificationReadButton({ id }: { id: string }) {
  const router = useRouter();
  const action = useAction(
    async () => {
      const res = await fetch(`/api/notifications/${id}/mark-read`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Could not mark notification read.");
      }
    },
    {
      quietSuccess: true,
      onSuccess: () => router.refresh(),
    },
  );
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      loading={action.pending}
      onClick={() => action.run()}
    >
      Mark Read
    </Button>
  );
}
