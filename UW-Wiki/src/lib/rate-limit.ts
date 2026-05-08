import "server-only";

import { createHash } from "node:crypto";

import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

const redis = Redis.fromEnv();

type Window = `${number} ${"s" | "m" | "h" | "d"}`;

export function createRateLimiter(requests: number, window: Window) {
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window),
  });
}

export function createDailyRateLimiter(requests: number) {
  return new Ratelimit({
    redis,
    limiter: Ratelimit.fixedWindow(requests, "24 h"),
  });
}

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string,
): Promise<RateLimitResult> {
  const result = await limiter.limit(identifier);
  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}

/**
 * Resolve the most trustworthy client IP available. Cloudflare and most
 * reverse proxies expose `cf-connecting-ip` / `x-real-ip`; fall back to the
 * first entry of `x-forwarded-for` only when those are absent.
 */
export function getClientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf;
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return "unknown";
}

/**
 * Stable, privacy-preserving identifier for an anonymous client. We never
 * log raw IPs in the rate limiter keys; instead, hash with a server secret
 * (the OPENROUTER api key is too sensitive — use the Upstash token already
 * present in the runtime env as the salt to avoid adding new secrets).
 */
export function hashClientIp(req: Request): string {
  const raw = getClientIp(req);
  if (raw === "unknown") return "unknown";
  const salt = process.env.UPSTASH_REDIS_REST_TOKEN ?? "uw-wiki";
  return createHash("sha256").update(`${salt}:${raw}`).digest("hex").slice(0, 32);
}

export function retryAfterSeconds(reset: number): number {
  return Math.max(1, Math.ceil((reset - Date.now()) / 1000));
}

/**
 * Run a sequence of limiters (e.g. burst then daily). Returns the first
 * limiter that fails so callers can surface a precise message.
 */
export async function checkRateLimitChain(
  checks: Array<{ limiter: Ratelimit; identifier: string; label?: string }>,
): Promise<{ success: true } | { success: false; label?: string; result: RateLimitResult }>
{
  for (const { limiter, identifier, label } of checks) {
    const result = await checkRateLimit(limiter, identifier);
    if (!result.success) return { success: false, label, result };
  }
  return { success: true };
}
