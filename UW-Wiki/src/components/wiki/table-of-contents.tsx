"use client";

import { ChevronRight } from "lucide-react";
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
        <summary className="flex cursor-pointer list-none items-center justify-between py-3 text-sm text-muted-foreground [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            <ChevronRight
              className={cn(
                "size-3.5 shrink-0 transition-transform duration-150",
                mobileOpen && "rotate-90",
              )}
              aria-hidden="true"
            />
            <span className="text-[11px] uppercase tracking-[0.16em]">On this page</span>
          </span>
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
  // Smooth-scroll to the target heading and update the URL hash without
  // letting the browser do its default jump (which is instant + abrupt).
  function handleClick(event: React.MouseEvent<HTMLAnchorElement>, id: string) {
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    if (typeof window !== "undefined" && window.history?.replaceState) {
      window.history.replaceState(null, "", `#${id}`);
    }
    onSelect?.();
  }

  return (
    <div className="flex flex-col gap-2.5">
      {entries.map((entry) => (
        <a
          key={entry.id}
          href={`#${entry.id}`}
          onClick={(event) => handleClick(event, entry.id)}
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
