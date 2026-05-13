"use client";

import Link from "next/link";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { ORG_CATEGORIES, type DirectoryOrg } from "@/types/domain";

type Props = {
  orgs: DirectoryOrg[];
};

export function DirectoryView({ orgs }: Props) {
  const [view, setView] = useState<"grid" | "list">("list");

  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-center justify-end">
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

      {ORG_CATEGORIES.map((category) => {
        const inCategory = sortOrgs(
          orgs.filter((org) => org.category === category),
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
              <div className="flex flex-col border-t border-border">
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

      {orgs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No organizations yet.
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
      className="group flex items-baseline justify-between gap-6 border-b border-border py-4 transition-colors duration-150 hover:bg-[color:var(--surface-2)]"
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
