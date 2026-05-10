"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

type ToolPart = {
  type: string;
  toolName?: string;
  output?: unknown;
};

type SearchChunk = {
  citationIndex: number;
  orgName: string;
  orgSlug: string;
  sectionTitle: string | null;
  sectionSlug: string | null;
  sourceUrl: string;
};

type SearchToolOutput = {
  found?: boolean;
  chunks?: SearchChunk[];
  suggestedPages?: Array<{ orgName: string; orgSlug: string }>;
};

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchPageInner />
    </Suspense>
  );
}

function SearchPageInner() {
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/search" }),
    [],
  );
  const { messages, status, sendMessage, error } = useChat({ transport });
  const [input, setInput] = useState("");
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q")?.trim() ?? "";
  const autoSubmittedRef = useRef(false);

  useEffect(() => {
    if (autoSubmittedRef.current) return;
    if (!initialQuery) return;
    autoSubmittedRef.current = true;
    sendMessage({ text: initialQuery });
  }, [initialQuery, sendMessage]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text) return;
    sendMessage({ text });
    setInput("");
  }

  return (
    <main className="flex min-h-screen w-full flex-col gap-8 px-6 py-10 md:px-10 lg:px-16">
      <div className="flex flex-col gap-3">
        <h1 className="text-5xl font-semibold tracking-tight text-foreground">Ask UW Wiki</h1>
        <p className="max-w-2xl text-base text-muted-foreground">
          Ask about UW clubs, design teams, societies, and campus organizations.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex w-full items-center gap-2 rounded-full border border-border bg-transparent px-4 py-2 transition-colors duration-150 focus-within:border-foreground">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted-foreground" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
        <input
          className="h-9 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask anything about UW organizations…"
        />
        <button
          className="inline-flex h-9 items-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-opacity duration-150 hover:opacity-90 disabled:opacity-30"
          disabled={status === "streaming" || input.trim().length === 0}
          type="submit"
        >
          {status === "streaming" ? "Searching…" : "Ask"}
        </button>
      </form>

      <section className="flex flex-col">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Try: <span className="text-foreground">What is WATonomous like?</span> or <span className="text-foreground">Which design teams use ROS2?</span>
          </p>
        ) : (
          messages.map((message) => {
            const citations = collectCitations(message.parts as ToolPart[]);
            return (
              <article key={message.id} className="border-b border-border py-6 last:border-b-0">
                <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  {message.role}
                </div>
                <div className="whitespace-pre-wrap text-base leading-relaxed text-foreground">
                  {message.parts.map((part, index) => {
                    if (part.type === "text") {
                      return <span key={index}>{part.text}</span>;
                    }
                    if (part.type.startsWith("tool-")) {
                      return (
                        <span key={index} className="block text-sm italic text-muted-foreground">
                          [{part.type.replace("tool-", "")}]
                        </span>
                      );
                    }
                    return null;
                  })}
                </div>
                {citations.length > 0 ? (
                  <ol className="mt-4 flex flex-col gap-1 border-t border-border pt-3 text-xs text-muted-foreground">
                    {citations.map((citation) => (
                      <li key={`${citation.citationIndex}-${citation.sourceUrl}`}>
                        <span className="text-foreground">[{citation.citationIndex}]</span>{" "}
                        <a className="underline-offset-4 hover:underline" href={citation.sourceUrl}>
                          {citation.orgName}
                          {citation.sectionTitle ? ` — ${citation.sectionTitle}` : ""}
                        </a>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </article>
            );
          })
        )}
      </section>

      {error ? (
        <p className="border border-[color:var(--color-destructive)] p-3 text-sm text-[color:var(--color-destructive)]">
          {error.message}
        </p>
      ) : null}
    </main>
  );
}

function collectCitations(parts: ToolPart[]): SearchChunk[] {
  const seen = new Map<string, SearchChunk>();
  for (const part of parts) {
    if (!part.type.startsWith("tool-")) continue;
    const output = part.output as SearchToolOutput | undefined;
    if (!output?.found || !output.chunks) continue;
    for (const chunk of output.chunks) {
      if (!seen.has(chunk.sourceUrl)) seen.set(chunk.sourceUrl, chunk);
    }
  }
  return [...seen.values()].sort((a, b) => a.citationIndex - b.citationIndex);
}
