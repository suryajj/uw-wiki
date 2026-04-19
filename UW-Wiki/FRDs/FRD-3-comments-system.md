# Feature Requirements Document: FRD 3 -- Comments System (v1.0)

| Field | Value |
|---|---|
| **Project** | UW Wiki |
| **Parent Document** | [PRD v0.1](../PRD.md) |
| **FRD Order** | [FRD Order](../FRD-order.md) |
| **PRD Sections** | 6.5 (Comments System) |
| **Type** | Core product feature |
| **Depends On** | FRD 0 (Setup Document), FRD 2 (Wiki Pages, Directory, Editor, and Edit Proposals) |
| **Delivers** | Inline text-anchored comments, threaded replies, margin indicators per section, comments sidebar, bottom section with sorting, voting system, anchor text management across page edits, moderation queue |
| **Created** | 2026-04-06 |

---

## Summary

FRD 3 builds the comments system for UW Wiki -- the mechanism through which users surface counterpoints, nuance, and alternative perspectives without replacing primary article content. Comments allow disputed information to coexist: the article states one view while comments surface alternatives. The system has three display components: **margin indicators** (per-H2-section comment counts displayed in the left gutter for discovery while reading), a **comments sidebar** (replaces the Pulse sidebar when open, showing comments in document-position order with threaded replies), and a **bottom section** (shows all page comments with sort options for browsing). Users create comments by selecting arbitrary text spans (Medium-style), which anchors the comment to specific content. The system stores the `anchor_text` and `section_slug` for each comment. On subsequent page loads, exact-match re-anchoring attempts to locate the anchor text in the current page version -- found comments are "anchored" (margin indicator shows, text can be highlighted), while not-found comments are "orphaned" (still visible, marked as "references previous version"). Comments support two-level threading (top-level + replies), upvote/downvote voting (account required), basic markdown formatting (bold, italic, links), and a 1500-character limit. Moderation is post-hoc: comments are live immediately, users can report with a reason, and reviewers can delete reported comments. Comment chunks integrate with the FRD 1 RAG pipeline for AI search.

---

## Given Context (Preconditions)

The following are assumed to be in place from FRD 0 and FRD 2:

| Prerequisite | Source FRD |
|---|---|
| Next.js 15 App Router project scaffolded | FRD 0 |
| Supabase project with PostgreSQL 17 configured | FRD 0 |
| Supabase Auth configured (Google OAuth + email/password) | FRD 0 |
| `universities`, `organizations`, `pages`, `page_versions`, `comments` tables exist | FRD 0 |
| shadcn/ui + TailwindCSS v4 with UW dark theme configured | FRD 0 |
| Three-column wiki page layout (TOC, content, Pulse sidebar) | FRD 2 |
| ProseMirror JSON content rendering | FRD 2 |
| User authentication flow | FRD 0, FRD 2 |
| RAG embedding service and `chunks` table | FRD 1 |

### Terms

| Term | Definition |
|---|---|
| Anchor text | The exact text span a user highlighted when creating a comment. Stored verbatim for re-anchoring and context preservation. |
| Anchored comment | A comment whose `anchor_text` was found via exact match in the current page version. The comment can be highlighted in the content area. |
| Orphaned comment | A comment whose `anchor_text` was not found in the current page version. The comment is still visible but marked as "references previous version." |
| Margin indicator | A visual element in the left gutter showing the number of comments anchored to a given H2 section. |
| Comments sidebar | A panel that replaces the Pulse sidebar when open, displaying comments for the page in document-position order. |
| Bottom section | A section below the wiki page content showing all comments with sort options (most recent, top voted). |
| Thread | A top-level comment and its replies. Threading is limited to two levels (no nested replies). |
| Section slug | The URL-anchor-friendly identifier for an H2 section (e.g., "Time Commitment" -> `time-commitment`). |

---

## Executive Summary (Gherkin-Style)

