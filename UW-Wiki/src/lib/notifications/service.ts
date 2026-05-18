import "server-only";

import { logServerError } from "@/lib/api/errors";
import { env } from "@/lib/config/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { NotificationPreferences, NotificationRow, NotificationType } from "@/types/domain";

type NotificationPayload = Record<string, unknown> & {
  title?: string;
  body?: string;
  href?: string;
};

const DEFAULT_PREFS = {
  in_app_pr_status: true,
  email_pr_status: true,
  in_app_comment_reply: true,
  email_comment_reply: true,
  in_app_page_update: true,
};

export async function ensureNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const admin = createAdminClient();
  const { error: upsertError } = await admin
    .from("notification_preferences")
    .upsert({ user_id: userId, ...DEFAULT_PREFS }, { onConflict: "user_id", ignoreDuplicates: true });
  if (upsertError) throw upsertError;
  const { data, error } = await admin
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (error) throw error;
  return mapPreferences(data);
}

export async function emitNotification(input: {
  recipientId: string | null | undefined;
  type: NotificationType;
  payload: NotificationPayload;
}) {
  if (!input.recipientId) return null;
  const prefs = await ensureNotificationPreferences(input.recipientId);
  const inAppEnabled = inAppPrefEnabled(prefs, input.type);
  const emailEnabled = emailPrefEnabled(prefs, input.type);
  let deliveredEmail = false;

  if (emailEnabled) {
    deliveredEmail = await sendNotificationEmail(input.recipientId, input.type, input.payload);
  }

  if (!inAppEnabled && !deliveredEmail) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("notifications")
    .insert({
      user_id: input.recipientId,
      type: input.type,
      payload: input.payload,
      delivered_email: deliveredEmail,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapNotification(data);
}

export async function listNotifications(userId: string, unreadOnly = false) {
  const admin = createAdminClient();
  let query = admin
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (unreadOnly) query = query.is("read_at", null);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapNotification);
}

export async function unreadNotificationCount(userId: string) {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) throw error;
}

export async function updateNotificationPreferences(
  userId: string,
  updates: Partial<{
    inAppPrStatus: boolean;
    emailPrStatus: boolean;
    inAppCommentReply: boolean;
    emailCommentReply: boolean;
    inAppPageUpdate: boolean;
  }>,
) {
  await ensureNotificationPreferences(userId);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("notification_preferences")
    .update({
      in_app_pr_status: updates.inAppPrStatus,
      email_pr_status: updates.emailPrStatus,
      in_app_comment_reply: updates.inAppCommentReply,
      email_comment_reply: updates.emailCommentReply,
      in_app_page_update: updates.inAppPageUpdate,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return mapPreferences(data);
}

async function sendNotificationEmail(
  userId: string,
  type: NotificationType,
  payload: NotificationPayload,
) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return false;
  const admin = createAdminClient();
  const { data: user } = await admin.from("users").select("email").eq("id", userId).maybeSingle();
  if (!user?.email) return false;
  const title = payload.title ?? notificationTitle(type);
  const body = payload.body ?? "You have a new UW Wiki notification.";
  const href = typeof payload.href === "string" ? payload.href : "/";
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: user.email,
        subject: title,
        text: `${body}\n\nOpen UW Wiki: ${new URL(href, env.NEXT_PUBLIC_APP_URL).toString()}`,
      }),
    });
    return response.ok;
  } catch (error) {
    logServerError("notifications.email", error);
    return false;
  }
}

function inAppPrefEnabled(prefs: NotificationPreferences, type: NotificationType) {
  if (type.startsWith("pr.")) return prefs.inAppPrStatus;
  if (type === "comment.reply") return prefs.inAppCommentReply;
  if (type === "page.updated") return prefs.inAppPageUpdate;
  return false;
}

function emailPrefEnabled(prefs: NotificationPreferences, type: NotificationType) {
  if (type.startsWith("pr.")) return prefs.emailPrStatus;
  if (type === "comment.reply") return prefs.emailCommentReply;
  return false;
}

function notificationTitle(type: NotificationType) {
  switch (type) {
    case "pr.accepted":
      return "Your UW Wiki proposal was accepted";
    case "pr.rejected":
      return "Your UW Wiki proposal was rejected";
    case "pr.changes_requested":
      return "Changes requested on your UW Wiki proposal";
    case "pr.needs_rebase":
      return "Your UW Wiki proposal needs a rebase";
    case "comment.reply":
      return "New reply to your UW Wiki comment";
    case "page.updated":
      return "Bookmarked UW Wiki pages were updated";
  }
}

export function mapNotification(row: Record<string, unknown>): NotificationRow {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    type: row.type as NotificationType,
    payload: (row.payload as Record<string, unknown>) ?? {},
    readAt: row.read_at as string | null,
    deliveredEmail: !!row.delivered_email,
    createdAt: row.created_at as string,
  };
}

function mapPreferences(row: Record<string, unknown>): NotificationPreferences {
  return {
    userId: row.user_id as string,
    inAppPrStatus: row.in_app_pr_status as boolean,
    emailPrStatus: row.email_pr_status as boolean,
    inAppCommentReply: row.in_app_comment_reply as boolean,
    emailCommentReply: row.email_comment_reply as boolean,
    inAppPageUpdate: (row.in_app_page_update as boolean | undefined) ?? true,
    updatedAt: row.updated_at as string,
  };
}
