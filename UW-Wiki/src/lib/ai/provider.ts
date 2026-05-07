import { createOpenAI } from "@ai-sdk/openai";
import { env } from "@/lib/config/env";

export const openrouter = createOpenAI({
  baseURL: env.OPENROUTER_BASE_URL,
  apiKey: env.OPENROUTER_API_KEY,
  headers: {
    "HTTP-Referer": env.OPENROUTER_HTTP_REFERER,
    "X-Title": env.OPENROUTER_X_TITLE,
  },
});
