"use client";

import { Check, Pencil, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { toast } from "@/lib/ui/toast";
import { useAction } from "@/lib/ui/use-action";

/**
 * Title block that admins can click to rename in place. Non-admins see the
 * static H1 + tagline. The save path PATCHes /api/admin/orgs/[id] and
 * refreshes the route so the new metadata streams everywhere it appears
 * (article header, directory cards, search results).
 *
 * Tagline is rendered as plain text below the title for editors; if the
 * org currently has no tagline (null), a placeholder is shown to make the
 * editable surface discoverable.
 */
export function EditableArticleTitle({
  orgId,
  initialOrgName,
  initialTagline,
  canEdit,
  rightSlot,
}: {
  orgId: string;
  initialOrgName: string;
  initialTagline: string | null;
  canEdit: boolean;
  /** Action icons (bookmark / history / propose edit) rendered to the right. */
  rightSlot?: ReactNode;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [orgName, setOrgName] = useState(initialOrgName);
  const [tagline, setTagline] = useState(initialTagline ?? "");
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setOrgName(initialOrgName);
    setTagline(initialTagline ?? "");
  }, [initialOrgName, initialTagline]);

  useEffect(() => {
    if (editing) titleInputRef.current?.select();
  }, [editing]);

  type SaveInput = { orgName: string; tagline: string };
  type SaveResult = { orgName: string; tagline: string | null };
  const saveAction = useAction<SaveInput, SaveResult>(
    async (input) => {
      const trimmedName = input.orgName.trim();
      if (!trimmedName) throw new Error("Title cannot be empty.");
      const res = await fetch(`/api/admin/orgs/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgName: trimmedName,
          // Send null to clear, send the trimmed string otherwise. Server
          // also normalizes empty-string → null.
          tagline: input.tagline.trim() === "" ? null : input.tagline.trim(),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        org?: SaveResult;
        error?: string;
      };
      if (!res.ok || !body.org) {
        throw new Error(body.error ?? "Could not save changes.");
      }
      return body.org;
    },
    {
      successMessage: "Title updated.",
      onSuccess: (org) => {
        setOrgName(org.orgName);
        setTagline(org.tagline ?? "");
        setEditing(false);
        // Refresh the server-component tree so the directory cards, header,
        // search results, etc. all pick up the new metadata.
        router.refresh();
      },
    },
  );

  function cancelEdit() {
    setOrgName(initialOrgName);
    setTagline(initialTagline ?? "");
    setEditing(false);
  }

  if (!editing) {
    return (
      <header className="mb-6 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground break-words sm:text-4xl md:text-5xl">
                {orgName}
              </h1>
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  aria-label="Edit title and tagline"
                  title="Edit title and tagline"
                  className="rounded-full border border-transparent p-2 text-muted-foreground transition-colors duration-150 hover:border-border hover:text-foreground"
                >
                  <Pencil className="size-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>
            {initialTagline ? (
              <p className="mt-2 text-sm text-muted-foreground">{initialTagline}</p>
            ) : canEdit ? (
              <p className="mt-2 text-sm italic text-muted-foreground/70">
                No tagline yet. Click the pencil to add one.
              </p>
            ) : null}
          </div>
          {rightSlot ? (
            <div className="flex shrink-0 items-center gap-1.5 pt-2">{rightSlot}</div>
          ) : null}
        </div>
      </header>
    );
  }

  return (
    <header className="mb-6 flex flex-col gap-3 rounded-md border border-border bg-[color:var(--surface-2)] p-4">
      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Title
        </span>
        <input
          ref={titleInputRef}
          value={orgName}
          onChange={(event) => setOrgName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void saveAction.run({ orgName, tagline });
            } else if (event.key === "Escape") {
              event.preventDefault();
              cancelEdit();
            }
          }}
          className="h-12 w-full rounded-md border border-border bg-transparent px-3 text-2xl font-semibold tracking-tight text-foreground outline-none focus:border-foreground"
          maxLength={200}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Tagline (subhead shown in cards)
        </span>
        <input
          value={tagline}
          onChange={(event) => setTagline(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              cancelEdit();
            }
          }}
          placeholder="A short one-liner shown on directory cards."
          className="h-9 w-full rounded-md border border-border bg-transparent px-3 text-sm text-foreground outline-none focus:border-foreground"
          maxLength={280}
        />
      </label>
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={cancelEdit}
          disabled={saveAction.pending}
        >
          <X className="size-4" aria-hidden="true" />
          Cancel
        </Button>
        <Button
          type="button"
          loading={saveAction.pending}
          onClick={() => {
            if (orgName.trim().length === 0) {
              toast.error("Title cannot be empty.");
              return;
            }
            void saveAction.run({ orgName, tagline });
          }}
        >
          <Check className="size-4" aria-hidden="true" />
          Save
        </Button>
      </div>
    </header>
  );
}
