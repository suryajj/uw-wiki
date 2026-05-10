"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function DirectorySearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = query.trim();
    if (!text) return;
    router.push(`/search?q=${encodeURIComponent(text)}`);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex w-full items-center gap-2 rounded-full border border-border bg-transparent px-4 py-2 transition-colors duration-150 focus-within:border-foreground"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 text-muted-foreground"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Ask anything about UW clubs, teams, and programs…"
        className="h-9 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
        aria-label="Ask UW Wiki"
      />
      <button
        type="submit"
        disabled={!query.trim()}
        className="inline-flex h-9 items-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-opacity duration-150 hover:opacity-90 disabled:opacity-30"
      >
        Ask
      </button>
    </form>
  );
}
