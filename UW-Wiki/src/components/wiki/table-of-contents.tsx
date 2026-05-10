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
        className="sticky top-24 hidden max-h-[calc(100vh-7rem)] overflow-y-auto pr-4 lg:block"
      >
        <TocList entries={entries} activeId={activeId} />
      </nav>

      {/* Mobile / tablet: collapsible dropdown. */}
      <details
        className="lg:hidden border-b border-border"
        open={mobileOpen}
        onToggle={(event) => {
          if (event.currentTarget instanceof HTMLDetailsElement) {
            setMobileOpen(event.currentTarget.open);
          }
        }}
      >
        <summary className="flex cursor-pointer items-center justify-between py-3 text-sm text-muted-foreground">
          <span className="uppercase tracking-[0.16em] text-[11px]">On this page</span>
          <span className="text-xs">{entries.length} sections</span>
        </summary>
        <div className="pb-4">
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
    <div className="flex flex-col gap-2.5">
      {entries.map((entry) => (
        <a
          key={entry.id}
          href={`#${entry.id}`}
          onClick={onSelect}
          className={cn(
            "block text-sm leading-snug transition-colors duration-150",
            entry.level === 3 && "pl-4 text-[13px]",
            activeId === entry.id
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {entry.title}
        </a>
      ))}
    </div>
  );
}
