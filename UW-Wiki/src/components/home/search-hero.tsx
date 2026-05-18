"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { MagnifierIcon } from "@/components/icons/magnifier";
import { RagMarkdown } from "@/components/search/rag-markdown";
import { toast } from "@/lib/ui/toast";

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

type PageContentToolOutput = {
  found?: boolean;
  slug?: string;
  orgName?: string;
  orgSlug?: string;
  sections?: Array<{ title: string; slug: string; body: string }>;
};

export function SearchHero({ browseSection }: { browseSection?: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <SearchHeroInner browseSection={browseSection} />
    </Suspense>
  );
}

function SearchHeroInner({ browseSection }: { browseSection?: ReactNode }) {
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/search" }),
    [],
  );
  // `messages` accumulates user/assistant turns. The /api/search route reads
  // the full history (capped at HISTORY_MAX_TURNS server-side) so follow-up
  // questions land with the previous Q&A as context — multi-turn for free.
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

  // Surface streaming errors as toasts instead of an inline error box
  useEffect(() => {
    if (error) toast.error(error.message || "Search failed. Try again.");
  }, [error]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text) return;
    // Do NOT clear `messages` — preserving history is what makes this a
    // multi-turn conversation. The new user message is appended and the
    // model sees the full history (including the previous answer).
    sendMessage({ text });
    setInput("");
  }

  const turns = useMemo(() => groupTurns(messages as UIMessageLike[]), [messages]);
  const hasMessages = turns.length > 0;
  const isStreaming = status === "streaming" || status === "submitted";

  // After a new user turn lands, snap it instantly to the top of the
  // viewport so the question is the immediate visual focus and the answer
  // streams in below. We deliberately use "instant" (not "smooth") so the
  // follow-up jumps without an animated slide — feels like the page
  // reloaded around the new question. `scroll-mt-24` on the wrapper offsets
  // the sticky SiteHeader so the question text isn't clipped.
  const latestTurnRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!hasMessages) return;
    latestTurnRef.current?.scrollIntoView({ behavior: "instant", block: "start" });
  }, [turns.length, hasMessages]);

  return (
    <>
      <section
        className={
          hasMessages
            ? "flex min-h-screen w-full flex-col gap-6 px-6 pb-40 pt-10 md:px-10 lg:px-16"
            : "relative flex min-h-[calc(100vh-65px)] w-full flex-col items-center justify-center gap-8 px-6 pb-20 md:px-10 lg:px-16"
        }
      >
        {hasMessages ? (
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-20">
            {turns.map((turn, index) => {
              const isLatest = index === turns.length - 1;
              const assistantParts = (turn.assistant?.parts ?? []) as ToolPart[];
              const assistantText = turn.assistant
                ? extractText(turn.assistant.parts)
                : "";
              const turnCitations = turn.assistant
                ? collectCitations(assistantParts)
                : [];
              const activeToolCall =
                isLatest && turn.assistant
                  ? findActiveToolCall(assistantParts)
                  : null;
              const turnIsStreaming = isLatest && isStreaming;
              const showSkeleton =
                turnIsStreaming && assistantText.length === 0 && !activeToolCall;
              return (
                <div
                  key={turn.user.id}
                  ref={isLatest ? latestTurnRef : undefined}
                  className="scroll-mt-24"
                >
                  <AnsweredView
                    questionText={extractText(turn.user.parts)}
                    assistantText={assistantText}
                    citations={turnCitations}
                    showSkeleton={showSkeleton}
                    isStreaming={turnIsStreaming}
                    activeToolCall={activeToolCall}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyHero />
        )}

        <SearchInput
          input={input}
          setInput={setInput}
          onSubmit={handleSubmit}
          isStreaming={isStreaming}
          floating={hasMessages}
          placeholder={
            hasMessages
              ? "Ask a follow-up…"
              : "Ask anything about UW organizations…"
          }
        />

        {!hasMessages ? <ScrollDownCue /> : null}
      </section>

      {/* Only render the browse-org directory when the user hasn't started
          a conversation yet. Once they ask their first question, the
          directory section disappears so the answer view owns the page. */}
      {!hasMessages ? browseSection : null}
    </>
  );
}

// Minimal shape we care about for grouping. `useChat`'s messages already
// satisfy this; the helper avoids depending on the AI SDK's full message
// type which evolves between minor versions.
type UIMessageLike = {
  id: string;
  role: string;
  parts: ReadonlyArray<{ type: string }>;
};

type ConversationTurn = {
  user: UIMessageLike;
  assistant?: UIMessageLike;
};

function groupTurns(messages: UIMessageLike[]): ConversationTurn[] {
  const turns: ConversationTurn[] = [];
  for (const message of messages) {
    if (message.role === "user") {
      turns.push({ user: message });
    } else if (message.role === "assistant" && turns.length > 0) {
      // Each user turn pairs with at most one assistant message. If the
      // assistant slot is already filled (shouldn't happen with `useChat`,
      // but defensive), the later assistant message wins.
      turns[turns.length - 1].assistant = message;
    }
  }
  return turns;
}

// Subtle grey arrow at the bottom of the empty hero that hints at the org
// directory below. Clicking smooth-scrolls to #browse-orgs (defined on the
// home page). Auto-hides once the directory enters the viewport — pure CSS
// would require restructuring; an IntersectionObserver keeps it self-contained.
function ScrollDownCue() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const target = document.getElementById("browse-orgs");
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { rootMargin: "0px 0px -40% 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  function handleClick() {
    const target = document.getElementById("browse-orgs");
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      aria-label="Browse organizations below"
      initial={{ opacity: 0 }}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.4, delay: 0.6 }}
      style={{ pointerEvents: visible ? "auto" : "none" }}
      className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1.5 text-muted-foreground/70 transition-colors duration-150 hover:text-foreground focus:outline-none"
    >
      <span className="text-xs">or browse organizations below</span>
      <motion.span
        animate={{ y: [0, 6, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden="true"
      >
        <ChevronDown className="size-5" />
      </motion.span>
    </motion.button>
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
  placeholder,
}: {
  input: string;
  setInput: (v: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  isStreaming: boolean;
  floating: boolean;
  placeholder?: string;
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
        placeholder={placeholder ?? "Ask anything about UW organizations…"}
      />
      <button
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-foreground px-5 text-sm font-medium text-background transition-opacity duration-150 hover:opacity-90 disabled:opacity-30"
        disabled={isStreaming || input.trim().length === 0}
        type="submit"
        aria-busy={isStreaming || undefined}
      >
        {isStreaming ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
        {isStreaming ? "Searching" : "Ask"}
      </button>
    </motion.form>
  );
}

function extractText(parts: ReadonlyArray<{ type: string }>): string {
  return parts
    .filter((p) => p.type === "text")
    .map((p) => ("text" in p ? (p as { text: string }).text : ""))
    .join("");
}

function findActiveToolCall(parts: ToolPart[]): { tool: string; query: string } | null {
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const part = parts[i];
    if (!part.type.startsWith("tool-")) continue;
    if (part.output !== undefined) continue;
    const toolName = part.type.slice(5);
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
    case "get_page_content":
      return "Reading the article on";
    case "list_orgs":
      return "Browsing orgs by";
    default:
      return "Searching for";
  }
}

// Build the citation list shown beneath the answer. Combines two sources:
//   - `search_wiki` chunks (each has its own citationIndex 1..N inside the
//     tool result; the model also references these as inline [N] markers).
//   - `get_page_content` reads — when the model fetched a full article, we
//     credit the whole page as a source so the user knows where the synthesis
//     came from. Indexed after the search_wiki chunks.
function collectCitations(parts: ToolPart[]): SearchChunk[] {
  const seen = new Map<string, SearchChunk>();
  let runningIndex = 0;
  for (const part of parts) {
    if (!part.type.startsWith("tool-")) continue;
    const toolName = part.type.slice(5);

    if (toolName === "search_wiki") {
      const output = part.output as SearchToolOutput | undefined;
      if (!output?.found || !output.chunks) continue;
      for (const chunk of output.chunks) {
        if (!seen.has(chunk.sourceUrl)) {
          seen.set(chunk.sourceUrl, chunk);
          runningIndex = Math.max(runningIndex, chunk.citationIndex);
        }
      }
      continue;
    }

    if (toolName === "get_page_content") {
      const output = part.output as PageContentToolOutput | undefined;
      if (!output?.found || !output.orgSlug) continue;
      const url = `/wiki/${output.orgSlug}`;
      if (seen.has(url)) continue;
      runningIndex += 1;
      seen.set(url, {
        citationIndex: runningIndex,
        orgName: output.orgName ?? output.orgSlug,
        orgSlug: output.orgSlug,
        sectionTitle: "full article",
        sectionSlug: null,
        sourceUrl: url,
      });
      continue;
    }
  }
  return [...seen.values()].sort((a, b) => a.citationIndex - b.citationIndex);
}
