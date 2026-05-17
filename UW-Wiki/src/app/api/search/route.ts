import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { z } from "zod";

import { SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { ragTools } from "@/lib/ai/tools";
import { openrouter } from "@/lib/ai/provider";
import { apiError, logServerError, parseJson } from "@/lib/api/errors";
import {
  checkRateLimit,
  createRateLimiter,
  hashClientIp,
  retryAfterSeconds,
} from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_QUERY_LENGTH = 3000;
const HISTORY_MAX_TURNS = 8;
const anonymousLimiter = createRateLimiter(10, "1 m");
const authenticatedLimiter = createRateLimiter(30, "1 m");

const messagePartSchema = z
  .object({
    type: z.string(),
    text: z.string().optional(),
  })
  .passthrough();

const messageSchema = z
  .object({
    id: z.string(),
    role: z.enum(["system", "user", "assistant", "tool", "data"]),
    parts: z.array(messagePartSchema).optional(),
    content: z.string().optional(),
  })
  .passthrough();

const requestSchema = z.object({
  messages: z.array(messageSchema).min(1),
});

export async function POST(req: Request) {
  const parsed = await parseJson(req, requestSchema);
  if (!parsed.ok) return parsed.response;

  const messages = sanitizeMessages(parsed.data.messages as UIMessage[]);
  if (latestUserText(messages).length < 2) {
    return apiError("VALIDATION_FAILED", "Query must be at least 2 characters.");
  }

  const user = await getAuthenticatedUserId();
  const limiter = user ? authenticatedLimiter : anonymousLimiter;
  const identifier = user ?? `ip:${hashClientIp(req)}`;
  const rateLimit = await checkRateLimit(limiter, identifier);

  if (!rateLimit.success) {
    return apiError(
      "RATE_LIMITED",
      "You're searching too fast — please wait a moment.",
      {
        headers: {
          "Retry-After": retryAfterSeconds(rateLimit.reset).toString(),
        },
      },
    );
  }

  const result = streamText({
    model: openrouter.chat("google/gemini-2.5-flash"),
    system: SYSTEM_PROMPT,
    messages: convertToModelMessages(messages),
    tools: ragTools,
    // 8 steps is enough for: get_org_data → get_page_content → optional
    // search_wiki follow-up, plus a multi-org compare (two reads in parallel).
    stopWhen: stepCountIs(8),
    // 4500 tokens supports a full article-grounded synthesis (Overview +
    // Curriculum + Co-op + Culture + etc.) plus a multi-org comparison
    // without truncation; previously 1200, which forced one-liner answers.
    maxOutputTokens: 4500,
    onError: ({ error }) => logServerError("api.search.stream", error),
  });

  return result.toUIMessageStreamResponse();
}

async function getAuthenticatedUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Strip control characters from text payloads, cap the latest user turn at
 * `MAX_QUERY_LENGTH`, and keep only the most recent `HISTORY_MAX_TURNS`
 * messages — FRD-1 §8.2 caps server-side history.
 */
function sanitizeMessages(messages: UIMessage[]): UIMessage[] {
  const trimmed = messages.slice(-HISTORY_MAX_TURNS);
  let truncatedLatest = false;
  return trimmed.map((message, index) => {
    const isLastUser =
      index === trimmed.length - 1 && message.role === "user";
    const sanitizedParts = (message.parts ?? []).map((part) => {
      const node = part as Record<string, unknown>;
      const value = typeof node.text === "string" ? node.text : null;
      if (value === null) return part;
      let cleaned = value.replace(/[\u0000-\u001F\u007F]/g, " ");
      if (isLastUser && cleaned.length > MAX_QUERY_LENGTH) {
        cleaned = cleaned.slice(0, MAX_QUERY_LENGTH);
        truncatedLatest = true;
      }
      return { ...node, text: cleaned } as typeof part;
    });
    void truncatedLatest;
    return { ...message, parts: sanitizedParts } as UIMessage;
  });
}

function latestUserText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== "user") continue;
    const text = (message.parts ?? [])
      .map((part) => {
        const node = part as { text?: unknown };
        return typeof node.text === "string" ? node.text : "";
      })
      .join(" ")
      .trim();
    if (text) return text;
  }
  return "";
}
