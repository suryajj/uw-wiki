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
import {
  checkRateLimit,
  createRateLimiter,
  getClientIp,
} from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_QUERY_LENGTH = 3000;
const anonymousLimiter = createRateLimiter(10, "1 m");
const authenticatedLimiter = createRateLimiter(30, "1 m");

const requestSchema = z.object({
  messages: z.array(z.unknown()).min(1),
});

export async function POST(req: Request) {
  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body." }, { status: 422 });
  }

  const messages = sanitizeMessages(parsed.data.messages as UIMessage[]);
  const user = await getAuthenticatedUserId();
  const limiter = user ? authenticatedLimiter : anonymousLimiter;
  const identifier = user ?? getClientIp(req);
  const rateLimit = await checkRateLimit(limiter, identifier);

  if (!rateLimit.success) {
    return Response.json(
      { error: "You're searching too fast — please wait a moment." },
      {
        status: 429,
        headers: {
          "Retry-After": Math.max(
            1,
            Math.ceil((rateLimit.reset - Date.now()) / 1000),
          ).toString(),
        },
      },
    );
  }

  const result = streamText({
    model: openrouter.chat("google/gemini-2.5-flash"),
    system: SYSTEM_PROMPT,
    messages: convertToModelMessages(messages),
    tools: ragTools,
    stopWhen: stepCountIs(5),
    maxOutputTokens: 1200,
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

function sanitizeMessages(messages: UIMessage[]): UIMessage[] {
  return messages.map((message) =>
    JSON.parse(
      JSON.stringify(message)
        .replace(/[\u0000-\u001F\u007F]/g, " ")
        .slice(0, MAX_QUERY_LENGTH * 2),
    ) as UIMessage,
  );
}
