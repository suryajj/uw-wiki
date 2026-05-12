"use client";

import type { Editor } from "@tiptap/react";
import { EditorContent, useEditor } from "@tiptap/react";
import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";

import { Button } from "@/components/ui/button";
import { CommentsWidget } from "@/components/comments/comments-widget";
import { clearDraft, loadDraft, saveDraft } from "@/lib/editor/autosave";
import { editorExtensions } from "@/lib/editor/extensions";
import { uploadEditorImage, UploadError } from "@/lib/editor/upload";
import { renderProseMirrorDoc } from "@/lib/prosemirror/render";
import { extractSections } from "@/lib/prosemirror/sections";
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
  const [submitState, setSubmitState] = useState<
    | { kind: "idle" }
    | { kind: "submitting" }
    | { kind: "success"; proposalId: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);

  const sections = useMemo(() => extractSections(initialContent), [initialContent]);
  const isEmpty = sections.length === 0 || sections.every(({ body }) => body.length === 0);

  const editor = useEditor({
    extensions: editorExtensions,
    content: initialContent,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "min-h-[60vh] w-full bg-transparent p-6 outline-none prose prose-neutral dark:prose-invert max-w-none font-serif [--tw-prose-body:var(--foreground)] [--tw-prose-headings:var(--foreground)] [--tw-prose-lead:var(--muted-foreground)] [--tw-prose-bold:var(--foreground)] [--tw-prose-counters:var(--muted-foreground)] [--tw-prose-bullets:var(--border)] [--tw-prose-hr:var(--border)] [--tw-prose-quotes:var(--foreground)] [--tw-prose-quote-borders:var(--border)] [--tw-prose-captions:var(--muted-foreground)] [--tw-prose-code:var(--foreground)] [--tw-prose-pre-code:var(--foreground)] [--tw-prose-pre-bg:var(--surface-2)] [--tw-prose-th-borders:var(--border)] [--tw-prose-td-borders:var(--border)] prose-headings:font-serif prose-h2:text-3xl prose-h2:font-semibold prose-h2:mt-8 prose-h2:mb-4 prose-h3:text-xl prose-h3:font-medium prose-h3:mt-6 prose-h3:mb-3 prose-a:text-foreground prose-a:underline-offset-4 prose-strong:text-foreground prose-blockquote:border-foreground/30",
      },
      handleDrop: (_view, event) => handleEditorDrop(event as unknown as DragEvent),
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

  const sectionSlugs = useMemo(
    () => sections.map((section) => section.slug),
    [sections],
  );

  useEffect(() => {
    if (mode === "edit") setSelectedSlugs(sectionSlugs);
  }, [mode, sectionSlugs]);

  const insertImage = useCallback(
    async (file: File) => {
      if (!editor) return;
      try {
        const url = await uploadEditorImage(file);
        editor.chain().focus().setImage({ src: url, alt: file.name }).run();
      } catch (error) {
        const message = error instanceof UploadError ? error.message : "Image upload failed.";
        setSubmitState({ kind: "error", message });
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

  async function submitProposal() {
    if (!editor || !pageVersionId) return;
    if (rationale.trim().length < 20) {
      setSubmitState({ kind: "error", message: "Rationale must be at least 20 characters." });
      return;
    }
    setSubmitState({ kind: "submitting" });
    const res = await fetch("/api/proposals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pageId,
        basePageVersionId: pageVersionId,
        proposedContentJson: editor.getJSON(),
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
      setSubmitState({
        kind: "error",
        message: body.error ?? "Could not submit proposal.",
      });
      return;
    }
    clearDraft(pageId);
    setSubmitState({ kind: "success", proposalId: body.proposalId });
  }

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
              setSubmitState({ kind: "idle" });
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={submitState.kind === "submitting"}
            onClick={submitProposal}
          >
            {submitState.kind === "submitting" ? "Submitting…" : "Submit Proposal"}
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
              {sections.map((section) => {
                const checked = selectedSlugs.includes(section.slug);
                return (
                  <label
                    key={section.slug}
                    className={
                      "cursor-pointer rounded-full border px-3 py-1 text-xs transition-colors duration-150 " +
                      (checked
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-muted-foreground hover:border-foreground hover:text-foreground")
                    }
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

          {submitState.kind === "success" ? (
            <p className="border border-border bg-[color:var(--surface-2)] p-3 text-sm text-foreground">
              Proposal submitted: <code className="font-mono text-xs">{submitState.proposalId}</code>
            </p>
          ) : null}
          {submitState.kind === "error" ? (
            <p className="border border-[color:var(--color-destructive)] bg-transparent p-3 text-sm text-[color:var(--color-destructive)]">
              {submitState.message}
            </p>
          ) : null}
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
