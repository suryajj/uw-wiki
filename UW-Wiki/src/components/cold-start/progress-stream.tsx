"use client";

import { AnimatePresence, motion } from "framer-motion";

import { MagnifierIcon } from "@/components/icons/magnifier";
import type { ColdStartProgressEvent } from "@/lib/cold-start/progress-events";

type Props = {
  events: ColdStartProgressEvent[];
  isStreaming: boolean;
};

const MAX_TAIL = 6;

export function ColdStartProgressStream({ events, isStreaming }: Props) {
  const currentPhase = [...events].reverse().find((e) => e.kind === "phase");
  const phaseLabel =
    currentPhase?.kind === "phase" ? currentPhase.label : isStreaming ? "Starting…" : "Idle";

  const lastSnippet = [...events]
    .reverse()
    .find((e): e is Extract<ColdStartProgressEvent, { kind: "snippet" }> => e.kind === "snippet");
  const snippetCount = lastSnippet?.count;

  const searches = events
    .filter((e): e is Extract<ColdStartProgressEvent, { kind: "search" }> => e.kind === "search")
    .slice(-MAX_TAIL);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2 w-2">
            {isStreaming ? (
              <>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foreground opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-foreground" />
              </>
            ) : (
              <span className="relative inline-flex h-2 w-2 rounded-full bg-muted-foreground" />
            )}
          </span>
          <motion.span
            key={phaseLabel}
            initial={{ opacity: 0, y: 4, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="text-sm font-medium text-foreground"
          >
            {phaseLabel}
          </motion.span>
        </div>
        {typeof snippetCount === "number" ? (
          <span className="text-xs text-muted-foreground">
            {snippetCount} {snippetCount === 1 ? "source" : "sources"} found
          </span>
        ) : null}
      </div>
      <ol className="mt-3 flex flex-col gap-1.5">
        <AnimatePresence initial={false}>
          {searches.map((event, idx) => (
            <motion.li
              key={`${event.query}-${idx}`}
              initial={{ opacity: 0, x: -6, filter: "blur(4px)" }}
              animate={{
                opacity: idx === searches.length - 1 ? 1 : 0.55,
                x: 0,
                filter: "blur(0px)",
              }}
              exit={{ opacity: 0, x: 6 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="flex items-start gap-2 font-mono text-xs text-muted-foreground"
            >
              <MagnifierIcon className="mt-0.5 shrink-0 text-muted-foreground" />
              <span className="truncate">
                <span className="text-foreground">{event.source}</span>{" "}
                <span>{event.query}</span>
              </span>
            </motion.li>
          ))}
        </AnimatePresence>
        {searches.length === 0 && isStreaming ? (
          <li className="text-xs text-muted-foreground">Preparing search queries…</li>
        ) : null}
      </ol>
    </div>
  );
}
