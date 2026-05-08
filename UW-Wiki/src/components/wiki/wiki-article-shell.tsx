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
          "min-h-72 rounded-md border border-border bg-background p-4 outline-none prose prose-invert max-w-none focus:ring-2 focus:ring-primary/40",
      },
      handleDrop: (_view, event) => handleEditorDrop(event as unknown as DragEvent),
    },
  });

  // Load any matching draft on entering edit mode and prompt the user
  // explicitly (Restore vs Discard) per FRD-2 §4.6 #4.
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

  // Autosave: every 10 s while editing, on blur, and on beforeunload.
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

  // Default the section checklist to every H2 the user might touch.
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
      <article
        id="wiki-content"
        className="min-w-0 rounded-lg border border-border bg-background p-4 md:p-6"
      >
        <div className="mb-4 flex items-center justify-end">
          <Button type="button" onClick={() => setMode("edit")}>
            Propose Edit
          </Button>
        </div>
        {isEmpty ? (
          <EmptyPagePlaceholder onProposeEdit={() => setMode("edit")} />
        ) : (
          renderProseMirrorDoc(initialContent, { decorateSections: true })
        )}
        <CommentsWidget pageId={pageId} />
      </article>
    );
  }

  return (
    <article
      id="wiki-content"
      className="min-w-0 rounded-lg border border-border bg-background p-4 md:p-6"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Editing this page</h2>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
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
            disabled={submitState.kind === "submitting"}
            onClick={submitProposal}
          >
            {submitState.kind === "submitting" ? "Submitting..." : "Submit Proposal"}
          </Button>
        </div>
      </div>

      {draftPrompt ? (
        <div className="mb-3 flex flex-col gap-2 rounded-md border border-primary/30 bg-primary/10 p-3 text-sm">
          <p>
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
      {editor ? <EditorContent editor={editor} /> : null}

      <fieldset className="mt-6 rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-medium">Sections in this proposal</legend>
        <div className="flex flex-wrap gap-3">
          {sections.map((section) => (
            <label
              key={section.slug}
              className="flex items-center gap-2 text-sm"
            >
              <input
                type="checkbox"
                checked={selectedSlugs.includes(section.slug)}
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
          ))}
        </div>
      </fieldset>

      <label className="mt-4 block text-sm font-medium" htmlFor="proposal-rationale">
        Rationale (min 20 characters)
      </label>
      <textarea
        id="proposal-rationale"
        value={rationale}
        onChange={(event) => setRationale(event.target.value)}
        maxLength={500}
        className="mt-2 min-h-24 w-full rounded-md border border-border bg-background p-2 text-sm"
        placeholder="Explain what changed and why."
      />
      <div className="mt-1 text-right text-xs text-muted-foreground">
        {rationale.length} / 500
      </div>

      {submitState.kind === "success" ? (
        <p className="mt-3 rounded-md border border-primary/30 bg-primary/10 p-3 text-sm">
          Proposal submitted: <code>{submitState.proposalId}</code>
        </p>
      ) : null}
      {submitState.kind === "error" ? (
        <p className="mt-3 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {submitState.message}
        </p>
      ) : null}
    </article>
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
    <div className="mb-3 flex flex-wrap items-center gap-2" role="toolbar" aria-label="Editor formatting">
      <ToolbarButton
        label="Heading 2"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        H2
      </ToolbarButton>
      <ToolbarButton
        label="Heading 3"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        H3
      </ToolbarButton>
      <ToolbarButton
        label="Bold"
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        B
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        I
      </ToolbarButton>
      <ToolbarButton
        label="Underline"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        U
      </ToolbarButton>
      <ToolbarButton
        label="Bullet list"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        UL
      </ToolbarButton>
      <ToolbarButton
        label="Ordered list"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        OL
      </ToolbarButton>
      <ToolbarButton
        label="Blockquote"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        Quote
      </ToolbarButton>
      <ToolbarButton
        label="Code block"
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        Code
      </ToolbarButton>
      <ToolbarButton
        label="Horizontal rule"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        Rule
      </ToolbarButton>
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
      <label className="inline-flex h-8 cursor-pointer items-center rounded-md border border-border px-3 text-xs">
        <span className="sr-only">Upload image</span>
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
    <Button
      size="sm"
      variant="outline"
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function EmptyPagePlaceholder({ onProposeEdit }: { onProposeEdit: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card p-10 text-center">
      <p className="text-lg font-medium">This page needs content.</p>
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
