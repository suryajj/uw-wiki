"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

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
      className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 md:flex-row"
    >
      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Ask anything about UW clubs, teams, and programs..."
        className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        aria-label="Ask UW Wiki"
      />
      <Button type="submit" disabled={!query.trim()}>
        Ask
      </Button>
    </form>
  );
}