```gherkin
Feature: Comments System

  Background:
    Given  FRD 0 and FRD 2 are complete
    And    the wiki page renders with the three-column layout
    And    Supabase Auth is configured

  # --- Comment Creation ---

  Scenario: User selects text to create a comment
    When   a user selects a span of text on a wiki page
    Then   a floating "Add Comment" button appears near the selection
    And    clicking the button opens the comments sidebar
    And    a comment composer appears at the top of the sidebar
    And    the selected text is stored as the anchor_text

  Scenario: User submits a comment
    Given  the comment composer is open
    When   the user types a comment (up to 1500 characters)
    And    applies basic markdown formatting (bold, italic, links)
    And    clicks "Submit"
    Then   the system requires authentication if not signed in
    And    the comment is saved with anchor_text and section_slug
    And    the comment appears immediately in the sidebar
    And    a comment chunk is created for RAG indexing (FRD 1)

  Scenario: Unauthenticated user attempts to submit a comment
    Given  the user is not signed in
    When   the user clicks "Submit" on the comment composer
    Then   an auth modal appears (Google OAuth or email/password)
    And    after successful sign-in, the comment is submitted automatically

  # --- Comment Display: Margin Indicators ---

  Scenario: Page renders with margin indicators
    Given  a wiki page has comments anchored to various sections
    When   a user views the page
    Then   each H2 section heading shows a comment count badge in the left margin
    And    the badge shows the total number of comments in that section
    And    sections with zero comments show no badge

  Scenario: User clicks a margin indicator
    When   a user clicks a margin indicator badge
    Then   the comments sidebar opens (replacing the Pulse sidebar)
    And    the sidebar scrolls to show comments for that section
    And    all anchor texts in that section are highlighted with a light highlight

  # --- Comment Display: Sidebar ---

  Scenario: User opens the comments sidebar
    When   a user clicks the "Comments" button in the page header
    Then   the comments sidebar opens (replacing the Pulse sidebar)
    And    all page comments are displayed in document-position order
    And    all anchor texts on the page receive a light highlight

  Scenario: User selects a comment in the sidebar
    When   a user clicks on a comment card in the sidebar
    Then   the page scrolls to the comment's anchor text
    And    the anchor text receives a darker highlight
    And    the comment card is visually selected

  Scenario: User views an orphaned comment in the sidebar
    Given  a comment's anchor_text no longer exists in the current page
    When   the user views the comment in the sidebar
    Then   the comment displays normally
    And    a "📍 Anchored text" element is clickable
    And    clicking it expands to reveal the original anchor_text snippet
    And    a "references previous version" badge is shown

  Scenario: User views an anchored comment's anchor element
    Given  a comment's anchor_text exists in the current page
    When   the user clicks the "📍 Anchored text" element
    Then   the page scrolls to the anchor text
    And    the anchor text receives a darker highlight
    And    no snippet is expanded (the user can see the text in the page)

  Scenario: User closes the comments sidebar
    When   a user clicks the X button in the sidebar header
    Or     clicks outside the sidebar area
    Then   the comments sidebar closes
    And    the Pulse sidebar returns
    And    all anchor highlights are removed

  # --- Comment Display: Bottom Section ---

  Scenario: User views the bottom section
    When   a user scrolls to the bottom of a wiki page
    Then   a "Comments" section displays all page comments
    And    a sort toggle allows switching between "Most Recent" and "Top Voted"
    And    "Most Recent" is the default sort order

  Scenario: User sorts comments by votes
    When   a user selects "Top Voted" in the bottom section
    Then   comments are sorted by net vote score (upvotes - downvotes) descending
    And    the sort preference is remembered for the session

  Scenario: Empty state in bottom section
    Given  a wiki page has no comments
    When   a user views the bottom section
    Then   a message displays: "No comments yet. Be the first to add one!"
    And    a "Add Comment" button is shown

  # --- Threading ---

  Scenario: User replies to a comment
    When   a user clicks "Reply" on a top-level comment
    Then   a reply composer appears below the comment
    And    the user can type a reply (up to 1500 characters)
    And    submitting adds the reply nested under the parent comment

  Scenario: Reply nesting is limited to two levels
    Given  a comment already has replies
    When   a user views a reply
    Then   no "Reply" button is shown on replies
    And    users can only reply to top-level comments

  # --- Voting ---

  Scenario: User upvotes a comment
    Given  the user is signed in
    When   the user clicks the upvote button on a comment or reply
    Then   the vote is recorded
    And    the vote count updates immediately
    And    the upvote button is highlighted

  Scenario: User downvotes a comment
    Given  the user is signed in
    When   the user clicks the downvote button on a comment or reply
    Then   the vote is recorded
    And    the vote count updates immediately
    And    the downvote button is highlighted

  Scenario: User changes their vote
    Given  the user previously upvoted a comment
    When   the user clicks the downvote button
    Then   the upvote is removed
    And    the downvote is recorded
    And    the vote count adjusts accordingly

  Scenario: Unauthenticated user attempts to vote
    Given  the user is not signed in
    When   the user clicks an upvote or downvote button
    Then   an auth modal appears
    And    after sign-in, the vote is recorded

  # --- Edit and Delete ---

  Scenario: User edits their own comment
    Given  the user authored a comment
    When   the user clicks "Edit" on their comment
    Then   the comment body becomes editable
    And    the user can modify the text
    And    saving shows an "edited" indicator on the comment

  Scenario: User deletes their own comment
    Given  the user authored a comment
    When   the user clicks "Delete" on their comment
    And    confirms the deletion
    Then   the comment is permanently removed
    And    no placeholder is shown
    And    the comment chunk is deleted from RAG (FRD 1)

  # --- Anchoring and Re-anchoring ---

  Scenario: Comment anchor text is found on page load
    Given  a comment was created with anchor_text "the culture is collaborative"
    And    the current page version contains "the culture is collaborative"
    When   the page loads
    Then   the comment is marked as anchored
    And    the margin indicator includes this comment
    And    the anchor text can be highlighted when the sidebar opens

  Scenario: Comment anchor text is not found on page load
    Given  a comment was created with anchor_text "old text that was removed"
    And    the current page version does not contain "old text that was removed"
    When   the page loads
    Then   the comment is marked as orphaned
    And    the comment's references_previous_version flag is set to true
    And    the margin indicator still includes this comment (counted toward section)
    And    the comment chunk is updated with references_previous_version = true (FRD 1)

  # --- Highlighting ---

  Scenario: Light highlight on sidebar open
    When   the comments sidebar opens
    Then   all anchor texts for anchored comments on the page receive a light highlight
    And    the highlight uses a subtle background color (e.g., yellow-900/20)

  Scenario: Dark highlight on comment selection
    When   a user clicks a comment in the sidebar
    Then   that comment's anchor text receives a darker highlight (e.g., yellow-700/40)
    And    other anchor texts remain with the light highlight

  Scenario: Highlights removed on sidebar close
    When   the comments sidebar closes
    Then   all anchor highlights are removed from the content

  # --- Attribution and Timestamps ---

  Scenario: User submits an anonymous comment
    Given  the attribution toggle is set to "Anonymous" (default)
    When   the user submits a comment
    Then   the comment displays "Anonymous" as the author

  Scenario: User submits an attributed comment
    Given  the user toggles attribution to show their display name
    When   the user submits a comment
    Then   the comment displays the user's display name

  Scenario: Comment displays relative timestamp
    Given  a comment was submitted 2 hours ago
    When   a user views the comment
    Then   the timestamp shows "2 hours ago"

  # --- Moderation ---

  Scenario: User reports a comment
    When   a user clicks "Report" on a comment
    Then   a modal appears with reason options: Spam, Harassment, Misinformation, Other
    And    the user selects a reason and optionally adds details
    And    the report is submitted to the moderation queue

  Scenario: Reviewer views reported comments
    Given  the user has the "reviewer" role
    When   the user navigates to /admin/reports
    Then   a list of reported comments is shown
    And    each report shows the comment, reporter, reason, and date

  Scenario: Reviewer hides a reported comment
    Given  a reviewer is viewing a reported comment
    When   the reviewer clicks "Hide Comment"
    Then   the comment is hidden from public view (is_hidden = true)
    And    the report is marked as resolved
    And    the comment remains in the database for audit purposes

  # --- RAG Integration ---

  Scenario: Comment chunk is created on submission
    When   a comment is submitted
    Then   a chunk is created with chunk_type = "comment"
    And    anchored_section is set to the section's title
    And    references_previous_version is set to false

  Scenario: Orphaned comment updates RAG chunk
    When   a comment becomes orphaned (anchor text not found)
    Then   the comment chunk's references_previous_version is set to true
```

---

## Table of Contents

