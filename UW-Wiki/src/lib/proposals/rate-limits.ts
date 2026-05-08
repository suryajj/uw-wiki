import "server-only";

import { apiError } from "@/lib/api/errors";
import {
  checkRateLimit,
  createRateLimiter,
  hashClientIp,
  retryAfterSeconds,
} from "@/lib/rate-limit";
import type { CurrentUser } from "@/lib/auth/current-user";

const proposalAnonymous = createRateLimiter(3, "1 h");
const proposalAuthenticated = createRateLimiter(5, "1 h");
const patchsetLimiter = createRateLimiter(3, "10 m");

const TOO_FAST = "Too many proposals — please wait before submitting again.";
const TOO_FAST_PATCHSET =
  "You're submitting patchsets too quickly — please wait a moment.";

export async function enforceProposalCreateLimit(
  req: Request,
  user: CurrentUser | null,
): Promise<Response | null> {
  const limiter = user ? proposalAuthenticated : proposalAnonymous;
  const identifier = user
    ? `proposals:create:user:${user.id}`
    : `proposals:create:ip:${hashClientIp(req)}`;
  const result = await checkRateLimit(limiter, identifier);
  if (result.success) return null;
  return apiError("RATE_LIMITED", TOO_FAST, {
    headers: { "Retry-After": retryAfterSeconds(result.reset).toString() },
  });
}

export async function enforcePatchsetLimit(
  user: CurrentUser,
  proposalId: string,
): Promise<Response | null> {
  const result = await checkRateLimit(
    patchsetLimiter,
    `proposals:patchset:${user.id}:${proposalId}`,
  );
  if (result.success) return null;
  return apiError("RATE_LIMITED", TOO_FAST_PATCHSET, {
    headers: { "Retry-After": retryAfterSeconds(result.reset).toString() },
  });
}
