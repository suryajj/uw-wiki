import { z } from "zod";

import { apiError, apiSuccess, logServerError, parseJson } from "@/lib/api/errors";
import {
  checkRateLimit,
  createRateLimiter,
  retryAfterSeconds,
} from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getActivePulseMetrics,
  PULSE_METRICS,
  type OrgCategory,
  type PulseMetric,
} from "@/types/domain";

export const runtime = "nodejs";

const voteLimiter = createRateLimiter(30, "10 m");

const voteSchema = z.object({
  orgId: z.string().uuid(),
  metric: z.enum(PULSE_METRICS),
  value: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  const parsed = await parseJson(req, voteSchema);
  if (!parsed.ok) return parsed.response;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("UNAUTHORIZED", "Sign in to rate this org.");

  const rateLimit = await checkRateLimit(voteLimiter, `pulse:user:${user.id}`);
  if (!rateLimit.success) {
    return apiError(
      "RATE_LIMITED",
      "Too many ratings — please try again in a few minutes.",
      {
        headers: { "Retry-After": retryAfterSeconds(rateLimit.reset).toString() },
      },
    );
  }

  const { orgId, metric, value } = parsed.data;
  const admin = createAdminClient();

  // Per-category metric guard: programs only accept workload/employability/
  // community; clubs/teams/etc. only accept selectivity/vibe_check/coop_boost.
  // The DB CHECK constraint (migration 012) accepts the union of all 6, so we
  // enforce the per-category split here.
  const { data: orgRow, error: orgRowError } = await admin
    .from("organizations")
    .select("category")
    .eq("id", orgId)
    .maybeSingle();
  if (orgRowError) {
    logServerError("pulse.vote.orgLookup", orgRowError);
    return apiError("UNEXPECTED", "Could not verify org for this rating.");
  }
  if (!orgRow) return apiError("VALIDATION_FAILED", "Unknown org.");

  const allowed = getActivePulseMetrics(orgRow.category as OrgCategory);
  if (!allowed.includes(metric)) {
    return apiError(
      "VALIDATION_FAILED",
      `Metric '${metric}' is not valid for ${orgRow.category} pages.`,
    );
  }

  const { data: existing } = await admin
    .from("pulse_ratings")
    .select("id")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .eq("metric", metric)
    .maybeSingle();

  if (existing) {
    return apiError("CONFLICT", "You've already rated this metric for this org.");
  }

  const { error } = await admin.from("pulse_ratings").insert({
    org_id: orgId,
    user_id: user.id,
    metric,
    value,
  });

  if (error) {
    if (error.code === "23505") {
      return apiError("CONFLICT", "You've already rated this metric for this org.");
    }
    logServerError("pulse.vote.insert", error);
    return apiError("UNEXPECTED", "Could not record rating.");
  }

  try {
    await recomputeAggregate(orgId, metric);
  } catch (recomputeError) {
    logServerError("pulse.vote.recompute", recomputeError);
  }
  return apiSuccess({ message: "Rating recorded." });
}

async function recomputeAggregate(orgId: string, metric: PulseMetric) {
  const admin = createAdminClient();
  const { data: ratings, error } = await admin
    .from("pulse_ratings")
    .select("value")
    .eq("org_id", orgId)
    .eq("metric", metric);
  if (error) throw error;
  if (!ratings || ratings.length === 0) return;

  const values = ratings.map((rating) => String(rating.value));
  const aggregateValue = computeAggregateValue(metric, values);
  const aggregateLabel = computeAggregateLabel(metric, aggregateValue);

  await admin.from("pulse_aggregates").upsert(
    {
      org_id: orgId,
      metric,
      aggregate_value: aggregateValue,
      aggregate_label: aggregateLabel,
      total_votes: values.length,
      updated_at: new Date().toISOString(),
      last_computed_at: new Date().toISOString(),
    },
    { onConflict: "org_id,metric" },
  );
}

function computeAggregateValue(metric: PulseMetric, values: string[]): string {
  if (metric === "selectivity") {
    return mode(values);
  }
  const numbers = values
    .map((value) => Number.parseFloat(value))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  if (numbers.length === 0) return "0";
  const mid = Math.floor(numbers.length / 2);
  const first = numbers[mid - 1];
  const second = numbers[mid];
  if (numbers.length % 2 === 1) {
    return (second ?? first ?? 0).toFixed(1);
  }
  if (first === undefined || second === undefined) return "0";
  return ((first + second) / 2).toFixed(1);
}

function computeAggregateLabel(metric: PulseMetric, value: string): string {
  // Every numeric metric (vibe/co-op for clubs, workload/employability/
  // community for programs) shows as "X.Y / 5". Selectivity stays categorical.
  if (metric === "selectivity") return value;
  return `${value} / 5`;
}

function mode(values: string[]): string {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? values[0] ?? "";
}
