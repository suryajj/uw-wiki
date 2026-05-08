"use client";

import { z } from "zod";

export const PENDING_ACTION_KEY = "uw-wiki:pending-action";
const TTL_MS = 24 * 60 * 60 * 1000;

const envelopeSchema = z.object({
  id: z.string(),
  type: z.enum(["pulse.vote", "comment.vote", "bookmark.toggle"]),
  savedAt: z.string(),
  expiresAt: z.string(),
  returnTo: z.string().optional(),
  payload: z.unknown(),
});

export type PendingActionEnvelope = z.infer<typeof envelopeSchema>;

export function savePendingAction(
  type: PendingActionEnvelope["type"],
  payload: unknown,
  returnTo?: string,
) {
  const now = Date.now();
  const envelope: PendingActionEnvelope = {
    id: crypto.randomUUID(),
    type,
    payload,
    returnTo,
    savedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + TTL_MS).toISOString(),
  };
  localStorage.setItem(PENDING_ACTION_KEY, JSON.stringify(envelope));
  return envelope;
}

export function loadPendingAction(): PendingActionEnvelope | null {
  const raw = localStorage.getItem(PENDING_ACTION_KEY);
  if (!raw) return null;
  try {
    const parsed = envelopeSchema.parse(JSON.parse(raw));
    if (Date.parse(parsed.expiresAt) < Date.now()) {
      clearPendingAction();
      return null;
    }
    return parsed;
  } catch {
    clearPendingAction();
    return null;
  }
}

export function clearPendingAction() {
  localStorage.removeItem(PENDING_ACTION_KEY);
}
