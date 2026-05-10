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
    <main className="flex min-h-screen w-full flex-col gap-8 px-6 py-10 md:px-10 lg:px-16">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">Notifications</h1>
          <p className="text-muted-foreground">Proposal updates, replies, and page digests.</p>
        </div>
        <MarkAllNotificationsReadButton />
      </header>
      <div className="flex gap-2">
        <Button asChild variant={!unreadOnly ? "default" : "outline"} size="sm">
          <Link href="/my/notifications">All</Link>
        </Button>
        <Button asChild variant={unreadOnly ? "default" : "outline"} size="sm">
          <Link href="/my/notifications?tab=unread">Unread</Link>
        </Button>
      </div>
      <div className="flex flex-col">
        {notifications.length === 0 ? (
          <div className="border border-dashed border-border p-10 text-center">
            <p className="font-medium text-foreground">No notifications here.</p>
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
                className={`flex flex-col gap-2 border-b border-border py-5 ${
                  notification.readAt ? "opacity-60" : ""
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <Link href={href} className="font-medium text-foreground transition-colors duration-150 hover:underline">
                      {String(notification.payload.title ?? notification.type)}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {String(notification.payload.body ?? "")}
                    </p>
                    <p className="text-xs text-muted-foreground">
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
