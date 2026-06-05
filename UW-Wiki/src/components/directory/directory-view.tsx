"use client";

import Link from "next/link";
import { LayoutGrid, List as ListIcon } from "lucide-react";
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
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          aria-pressed={view === "list"}
          aria-label="List layout"
          title="List"
          onClick={() => setView("list")}
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-150",
            view === "list"
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <ListIcon className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-pressed={view === "grid"}
          aria-label="Grid layout"
          title="Grid"
          onClick={() => setView("grid")}
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-150",
            view === "grid"
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <LayoutGrid className="size-4" aria-hidden="true" />
        </button>
      </div>

      {ORG_CATEGORIES.map((category) => {
        const inCategory = sortOrgs(
          orgs.filter((org) => org.category === category),
        );

        if (inCategory.length === 0) return null;

        return (
          <section key={category} aria-labelledby={`cat-${category}`} className="flex flex-col">
            <h2
              id={`cat-${category}`}
              className="border-b border-border pb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground"
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 pt-3">
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
          No articles yet.
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
      className="group grid grid-cols-[minmax(0,18rem)_1fr] items-baseline gap-8 py-3 transition-colors duration-150 hover:bg-[color:var(--surface-2)]"
    >
      <span className="text-lg font-medium text-foreground">
        {org.orgName}
      </span>
      <span className="hidden truncate text-sm text-muted-foreground md:inline">
        {org.tagline ?? "No tagline yet."}
      </span>
    </Link>
  );
}

function OrgTile({ org }: { org: DirectoryOrg }) {
  const href = `/wiki/${org.pageSlug ?? org.orgSlug}`;
  return (
    <Link
      href={href}
      className="flex flex-col gap-1.5 p-4 transition-colors duration-150 hover:bg-[color:var(--surface-2)]"
    >
      <span className="text-lg font-medium text-foreground">{org.orgName}</span>
      <p className="line-clamp-3 text-sm text-muted-foreground">
        {org.tagline ?? "No tagline yet."}
      </p>
    </Link>
  );
}
