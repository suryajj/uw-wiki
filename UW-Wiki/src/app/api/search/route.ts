import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { openrouter } from "@/lib/ai/provider";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: openrouter("google/gemini-2.5-flash"),
    system:
      "You are UW Wiki's AI search assistant. Real retrieval tools wire up in FRD-1.",
    messages: convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
