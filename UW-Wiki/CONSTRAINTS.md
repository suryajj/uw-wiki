# UW Wiki — Implementation Constraints

This document captures concrete rules, version-specific gotchas, and hard constraints that are not obvious from reading the FRDs alone. An agent implementing any FRD **must read this document first** and follow these rules throughout. Violations will produce code that looks plausible but fails at runtime.

---

## 1. Tailwind CSS v4 — CSS-First Configuration

**The single highest-risk assumption an agent can make:** Tailwind v4 does NOT use `tailwind.config.ts` or `tailwind.config.js`. The entire project config lives in CSS.

### What to do

`globals.css` is the only configuration file:

```css
@import "tailwindcss";

@theme inline {
  /* Map shadcn/ui CSS variables to Tailwind theme tokens */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-border: var(--border);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-destructive: var(--destructive);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

:root {
  /* UW Wiki dark theme — from PRD §12 */
  --background: oklch(0.09 0 0);           /* #0a0a0a near-black */
  --foreground: oklch(1 0 0);              /* white */
  --card: oklch(0.12 0 0);                 /* #141414 dark grey */
  --card-foreground: oklch(1 0 0);
  --muted: oklch(0.18 0 0);
  --muted-foreground: oklch(0.65 0 0);     /* zinc-400 equivalent */
  --border: oklch(0.22 0 0);              /* #262626 */
  --primary: oklch(0.82 0.16 87);          /* UW Gold #FEC93B */
  --primary-foreground: oklch(0.09 0 0);
  --secondary: oklch(0.18 0 0);
  --secondary-foreground: oklch(1 0 0);
  --accent: oklch(0.18 0 0);
  --accent-foreground: oklch(1 0 0);
  --destructive: oklch(0.577 0.245 27.33); /* red-500 */
  --radius: 0.625rem;
}
```

`postcss.config.mjs`:

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
export default config;
```

**No `tailwind.config.ts`.** Do not create one.

### What NOT to do

```css
/* WRONG — v3 syntax, breaks in v4 */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

```ts
// WRONG — do not create this file
// tailwind.config.ts
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: { colors: { gold: "#FEC93B" } } },
};
```

### shadcn/ui Initialization (Tailwind v4 path)

shadcn uses a different setup flow with Tailwind v4. Run `npx shadcn@latest init` — it will detect v4 and configure CSS variables in `globals.css` using `oklch` colors and `@theme inline`. Do not follow the v3 shadcn setup instructions (which configure `tailwind.config.ts`).

After `init`, add components individually: `npx shadcn@latest add button card dialog etc.`

---

## 2. Vercel AI SDK v5 — Import Paths and Streaming Pattern

AI SDK v5 (`ai@5.x`) has breaking import path changes from v4. An agent with v4 knowledge will produce silently broken code.

### Import paths

| What | v4 (WRONG) | v5 (CORRECT) |
|---|---|---|
| `useChat` hook | `import { useChat } from "ai/react"` | `import { useChat } from "@ai-sdk/react"` |
| `useCompletion` | `import { useCompletion } from "ai/react"` | `import { useCompletion } from "@ai-sdk/react"` |
| `streamText` | `import { streamText } from "ai"` | `import { streamText } from "ai"` ✓ (unchanged) |
| `generateText` | `import { generateText } from "ai"` | `import { generateText } from "ai"` ✓ |
| `generateObject` | `import { generateObject } from "ai"` | `import { generateObject } from "ai"` ✓ |
| Stream response | `result.toDataStreamResponse()` | `result.toUIMessageStreamResponse()` |
| Message type | `Message` | `UIMessage` |
| Convert messages | N/A | `convertToModelMessages(messages)` |

### Streaming route handler pattern (v5)

```typescript
// src/app/api/search/route.ts
import { streamText, UIMessage, convertToModelMessages } from "ai";
import { openrouter } from "@/lib/ai/provider";

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  
  const result = streamText({
    model: openrouter("google/gemini-2.5-flash"),
    messages: convertToModelMessages(messages),
    tools: { /* ... */ },
  });
  
  return result.toUIMessageStreamResponse();
}
```

### useChat pattern (v5)

```typescript
// Client component
import { useChat } from "@ai-sdk/react";
import { ChatStore, TextStreamChatTransport } from "ai";

// Simple pattern (preferred for MVP):
const { messages, input, handleSubmit, handleInputChange, status } = useChat({
  api: "/api/search",
});

// Or explicit transport pattern if needed:
const { messages, input, handleSubmit } = useChat({
  chatStore: new ChatStore({
    transport: new TextStreamChatTransport({ api: "/api/search" }),
  }),
});
```

---

## 3. Zod Version

Use **Zod v3** (`zod@^3`). Do not upgrade to Zod v4 for MVP.

- `ai@5.x` schema utilities are tested against Zod v3
- FRD-5's `generateObject` schemas use Zod v3 API
- Zod v4 has breaking changes (`z.string().email()` behavior, `.parse()` error format)

FRD-0 says "3.x or 4.x (AI SDK v5-compatible)" — choose 3.x.

---

## 4. Migration File Numbering Convention

Each FRD that adds schema gets a numbered migration file. The naming convention is `00N_description.sql` where N is the FRD number; if an FRD later needs a second DB object migration, suffix the same number with an extra digit (for example `0011_...`) so it sorts after that FRD's baseline work and before later FRDs.

