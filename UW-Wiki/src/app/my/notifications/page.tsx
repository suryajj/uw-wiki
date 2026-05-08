import Link from "next/link";

import {
  MarkAllNotificationsReadButton,
  MarkNotificationReadButton,
} from "@/components/notifications/notification-actions";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/guards";
import { listNotifications } from "@/lib/notifications/service";
import { formatRelativeTime } from "@/lib/utils/time";

type PageProps = { searchParams: Promise<{ tab?: string }> };

export const dynamic = "force-dynamic";

export default async function MyNotificationsPage({ searchParams }: PageProps) {
  const user = await requireUser({ returnTo: "/my/notifications" });
  const { tab } = await searchParams;
  const unreadOnly = tab === "unread";
  const notifications = await listNotifications(user.id, unreadOnly);

  return (
    <main className="mx-auto min-h-screen max-w-4xl p-6 md:p-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="mt-2 text-muted-foreground">Proposal updates, replies, and page digests.</p>
        </div>
        <MarkAllNotificationsReadButton />
      </div>
      <div className="mt-6 flex gap-2">
        <Button asChild variant={!unreadOnly ? "default" : "outline"} size="sm">
          <Link href="/my/notifications">All</Link>
        </Button>
        <Button asChild variant={unreadOnly ? "default" : "outline"} size="sm">
          <Link href="/my/notifications?tab=unread">Unread</Link>
        </Button>
      </div>
      <div className="mt-6 space-y-3">
        {notifications.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6">
            <p className="font-medium">No notifications here.</p>
          </div>
        ) : (
          notifications.map((notification) => {
            const href =
              typeof notification.payload.href === "string"
                ? notification.payload.href
                : "/my/notifications";
            return (
              <article
                key={notification.id}
                className={`rounded-lg border border-border bg-card p-4 ${
                  notification.readAt ? "opacity-75" : ""
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link href={href} className="font-semibold hover:underline">
                      {String(notification.payload.title ?? notification.type)}
                    </Link>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {String(notification.payload.body ?? "")}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatRelativeTime(notification.createdAt)}
                    </p>
                  </div>
                  {!notification.readAt ? (
                    <MarkNotificationReadButton id={notification.id} />
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </div>
    </main>
  );
}
