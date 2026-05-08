"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { AuthModal } from "@/components/auth/auth-modal";
import { Button } from "@/components/ui/button";
import { renderCommentMarkdown } from "@/lib/comments/markdown";
import { savePendingAction } from "@/lib/pending-actions/storage";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils/time";
import type { CommentTree } from "@/types/domain";

type SelectionState = {
  anchorText: string;
  sectionSlug: string;
  rect: { left: number; top: number; width: number; bottom: number };
} | null;

type SortMode = "recent" | "votes";

type ReportState = { commentId: string };

const HIGHLIGHT_LIGHT_CLASS = "uw-comment-highlight-light";
const HIGHLIGHT_DARK_CLASS = "uw-comment-highlight-dark";

export function CommentsWidget({ pageId }: { pageId: string }) {
  const [comments, setComments] = useState<CommentTree[]>([]);
  const [selection, setSelection] = useState<SelectionState>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerBody, setComposerBody] = useState("");
  const [composerAnonymous, setComposerAnonymous] = useState(true);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [reportState, setReportState] = useState<ReportState | null>(null);
  const sidebarRef = useRef<HTMLDivElement | null>(null);

  const loadComments = useCallback(async () => {
    const res = await fetch(`/api/comments?pageId=${encodeURIComponent(pageId)}`);
    const json = (await res.json().catch(() => ({}))) as {
      comments?: CommentTree[];
    };
    setComments(json.comments ?? []);
  }, [pageId]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  useEffect(() => {
    function onMouseUp() {
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? "";
      if (!sel || sel.isCollapsed || !text) {
        setSelection(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const wikiContent = document.getElementById("wiki-content");
      if (!wikiContent || !wikiContent.contains(range.commonAncestorContainer)) {
        setSelection(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      setSelection({
        anchorText: text.length > 500 ? `${text.slice(0, 499)}…` : text,
        sectionSlug: findNearestSectionSlug(range.startContainer),
        rect: {
          left: rect.left + rect.width / 2,
          top: rect.top,
          width: rect.width,
          bottom: rect.bottom + window.scrollY + 8,
        },
      });
    }
    document.addEventListener("mouseup", onMouseUp);
    return () => document.removeEventListener("mouseup", onMouseUp);
  }, []);

  // Margin indicators: count top-level comments per section slug.
  const sectionCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const comment of comments) {
      map.set(comment.sectionSlug, (map.get(comment.sectionSlug) ?? 0) + 1);
    }
    return map;
  }, [comments]);

  useEffect(() => {
    const wikiContent = document.getElementById("wiki-content");
    if (!wikiContent) return undefined;

    const heading = Array.from(
      wikiContent.querySelectorAll<HTMLElement>("[data-section-slug]"),
    );
    const placed: Array<{ wrapper: HTMLElement; original: HTMLElement }> = [];

    for (const node of heading) {
      const slug = node.dataset.sectionSlug;
      if (!slug) continue;
      const count = sectionCounts.get(slug) ?? 0;
      if (count === 0) continue;
      const button = document.createElement("button");
      button.type = "button";
      button.className =
        "uw-comment-margin-indicator absolute -left-7 top-3 hidden h-5 min-w-5 items-center justify-center rounded-full border border-border bg-card px-1 text-[10px] font-medium text-muted-foreground hover:border-primary lg:flex";
      button.dataset.sectionSlug = slug;
      button.title = `${count} comment${count > 1 ? "s" : ""}`;
      button.textContent = count > 9 ? "9+" : String(count);
      button.addEventListener("click", () => {
        setSidebarOpen(true);
        setSelectedCommentId(null);
        const card = document.querySelector<HTMLElement>(
          `[data-comments-section="${slug}"]`,
        );
        card?.scrollIntoView({ block: "start", behavior: "smooth" });
      });
      const wrapper = document.createElement("div");
      wrapper.className = "relative";
      node.parentElement?.insertBefore(wrapper, node);
      wrapper.appendChild(node);
      wrapper.appendChild(button);
      placed.push({ wrapper, original: node });
    }

    return () => {
      for (const { wrapper, original } of placed) {
        wrapper.parentElement?.insertBefore(original, wrapper);
        wrapper.remove();
      }
    };
  }, [sectionCounts]);

  // Highlight controller.
  useEffect(() => {
    const wikiContent = document.getElementById("wiki-content");
    if (!wikiContent) return undefined;

    if (!sidebarOpen) {
      removeHighlights(wikiContent);
      return undefined;
    }

    removeHighlights(wikiContent);
    for (const comment of comments) {
      if (!comment.isAnchored || !comment.anchorText) continue;
      highlightAnchor(
        wikiContent,
        comment.anchorText,
        comment.id,
        comment.id === selectedCommentId
          ? HIGHLIGHT_DARK_CLASS
          : HIGHLIGHT_LIGHT_CLASS,
      );
    }

    return () => {
      removeHighlights(wikiContent);
    };
  }, [sidebarOpen, comments, selectedCommentId]);

  const groupedSidebar = useMemo(() => {
    if (comments.length === 0) return [];
    const wikiContent = document.getElementById("wiki-content");
    const order = new Map<string, number>();
    if (wikiContent) {
      const headings = wikiContent.querySelectorAll<HTMLElement>(
        "[data-section-slug]",
      );
      headings.forEach((heading, index) => {
        const slug = heading.dataset.sectionSlug;
        if (slug) order.set(slug, index);
      });
    }
    const groups = new Map<string, CommentTree[]>();
    for (const comment of comments) {
      const arr = groups.get(comment.sectionSlug) ?? [];
      arr.push(comment);
      groups.set(comment.sectionSlug, arr);
    }
    const entries = [...groups.entries()].map(([slug, value]) => {
      const sorted = [...value].sort(
        (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
      );
      return [slug, sorted] as const;
    });
    entries.sort(([slugA], [slugB]) => {
      const orderA = order.get(slugA) ?? Number.MAX_SAFE_INTEGER;
      const orderB = order.get(slugB) ?? Number.MAX_SAFE_INTEGER;
      return orderA - orderB;
    });
    return entries;
  }, [comments]);

  const bottomComments = useMemo(() => {
    const copy = [...comments];
    if (sortMode === "votes") {
      copy.sort(
        (a, b) => b.upvotes - b.downvotes - (a.upvotes - a.downvotes),
      );
    } else {
      copy.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    }
    return copy;
  }, [comments, sortMode]);

  async function submitComment(parentCommentId?: string) {
    if (!composerBody.trim()) return;
    const source = selection ?? { anchorText: "", sectionSlug: "unknown" };
    setComposerError(null);
    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pageId,
        body: composerBody,
        anchorText: source.anchorText,
        sectionSlug: source.sectionSlug,
        isAnonymous: composerAnonymous,
        parentCommentId: parentCommentId ?? null,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      comments?: CommentTree[];
      error?: string;
    };
    if (!res.ok) {
      setComposerError(json.error ?? "Could not add comment.");
      return;
    }
    setComments(json.comments ?? []);
    setComposerBody("");
    setComposerOpen(false);
    setSelection(null);
  }

  return (
    <section className="relative mt-10 border-t border-border pt-8">
      <HighlightStyles />

      {selection ? (
        <button
          type="button"
          className="fixed z-50 -translate-x-1/2 rounded-md bg-primary px-3 py-1 text-sm font-medium text-primary-foreground shadow"
          style={{ top: selection.rect.bottom, left: selection.rect.left }}
          onClick={() => {
            setSidebarOpen(true);
            setComposerOpen(true);
          }}
        >
          Add Comment
        </button>
      ) : null}

      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Comments</h2>
          <p className="text-sm text-muted-foreground">
            Select text in the article to anchor a new comment, or browse all
            comments below.
          </p>
        </div>
        <Button variant="outline" onClick={() => setSidebarOpen(true)}>
          Open Sidebar ({comments.length})
        </Button>
      </div>

      <div className="mb-4 flex gap-2">
        <Button
          size="sm"
          variant={sortMode === "recent" ? "default" : "outline"}
          onClick={() => setSortMode("recent")}
        >
          Most Recent
        </Button>
        <Button
          size="sm"
          variant={sortMode === "votes" ? "default" : "outline"}
          onClick={() => setSortMode("votes")}
        >
          Top Voted
        </Button>
      </div>

      {bottomComments.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No comments yet. Be the first to add one!
        </div>
      ) : (
        <div className="space-y-3">
          {bottomComments.map((comment) => (
            <CommentCard
              key={comment.id}
              comment={comment}
              onReload={loadComments}
              onSelect={() => {
                setSelectedCommentId(comment.id);
                setSidebarOpen(true);
              }}
              onReport={() => setReportState({ commentId: comment.id })}
            />
          ))}
        </div>
      )}

      {sidebarOpen ? (
        <div
          ref={sidebarRef}
          className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-border bg-background shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-border p-4">
            <h2 className="font-semibold">Comments ({comments.length})</h2>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSidebarOpen(false);
                setSelectedCommentId(null);
                setComposerOpen(false);
              }}
            >
              Close
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {composerOpen ? (
              <div className="mb-4 rounded-lg border border-border bg-card p-3">
                <p className="mb-2 text-xs text-muted-foreground">
                  {selection?.anchorText
                    ? `Anchored to: ${selection.anchorText}`
                    : "General page comment"}
                </p>
                <textarea
                  value={composerBody}
                  onChange={(event) => setComposerBody(event.target.value)}
                  maxLength={1500}
                  className="min-h-24 w-full rounded-md border border-border bg-background p-2 text-sm"
                  placeholder="Share your thoughts..."
                />
                <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3 text-xs">
                    <span
                      className={cn(
                        composerBody.length > 1400 && "text-destructive",
                      )}
                    >
                      {composerBody.length} / 1500
                    </span>
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={!composerAnonymous}
                        onChange={(event) =>
                          setComposerAnonymous(!event.target.checked)
                        }
                      />
                      Attribute to me
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setComposerOpen(false);
                        setComposerBody("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={!composerBody.trim()}
                      onClick={() => submitComment()}
                    >
                      Submit
                    </Button>
                  </div>
                </div>
                {composerError ? (
                  <p className="mt-2 text-xs text-destructive">
                    {composerError}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-6">
              {groupedSidebar.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No comments yet.
                </p>
              ) : (
                groupedSidebar.map(([slug, items]) => (
                  <div key={slug} data-comments-section={slug}>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {slug.replace(/-/g, " ")}
                    </h3>
                    <div className="space-y-3">
                      {items.map((comment) => (
                        <CommentCard
                          key={comment.id}
                          comment={comment}
                          onReload={loadComments}
                          onSelect={() => setSelectedCommentId(comment.id)}
                          onReport={() => setReportState({ commentId: comment.id })}
                          isSelected={selectedCommentId === comment.id}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {reportState ? (
        <ReportModal
          commentId={reportState.commentId}
          onClose={() => setReportState(null)}
        />
      ) : null}
    </section>
  );
}

function CommentCard({
  comment,
  onReload,
  onSelect,
  onReport,
  isReply = false,
  isSelected = false,
}: {
  comment: CommentTree | CommentTree["replies"][number];
  onReload: () => Promise<void>;
  onSelect?: () => void;
  onReport: () => void;
  isReply?: boolean;
  isSelected?: boolean;
}) {
  const [reply, setReply] = useState("");
  const [replyOpen, setReplyOpen] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  async function vote(voteType: "up" | "down") {
    setVoteError(null);
    const res = await fetch(`/api/comments/${comment.id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voteType }),
    });
    if (res.status === 401) {
      savePendingAction(
        "comment.vote",
        { commentId: comment.id, voteType },
        window.location.pathname,
      );
      setAuthOpen(true);
      setVoteError("Sign in to vote. Your vote has been saved.");
      return;
    }
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      setVoteError(json.error ?? "Could not vote.");
      return;
    }
    await onReload();
  }

  async function submitReply() {
    if (!reply.trim()) return;
    const res = await fetch(`/api/comments/${comment.id}/replies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: reply, isAnonymous: true }),
    });
    if (res.ok) {
      setReply("");
      setReplyOpen(false);
      await onReload();
    }
  }

  return (
    <article
      data-comment-id={comment.id}
      onClick={onSelect}
      className={cn(
        "rounded-lg border border-border bg-card p-3",
        isReply && "ml-5 bg-background",
        isSelected && "border-primary",
        onSelect && "cursor-pointer",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>
          {comment.authorDisplayName ?? "Anonymous"} ·{" "}
          {formatRelativeTime(comment.createdAt)}
          {comment.isEdited ? " · edited" : ""}
        </span>
        {!isReply ? (
          <span className="rounded-full border border-border px-2 py-0.5">
            {comment.sectionSlug}
          </span>
        ) : null}
      </div>
      {!isReply && comment.anchorText ? (
        <p className="mb-2 border-l-2 border-primary/40 pl-2 text-xs text-muted-foreground">
          {comment.isAnchored
            ? `“${comment.anchorText.slice(0, 80)}${
                comment.anchorText.length > 80 ? "…" : ""
              }”`
            : `“${comment.anchorText.slice(0, 80)}${
                comment.anchorText.length > 80 ? "…" : ""
              }” · references previous version`}
        </p>
      ) : null}
      <div
        className="text-sm leading-6 text-zinc-200"
        dangerouslySetInnerHTML={{ __html: renderCommentMarkdown(comment.body) }}
      />
      <div className="mt-3 flex items-center gap-3 text-xs">
        <button
          className="text-muted-foreground hover:text-primary"
          onClick={(event) => {
            event.stopPropagation();
            void vote("up");
          }}
        >
          ▲ {comment.upvotes}
        </button>
        <button
          className="text-muted-foreground hover:text-red-400"
          onClick={(event) => {
            event.stopPropagation();
            void vote("down");
          }}
        >
          ▼ {comment.downvotes}
        </button>
        {!isReply ? (
          <button
            className="text-muted-foreground hover:text-foreground"
            onClick={(event) => {
              event.stopPropagation();
              setReplyOpen((value) => !value);
            }}
          >
            Reply
          </button>
        ) : null}
        <button
          className="ml-auto text-muted-foreground hover:text-destructive"
          onClick={(event) => {
            event.stopPropagation();
            onReport();
          }}
        >
          Report
        </button>
      </div>
      {voteError ? (
        <p className="mt-2 text-xs text-destructive">{voteError}</p>
      ) : null}
      <AuthModal
        open={authOpen}
        returnTo={typeof window === "undefined" ? "/" : window.location.pathname}
        onClose={() => setAuthOpen(false)}
      />
      {replyOpen ? (
        <div
          className="mt-3 flex gap-2"
          onClick={(event) => event.stopPropagation()}
        >
          <textarea
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            maxLength={1500}
            className="min-h-16 flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm"
            placeholder="Write a reply..."
          />
          <Button size="sm" disabled={!reply.trim()} onClick={submitReply}>
            Reply
          </Button>
        </div>
      ) : null}
      {"replies" in comment && comment.replies.length > 0 ? (
        <div className="mt-3 space-y-2">
          {comment.replies.map((child) => (
            <CommentCard
              key={child.id}
              comment={child}
              onReload={onReload}
              onReport={() => onReport()}
              isReply
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}

function ReportModal({
  commentId,
  onClose,
}: {
  commentId: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<"spam" | "harassment" | "misinformation" | "other">("spam");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setMessage(null);
    const res = await fetch(`/api/comments/${commentId}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, details: details || undefined }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setSubmitting(false);
    if (!res.ok) {
      setMessage(json.error ?? "Could not submit report.");
      return;
    }
    setMessage("Report submitted. A reviewer will follow up.");
    setTimeout(onClose, 1200);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-w-sm rounded-lg border border-border bg-card p-5 text-sm">
        <h3 className="text-base font-semibold">Report comment</h3>
        <fieldset className="mt-3 space-y-2">
          <legend className="sr-only">Reason</legend>
          {[
            { value: "spam", label: "Spam" },
            { value: "harassment", label: "Harassment" },
            { value: "misinformation", label: "Misinformation" },
            { value: "other", label: "Other" },
          ].map((option) => (
            <label key={option.value} className="flex items-center gap-2">
              <input
                type="radio"
                name="report-reason"
                value={option.value}
                checked={reason === option.value}
                onChange={() =>
                  setReason(option.value as typeof reason)
                }
              />
              {option.label}
            </label>
          ))}
        </fieldset>
        <textarea
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          maxLength={1000}
          className="mt-3 min-h-16 w-full rounded-md border border-border bg-background p-2 text-sm"
          placeholder="Optional details"
        />
        {message ? (
          <p className="mt-3 text-xs text-muted-foreground">{message}</p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={submitting} onClick={submit}>
            {submitting ? "Submitting..." : "Submit Report"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function HighlightStyles() {
  return (
    <style suppressHydrationWarning>{`
      .${HIGHLIGHT_LIGHT_CLASS} {
        background-color: rgba(254, 201, 59, 0.2);
        border-radius: 2px;
      }
      .${HIGHLIGHT_DARK_CLASS} {
        background-color: rgba(254, 201, 59, 0.4);
        border-radius: 2px;
      }
    `}</style>
  );
}

function highlightAnchor(
  root: HTMLElement,
  anchorText: string,
  commentId: string,
  className: string,
) {
  const cleaned = anchorText.replace(/\s+/g, " ").trim();
  if (!cleaned) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const candidates: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (node.parentElement?.closest(`.${HIGHLIGHT_LIGHT_CLASS}, .${HIGHLIGHT_DARK_CLASS}`)) {
      continue;
    }
    candidates.push(node);
  }
  for (const node of candidates) {
    const text = node.nodeValue ?? "";
    const idx = text.indexOf(cleaned);
    if (idx === -1) continue;
    const range = document.createRange();
    range.setStart(node, idx);
    range.setEnd(node, idx + cleaned.length);
    const mark = document.createElement("mark");
    mark.className = className;
    mark.dataset.commentId = commentId;
    range.surroundContents(mark);
    return;
  }
}

function removeHighlights(root: HTMLElement) {
  const marks = root.querySelectorAll<HTMLElement>(
    `.${HIGHLIGHT_LIGHT_CLASS}, .${HIGHLIGHT_DARK_CLASS}`,
  );
  for (const mark of marks) {
    const parent = mark.parentNode;
    if (!parent) continue;
    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark);
    }
    parent.removeChild(mark);
    parent.normalize();
  }
}

function findNearestSectionSlug(node: Node): string {
  let current: Node | null = node;
  while (current && current.nodeType !== Node.ELEMENT_NODE) {
    current = current.parentNode;
  }
  let element = current as Element | null;
  while (element) {
    if (element instanceof HTMLElement && element.dataset.sectionSlug) {
      return element.dataset.sectionSlug;
    }
    let previous = element.previousElementSibling;
    while (previous) {
      if (previous instanceof HTMLElement && previous.dataset.sectionSlug) {
        return previous.dataset.sectionSlug;
      }
      previous = previous.previousElementSibling;
    }
    element = element.parentElement;
  }
  return "unknown";
}
