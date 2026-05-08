"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function MarkAllNotificationsReadButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        await fetch("/api/notifications/mark-all-read", { method: "POST" });
        setLoading(false);
        router.refresh();
      }}
    >
      {loading ? "Marking..." : "Mark All Read"}
    </Button>
  );
}

export function MarkNotificationReadButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        await fetch(`/api/notifications/${id}/mark-read`, { method: "POST" });
        setLoading(false);
        router.refresh();
      }}
    >
      {loading ? "Marking..." : "Mark Read"}
    </Button>
  );
}
