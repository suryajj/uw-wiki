"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { AnimatePresence, motion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { MagnifierIcon } from "@/components/icons/magnifier";
import { RagMarkdown } from "@/components/search/rag-markdown";

type ToolPart = {
  type: string;
  toolName?: string;
  state?: string;
  input?: unknown;
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
  const { messages, status, sendMessage, setMessages, error } = useChat({ transport });
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
    // Single-shot view: clear prior Q/A before asking again
    setMessages([]);
    sendMessage({ text });
    setInput("");
  }

  const hasMessages = messages.length > 0;
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const assistantText = lastAssistant
    ? lastAssistant.parts
        .filter((p) => p.type === "text")
        .map((p) => ("text" in p ? (p as { text: string }).text : ""))
        .join("")
    : "";
  const citations = lastAssistant
    ? collectCitations(lastAssistant.parts as ToolPart[])
    : [];
  const activeToolCall = lastAssistant
    ? findActiveToolCall(lastAssistant.parts as ToolPart[])
    : null;
  const isStreaming = status === "streaming" || status === "submitted";
  const showSkeleton = isStreaming && assistantText.length === 0 && !activeToolCall;

  return (
    <main
      className={
        hasMessages
          ? "flex min-h-screen w-full flex-col gap-6 px-6 pb-40 pt-10 md:px-10 lg:px-16"
          : "flex min-h-[calc(100vh-65px)] w-full flex-col items-center justify-center gap-8 px-6 pb-20 md:px-10 lg:px-16"
      }
    >
      {hasMessages ? (
        <AnsweredView
          questionText={lastUser ? extractText(lastUser.parts) : ""}
          assistantText={assistantText}
          citations={citations}
          showSkeleton={showSkeleton}
          isStreaming={isStreaming}
          activeToolCall={activeToolCall}
        />
      ) : (
        <EmptyHero />
      )}

      {error ? (
        <p className="border border-border p-3 text-sm text-foreground">
          {error.message}
        </p>
      ) : null}

      <SearchInput
        input={input}
        setInput={setInput}
        onSubmit={handleSubmit}
        isStreaming={isStreaming}
        floating={hasMessages}
      />
    </main>
  );
}

function EmptyHero() {
  return (
    <div className="flex w-full max-w-3xl flex-col items-center gap-4 text-center">
      <motion.h1
        initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="text-5xl font-semibold tracking-tight text-foreground md:text-6xl"
      >
        Ask UW Wiki
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="max-w-xl text-base text-muted-foreground"
      >
        Ask about UW clubs, design teams, and campus organizations.
      </motion.p>
    </div>
  );
}

function AnsweredView({
  questionText,
  assistantText,
  citations,
  showSkeleton,
  isStreaming,
  activeToolCall,
}: {
  questionText: string;
  assistantText: string;
  citations: SearchChunk[];
  showSkeleton: boolean;
  isStreaming: boolean;
  activeToolCall: { tool: string; query: string } | null;
}) {
  return (
    <div className="flex w-full max-w-4xl flex-col gap-8">
      <motion.h1
        key={questionText}
        initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl lg:text-5xl"
      >
        {questionText}
      </motion.h1>

      <AnimatePresence mode="wait">
        {activeToolCall && assistantText.length === 0 ? (
          <motion.div
            key={`tool-${activeToolCall.tool}-${activeToolCall.query}`}
            initial={{ opacity: 0, y: 4, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(4px)" }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <MagnifierIcon className="text-muted-foreground" />
            <span>
              {toolLabel(activeToolCall.tool)}{" "}
              <span className="font-mono text-foreground">
                {activeToolCall.query}
              </span>
              <span className="ml-1 inline-block animate-pulse">…</span>
            </span>
          </motion.div>
        ) : showSkeleton ? (
          <SkeletonAnswer key="skeleton" />
        ) : (
          <motion.div
            key={`answer-${questionText}`}
            initial={{ opacity: 0, filter: "blur(4px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <RagMarkdown>{assistantText}</RagMarkdown>
            {isStreaming ? (
              <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-foreground align-middle" />
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>

      {citations.length > 0 ? (
        <motion.ol
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex flex-col gap-1 border-t border-border pt-4 text-xs text-muted-foreground"
        >
          {citations.map((c) => (
            <li key={`${c.citationIndex}-${c.sourceUrl}`}>
              <span className="text-foreground">[{c.citationIndex}]</span>{" "}
              <a
                className="underline-offset-4 hover:underline"
                href={c.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {c.orgName}
                {c.sectionTitle ? ` — ${c.sectionTitle}` : ""}
              </a>
            </li>
          ))}
        </motion.ol>
      ) : null}
    </div>
  );
}

function SkeletonAnswer() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-2"
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block h-2 w-2 rounded-full bg-muted-foreground"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.18,
          }}
        />
      ))}
    </motion.div>
  );
}

function SearchInput({
  input,
  setInput,
  onSubmit,
  isStreaming,
  floating,
}: {
  input: string;
  setInput: (v: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  isStreaming: boolean;
  floating: boolean;
}) {
  const formClass = floating
    ? "fixed bottom-6 left-1/2 z-30 flex w-[min(720px,calc(100%-3rem))] -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-[color:var(--background)]/85 px-4 py-2 backdrop-blur transition-colors duration-150 focus-within:border-foreground"
    : "flex w-full max-w-2xl items-center gap-2 rounded-full border border-border bg-transparent px-4 py-2 transition-colors duration-150 focus-within:border-foreground";
  return (
    <motion.form
      onSubmit={onSubmit}
      className={formClass}
      initial={floating ? { opacity: 0, y: 12 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <MagnifierIcon className="shrink-0 text-muted-foreground" />
      <input
        className="h-9 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ask anything about UW organizations…"
      />
      <button
        className="inline-flex h-9 items-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-opacity duration-150 hover:opacity-90 disabled:opacity-30"
        disabled={isStreaming || input.trim().length === 0}
        type="submit"
      >
        {isStreaming ? "Searching…" : "Ask"}
      </button>
    </motion.form>
  );
}

function extractText(parts: { type: string }[]): string {
  return parts
    .filter((p) => p.type === "text")
    .map((p) => ("text" in p ? (p as { text: string }).text : ""))
    .join("");
}

function findActiveToolCall(parts: ToolPart[]): { tool: string; query: string } | null {
  // The AI SDK streams parts like { type: "tool-search_wiki", state: "input-available", input: {...} }
  // followed by an "output-available" update on the same logical part. We pick
  // the most recent tool part whose output hasn't arrived yet.
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const part = parts[i];
    if (!part.type.startsWith("tool-")) continue;
    if (part.output !== undefined) continue; // already finished — skip
    const toolName = part.type.slice(5); // strip "tool-"
    const input = (part.input ?? {}) as Record<string, unknown>;
    const query =
      typeof input.query === "string"
        ? input.query
        : Array.isArray(input.orgs)
          ? (input.orgs as Array<{ name?: string; slug?: string }>)
              .map((o) => o.name ?? o.slug ?? "")
              .filter(Boolean)
              .join(", ")
          : "";
    if (!query) return null;
    return { tool: toolName, query };
  }
  return null;
}

function toolLabel(tool: string): string {
  switch (tool) {
    case "search_wiki":
      return "Searching the wiki for";
    case "get_org_data":
      return "Looking up";
    case "list_orgs":
      return "Browsing orgs by";
    default:
      return "Searching for";
  }
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
