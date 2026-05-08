"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { NotificationRow } from "@/types/domain";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<NotificationRow[]>([]);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    const [countRes, listRes] = await Promise.all([
      fetch("/api/notifications/unread-count"),
      fetch("/api/notifications"),
    ]);
    const countBody = (await countRes.json().catch(() => ({}))) as { count?: number };
    const listBody = (await listRes.json().catch(() => ({}))) as {
      notifications?: NotificationRow[];
    };
    setCount(countBody.count ?? 0);
    setItems((listBody.notifications ?? []).slice(0, 5));
  }

  async function markAllRead() {
    await fetch("/api/notifications/mark-all-read", { method: "POST" });
    await refresh();
  }

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/mark-read`, { method: "POST" });
    await refresh();
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen((value) => !value)}
        aria-label="Notifications"
      >
        <Bell className="size-4" />
        {count > 0 ? (
          <span className="absolute -right-1 -top-1 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </Button>
      {open ? (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-lg border border-border bg-card p-3 text-sm shadow-lg">
          <div className="flex items-center justify-between">
            <p className="font-semibold">Notifications</p>
            <button type="button" className="text-xs text-primary hover:underline" onClick={markAllRead}>
              Mark all read
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {items.length === 0 ? (
              <p className="text-muted-foreground">No unread notifications.</p>
            ) : (
              items.map((item) => {
                const href = typeof item.payload.href === "string" ? item.payload.href : "/my/notifications";
                return (
                  <Link
                    key={item.id}
                    href={href}
                    onClick={() => void markRead(item.id)}
                    className="block rounded-md border border-border p-2 hover:border-primary/40"
                  >
                    <p className="font-medium">{String(item.payload.title ?? item.type)}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {String(item.payload.body ?? "")}
                    </p>
                  </Link>
                );
              })
            )}
          </div>
          <Link href="/my/notifications" className="mt-3 block text-xs text-primary hover:underline">
            View all notifications
          </Link>
        </div>
      ) : null}
    </div>
  );
}
