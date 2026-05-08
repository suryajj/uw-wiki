"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { ORG_CATEGORIES, type DirectoryOrg } from "@/types/domain";

type Props = {
  orgs: DirectoryOrg[];
};

type SortMode = "name-asc" | "name-desc";

export function DirectoryView({ orgs }: Props) {
  const [filter, setFilter] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sortMode, setSortMode] = useState<SortMode>("name-asc");

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
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <input
          type="text"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter organizations..."
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          aria-label="Filter organizations"
        />
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground" htmlFor="directory-sort">
            Sort by
          </label>
          <select
            id="directory-sort"
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          >
            <option value="name-asc">Name (A–Z)</option>
            <option value="name-desc">Name (Z–A)</option>
          </select>
          <div
            role="group"
            aria-label="Layout"
            className="ml-2 flex overflow-hidden rounded-md border border-border"
          >
            <button
              type="button"
              aria-pressed={view === "grid"}
              aria-label="Grid layout"
              title="Grid"
              onClick={() => setView("grid")}
              className={cn(
                "px-3 py-1 text-xs",
                view === "grid"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent",
              )}
            >
              Grid
            </button>
            <button
              type="button"
              aria-pressed={view === "list"}
              aria-label="List layout"
              title="List"
              onClick={() => setView("list")}
              className={cn(
                "border-l border-border px-3 py-1 text-xs",
                view === "list"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent",
              )}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {ORG_CATEGORIES.map((category) => {
        const inCategory = sortOrgs(
          filtered.filter((org) => org.category === category),
          sortMode,
        );

        if (inCategory.length === 0) return null;

        return (
          <section key={category} aria-labelledby={`cat-${category}`}>
            <h2
              id={`cat-${category}`}
              className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground"
            >
              {category}
            </h2>
            <div
              className={cn(
                view === "grid"
                  ? "grid gap-3 md:grid-cols-2 lg:grid-cols-3"
                  : "flex flex-col gap-2",
              )}
            >
              {inCategory.map((org) => (
                <OrgCard key={org.id} org={org} layout={view} />
              ))}
            </div>
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

function sortOrgs(orgs: DirectoryOrg[], mode: SortMode): DirectoryOrg[] {
  const direction = mode === "name-asc" ? 1 : -1;
  return [...orgs].sort(
    (a, b) => a.orgName.localeCompare(b.orgName) * direction,
  );
}

function OrgCard({ org, layout }: { org: DirectoryOrg; layout: "grid" | "list" }) {
  const href = `/wiki/${org.pageSlug ?? org.orgSlug}`;
  if (layout === "list") {
    return (
      <Link
        href={href}
        className="flex items-center justify-between rounded-md border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40"
      >
        <span className="font-medium text-foreground">{org.orgName}</span>
        <span className="mx-4 flex-1 truncate text-sm text-muted-foreground">
          {org.tagline ?? "No tagline yet."}
        </span>
        <span className="rounded-full border border-primary/40 px-2 py-0.5 text-xs text-primary">
          {org.category}
        </span>
      </Link>
    );
  }
  return (
    <Link
      href={href}
      className="flex flex-col gap-2 rounded-md border border-border bg-card p-4 transition-colors hover:border-primary/40"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-foreground">{org.orgName}</span>
        <span className="rounded-full border border-primary/40 px-2 py-0.5 text-xs text-primary">
          {org.category}
        </span>
      </div>
      <p className="line-clamp-2 text-sm text-muted-foreground">
        {org.tagline ?? "No tagline yet."}
      </p>
    </Link>
  );
}

