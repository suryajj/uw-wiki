"use client";

import type { Editor } from "@tiptap/react";
import { EditorContent, useEditor } from "@tiptap/react";
import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";

import { Button } from "@/components/ui/button";
import { CommentsWidget } from "@/components/comments/comments-widget";
import { clearDraft, loadDraft, saveDraft } from "@/lib/editor/autosave";
import { transformSuperscriptPaste } from "@/lib/editor/citation-extension";
import { editorExtensions } from "@/lib/editor/extensions";
import { uploadEditorImage, UploadError } from "@/lib/editor/upload";
import { renderProseMirrorDoc } from "@/lib/prosemirror/render";
import {
  ensureSectionSlugs,
  extractSections,
} from "@/lib/prosemirror/sections";
import { toast } from "@/lib/ui/toast";
import { useAction } from "@/lib/ui/use-action";
import type { ProseMirrorDoc } from "@/types/domain";

type Props = {
  pageId: string;
  pageVersionId: string | null;
  initialContent: ProseMirrorDoc;
};

export function WikiArticleShell({
  pageId,
  pageVersionId,
  initialContent,
}: Props) {
  const [mode, setMode] = useState<"read" | "edit">("read");
  const [draftPrompt, setDraftPrompt] = useState<{
    savedAt: string;
    content: ProseMirrorDoc;
  } | null>(null);
  const [rationale, setRationale] = useState("");
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);

  // Track BOTH the base sections (what shipped on the live page when this
  // edit session opened) and the current proposed sections (live editor
  // doc). `displaySections` is the union — every base section + every
  // brand-new section the user typed. Each entry carries a `kind` so the
  // pill UI can show "modified", "added", or "removed". Without tracking
  // the base side, deletions are invisible to both the contributor and
  // the reviewer and never apply on accept.
  const baseSections = useMemo(() => extractSections(initialContent), [initialContent]);
  const [proposedSections, setProposedSections] = useState(baseSections);
  const displaySections = useMemo(() => {
    const proposedBySlug = new Map(proposedSections.map((s) => [s.slug, s]));
    const baseSlugs = new Set(baseSections.map((s) => s.slug));
    // 1) Walk proposed sections in their authored order. Each is either
    //    "kept" (also in base) or "new" (only in proposed). Explicit type
    //    annotation so the push of "deleted" entries below stays valid.
    type DisplayEntry = {
      slug: string;
      title: string;
      kind: "kept" | "new" | "deleted";
    };
    const ordered: DisplayEntry[] = proposedSections.map((section) => ({
      slug: section.slug,
      title: section.title,
      kind: baseSlugs.has(section.slug) ? "kept" : "new",
    }));
    // 2) Append any base sections that no longer appear in the proposed
    //    doc — those are deletions.
    for (const baseSection of baseSections) {
      if (!proposedBySlug.has(baseSection.slug)) {
        ordered.push({
          slug: baseSection.slug,
          title: baseSection.title,
          kind: "deleted",
        });
      }
    }
    return ordered;
  }, [baseSections, proposedSections]);
  const isEmpty =
    proposedSections.length === 0 ||
    proposedSections.every(({ body }) => body.length === 0);

  const editor = useEditor({
    extensions: editorExtensions,
    content: initialContent,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          // `text-foreground` is added explicitly so the editor's body text
          // follows the theme variable in BOTH light and dark modes. Without
          // it, prose-neutral's hard-coded body color wins in light mode and
          // the typed text renders as the dark-mode tone on a light surface
          // (low contrast). The `[--tw-prose-body:var(--foreground)]`
          // override alone isn't reliable across Tailwind versions because
          // cascade order with `prose-neutral` isn't guaranteed.
          "min-h-[60vh] w-full bg-transparent p-6 outline-none prose prose-neutral dark:prose-invert max-w-none font-serif text-foreground [--tw-prose-body:var(--foreground)] [--tw-prose-headings:var(--foreground)] [--tw-prose-lead:var(--muted-foreground)] [--tw-prose-bold:var(--foreground)] [--tw-prose-counters:var(--muted-foreground)] [--tw-prose-bullets:var(--border)] [--tw-prose-hr:var(--border)] [--tw-prose-quotes:var(--foreground)] [--tw-prose-quote-borders:var(--border)] [--tw-prose-captions:var(--muted-foreground)] [--tw-prose-code:var(--foreground)] [--tw-prose-pre-code:var(--foreground)] [--tw-prose-pre-bg:var(--surface-2)] [--tw-prose-th-borders:var(--border)] [--tw-prose-td-borders:var(--border)] prose-headings:font-serif prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-h2:text-3xl prose-h2:font-semibold prose-h2:mt-8 prose-h2:mb-4 prose-h3:text-xl prose-h3:font-medium prose-h3:mt-6 prose-h3:mb-3 prose-a:text-foreground prose-a:underline-offset-4 prose-strong:text-foreground prose-blockquote:border-foreground/30",
      },
      handleDrop: (_view, event) => handleEditorDrop(event as unknown as DragEvent),
      // Normalize Unicode superscript digits (e.g. ¹²) into [12] BEFORE the
      // citation paste rule runs. This catches Wikipedia HTML and other rich
      // sources whose citations don't use literal square brackets. ASCII
      // `[N]` runs are handled by the paste rule directly.
      transformPastedText: (text) => transformSuperscriptPaste(text),
    },
  });

  useEffect(() => {
    // Listen for external "Propose Edit" triggers (e.g. icon button in the
    // page header). The header lives outside WikiArticleShell, so we use a
    // custom event to flip the mode without lifting state to the page.
    const handler = () => setMode("edit");
    window.addEventListener("wiki:propose-edit", handler);
    return () => window.removeEventListener("wiki:propose-edit", handler);
  }, []);

  useEffect(() => {
    if (mode !== "edit" || !editor || !pageVersionId) return;
    const existing = loadDraft(pageId, pageVersionId);
    if (existing) {
      setDraftPrompt({
        savedAt: existing.savedAt,
        content: existing.content,
      });
    }
  }, [mode, editor, pageId, pageVersionId]);

  useEffect(() => {
    if (mode !== "edit" || !editor || !pageVersionId) return;
    const persist = () => saveDraft(pageId, editor.getJSON() as ProseMirrorDoc, pageVersionId);
    const interval = window.setInterval(persist, 10_000);
    const handleBlur = () => persist();
    editor.on("blur", handleBlur);
    window.addEventListener("beforeunload", persist);
    return () => {
      window.clearInterval(interval);
      editor.off("blur", handleBlur);
      window.removeEventListener("beforeunload", persist);
    };
  }, [mode, editor, pageId, pageVersionId]);

  const allSectionSlugs = useMemo(
    () => displaySections.map((section) => section.slug),
    [displaySections],
  );

  useEffect(() => {
    // On mode → edit, default-select EVERY relevant slug (kept, new, AND
    // deleted). The user can opt out via checkbox if they want to scope
    // their proposal narrower than what they actually changed.
    if (mode === "edit") setSelectedSlugs(allSectionSlugs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Live-sync the proposed section list as the user types. Auto-include
  // both freshly added headings AND the slugs of headings the user just
  // deleted (so deletions actually flow through to the server). The
  // user's manual opt-outs survive.
  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      const next = extractSections(editor.getJSON() as ProseMirrorDoc);
      setProposedSections(next);
      const baseSlugs = new Set(baseSections.map((s) => s.slug));
      const proposedSlugs = new Set(next.map((s) => s.slug));
      // Valid universe: any slug that's in base or in proposed.
      const validSlugs = new Set<string>([...baseSlugs, ...proposedSlugs]);
      setSelectedSlugs((prev) => {
        const prevSet = new Set(prev);
        // Drop slugs that aren't in the valid universe (shouldn't really
        // happen but defensive — e.g. stale slug from a discarded draft).
        const kept = prev.filter((slug) => validSlugs.has(slug));
        const result = [...kept];
        // Auto-add any new heading the user typed.
        for (const section of next) {
          if (!prevSet.has(section.slug)) result.push(section.slug);
        }
        // Auto-add any base section the user just deleted (slug in base
        // but not in proposed AND not already tracked).
        for (const baseSection of baseSections) {
          if (!proposedSlugs.has(baseSection.slug) && !prevSet.has(baseSection.slug)) {
            result.push(baseSection.slug);
          }
        }
        return result;
      });
    };
    editor.on("update", handler);
    return () => {
      editor.off("update", handler);
    };
  }, [editor, baseSections]);

  const insertImage = useCallback(
    async (file: File) => {
      if (!editor) return;
      try {
        const url = await uploadEditorImage(file);
        editor.chain().focus().setImage({ src: url, alt: file.name }).run();
      } catch (error) {
        const message = error instanceof UploadError ? error.message : "Image upload failed.";
        toast.error(message);
      }
    },
    [editor],
  );

  function handleEditorDrop(event: DragEvent): boolean {
    const file = event.dataTransfer?.files?.[0];
    if (!file || !file.type.startsWith("image/")) return false;
    event.preventDefault();
    void insertImage(file);
    return true;
  }

  const submitAction = useAction(
    async () => {
      if (!editor || !pageVersionId) throw new Error("Editor not ready.");
      if (rationale.trim().length < 20) {
        throw new Error("Rationale must be at least 20 characters.");
      }
      // Normalize the doc before submit: every H2 gets a `slug` attr so the
      // server-side diff engine and read-mode renderer agree on which
      // sections changed. Without this, a brand-new heading inserted via
      // the toolbar lacks the attr and its identity falls back to the
      // computed slugify(title) — fine, but persisting the attr is more
      // robust against future title edits.
      const proposedContentJson = ensureSectionSlugs(
        editor.getJSON() as ProseMirrorDoc,
      );
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId,
          basePageVersionId: pageVersionId,
          proposedContentJson,
          rationale,
          sectionSlugs: selectedSlugs.length > 0 ? selectedSlugs : undefined,
          isAnonymous: true,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        proposalId?: string;
        error?: string;
      };
      if (!res.ok || !body.proposalId) {
        throw new Error(body.error ?? "Could not submit proposal.");
      }
      return body as { proposalId: string };
    },
    {
      successMessage: "Proposal submitted. Reviewers notified.",
      onSuccess: () => {
        // Critical post-action: auto-exit edit mode and return to the article.
        clearDraft(pageId);
        setRationale("");
        setMode("read");
        setDraftPrompt(null);
      },
    },
  );

  if (mode === "read") {
    return (
      // Use plain block flow (no flex) so text wraps around the floated Pulse
      // sidebar that sits beside this component.
      <div id="wiki-content" className="block">
        {isEmpty ? (
          <EmptyPagePlaceholder onProposeEdit={() => setMode("edit")} />
        ) : (
          <div
            id="wiki-article-body"
            className="prose prose-neutral dark:prose-invert max-w-none font-serif [--tw-prose-body:var(--foreground)] [--tw-prose-headings:var(--foreground)] [--tw-prose-lead:var(--muted-foreground)] [--tw-prose-bold:var(--foreground)] [--tw-prose-counters:var(--muted-foreground)] [--tw-prose-bullets:var(--border)] [--tw-prose-hr:var(--border)] [--tw-prose-quotes:var(--foreground)] [--tw-prose-quote-borders:var(--border)] [--tw-prose-captions:var(--muted-foreground)] [--tw-prose-code:var(--foreground)] [--tw-prose-pre-code:var(--foreground)] [--tw-prose-pre-bg:var(--surface-2)] [--tw-prose-th-borders:var(--border)] [--tw-prose-td-borders:var(--border)] prose-headings:font-serif prose-a:text-foreground prose-a:underline-offset-4 prose-blockquote:border-foreground/30"
          >
            {renderProseMirrorDoc(initialContent, { decorateSections: true })}
          </div>
        )}
        <div className="clear-both mt-12">
          <CommentsWidget pageId={pageId} />
        </div>
      </div>
    );
  }

  return (
    <div
      id="wiki-content"
      className="fixed inset-0 z-40 flex flex-col bg-background"
    >
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-background/95 px-6 py-3 backdrop-blur md:px-10">
        <h2 className="text-base font-medium text-foreground">Editing this page</h2>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setMode("read");
              setDraftPrompt(null);
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            loading={submitAction.pending}
            onClick={() => submitAction.run()}
          >
            Submit Proposal
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6 md:px-10 lg:px-20">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
          {draftPrompt ? (
            <div className="flex flex-col gap-2 border border-border bg-[color:var(--surface-2)] p-4 text-sm">
              <p className="text-foreground">
                You have unsaved changes from {new Date(draftPrompt.savedAt).toLocaleString()}.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  type="button"
                  onClick={() => {
                    if (editor && draftPrompt) {
                      editor.commands.setContent(draftPrompt.content);
                    }
                    setDraftPrompt(null);
                  }}
                >
                  Restore Draft
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => {
                    clearDraft(pageId);
                    setDraftPrompt(null);
                  }}
                >
                  Discard Draft
                </Button>
              </div>
            </div>
          ) : null}

          <Toolbar editor={editor} onUploadImage={insertImage} />
          <div className="rounded-md border border-border focus-within:border-foreground transition-colors duration-150">
            {editor ? <EditorContent editor={editor} /> : null}
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Sections in this proposal
            </legend>
            <div className="flex flex-wrap gap-2">
              {displaySections.map((section) => {
                const checked = selectedSlugs.includes(section.slug);
                // Visual cue for each pill: kept (default), new (emerald
                // outline when unchecked, green when checked), deleted
                // (red outline + strikethrough). Tells the contributor at
                // a glance what each section means in the proposal.
                const isNew = section.kind === "new";
                const isDeleted = section.kind === "deleted";
                const baseClass =
                  "cursor-pointer rounded-full border px-3 py-1 text-xs transition-colors duration-150";
                const checkedClass = isDeleted
                  ? "border-destructive bg-destructive text-background line-through"
                  : isNew
                    ? "border-emerald-500 bg-emerald-500 text-background"
                    : "border-foreground bg-foreground text-background";
                const uncheckedClass = isDeleted
                  ? "border-destructive/60 text-destructive line-through hover:border-destructive"
                  : isNew
                    ? "border-emerald-500/60 text-emerald-500 hover:border-emerald-500"
                    : "border-border text-muted-foreground hover:border-foreground hover:text-foreground";
                return (
                  <label
                    key={section.slug}
                    title={
                      isDeleted
                        ? "This section will be removed when the proposal is accepted."
                        : isNew
                          ? "This section will be added."
                          : "This section will be modified."
                    }
                    className={`${baseClass} ${checked ? checkedClass : uncheckedClass}`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={(event) => {
                        setSelectedSlugs((prev) =>
                          event.target.checked
                            ? [...prev, section.slug]
                            : prev.filter((slug) => slug !== section.slug),
                        );
                      }}
                    />
                    {section.title}
                    {isDeleted ? " (remove)" : isNew ? " (new)" : ""}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="flex flex-col gap-2">
            <label
              className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground"
              htmlFor="proposal-rationale"
            >
              Rationale (min 20 characters)
            </label>
            <textarea
              id="proposal-rationale"
              value={rationale}
              onChange={(event) => setRationale(event.target.value)}
              maxLength={500}
              className="min-h-32 w-full rounded-md border border-border bg-transparent p-3 text-sm text-foreground outline-none transition-colors duration-150 focus:border-foreground"
              placeholder="Explain what changed and why."
            />
            <div className="text-right text-xs text-muted-foreground">
              {rationale.length} / 500
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function Toolbar({
  editor,
  onUploadImage,
}: {
  editor: Editor | null;
  onUploadImage: (file: File) => Promise<void>;
}) {
  if (!editor) return null;
  return (
    <div
      className="no-scrollbar sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b border-border bg-background/95 py-2 backdrop-blur"
      role="toolbar"
      aria-label="Editor formatting"
    >
      <ToolbarButton label="Heading 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</ToolbarButton>
      <ToolbarButton label="Heading 3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</ToolbarButton>
      <ToolbarDivider />
      <ToolbarButton label="Bold" onClick={() => editor.chain().focus().toggleBold().run()}>B</ToolbarButton>
      <ToolbarButton label="Italic" onClick={() => editor.chain().focus().toggleItalic().run()}>I</ToolbarButton>
      <ToolbarButton label="Underline" onClick={() => editor.chain().focus().toggleUnderline().run()}>U</ToolbarButton>
      <ToolbarDivider />
      <ToolbarButton label="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()}>UL</ToolbarButton>
      <ToolbarButton label="Ordered list" onClick={() => editor.chain().focus().toggleOrderedList().run()}>OL</ToolbarButton>
      <ToolbarButton
        label="Insert citation"
        onClick={() => editor.chain().focus().insertNextCitation().run()}
      >
        [N]
      </ToolbarButton>
      <ToolbarButton label="Blockquote" onClick={() => editor.chain().focus().toggleBlockquote().run()}>Quote</ToolbarButton>
      <ToolbarButton label="Code block" onClick={() => editor.chain().focus().toggleCodeBlock().run()}>Code</ToolbarButton>
      <ToolbarButton label="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}>Rule</ToolbarButton>
      <ToolbarButton
        label="Insert link"
        onClick={() => {
          const url = window.prompt("Enter URL");
          if (!url) return;
          editor.chain().focus().setLink({ href: url }).run();
        }}
      >
        Link
      </ToolbarButton>
      <label className="inline-flex h-8 cursor-pointer items-center rounded-full border border-border px-3 text-xs text-muted-foreground transition-colors duration-150 hover:border-foreground hover:text-foreground">
        Image
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onUploadImage(file);
            event.target.value = "";
          }}
        />
      </label>
    </div>
  );
}

function ToolbarDivider() {
  return <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />;
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-border px-2.5 text-xs text-muted-foreground transition-colors duration-150 hover:border-foreground hover:text-foreground"
    >
      {children}
    </button>
  );
}

function EmptyPagePlaceholder({ onProposeEdit }: { onProposeEdit: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 border border-dashed border-border bg-transparent p-12 text-center">
      <p className="text-lg font-medium text-foreground">This page needs content.</p>
      <p className="max-w-md text-sm text-muted-foreground">
        Be the first to write what this organization is about, what students do
        there, and how to get involved.
      </p>
      <Button type="button" onClick={onProposeEdit}>
        Propose Edit
      </Button>
    </div>
  );
}
