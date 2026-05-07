import "server-only";

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

export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string,
): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}> {
  const result = await limiter.limit(identifier);
  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}

export function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}
