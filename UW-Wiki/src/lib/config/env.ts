// Server-side environment validation. Import this in server code only
// (route handlers, server components, middleware, server-only modules).
//
// For client components, use NEXT_PUBLIC_* values directly via process.env
// or import from "@/lib/config/env-client".

import "server-only";
import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  OPENROUTER_API_KEY: z.string().min(1),
  OPENROUTER_BASE_URL: z.string().url(),
  OPENROUTER_HTTP_REFERER: z.string().min(1),
  OPENROUTER_X_TITLE: z.string().min(1),
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  TAVILY_API_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  POSTHOG_KEY: z.string().optional(),
  POSTHOG_HOST: z.string().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  FEATURE_FLAG_LOCAL_SUPABASE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const formatted = parsed.error.flatten().fieldErrors;
  const missing = Object.entries(formatted)
    .map(([key, errs]) => `  ${key}: ${errs?.join(", ")}`)
    .join("\n");
  throw new Error(
    `Invalid environment variables:\n${missing}\n\n` +
      `Copy .env.example to .env.local and fill required values.`,
  );
}

export const env = parsed.data;
export type Env = typeof env;
