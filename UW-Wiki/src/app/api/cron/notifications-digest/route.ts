import { apiError, apiSuccess, logServerError } from "@/lib/api/errors";
import { env } from "@/lib/config/env";
import { emitNotification, ensureNotificationPreferences } from "@/lib/notifications/service";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const secret = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!env.CRON_SECRET) {
    return apiError("FORBIDDEN", "Cron secret is not configured.");
  }
  if (secret !== env.CRON_SECRET) {
    return apiError("FORBIDDEN", "Invalid cron secret.");
  }

  const admin = createAdminClient();
  const { data: users, error } = await admin
    .from("notification_preferences")
    .select("user_id,last_digest_sent_at,page_update_digest_frequency,email_page_update_digest")
    .neq("page_update_digest_frequency", "never")
    .eq("email_page_update_digest", true);
  if (error) {
    logServerError("notifications.digest.prefs", error);
    return apiError("UNEXPECTED", "Could not load digest preferences.");
  }

  let sent = 0;
  for (const pref of users ?? []) {
    const fullPrefs = await ensureNotificationPreferences(pref.user_id);
    if (!shouldSendDigest(fullPrefs.pageUpdateDigestFrequency, fullPrefs.lastDigestSentAt)) continue;
    const since = fullPrefs.lastDigestSentAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: bookmarks } = await admin
      .from("bookmarks")
      .select("pages(slug,last_modified_at,organizations(org_name,org_slug))")
      .eq("user_id", pref.user_id);
    const updated = (bookmarks ?? []).flatMap((bookmark) => {
      const page = Array.isArray(bookmark.pages) ? bookmark.pages[0] : bookmark.pages;
      if (!page || Date.parse(page.last_modified_at) <= Date.parse(since)) return [];
      const org = Array.isArray(page.organizations) ? page.organizations[0] : page.organizations;
      return [{ slug: page.slug, orgName: org?.org_name ?? page.slug }];
    });
    if (updated.length > 0) {
      await emitNotification({
        recipientId: pref.user_id,
        type: "page.updated",
        payload: {
          title: "Bookmarked pages were updated",
          body: `${updated.length} bookmarked UW Wiki page${updated.length === 1 ? "" : "s"} changed.`,
          href: "/my/bookmarks",
          pages: updated,
        },
      }).catch((notifyError) => logServerError("notifications.digest.emit", notifyError));
      sent += 1;
    }
    await admin
      .from("notification_preferences")
      .update({ last_digest_sent_at: new Date().toISOString() })
      .eq("user_id", pref.user_id);
  }

  return apiSuccess({ sent, appUrl: env.NEXT_PUBLIC_APP_URL });
}

function shouldSendDigest(frequency: "daily" | "weekly" | "never", lastSent: string | null) {
  if (frequency === "never") return false;
  if (!lastSent) return true;
  const elapsed = Date.now() - Date.parse(lastSent);
  const day = 24 * 60 * 60 * 1000;
  return frequency === "daily" ? elapsed >= day : elapsed >= 7 * day;
}
