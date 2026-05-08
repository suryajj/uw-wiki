"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useMemo, useState, type FormEvent } from "react";

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
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/search" }),
    [],
  );
  const { messages, status, sendMessage, error } = useChat({ transport });
  const [input, setInput] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text) return;
    sendMessage({ text });
    setInput("");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 p-8">
      <div>
        <h1 className="text-3xl font-semibold text-primary">Ask UW Wiki</h1>
        <p className="mt-2 text-muted-foreground">
          Ask about UW clubs, design teams, societies, and campus organizations.
        </p>
      </div>

      <section className="flex-1 space-y-4 rounded-lg border bg-card p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Try: What is WATonomous like? or Which design teams use ROS2?
          </p>
        ) : (
          messages.map((message) => {
            const citations = collectCitations(message.parts as ToolPart[]);
            return (
              <div key={message.id} className="rounded-md border p-3">
                <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                  {message.role}
                </div>
                <div className="whitespace-pre-wrap text-sm leading-6">
                  {message.parts.map((part, index) => {
                    if (part.type === "text") {
                      return <span key={index}>{part.text}</span>;
                    }
                    if (part.type.startsWith("tool-")) {
                      return (
                        <span key={index} className="block text-muted-foreground">
                          [{part.type.replace("tool-", "")} tool call]
                        </span>
                      );
                    }
                    return null;
                  })}
                </div>
                {citations.length > 0 ? (
                  <ol className="mt-3 space-y-1 border-t border-border pt-2 text-xs text-muted-foreground">
                    {citations.map((citation) => (
                      <li key={`${citation.citationIndex}-${citation.sourceUrl}`}>
                        <span className="text-primary">[{citation.citationIndex}]</span>{" "}
                        <a className="underline" href={citation.sourceUrl}>
                          {citation.orgName}
                          {citation.sectionTitle ? ` — ${citation.sectionTitle}` : ""}
                        </a>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </div>
            );
          })
        )}
      </section>

      {error ? (
        <p className="rounded-md border border-destructive p-3 text-sm text-destructive">
          {error.message}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          className="flex-1 rounded-md border bg-background px-3 py-2 outline-none ring-primary focus:ring-2"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask anything about UW organizations..."
        />
        <button
          className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50"
          disabled={status === "streaming" || input.trim().length === 0}
          type="submit"
        >
          {status === "streaming" ? "Searching..." : "Ask"}
        </button>
      </form>
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
