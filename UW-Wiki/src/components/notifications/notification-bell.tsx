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
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-medium text-background">
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </Button>
      {open ? (
        <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-md border border-border bg-[color:var(--surface)] text-sm">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Notifications</p>
            <button type="button" className="text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground" onClick={markAllRead}>
              Mark all read
            </button>
          </div>
          <div className="flex flex-col">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-muted-foreground">No unread notifications.</p>
            ) : (
              items.map((item) => {
                const href = typeof item.payload.href === "string" ? item.payload.href : "/my/notifications";
                return (
                  <Link
                    key={item.id}
                    href={href}
                    onClick={() => void markRead(item.id)}
                    className="block border-b border-border px-4 py-3 transition-colors duration-150 hover:bg-[color:var(--surface-2)]"
                  >
                    <p className="font-medium text-foreground">{String(item.payload.title ?? item.type)}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {String(item.payload.body ?? "")}
                    </p>
                  </Link>
                );
              })
            )}
          </div>
          <Link href="/my/notifications" className="block px-4 py-3 text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground">
            View all notifications →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