| FRD | Migration File | Notes |
|---|---|---|
| FRD-0 | `001_init_foundation.sql` | All baseline tables + FRD 2/3 forward-compat fields |
| FRD-1 | `0011_rag_search_functions.sql` | `chunks` schema is in FRD-0, but pgvector/FTS search RPCs live here |
| FRD-2 | `002_wiki_pages.sql` | `ALTER TABLE` additions for affiliation model |
| FRD-3 | `003_comments.sql` | `ALTER TABLE comments` for votes, hidden, etc. |
| FRD-4 | `004_pr_edit_system.sql` | `ALTER TABLE edit_proposals` additions |
| FRD-5 | `005_cold_start.sql` | `cold_start_jobs` table |
| FRD-6 | `006_auth_ui.sql` | Display name constraints, `user_affiliations` table |
| FRD-7 | `007_admin_dashboard.sql` | `admin_activity_log` table |
| FRD-8 | *(no migration)* | `bookmarks` table already in FRD-0 baseline |
| FRD-9 | `009_notifications.sql` | `notifications` schema update, `notification_preferences` table |

**Rule:** Never modify `001_init_foundation.sql` after FRD-0 is done. All subsequent schema changes go in their FRD's numbered migration.

---

## 5. Environment Variables — Complete List

FRD-0 Appendix B lists most vars. These additional vars are defined in their respective FRDs but **must also appear in `.env.example`**:

| Variable | Defined In | Scope | Required | Purpose |
|---|---|---|---|---|
| `TAVILY_API_KEY` | FRD-5 §14 | Server only | Yes (for cold start) | Tavily web search/extract API |
| `RESEND_API_KEY` | FRD-9 §5.1 | Server only | Yes (for email notifications) | Resend email delivery |
| `EMAIL_FROM` | FRD-9 §5.1 | Server only | Yes | Sender address (`notifications@uw-wiki.ca`) |

Complete `.env.example` must include all vars from FRD-0 Appendix B **plus** these three. The `TAVILY_API_KEY` check should be a soft warn (cold start degrades gracefully); `RESEND_API_KEY` and `EMAIL_FROM` are required for FRD-9 email delivery.

---

## 6. TypeScript Conventions

- **Strict mode required.** `tsconfig.json` must have `"strict": true`. FRD-0 §5.1 mandates this.
- **No `any` type.** Use `unknown` and narrow. Using `any` defeats strict mode.
- **Database types** go in `src/types/database.ts` — these are the raw Supabase row types matching table columns exactly.
- **Domain types** go in `src/types/domain.ts` — these are application-layer types derived from DB types (e.g. with joins resolved, computed fields added).
- **Never import server-only modules in client components.** Next.js will catch this at build, but structurally: anything under `src/lib/supabase/server.ts` or `src/lib/supabase/admin.ts` must only be imported in route handlers, server components, and middleware.

---

## 7. API Error Response Shape

All API routes must return errors in this shape. No exceptions:

```typescript
// Success: HTTP 2xx
Response.json({ /* payload */ })

// Error: HTTP 4xx/5xx
Response.json({ error: "Human-readable message" }, { status: NNN })
```

**Standard status codes used in this project:**

| Code | When |
|---|---|
| 400 | Malformed request body / invalid input |
| 401 | No session (missing auth) |
| 403 | Authenticated but wrong role |
| 404 | Resource not found |
| 409 | Conflict (e.g. duplicate vote) |
| 422 | Validation failed (Zod parse error) — use this instead of 400 for validation |
| 429 | Rate limit exceeded |
| 500 | Unexpected server error |

Never expose raw DB errors, stack traces, or internal IDs in error responses.

---

## 8. Server-Side Rendering Constraints

- **Wiki page view (`/wiki/[slug]`)** must be SSR (`export const dynamic = "force-dynamic"` or default dynamic). It is the SEO-critical route.
- **Directory (`/`)** can be statically generated or ISR with short revalidation.
- **Admin routes** must be server-rendered — never expose admin data via client fetches.
- **Streaming routes (`/api/search`)** must set `export const runtime = "nodejs"` (not edge) because pgvector operations require Node.js crypto primitives.

---

## 9. Do Not

| Forbidden | Why |
|---|---|
| Create `tailwind.config.ts` | Tailwind v4 is CSS-first; this file is ignored |
| Use `import { useChat } from "ai"` | v5 moved it to `@ai-sdk/react` |
| Use `result.toDataStreamResponse()` | v5 renamed it to `toUIMessageStreamResponse()` |
| Use `Message` type from `ai` | v5 uses `UIMessage` |
| Add columns to `001_init_foundation.sql` after FRD-0 | Use the FRD-specific migration file instead |
| Expose `SUPABASE_SERVICE_ROLE_KEY` or `OPENROUTER_API_KEY` to client | Server-only secrets |
| Hard-code org slugs, university IDs, or UUIDs | Use seed data + environment-agnostic queries |
| Write `SELECT *` queries | Always select specific columns to avoid type drift |
| Use Zod v4 | Use Zod v3; AI SDK v5 compatibility is tested against v3 |
| Create Tailwind classes with string interpolation (e.g. `` `bg-${color}-500` ``) | Tailwind v4 cannot statically analyze dynamic class names |