1. [Comment Creation](#1-comment-creation)
2. [Comment Storage](#2-comment-storage)
3. [Anchor Text Management](#3-anchor-text-management)
4. [Margin Indicators](#4-margin-indicators)
5. [Comments Sidebar](#5-comments-sidebar)
6. [Bottom Section](#6-bottom-section)
7. [Highlighting System](#7-highlighting-system)
8. [Threading](#8-threading)
9. [Voting System](#9-voting-system)
10. [Edit and Delete](#10-edit-and-delete)
11. [Attribution and Timestamps](#11-attribution-and-timestamps)
12. [Moderation](#12-moderation)
13. [RAG Integration](#13-rag-integration)
14. [Database Schema](#14-database-schema)
15. [API Routes](#15-api-routes)
16. [Non-Functional Requirements](#16-non-functional-requirements)
17. [Exit Criteria](#17-exit-criteria)
18. [Appendix A: Comment Card Component Spec](#appendix-a-comment-card-component-spec)
19. [Appendix B: Markdown Rendering](#appendix-b-markdown-rendering)
20. [Appendix C: Anchor Highlight Styles](#appendix-c-anchor-highlight-styles)
21. [Design Decisions Log](#design-decisions-log)

---

## 1. Comment Creation

### 1.1 Overview

Users create comments by selecting text on a wiki page. A floating "Add Comment" button appears near the selection. Clicking it opens the comments sidebar with a composer pre-loaded with the selected anchor text.

### 1.2 Text Selection Flow

The system shall:

1. Listen for `mouseup` events on the wiki page content area.
2. On text selection, check if the selection contains at least 1 character of text.
3. Display a floating "Add Comment" button positioned near the selection (above or below, whichever has more space).
4. The button has a comment icon and the text "Add Comment."
5. If the user clicks elsewhere or makes a new selection, dismiss the current button.

### 1.3 Selection Constraints

The system shall:

1. Allow selection of any contiguous text span within the content area.
2. Selections can span multiple paragraphs or inline elements.
3. Store the raw text content of the selection (no HTML/formatting) as `anchor_text`.
4. Limit `anchor_text` to 500 characters. If the selection exceeds this, truncate and append "..." with a visual indicator.

### 1.4 Opening the Composer

When the user clicks "Add Comment":

1. Store the selected text as `anchor_text` in component state.
2. Determine the `section_slug` by finding the nearest preceding H2 heading.
3. Open the comments sidebar (replacing the Pulse sidebar).
4. Render the comment composer at the top of the sidebar.
5. The composer shows the anchor text snippet (truncated to 100 chars) as context.

### 1.5 Comment Composer

The comment composer contains:

| Element | Description |
|---|---|
| **Anchor preview** | A greyed-out snippet of the anchor text, truncated with ellipsis. Non-editable. |
| **Textarea** | Multi-line input for the comment body. Placeholder: "Share your thoughts..." |
| **Character counter** | Shows "X / 1500" with the count turning red when approaching the limit. |
| **Formatting toolbar** | Three buttons: Bold (B), Italic (I), Link (🔗). |
| **Attribution toggle** | Switch defaulting to "Anonymous." Toggling shows "Attributed to: [display name]." |
| **Submit button** | "Submit" (gold accent). Disabled if body is empty. |
| **Cancel button** | "Cancel" text link. Closes the composer without submitting. |

### 1.6 Formatting Toolbar

The toolbar provides basic markdown shortcuts:

| Button | Action | Markdown |
|---|---|---|
| **B** | Bold | Wraps selection in `**...**` |
| **I** | Italic | Wraps selection in `*...*` |
| **🔗** | Link | Opens a prompt for URL, wraps selection in `[...](url)` |

The textarea accepts raw markdown. Rendering is handled at display time.

### 1.7 Submission

When the user clicks "Submit":

1. If the user is not authenticated, show the auth modal (same as FRD 2).
2. After authentication (or if already authenticated), call `POST /api/comments`.
3. On success:
   - Close the composer.
   - Insert the new comment at the top of the comments list in the sidebar.
   - Create a comment chunk via `reembedComment` (FRD 1).
   - Show a brief success toast: "Comment added."
4. On failure, show an error toast with the message.

### 1.8 Implementation

```typescript
// src/components/comments/TextSelectionHandler.tsx

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";

interface TextSelectionHandlerProps {
  contentRef: React.RefObject<HTMLDivElement>;
  onAddComment: (anchorText: string, sectionSlug: string) => void;
}

export function TextSelectionHandler({ contentRef, onAddComment }: TextSelectionHandlerProps) {
  const [selection, setSelection] = useState<{
    text: string;
    rect: DOMRect;
    sectionSlug: string;
  } | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !contentRef.current) {
      setSelection(null);
      return;
    }

    const text = sel.toString().trim();
    if (text.length === 0) {
      setSelection(null);
      return;
    }

    const range = sel.getRangeAt(0);
    if (!contentRef.current.contains(range.commonAncestorContainer)) {
      setSelection(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    const sectionSlug = findNearestSectionSlug(range.startContainer);

    setSelection({
      text: text.slice(0, 500),
      rect,
      sectionSlug,
    });
  }, [contentRef]);

  useEffect(() => {
    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, [handleMouseUp]);

  if (!selection) return null;

  const buttonTop = selection.rect.bottom + window.scrollY + 8;
  const buttonLeft = selection.rect.left + selection.rect.width / 2;

  return (
    <div
      ref={buttonRef}
      className="fixed z-50 -translate-x-1/2"
      style={{ top: buttonTop, left: buttonLeft }}
    >
      <Button
        size="sm"
        className="bg-[#FEC93B] text-black hover:bg-[#FFD700]"
        onClick={() => {
          onAddComment(selection.text, selection.sectionSlug);
          setSelection(null);
          window.getSelection()?.removeAllRanges();
        }}
      >
        <MessageSquare className="h-4 w-4 mr-1" />
        Add Comment
      </Button>
    </div>
  );
}

function findNearestSectionSlug(node: Node): string {
  let current: Node | null = node;
  while (current && current.nodeType !== Node.ELEMENT_NODE) {
    current = current.parentNode;
  }

  while (current) {
    const el = current as Element;
    const heading = el.closest("[data-section-slug]");
    if (heading) {
      return heading.getAttribute("data-section-slug") || "unknown";
    }
    const prevHeading = findPreviousHeading(el);
    if (prevHeading) {
      return prevHeading.getAttribute("data-section-slug") || "unknown";
    }
    current = current.parentNode;
  }

  return "unknown";
}

function findPreviousHeading(el: Element): Element | null {
  let sibling = el.previousElementSibling;
  while (sibling) {
    if (sibling.tagName === "H2" && sibling.hasAttribute("data-section-slug")) {
      return sibling;
    }
    sibling = sibling.previousElementSibling;
  }
  return null;
}
```

---

## 2. Comment Storage

### 2.1 Data Model

Each comment is stored in the `comments` table:

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `page_id` | UUID | Foreign key to `pages` |
| `parent_comment_id` | UUID | NULL for top-level comments, references `comments.id` for replies |
| `user_id` | UUID | Foreign key to `users` (the author) |
| `anchor_text` | TEXT | The exact text span the user selected (up to 500 chars) |
| `section_slug` | TEXT | The slug of the H2 section the comment is anchored to |
| `body` | TEXT | The comment content (up to 1500 chars, may contain markdown) |
| `is_anonymous` | BOOLEAN | Whether to display author name (default: true) |
| `is_edited` | BOOLEAN | Whether the comment has been edited (default: false) |
| `upvotes` | INTEGER | Cached upvote count |
| `downvotes` | INTEGER | Cached downvote count |
| `created_at` | TIMESTAMPTZ | When the comment was created |
| `updated_at` | TIMESTAMPTZ | When the comment was last edited |

### 2.2 Vote Storage

Votes are stored in a `comment_votes` table:

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `comment_id` | UUID | Foreign key to `comments` |
| `user_id` | UUID | Foreign key to `users` |
| `vote_type` | TEXT | "up" or "down" |
| `created_at` | TIMESTAMPTZ | When the vote was cast |

A unique constraint on `(comment_id, user_id)` ensures one vote per user per comment.

### 2.3 Report Storage

Reports are stored in a `comment_reports` table:

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `comment_id` | UUID | Foreign key to `comments` |
| `reporter_id` | UUID | Foreign key to `users` |
| `reason` | TEXT | "spam", "harassment", "misinformation", or "other" |
| `details` | TEXT | Optional additional context |
| `status` | TEXT | "pending", "resolved", "dismissed" |
| `resolved_by` | UUID | Foreign key to `users` (the reviewer) |
| `resolved_at` | TIMESTAMPTZ | When the report was resolved |
| `created_at` | TIMESTAMPTZ | When the report was submitted |

---

## 3. Anchor Text Management

### 3.1 Overview

Each comment stores the exact `anchor_text` that was selected at creation time. On page load, the system attempts to re-anchor comments by finding exact matches of the anchor text in the current page content. This determines whether a comment is "anchored" (text found) or "orphaned" (text not found).

### 3.2 Re-anchoring Algorithm

On page load, for each comment on the page:

```typescript
// src/lib/comments/anchoring.ts

interface AnchorResult {
  isAnchored: boolean;
  position?: { start: number; end: number };
}

export function reanchorComment(
  anchorText: string,
  pageTextContent: string
): AnchorResult {
  const index = pageTextContent.indexOf(anchorText);
  
  if (index === -1) {
    return { isAnchored: false };
  }
  
  return {
    isAnchored: true,
    position: { start: index, end: index + anchorText.length },
  };
}
```

The algorithm is intentionally simple: **exact match only**. No fuzzy matching, no Levenshtein distance, no partial matches. If the anchor text was modified in any way (even a single character), the comment becomes orphaned.

### 3.3 Extracting Page Text Content

To search for anchor text, the system extracts plain text from the ProseMirror JSON:

```typescript
// src/lib/comments/anchoring.ts

export function extractPageTextContent(prosemirrorJson: object): string {
  const lines: string[] = [];
  
  function walk(node: any) {
    if (node.text) {
      lines.push(node.text);
    }
    if (node.content) {
      for (const child of node.content) {
        walk(child);
      }
    }
  }
  
  walk(prosemirrorJson);
  return lines.join(" ");
}
```

### 3.4 Anchor Status Propagation

The re-anchoring result is used in three places:

1. **UI rendering:** Anchored comments can be highlighted; orphaned comments show the anchor text snippet.
2. **Margin indicators:** Both anchored and orphaned comments count toward the section's comment count.
3. **RAG chunks:** Orphaned comments have `references_previous_version = true`.

### 3.5 When Re-anchoring Fails

When a comment becomes orphaned:

1. The comment remains visible in the sidebar and bottom section.
2. The "📍 Anchored text" element in the comment card becomes expandable.
3. Clicking it reveals the original anchor text snippet with a "references previous version" badge.
4. The comment chunk is updated: `UPDATE chunks SET references_previous_version = true WHERE source_comment_id = $1`.

### 3.6 Updating Anchor Status on Page Edit

When a page edit is accepted (FRD 2, Section 8.6), the system runs re-anchoring for all comments on that page:

```typescript
// src/lib/comments/anchoring.ts

export async function updateAnchorStatusForPage(
  pageId: string,
  newContentJson: object
) {
  const supabase = createAdminClient();
  const pageText = extractPageTextContent(newContentJson);
  
  const { data: comments } = await supabase
    .from("comments")
    .select("id, anchor_text")
    .eq("page_id", pageId)
    .is("parent_comment_id", null);
  
  for (const comment of comments || []) {
    const { isAnchored } = reanchorComment(comment.anchor_text, pageText);
    
    if (!isAnchored) {
      await supabase
        .from("chunks")
        .update({ references_previous_version: true })
        .eq("source_comment_id", comment.id);
    }
  }
}
```

This runs asynchronously after the page edit is accepted.

---

## 4. Margin Indicators

### 4.1 Overview

Margin indicators are small badges displayed in the left gutter next to each H2 section heading. They show the total number of comments anchored to that section, enabling discovery while reading.

### 4.2 Placement

Each H2 heading element receives a margin indicator badge positioned:

- Absolutely positioned to the left of the heading text.
- Vertically centered with the heading.
- Within the TOC column gutter space on desktop.
- Hidden on mobile (comments are accessed via the bottom section or header button).

### 4.3 Comment Count Computation

For each H2 section, count all comments (top-level only, not replies) where `section_slug` matches the section's slug:

```typescript
// src/lib/comments/indicators.ts

interface SectionCommentCount {
  sectionSlug: string;
  count: number;
}

export function computeSectionCounts(
  comments: { section_slug: string; parent_comment_id: string | null }[]
): Map<string, number> {
  const counts = new Map<string, number>();
  
  for (const comment of comments) {
    if (comment.parent_comment_id !== null) continue; // Skip replies
    
    const current = counts.get(comment.section_slug) || 0;
    counts.set(comment.section_slug, current + 1);
  }
  
  return counts;
}
```

### 4.4 Visual Design

| State | Appearance |
|---|---|
| **0 comments** | No badge shown |
| **1-9 comments** | Small circular badge with the number, muted background (`bg-zinc-700`) |
| **10+ comments** | Badge shows "9+" to prevent excessive width |

### 4.5 Click Behavior

When a user clicks a margin indicator:

1. Open the comments sidebar.
2. Scroll the sidebar to show comments for that section first.
3. Apply light highlights to all anchored comment texts in that section.

### 4.6 Implementation

```typescript
// src/components/comments/MarginIndicator.tsx

"use client";

import { cn } from "@/lib/utils";

interface MarginIndicatorProps {
  count: number;
  onClick: () => void;
}

export function MarginIndicator({ count, onClick }: MarginIndicatorProps) {
  if (count === 0) return null;
  
  const displayCount = count > 9 ? "9+" : count.toString();
  
  return (
    <button
      onClick={onClick}
      className={cn(
        "absolute -left-8 top-1/2 -translate-y-1/2",
        "flex items-center justify-center",
        "w-5 h-5 rounded-full",
        "bg-zinc-700 hover:bg-zinc-600",
        "text-xs text-zinc-300 font-medium",
        "transition-colors cursor-pointer"
      )}
      title={`${count} comment${count !== 1 ? "s" : ""}`}
    >
      {displayCount}
    </button>
  );
}
```

---

## 5. Comments Sidebar

### 5.1 Overview

The comments sidebar is a panel that replaces the Pulse sidebar when open. It displays all comments for the page in document-position order, with threaded replies nested under their parent comments.

### 5.2 Trigger

The sidebar opens when:

1. A user clicks a margin indicator badge.
2. A user clicks the "Comments" button in the page header.
3. A user clicks the floating "Add Comment" button after selecting text.

### 5.3 Layout

The sidebar has three zones:

| Zone | Content |
|---|---|
| **Header** | "Comments" title, total comment count badge, X close button |
| **Composer area** | Shown when creating a new comment. Hidden otherwise. |
| **Comments list** | Scrollable list of comment cards in document-position order |

### 5.4 Sorting

Comments in the sidebar are sorted by **document position**:

1. Extract each comment's anchor position in the page text (from re-anchoring).
2. Sort comments by their anchor position ascending (top of page to bottom).
3. Orphaned comments (no anchor position) are sorted to the end, grouped by `section_slug`, then by `created_at` descending.

### 5.5 Section Grouping

Comments are visually grouped by section:

```
┌─────────────────────────────┐
│ Comments (12)          [X]  │
├─────────────────────────────┤
│ ▸ Time Commitment (3)       │
│   [CommentCard]             │
│   [CommentCard]             │
│   [CommentCard]             │
│ ▸ Culture and Vibe (5)      │
│   [CommentCard]             │
│   ...                       │
└─────────────────────────────┘
```

Section headers show the section title and comment count. They are collapsible for long pages.

### 5.6 Close Behavior

The sidebar closes when:

1. The user clicks the X button in the sidebar header.
2. The user clicks outside the sidebar area (on the content or TOC).
3. The user presses the Escape key.

On close, the Pulse sidebar returns and all anchor highlights are removed.

### 5.7 Scroll to Section

When opened via a margin indicator click, the sidebar scrolls to bring the clicked section's comments into view.

### 5.8 Implementation

```typescript
// src/components/comments/CommentsSidebar.tsx

"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { CommentCard } from "./CommentCard";
import { CommentComposer } from "./CommentComposer";
import { cn } from "@/lib/utils";

interface Comment {
  id: string;
  body: string;
  anchor_text: string;
  section_slug: string;
  is_anonymous: boolean;
  is_edited: boolean;
  upvotes: number;
  downvotes: number;
  created_at: string;
  user: { display_name: string } | null;
  replies: Comment[];
  isAnchored: boolean;
}

interface CommentsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  comments: Comment[];
  composerAnchorText?: string;
  composerSectionSlug?: string;
  onCommentSubmit: (data: {
    body: string;
    anchorText: string;
    sectionSlug: string;
    isAnonymous: boolean;
  }) => Promise<void>;
  onCommentSelect: (commentId: string) => void;
  selectedCommentId: string | null;
}

export function CommentsSidebar({
  isOpen,
  onClose,
  comments,
  composerAnchorText,
  composerSectionSlug,
  onCommentSubmit,
  onCommentSelect,
  selectedCommentId,
}: CommentsSidebarProps) {
  const [isComposerOpen, setIsComposerOpen] = useState(!!composerAnchorText);
  
  const groupedComments = groupBySection(comments);
  const totalCount = comments.length;
  
  if (!isOpen) return null;
  
  return (
    <aside className="w-[280px] min-w-[280px] border-l border-[#262626] bg-[#0A0A0A] overflow-y-auto">
      <div className="sticky top-0 bg-[#0A0A0A] border-b border-[#262626] p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-white">Comments</h2>
          <span className="text-xs bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded-full">
            {totalCount}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      
      {isComposerOpen && composerAnchorText && composerSectionSlug && (
        <CommentComposer
          anchorText={composerAnchorText}
          sectionSlug={composerSectionSlug}
          onSubmit={async (data) => {
            await onCommentSubmit(data);
            setIsComposerOpen(false);
          }}
          onCancel={() => setIsComposerOpen(false)}
        />
      )}
      
      <div className="p-4 space-y-6">
        {Array.from(groupedComments.entries()).map(([sectionSlug, sectionComments]) => (
          <div key={sectionSlug}>
            <h3 className="text-sm font-medium text-zinc-400 mb-3">
              {formatSectionTitle(sectionSlug)} ({sectionComments.length})
            </h3>
            <div className="space-y-3">
              {sectionComments.map((comment) => (
                <CommentCard
                  key={comment.id}
                  comment={comment}
                  isSelected={selectedCommentId === comment.id}
                  onClick={() => onCommentSelect(comment.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

function groupBySection(comments: Comment[]): Map<string, Comment[]> {
  const groups = new Map<string, Comment[]>();
  for (const comment of comments) {
    const existing = groups.get(comment.section_slug) || [];
    groups.set(comment.section_slug, [...existing, comment]);
  }
  return groups;
}

function formatSectionTitle(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
```

---

## 6. Bottom Section

### 6.1 Overview

The bottom section is a dedicated area below the wiki page content that displays all page comments with sort options. It provides an alternative browsing interface to the sidebar, optimized for reading through all comments.

### 6.2 Layout

The bottom section sits below the three-column layout, spanning full width:

```
┌──────────────────────────────────────────────────────────────────┐
│                          MAIN CONTENT                             │
│  [TOC]       [Wiki Content]               [Pulse Sidebar]         │
└──────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────┐
│  Comments (12)                                                    │
│  Sort: [Most Recent ▼] [Top Voted]                               │
├──────────────────────────────────────────────────────────────────┤
│  [CommentCard]                                                    │
│  [CommentCard]                                                    │
│  [CommentCard]                                                    │
│  ...                                                              │
└──────────────────────────────────────────────────────────────────┘
```

### 6.3 Sort Options

Two sort modes, selectable via toggle buttons:

| Sort Mode | Order |
|---|---|
| **Most Recent** (default) | `created_at` descending (newest first) |
| **Top Voted** | Net score (`upvotes - downvotes`) descending |

The selected sort mode is stored in session state (not persisted).

### 6.4 Comment Display

Comments in the bottom section use the same `CommentCard` component as the sidebar, but with a wider layout to utilize the full content width.

### 6.5 Empty State

When a page has no comments:

```
┌──────────────────────────────────────────────────────────────────┐
│  Comments                                                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│     💬 No comments yet. Be the first to add one!                 │
│                                                                   │
│              [Add Comment]                                        │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

Clicking "Add Comment" in the empty state prompts the user to select text on the page.

### 6.6 Implementation

```typescript
// src/components/comments/BottomSection.tsx

"use client";

import { useState, useMemo } from "react";
import { CommentCard } from "./CommentCard";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MessageSquare } from "lucide-react";

interface Comment {
  id: string;
  body: string;
  anchor_text: string;
  section_slug: string;
  is_anonymous: boolean;
  is_edited: boolean;
  upvotes: number;
  downvotes: number;
  created_at: string;
  user: { display_name: string } | null;
  replies: Comment[];
  isAnchored: boolean;
}

interface BottomSectionProps {
  comments: Comment[];
  onCommentClick: (commentId: string) => void;
}

export function BottomSection({ comments, onCommentClick }: BottomSectionProps) {
  const [sortMode, setSortMode] = useState<"recent" | "votes">("recent");
  
  const sortedComments = useMemo(() => {
    const sorted = [...comments];
    if (sortMode === "recent") {
      sorted.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } else {
      sorted.sort((a, b) => 
        (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes)
      );
    }
    return sorted;
  }, [comments, sortMode]);
  
  return (
    <section className="mt-12 border-t border-[#262626] pt-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-white">Comments</h2>
          <span className="text-sm bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded-full">
            {comments.length}
          </span>
        </div>
        
        {comments.length > 0 && (
          <ToggleGroup
            type="single"
            value={sortMode}
            onValueChange={(v) => v && setSortMode(v as "recent" | "votes")}
          >
            <ToggleGroupItem value="recent" className="text-sm">
              Most Recent
            </ToggleGroupItem>
            <ToggleGroupItem value="votes" className="text-sm">
              Top Voted
            </ToggleGroupItem>
          </ToggleGroup>
        )}
      </div>
      
      {comments.length === 0 ? (
        <div className="text-center py-12 bg-[#141414] rounded-lg border border-[#262626]">
          <MessageSquare className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-400 mb-4">
            No comments yet. Be the first to add one!
          </p>
          <Button variant="outline" className="border-[#FEC93B] text-[#FEC93B]">
            Add Comment
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedComments.map((comment) => (
            <CommentCard
              key={comment.id}
              comment={comment}
              layout="wide"
              onClick={() => onCommentClick(comment.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
```

---

## 7. Highlighting System

### 7.1 Overview

The highlighting system visually connects comments to their anchor text in the page content. Two highlight levels exist: a light highlight for all anchored comments when the sidebar is open, and a darker highlight for the currently selected comment.

### 7.2 Highlight Levels

| Level | Color | When Applied |
|---|---|---|
| **Light** | `bg-yellow-900/20` | All anchored comments when sidebar is open |
| **Dark** | `bg-yellow-700/40` | The currently selected comment |

### 7.3 Applying Highlights

Highlights are applied by wrapping matched text in the DOM with `<mark>` elements:

```typescript
// src/lib/comments/highlighting.ts

interface HighlightRange {
  commentId: string;
  start: number;
  end: number;
  level: "light" | "dark";
}

export function applyHighlights(
  contentElement: HTMLElement,
  ranges: HighlightRange[]
) {
  const sortedRanges = [...ranges].sort((a, b) => b.start - a.start);
  
  const walker = document.createTreeWalker(
    contentElement,
    NodeFilter.SHOW_TEXT
  );
  
  const textNodes: { node: Text; start: number; end: number }[] = [];
  let offset = 0;
  
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    textNodes.push({
      node,
      start: offset,
      end: offset + node.length,
    });
    offset += node.length + 1;
  }
  
  for (const range of sortedRanges) {
    for (const { node, start, end } of textNodes) {
      if (range.start >= start && range.end <= end) {
        const localStart = range.start - start;
        const localEnd = range.end - start;
        wrapTextRange(node, localStart, localEnd, range.level, range.commentId);
        break;
      }
    }
  }
}

function wrapTextRange(
  textNode: Text,
  start: number,
  end: number,
  level: "light" | "dark",
  commentId: string
) {
  const range = document.createRange();
  range.setStart(textNode, start);
  range.setEnd(textNode, end);
  
  const mark = document.createElement("mark");
  mark.className = level === "dark"
    ? "bg-yellow-700/40 comment-highlight comment-highlight-dark"
    : "bg-yellow-900/20 comment-highlight comment-highlight-light";
  mark.dataset.commentId = commentId;
  
  range.surroundContents(mark);
}

export function removeHighlights(contentElement: HTMLElement) {
  const marks = contentElement.querySelectorAll("mark.comment-highlight");
  for (const mark of marks) {
    const parent = mark.parentNode;
    while (mark.firstChild) {
      parent?.insertBefore(mark.firstChild, mark);
    }
    parent?.removeChild(mark);
  }
}
```

### 7.4 Highlight State Management

The wiki page component manages highlight state:

```typescript
// Sidebar open: apply light highlights to all anchored comments
// Comment selected: upgrade that comment's highlight to dark
// Sidebar closed: remove all highlights
```

### 7.5 Scroll to Highlight

When a user selects a comment in the sidebar, the page scrolls to bring the highlighted text into view:

```typescript
function scrollToComment(commentId: string) {
  const mark = document.querySelector(`mark[data-comment-id="${commentId}"]`);
  if (mark) {
    mark.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}
```

---

## 8. Threading

### 8.1 Overview

Comments support two-level threading: top-level comments (anchored to page text) and replies (nested under top-level comments). No deeper nesting is allowed.

### 8.2 Reply Creation

Replies are created by clicking "Reply" on a top-level comment:

1. A reply composer appears below the comment.
2. The composer is similar to the main composer but without the anchor preview.
3. Submitting creates a comment with `parent_comment_id` set to the top-level comment's ID.

### 8.3 Reply Display

Replies are displayed nested under their parent comment with visual indentation:

```
┌─────────────────────────────────────┐
│ [CommentCard - Top Level]           │
│   📍 Anchored text                  │
│   The culture is very...            │
│   ⬆ 5  ⬇ 1  · Reply                │
│                                     │
│   ┌─────────────────────────────┐   │
│   │ [Reply]                     │   │
│   │   I disagree, I found...    │   │
│   │   ⬆ 2  ⬇ 0                  │   │
│   └─────────────────────────────┘   │
│   ┌─────────────────────────────┐   │
│   │ [Reply]                     │   │
│   │   Same experience here      │   │
│   │   ⬆ 1  ⬇ 0                  │   │
│   └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

### 8.4 No Reply Button on Replies

Replies do not have a "Reply" button. This enforces the two-level limit.

### 8.5 Fetching Replies

When fetching comments for a page, replies are included as nested data:

```typescript
const { data: comments } = await supabase
  .from("comments")
  .select(`
    *,
    user:users(display_name),
    replies:comments!parent_comment_id(
      *,
      user:users(display_name)
    )
  `)
  .eq("page_id", pageId)
  .is("parent_comment_id", null)
  .order("created_at", { foreignTable: "replies", ascending: true });
```

---

## 9. Voting System

### 9.1 Overview

Users can upvote or downvote comments and replies. Voting requires authentication. Each user can cast one vote per comment, which can be changed at any time.

### 9.2 Vote Actions

| Action | Result |
|---|---|
| **Upvote** | Increments `upvotes` by 1 |
| **Downvote** | Increments `downvotes` by 1 |
| **Remove vote** | Decrements the previous vote count by 1 |
| **Change vote** | Removes old vote, applies new vote |

### 9.3 Vote State

The current user's vote is fetched with the comment and displayed as:

- Upvote button highlighted (gold) if user has upvoted.
- Downvote button highlighted (red) if user has downvoted.
- Neither highlighted if user has not voted.

### 9.4 Vote API

```typescript
// POST /api/comments/[id]/vote
// Body: { voteType: "up" | "down" | null }

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }
  
  const { voteType } = await req.json();
  
  const { data: existingVote } = await supabase
    .from("comment_votes")
    .select("id, vote_type")
    .eq("comment_id", params.id)
    .eq("user_id", user.id)
    .single();
  
  if (voteType === null) {
    if (existingVote) {
      await supabase.from("comment_votes").delete().eq("id", existingVote.id);
      await adjustVoteCount(params.id, existingVote.vote_type, -1);
    }
  } else if (existingVote) {
    if (existingVote.vote_type !== voteType) {
      await supabase.from("comment_votes")
        .update({ vote_type: voteType })
        .eq("id", existingVote.id);
      await adjustVoteCount(params.id, existingVote.vote_type, -1);
      await adjustVoteCount(params.id, voteType, 1);
    }
  } else {
    await supabase.from("comment_votes").insert({
      comment_id: params.id,
      user_id: user.id,
      vote_type: voteType,
    });
    await adjustVoteCount(params.id, voteType, 1);
  }
  
  return Response.json({ success: true });
}

async function adjustVoteCount(
  commentId: string,
  voteType: string,
  delta: number
) {
  const supabase = createAdminClient();
  const column = voteType === "up" ? "upvotes" : "downvotes";
  
  await supabase.rpc("increment_comment_vote", {
    comment_id: commentId,
    column_name: column,
    delta,
  });
}
```

### 9.5 Vote Display

Votes are displayed as a net score with separate up/down buttons:

```
⬆ 5  ⬇ 1
```

No auto-collapse for downvoted comments (per design decision).

---

## 10. Edit and Delete

### 10.1 Edit

Users can edit their own comments:

1. Click "Edit" on a comment they authored.
2. The comment body becomes an editable textarea.
3. The user can modify the text and formatting.
4. Click "Save" to submit changes.
5. The `is_edited` flag is set to true.
6. An "edited" label appears on the comment.

Editing does not change the `anchor_text` -- that remains fixed from creation.

### 10.2 Delete

Users can delete their own comments:

1. Click "Delete" on a comment they authored.
2. A confirmation dialog appears: "Delete this comment? This cannot be undone."
3. Click "Delete" to confirm.
4. The comment and all its replies are permanently removed.
5. No placeholder is shown.
6. The comment chunk is deleted from RAG: `DELETE FROM chunks WHERE source_comment_id = $1`.

### 10.3 Visibility

Edit and Delete buttons are only visible to the comment author (matched by `user_id`).

---

## 11. Attribution and Timestamps

### 11.1 Attribution

Comments default to anonymous. Users can opt-in to show their display name.

| `is_anonymous` | Display |
|---|---|
| `true` (default) | "Anonymous" |
| `false` | User's `display_name` from their profile |

The toggle is in the comment composer. The setting only applies to that specific comment, not globally.

### 11.2 Timestamps

All timestamps are displayed as relative times:

- "Just now" (< 1 minute)
- "X minutes ago" (1-59 minutes)
- "X hours ago" (1-23 hours)
- "X days ago" (1-6 days)
- "X weeks ago" (1-4 weeks)
- Date (> 4 weeks, formatted as "Mar 15, 2026")

### 11.3 Implementation

```typescript
// src/lib/utils/time.ts

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes !== 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
  if (diffWeeks <= 4) return `${diffWeeks} week${diffWeeks !== 1 ? "s" : ""} ago`;
  
  return then.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
```

---

## 12. Moderation

### 12.1 Reporting

Users can report comments for review. The report flow:

1. Click "Report" on a comment.
2. A modal appears with reason options:
   - Spam
   - Harassment
   - Misinformation
   - Other
3. Optionally add details in a text field.
4. Click "Submit Report."

### 12.2 Report Queue

Reports are visible to reviewers at `/admin/reports`:

| Column | Content |
|---|---|
| Comment | Preview of the comment body (truncated) |
| Reporter | Display name or "Anonymous" |
| Reason | The selected reason category |
| Details | Additional context (if provided) |
| Reported | Relative time |

### 12.3 Reviewer Actions

| Action | Result |
|---|---|
| **Hide Comment** | Sets `comments.is_hidden = true`. Comment is no longer shown to other users. The row is preserved in the database for audit purposes. Report marked "resolved." |
| **Dismiss Report** | Report marked "dismissed." Comment remains visible. |

### 12.4 Implementation

```typescript
// POST /api/comments/[id]/report

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  const { reason, details } = await req.json();
  
  if (!["spam", "harassment", "misinformation", "other"].includes(reason)) {
    return Response.json({ error: "Invalid reason" }, { status: 400 });
  }
  
  await supabase.from("comment_reports").insert({
    comment_id: params.id,
    reporter_id: user?.id || null,
    reason,
    details,
    status: "pending",
  });
  
  return Response.json({ success: true });
}
```

---

## 13. RAG Integration

### 13.1 Overview

Comments are embedded into the RAG corpus as defined in FRD 1. Each comment creates a chunk with `chunk_type = "comment"`.

### 13.2 Chunk Creation

When a comment is submitted, `reembedComment` from FRD 1 is called:

```typescript
// From FRD 1: src/lib/ai/embeddings.ts

export async function reembedComment(commentId: string, orgMeta: OrgMeta, comment: CommentData) {
  const supabase = createClient();

  await supabase.from("chunks").delete().match({ source_comment_id: commentId });

  const header = `[${orgMeta.orgName} > ${comment.anchoredSection} > Comment]`;
  const contentWithHeader = `${header}\n${comment.body}`;
  const [vector] = await embedBatch([contentWithHeader]);

  await supabase.from("chunks").insert({
    university_id: orgMeta.universityId,
    org_id: orgMeta.orgId,
    source_comment_id: commentId,
    chunk_type: "comment",
    org_name: orgMeta.orgName,
    org_slug: orgMeta.orgSlug,
    category: orgMeta.category,
    anchored_section: comment.anchoredSection,
    content_text: contentWithHeader,
    embedding: vector,
    created_at: comment.createdAt,
  });
}
```

### 13.3 Orphan Flag Update

When a comment becomes orphaned (anchor text not found after a page edit):

```typescript
await supabase
  .from("chunks")
  .update({ references_previous_version: true })
  .eq("source_comment_id", commentId);
```

### 13.4 Chunk Deletion

When a comment is deleted, its chunk is also deleted:

```typescript
await supabase
  .from("chunks")
  .delete()
  .eq("source_comment_id", commentId);
```

---

## 14. Database Schema

### 14.1 Comments Table (Modified)

The `comments` table from FRD 0 is extended:

```sql
ALTER TABLE comments ADD COLUMN section_slug TEXT NOT NULL;
ALTER TABLE comments ADD COLUMN is_edited BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE comments ADD COLUMN upvotes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE comments ADD COLUMN downvotes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE comments ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
```

### 14.2 Comment Votes Table

```sql
CREATE TABLE comment_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

CREATE INDEX idx_comment_votes_comment_id ON comment_votes (comment_id);
CREATE INDEX idx_comment_votes_user_id ON comment_votes (user_id);
```

### 14.3 Comment Reports Table

```sql
CREATE TABLE comment_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES users(id),
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'harassment', 'misinformation', 'other')),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comment_reports_status ON comment_reports (status);
CREATE INDEX idx_comment_reports_comment_id ON comment_reports (comment_id);
```

### 14.4 Vote Count Increment Function

```sql
CREATE OR REPLACE FUNCTION increment_comment_vote(
  comment_id UUID,
  column_name TEXT,
  delta INTEGER
) RETURNS VOID AS $$
BEGIN
  EXECUTE format(
    'UPDATE comments SET %I = %I + $1 WHERE id = $2',
    column_name, column_name
  ) USING delta, comment_id;
END;
$$ LANGUAGE plpgsql;
```

### 14.5 Indexes for Comments

```sql
CREATE INDEX idx_comments_page_id ON comments (page_id);
CREATE INDEX idx_comments_section_slug ON comments (section_slug);
CREATE INDEX idx_comments_parent_comment_id ON comments (parent_comment_id);
CREATE INDEX idx_comments_user_id ON comments (user_id);
```

---

## 15. API Routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/comments` | GET | None | Get comments for a page (query param: `pageId`) |
| `/api/comments` | POST | Required | Create a new comment |
| `/api/comments/[id]` | GET | None | Get a single comment with replies |
| `/api/comments/[id]` | PATCH | Required (author) | Edit a comment |
| `/api/comments/[id]` | DELETE | Required (author) | Delete a comment |
| `/api/comments/[id]/vote` | POST | Required | Cast or change a vote |
| `/api/comments/[id]/report` | POST | None | Report a comment |
| `/api/comments/[id]/replies` | POST | Required | Create a reply |
| `/admin/reports` | GET | Reviewer | Get reported comments |
| `/api/admin/comments/[id]/hide` | POST | Reviewer | Hide a reported comment (hide-only; no deletion) |
| `/api/admin/reports/[id]/dismiss` | POST | Reviewer | Dismiss a report without hiding the comment |

---

## 16. Non-Functional Requirements

| Requirement | Target |
|---|---|
| **Comment submission latency** | < 1 second (excluding RAG embedding) |
| **Sidebar open latency** | < 500ms from click to render |
| **Highlight application** | < 200ms |
| **Vote recording** | < 500ms |
| **Re-anchoring (per page load)** | < 100ms for up to 100 comments |
| **Comment fetch** | < 500ms for a page with 100 comments |

---

## 17. Exit Criteria

FRD 3 is complete when ALL of the following are satisfied:

| # | Criterion | Verification |
|---|---|---|
| 1 | Text selection shows "Add Comment" button | Select text on a wiki page and verify the button appears |
| 2 | Comment composer opens in sidebar | Click the button and verify the sidebar opens with composer |
| 3 | Comment submission works | Submit a comment and verify it appears in the sidebar |
| 4 | Anonymous submission is default | Submit without toggling attribution and verify "Anonymous" display |
| 5 | Attributed submission works | Toggle attribution, submit, and verify display name appears |
| 6 | Margin indicators show correct counts | Create comments in different sections and verify counts |
| 7 | Margin indicator click opens sidebar | Click a margin indicator and verify sidebar opens to that section |
| 8 | Sidebar sorts by document position | Create comments in different sections and verify order |
| 9 | Comment selection highlights anchor text | Click a comment and verify the anchor text gets dark highlight |
| 10 | Orphaned comments show anchor snippet | Edit page to remove anchor text, reload, and verify expandable snippet |
| 11 | Light highlight on sidebar open | Open sidebar and verify all anchor texts have light highlight |
| 12 | Highlights removed on sidebar close | Close sidebar and verify all highlights are removed |
| 13 | Bottom section shows all comments | Scroll to bottom and verify comments section appears |
| 14 | Bottom section sort toggle works | Switch between Most Recent and Top Voted and verify order changes |
| 15 | Reply creation works | Click Reply, submit a reply, and verify it appears nested |
| 16 | No Reply button on replies | Verify replies do not have a Reply button |
| 17 | Upvote/downvote work | Vote on a comment and verify count updates |
| 18 | Vote change works | Change vote from up to down and verify counts adjust |
| 19 | Unauthenticated vote shows auth modal | Attempt to vote while signed out and verify modal appears |
| 20 | Edit comment works | Edit own comment and verify "edited" indicator appears |
| 21 | Delete comment works | Delete own comment and verify it disappears with no placeholder |
| 22 | Report submission works | Report a comment and verify it appears in admin queue |
| 23 | Reviewer can hide reported comment | As reviewer, hide a reported comment via `/api/admin/comments/[id]/hide` and verify `is_hidden = true` and report is resolved |
| 24 | RAG chunk created on comment submit | Submit a comment and verify chunk exists in `chunks` table |
| 25 | RAG chunk deleted on comment delete | Delete a comment and verify chunk is removed |
| 26 | Orphan flag updates on page edit | Edit page to remove anchor text and verify `references_previous_version = true` |
| 27 | 1500 character limit enforced | Attempt to submit > 1500 chars and verify rejection |
| 28 | Basic markdown renders | Submit a comment with `**bold**` and verify it renders as bold |

---

## Appendix A: Comment Card Component Spec

```typescript
// src/components/comments/CommentCard.tsx

"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, MapPin, MoreHorizontal } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils/time";
import { cn } from "@/lib/utils";
import { renderMarkdown } from "@/lib/comments/markdown";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CommentCardProps {
  comment: {
    id: string;
    body: string;
    anchor_text: string;
    is_anonymous: boolean;
    is_edited: boolean;
    upvotes: number;
    downvotes: number;
    created_at: string;
    user: { display_name: string } | null;
    isAnchored: boolean;
    replies?: CommentCardProps["comment"][];
  };
  isSelected?: boolean;
  layout?: "default" | "wide";
  onClick?: () => void;
  isReply?: boolean;
  currentUserId?: string;
}

export function CommentCard({
  comment,
  isSelected,
  layout = "default",
  onClick,
  isReply = false,
  currentUserId,
}: CommentCardProps) {
  const [isAnchorExpanded, setIsAnchorExpanded] = useState(false);
  const isAuthor = currentUserId === comment.user?.display_name;
  
  const authorDisplay = comment.is_anonymous
    ? "Anonymous"
    : comment.user?.display_name || "Unknown";
  
  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-colors cursor-pointer",
        isSelected
          ? "border-[#FEC93B] bg-[#FEC93B]/5"
          : "border-[#262626] bg-[#141414] hover:border-[#404040]",
        isReply && "ml-4 mt-2"
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-zinc-300">{authorDisplay}</span>
          <span className="text-zinc-500">·</span>
          <span className="text-zinc-500">{formatRelativeTime(comment.created_at)}</span>
          {comment.is_edited && (
            <span className="text-zinc-600 text-xs">(edited)</span>
          )}
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="text-zinc-500 hover:text-zinc-300">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isAuthor && (
              <>
                <DropdownMenuItem>Edit</DropdownMenuItem>
                <DropdownMenuItem className="text-red-400">Delete</DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem>Report</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {!isReply && (
        <button
          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 mb-2"
          onClick={(e) => {
            e.stopPropagation();
            if (comment.isAnchored) {
              onClick?.();
            } else {
              setIsAnchorExpanded(!isAnchorExpanded);
            }
          }}
        >
          <MapPin className="h-3 w-3" />
          <span>Anchored text</span>
          {!comment.isAnchored && (
            isAnchorExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
          )}
        </button>
      )}
      
      {!comment.isAnchored && isAnchorExpanded && (
        <div className="mb-2 p-2 bg-zinc-800/50 rounded text-xs text-zinc-400 border-l-2 border-orange-500">
          <span className="inline-block px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded text-[10px] mb-1">
            references previous version
          </span>
          <p className="italic">"{comment.anchor_text}"</p>
        </div>
      )}
      
      <div
        className="text-sm text-zinc-300 prose prose-invert prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(comment.body) }}
      />
      
      <div className="flex items-center gap-4 mt-3 text-sm">
        <div className="flex items-center gap-1">
          <button className="text-zinc-500 hover:text-[#FEC93B]">
            <ChevronUp className="h-4 w-4" />
          </button>
          <span className="text-zinc-400 min-w-[20px] text-center">
            {comment.upvotes - comment.downvotes}
          </span>
          <button className="text-zinc-500 hover:text-red-400">
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
        
        {!isReply && (
          <button className="text-zinc-500 hover:text-zinc-300 text-xs">
            Reply
          </button>
        )}
      </div>
      
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-3 space-y-2">
          {comment.replies.map((reply) => (
            <CommentCard
              key={reply.id}
              comment={reply}
              isReply
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Appendix B: Markdown Rendering

Comments support basic markdown: bold, italic, and links.

```typescript
// src/lib/comments/markdown.ts

export function renderMarkdown(text: string): string {
  let html = escapeHtml(text);
  
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(
    /\[(.+?)\]\((.+?)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-[#FEC93B] underline hover:text-[#FFD700]">$1</a>'
  );
  html = html.replace(/\n/g, "<br>");
  
  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
```

---

## Appendix C: Anchor Highlight Styles

```css
/* src/app/globals.css */

.comment-highlight-light {
  background-color: rgba(254, 201, 59, 0.2);
  border-radius: 2px;
  padding: 0 2px;
  transition: background-color 150ms ease;
}

.comment-highlight-dark {
  background-color: rgba(254, 201, 59, 0.4);
  border-radius: 2px;
  padding: 0 2px;
  transition: background-color 150ms ease;
}
```

---

## Design Decisions Log

| Decision | Rationale |
|---|---|
| **Arbitrary text selection (Medium-style) over line-level anchoring** | Line-level would not survive responsive reflow or minor edits. Text selection captures the exact context the user wants to comment on. Storing `anchor_text` preserves meaning even if the comment becomes orphaned. |
| **Per-section (H2) margin indicators over per-paragraph** | Per-paragraph creates visual clutter and complicates the gutter. H2 sections are the natural reading units in wiki pages. The sidebar groups by section anyway, so section-level indicators align with the browsing model. |
| **Exact match re-anchoring over fuzzy matching** | Fuzzy matching (Levenshtein, n-grams) adds complexity with marginal benefit. If the anchor text was edited, the commenter's original context may no longer apply. Exact match is deterministic and easy to reason about. Orphaned comments still display with their original anchor text visible. |
| **Orphaned comments visible with "references previous version" badge** | Deleting orphaned comments would lose valuable historical context. Keeping them visible with clear labeling lets readers know the comment may not apply to current content while preserving the discussion history. |
| **Two-level threading (comments + replies) over unlimited nesting** | Unlimited nesting creates UI complexity and deep conversation chains that are hard to follow. Two levels suffice for most discourse: a comment and responses. Deeper discussions can reference each other with quotes. |
| **Voting on both comments and replies** | Replies are substantive content that can be valuable or problematic. Allowing votes on replies enables community quality signals at all levels. |
| **No auto-collapse for downvoted comments** | Auto-collapse can hide legitimate minority opinions. The UW Wiki editorial values prioritize surfacing alternative viewpoints, not suppressing them based on popularity. Users can manually scroll past comments they find unhelpful. |
| **Anonymous by default, opt-in attribution** | Lowers the barrier to contribution. Users may share candid perspectives they wouldn't attach their name to. Opt-in attribution respects those who want credit while protecting privacy. Matches the PRD's treatment of comments as anonymous in RAG synthesis. |
| **Relative timestamps only** | Relative times ("2 hours ago") are easier to parse at a glance than absolute timestamps. They communicate recency without requiring mental date math. Exact timestamps are available via tooltip if needed. |
| **Post-hoc moderation (live immediately) over pre-approval** | Pre-approval creates bottlenecks and delays the feedback loop for contributors. Post-hoc moderation allows immediate participation while still catching problematic content via reports. Aligns with the wiki's editorial philosophy of trusting contributors. |
| **Sidebar replaces Pulse sidebar when open** | The right column can't fit both sidebars without horizontal scrolling or cramped layouts. Replacing rather than overlaying maintains the three-column structure. The Pulse sidebar returns on close. |
| **Bottom section as separate browsing interface** | The sidebar is context-focused (anchored to where you're reading). The bottom section is browse-focused (see all comments, sort by votes or time). Both serve distinct use cases without conflict. |
| **Light/dark highlight levels** | A single highlight level makes it hard to distinguish the selected comment from others. Two levels provide visual hierarchy: "these are all commented" (light) vs "this is the one you're looking at" (dark). |
| **1500 character limit** | Long enough for substantive comments with examples, short enough to prevent essay-length walls of text. Encourages focused, concise contributions. Matches Twitter/X thread-post length, which users are familiar with. |
| **Basic markdown (bold, italic, links) over rich formatting** | Full rich text editing adds complexity and inconsistent rendering. Basic markdown is familiar to technical users and renders predictably. Covers the essential formatting needs for emphasis and references. |
| **No notifications for MVP** | Notification systems require infrastructure (email, push, in-app) that adds significant scope. MVP focuses on the core commenting experience. Notifications can be added post-launch once usage patterns are understood. |
