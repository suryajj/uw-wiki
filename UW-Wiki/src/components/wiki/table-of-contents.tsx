"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export type TocEntry = {
  id: string;
  title: string;
  level: number;
};

export function TableOfContents({ entries }: { entries: TocEntry[] }) {
  const [activeId, setActiveId] = useState(entries[0]?.id ?? "");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (observed) => {
        for (const entry of observed) {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        }
      },
      { rootMargin: "-96px 0px -60% 0px" },
    );

    for (const entry of entries) {
      const el = document.getElementById(entry.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [entries]);

  if (entries.length === 0) return null;

  return (
    <>
      {/* Desktop: sticky sidebar. */}
      <nav
        aria-label="On this page"
        className="sticky top-8 hidden max-h-[calc(100vh-4rem)] w-52 overflow-y-auto lg:block"
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          On this page
        </p>
        <TocList entries={entries} activeId={activeId} />
      </nav>

      {/* Mobile / tablet: collapsible dropdown so users still get section
          navigation per FRD-2 §2.2. */}
      <details
        className="lg:hidden rounded-md border border-border bg-card"
        open={mobileOpen}
        onToggle={(event) => {
          if (event.currentTarget instanceof HTMLDetailsElement) {
            setMobileOpen(event.currentTarget.open);
          }
        }}
      >
        <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm">
          <span>On this page</span>
          <span className="text-xs text-muted-foreground">
            {entries.length} sections
          </span>
        </summary>
        <div className="border-t border-border p-3">
          <TocList
            entries={entries}
            activeId={activeId}
            onSelect={() => setMobileOpen(false)}
          />
        </div>
      </details>
    </>
  );
}

function TocList({
  entries,
  activeId,
  onSelect,
}: {
  entries: TocEntry[];
  activeId: string;
  onSelect?: () => void;
}) {
  return (
    <div className="space-y-1">
      {entries.map((entry) => (
        <a
          key={entry.id}
          href={`#${entry.id}`}
          onClick={onSelect}
          className={cn(
            "block rounded px-2 py-1 text-sm transition-colors",
            entry.level === 3 && "pl-5 text-xs",
            activeId === entry.id
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {entry.title}
        </a>
      ))}
    </div>
  );
}
