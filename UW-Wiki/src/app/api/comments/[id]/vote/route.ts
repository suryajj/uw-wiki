import { z } from "zod";

import { apiError, apiSuccess, logServerError, parseJson } from "@/lib/api/errors";
import { getCurrentUser } from "@/lib/auth/current-user";
import { checkRateLimit, createRateLimiter } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const voteLimiter = createRateLimiter(30, "10 m");

const voteSchema = z.object({
  voteType: z.enum(["up", "down"]).nullable(),
});

type RouteCtx = {
  params: Promise<{ id: string }>;
};

export async function POST(req: Request, { params }: RouteCtx) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHORIZED", "Sign in to vote.");
  const { id } = await params;
  const limit = await checkRateLimit(voteLimiter, `comments:vote:${user.id}`);
  if (!limit.success) return apiError("RATE_LIMITED", "Too many requests. Please slow down.");
  const parsed = await parseJson(req, voteSchema);
  if (!parsed.ok) return parsed.response;

  const admin = createAdminClient();
  // Read previous vote so we can compute count deltas. The unique
  // (comment_id, user_id) PK serializes concurrent writes for the same
  // user, so a read-then-upsert is race-safe per user.
  const { data: existing, error: readError } = await admin
    .from("comment_votes")
    .select("vote_type, vote")
    .eq("comment_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (readError) {
    logServerError("comments.vote.read", readError);
    return apiError("UNEXPECTED", "Could not read vote.");
  }

  const previous = existing
    ? existing.vote_type ??
      (existing.vote === 1 ? "up" : existing.vote === -1 ? "down" : null)
    : null;
  const next = parsed.data.voteType;
  if (previous === next) {
    return apiSuccess({ message: "Vote unchanged." });
  }

  if (next === null) {
    const { error: deleteError } = await admin
      .from("comment_votes")
      .delete()
      .eq("comment_id", id)
      .eq("user_id", user.id);
    if (deleteError) {
      logServerError("comments.vote.delete", deleteError);
      return apiError("UNEXPECTED", "Could not remove vote.");
    }
  } else {
    const { error: upsertError } = await admin
      .from("comment_votes")
      .upsert(
        {
          comment_id: id,
          user_id: user.id,
          vote: next === "up" ? 1 : -1,
          vote_type: next,
        },
        { onConflict: "comment_id,user_id" },
      );
    if (upsertError) {
      logServerError("comments.vote.upsert", upsertError);
      return apiError("UNEXPECTED", "Could not record vote.");
    }
  }

  const deltaUp = (next === "up" ? 1 : 0) - (previous === "up" ? 1 : 0);
  const deltaDown = (next === "down" ? 1 : 0) - (previous === "down" ? 1 : 0);
  if (deltaUp !== 0 || deltaDown !== 0) {
    const { error: rpcError } = await admin.rpc("increment_comment_vote", {
      p_comment_id: id,
      p_delta_up: deltaUp,
      p_delta_down: deltaDown,
    });
    if (rpcError) {
      logServerError("comments.vote.rpc", rpcError);
      return apiError("UNEXPECTED", "Could not update vote totals.");
    }
  }

  return apiSuccess({ message: "Vote recorded." });
}
