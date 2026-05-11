"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { ORG_CATEGORIES, type DirectoryOrg } from "@/types/domain";

type Props = {
  orgs: DirectoryOrg[];
};

export function DirectoryView({ orgs }: Props) {
  const [filter, setFilter] = useState("");
  const [view, setView] = useState<"grid" | "list">("list");

  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim();
    if (!q) return orgs;
    return orgs.filter(
      (org) =>
        org.orgName.toLowerCase().includes(q) ||
        (org.tagline?.toLowerCase().includes(q) ?? false),
    );
  }, [orgs, filter]);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-4 border-b border-border pb-4 md:flex-row md:items-center">
        <input
          type="text"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter organizations…"
          className="h-10 flex-1 rounded-full border border-border bg-transparent px-4 text-sm text-foreground outline-none transition-colors duration-150 placeholder:text-muted-foreground focus:border-foreground"
          aria-label="Filter organizations"
        />
        <div className="flex items-center gap-3 text-sm">
          <div
            role="group"
            aria-label="Layout"
            className="flex overflow-hidden rounded-full border border-border"
          >
            <button
              type="button"
              aria-pressed={view === "list"}
              aria-label="List layout"
              title="List"
              onClick={() => setView("list")}
              className={cn(
                "px-3 py-1.5 text-xs transition-colors duration-150",
                view === "list"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              List
            </button>
            <button
              type="button"
              aria-pressed={view === "grid"}
              aria-label="Grid layout"
              title="Grid"
              onClick={() => setView("grid")}
              className={cn(
                "border-l border-border px-3 py-1.5 text-xs transition-colors duration-150",
                view === "grid"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Grid
            </button>
          </div>
        </div>
      </div>

      {ORG_CATEGORIES.map((category) => {
        const inCategory = sortOrgs(
          filtered.filter((org) => org.category === category),
        );

        if (inCategory.length === 0) return null;

        return (
          <section key={category} aria-labelledby={`cat-${category}`} className="flex flex-col gap-3">
            <h2
              id={`cat-${category}`}
              className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground"
            >
              {category}
            </h2>
            {view === "list" ? (
              <div className="flex flex-col">
                {inCategory.map((org) => (
                  <OrgRow key={org.id} org={org} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 border-t border-l border-border">
                {inCategory.map((org) => (
                  <OrgTile key={org.id} org={org} />
                ))}
              </div>
            )}
          </section>
        );
      })}

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No organizations match your filter.
        </p>
      ) : null}
    </div>
  );
}

function sortOrgs(orgs: DirectoryOrg[]): DirectoryOrg[] {
  return [...orgs].sort((a, b) => a.orgName.localeCompare(b.orgName));
}

function OrgRow({ org }: { org: DirectoryOrg }) {
  const href = `/wiki/${org.pageSlug ?? org.orgSlug}`;
  return (
    <Link
      href={href}
      className="group flex items-baseline justify-between gap-6 border-b border-border px-6 py-4 transition-colors duration-150 hover:bg-[color:var(--surface-2)] md:px-10 lg:px-16"
    >
      <span className="min-w-[200px] text-lg font-medium text-foreground">
        {org.orgName}
      </span>
      <span className="hidden flex-1 truncate text-sm text-muted-foreground md:inline">
        {org.tagline ?? "No tagline yet."}
      </span>
      <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {org.category}
      </span>
    </Link>
  );
}

function OrgTile({ org }: { org: DirectoryOrg }) {
  const href = `/wiki/${org.pageSlug ?? org.orgSlug}`;
  return (
    <Link
      href={href}
      className="flex flex-col gap-2 border-b border-r border-border bg-background p-6 transition-colors duration-150 hover:bg-[color:var(--surface-2)]"
    >
      <span className="text-lg font-medium text-foreground">{org.orgName}</span>
      <p className="line-clamp-3 text-sm text-muted-foreground">
        {org.tagline ?? "No tagline yet."}
      </p>
      <span className="mt-auto pt-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {org.category}
      </span>
    </Link>
  );
}
