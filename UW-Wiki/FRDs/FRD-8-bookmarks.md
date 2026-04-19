# Feature Requirements Document: FRD 8 -- Bookmarks and Contribution History (v1.0)

| Field               | Value                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| **Project**         | UW Wiki                                                                                                   |
| **Parent Document** | [PRD v0.1](../PRD.md)                                                                                     |
| **FRD Order**       | [FRD Order](../FRD-order.md)                                                                              |
| **PRD Sections**    | 9 (Identity and Authentication)                                                                           |
| **Type**            | User-facing account feature                                                                               |
| **Depends On**      | FRD 0 (schema + guards), FRD 2 (wiki page header surface), FRD 4 (edit_proposals), FRD 6 (auth + stubs) |
| **Delivers**        | Bookmark toggle button on wiki pages, `/api/bookmarks/toggle` server action, `/my/bookmarks` page listing saved pages, `/my/contributions` page listing the user's edit proposals with status |
| **Created**         | 2026-04-07                                                                                                |

---

## Summary

FRD 6 ships `/my/bookmarks` and `/my/contributions` as Coming Soon stubs, wires them to the user menu dropdown, and defines the `bookmark.toggle` pending action type (with auto-resume logic after OAuth redirect). FRD 8 implements the actual feature behind both pages.

**Bookmarks** let authenticated users save wiki pages they want to return to. The bookmark icon lives in the wiki page header (alongside the page title). Toggling it is a single-click action — no modal, no form. If the user is unauthenticated, the `AuthModal` appears and the pending action is queued via FRD 6's pending-action system so the bookmark fires automatically after sign-in.

**Contribution History** gives contributors a personal record of every edit proposal they have submitted. Proposals are listed with their status (`pending`, `needs_rebase`, `accepted`, `rejected`), the sections they targeted, and a link to the proposal detail. This closes the loop on FRD 4's contributor UX — after submitting a PR, users have somewhere to check its status without relying on reviewer notifications.

Both pages are behind `requireUser()`. Neither requires a new database table — `bookmarks` is created by FRD 0 and `edit_proposals` is created by FRD 4.

---

## Supersession and Overlap Resolution

| FRD | What it owns | What FRD 8 adds |
|-----|-------------|-----------------|
| FRD 0 | `bookmarks` table schema | Nothing — uses the existing table |
| FRD 2 | Wiki page header layout | Adds the bookmark icon button to the header |
| FRD 4 | `edit_proposals` table, status enum | Nothing — reads the existing table |
| FRD 6 | `/my/bookmarks` stub, `/my/contributions` stub, `bookmark.toggle` pending action + replay handler, user menu links | Replaces stub content with real implementations; `POST /api/bookmarks/toggle` referenced by FRD 6's replay handler |

---

## Given Context (Pre-conditions from Prior FRDs)

1. `bookmarks` table exists with columns: `id UUID PK`, `user_id UUID FK → public.users`, `page_id UUID FK → pages`, `created_at TIMESTAMPTZ`, `UNIQUE(user_id, page_id)`. RLS: auth-only insert/delete on own rows.
2. `edit_proposals` table exists with `contributor_id UUID FK → public.users`, `page_id`, `section_slugs TEXT[]`, `status` (`pending` | `needs_rebase` | `accepted` | `rejected`), `submitted_at`, `reviewed_at`, `title TEXT`. (Full schema in FRD 4.)
3. `pages` table has `title TEXT`, `org_id UUID FK → organizations`, `updated_at TIMESTAMPTZ`.
4. `organizations` table has `name TEXT`, `category TEXT`, `slug TEXT`.
5. FRD 6 ships stub pages at `/my/bookmarks` and `/my/contributions` with a "Coming Soon" placeholder.
6. FRD 6's `replayPendingAction` function already has a `bookmark.toggle` case that calls `POST /api/bookmarks/toggle` and reads `payload.page_id` and `payload.desiredState`.
7. `requireUser({ returnTo })` guard redirects to `/auth/sign-in?returnTo=<path>` for unauthenticated access.

---

## Terms

| Term | Definition |
|------|------------|
| **Bookmark** | A saved page association between an authenticated user and a wiki page; stored as a row in the `bookmarks` table |
| **Toggle** | A single action that adds a bookmark if none exists, or removes it if it does |
| **Desired state** | The `desiredState` field in the `bookmark.toggle` pending action payload; either `"bookmarked"` or `"unbookmarked"` — ensures the pending action replays correctly even if the user's auth state has changed |
| **Contribution** | An edit proposal submitted by the authenticated user; read from `edit_proposals` where `contributor_id = current_user.id` |
| **Status badge** | A colored pill that communicates proposal status: yellow for `pending`, orange for `needs_rebase`, green for `accepted`, red for `rejected` |

---

## Executive Summary (Gherkin-Style)

```gherkin
Feature: Bookmark a wiki page

  Scenario: Authenticated user bookmarks a page
    Given I am signed in
    And I am viewing a wiki page that is not bookmarked
    When I click the bookmark icon in the page header
    Then the icon fills to indicate bookmarked
    And a "Bookmarked" toast appears
    And the page appears in my /my/bookmarks list

  Scenario: Authenticated user removes a bookmark
    Given I am signed in
    And I am viewing a wiki page I have bookmarked
    When I click the filled bookmark icon
    Then the icon empties to indicate not bookmarked
    And a "Removed from bookmarks" toast appears
    And the page is removed from my /my/bookmarks list

  Scenario: Unauthenticated user clicks the bookmark icon
    Given I am not signed in
    And I am viewing a wiki page
    When I click the bookmark icon
    Then the AuthModal appears
    And the bookmark.toggle pending action is saved to localStorage
    When I complete sign-in
    Then the bookmark toggle fires automatically
    And "Bookmarked" toast appears

Feature: View bookmarked pages

  Scenario: User views their bookmarks
    Given I am signed in
    And I have bookmarked three pages
    When I navigate to /my/bookmarks
    Then I see a list of three org wiki pages
    And each card shows the org name, category, and last-edited date
    And clicking a card navigates to that wiki page

  Scenario: User has no bookmarks
    Given I am signed in
    And I have no bookmarked pages
    When I navigate to /my/bookmarks
    Then I see an empty state: "No bookmarks yet. Save pages you want to return to."

Feature: View contribution history

  Scenario: User views their contributions
    Given I am signed in
    And I have submitted two edit proposals
    When I navigate to /my/contributions
    Then I see both proposals listed
    And each row shows the org name, targeted section headings, submission date, and status badge
    And a pending proposal has a yellow "Pending Review" badge
    And an accepted proposal has a green "Accepted" badge
    And clicking a row navigates to the proposal detail

  Scenario: User has no contributions
    Given I am signed in
    And I have never submitted an edit proposal
    When I navigate to /my/contributions
    Then I see an empty state: "No contributions yet. Edit a wiki page to get started."
```

---

## 1. Bookmark Toggle — Wiki Page Header Integration

### 1.1 Placement

The bookmark icon button is placed in the wiki page header, to the right of the page title and left of the page actions menu. It is rendered by the wiki page server component (`src/app/wiki/[slug]/page.tsx`) and hydrated as a client component for optimistic toggling.

Layout position (FRD 2 header row):

```
[← Directory]   [Org Name  ·  Category]   [🔖]   [⋯ actions]
```

### 1.2 Visual States

| State | Icon | Tooltip |
|-------|------|---------|
| Not bookmarked, authenticated | Outline bookmark (`BookmarkIcon`) | "Save page" |
| Bookmarked, authenticated | Filled bookmark (`BookmarkFilledIcon`) | "Remove bookmark" |
| Not authenticated | Outline bookmark (slightly dimmed) | "Sign in to bookmark" |
| Loading (optimistic) | Spinner overlay on icon | — |

Use `lucide-react` `Bookmark` (outline) and `BookmarkCheck` (filled). Icon size: 20px. Accessible label via `aria-label` that changes with state.

### 1.3 Interaction

**Authenticated flow:**

1. User clicks the bookmark icon.
2. Optimistic UI: icon swaps to filled (or outline) immediately.
3. `POST /api/bookmarks/toggle` fires in the background.
4. On success: toast ("Bookmarked." or "Removed from bookmarks.").
5. On error: revert optimistic state, toast ("Something went wrong. Try again.").

**Unauthenticated flow:**

1. User clicks the bookmark icon.
2. Save `bookmark.toggle` pending action to localStorage via FRD 6's `savePendingAction()` helper. Payload: `{ page_id, desiredState: "bookmarked" }`.
3. `AuthModal` opens.
4. After sign-in, FRD 6's `replayPendingAction()` fires the toggle automatically.

### 1.4 Initial Bookmark State on Page Load

The wiki page server component must pass the initial bookmark state to the client component. Query pattern:

```ts
// Server component (RSC)
const user = await getUser(); // null if unauthenticated
let isBookmarked = false;

if (user) {
  const { data } = await supabase
    .from("bookmarks")
    .select("id")
    .eq("user_id", user.id)
    .eq("page_id", page.id)
    .maybeSingle();
  isBookmarked = !!data;
}
```

Pass `isBookmarked` and `pageId` as props to `<BookmarkButton>`.

---

## 2. API Contract — `POST /api/bookmarks/toggle`

### Request

```ts
// src/app/api/bookmarks/toggle/route.ts (Next.js Route Handler)
// Also exposed as a server action at src/lib/actions/bookmarks.ts

type ToggleBookmarkInput = {
  page_id: string;          // UUID
  desired_state: "bookmarked" | "unbookmarked";
};
```

### Response

```ts
type ToggleBookmarkResult =
  | { ok: true; state: "bookmarked" | "unbookmarked" }
  | { ok: false; error: string; code: "UNAUTHORIZED" | "PAGE_NOT_FOUND" | "DB_ERROR" };
```

### Server-Side Logic

```ts
// Pseudo-code
export async function toggleBookmark(input: ToggleBookmarkInput): Promise<ToggleBookmarkResult> {
  const user = await requireUser(); // throws/redirects if unauthenticated

  // Validate page exists
  const { data: page } = await supabase
    .from("pages")
    .select("id")
    .eq("id", input.page_id)
    .maybeSingle();
  if (!page) return { ok: false, error: "Page not found", code: "PAGE_NOT_FOUND" };

  const existing = await supabase
    .from("bookmarks")
    .select("id")
    .eq("user_id", user.id)
    .eq("page_id", input.page_id)
    .maybeSingle();

  if (input.desired_state === "bookmarked") {
    if (existing.data) return { ok: true, state: "bookmarked" }; // already bookmarked, idempotent
    await supabase.from("bookmarks").insert({ user_id: user.id, page_id: input.page_id });
    return { ok: true, state: "bookmarked" };
  } else {
    if (!existing.data) return { ok: true, state: "unbookmarked" }; // already gone, idempotent
    await supabase.from("bookmarks").delete().eq("id", existing.data.id);
    return { ok: true, state: "unbookmarked" };
  }
}
```

**Idempotency guarantee:** Toggling to a state the user is already in (e.g., bookmarking a page already bookmarked) returns success without a DB write. This ensures FRD 6's replay handler is safe to call multiple times.

---

## 3. `/my/bookmarks` Page

### 3.1 Route

`src/app/my/bookmarks/page.tsx` — Server Component, replaces the FRD 6 stub.

```ts
const user = await requireUser({ returnTo: "/my/bookmarks" });
```

### 3.2 Data Fetch

```ts
const { data: bookmarks } = await supabase
  .from("bookmarks")
  .select(`
    id,
    created_at,
    pages (
      id,
      title,
      updated_at,
      organizations ( name, category, slug )
    )
  `)
  .eq("user_id", user.id)
  .order("created_at", { ascending: false });
```

### 3.3 Layout

**Page header:**
```
Bookmarks                          [n saved]
```

**Card list** (single column, full-width cards):

Each card:
```
┌────────────────────────────────────────────────────────┐
│  [Category badge]   Org Name                           │
│  Last edited: April 2, 2026                            │
│                                      [Remove 🔖]       │
└────────────────────────────────────────────────────────┘
```

- Clicking the card (anywhere except the remove button) navigates to the wiki page.
- The **Remove** button calls `toggleBookmark({ page_id, desired_state: "unbookmarked" })` with optimistic removal from the list.

**Empty state** (no bookmarks):
```
No bookmarks yet.
Save pages you want to return to by clicking the bookmark icon on any wiki page.

[Browse directory →]
```

### 3.4 Sort Order

Reverse chronological by `bookmarks.created_at` (most recently bookmarked first). No sorting controls for MVP.

---

## 4. `/my/contributions` Page

### 4.1 Route

`src/app/my/contributions/page.tsx` — Server Component, replaces the FRD 6 stub.

```ts
const user = await requireUser({ returnTo: "/my/contributions" });
```

### 4.2 Data Fetch

```ts
const { data: proposals } = await supabase
  .from("edit_proposals")
  .select(`
    id,
    title,
    section_slugs,
    status,
    submitted_at,
    reviewed_at,
    pages (
      id,
      title,
      organizations ( name, category, slug )
    )
  `)
  .eq("contributor_id", user.id)
  .order("submitted_at", { ascending: false });
```

### 4.3 Layout

**Page header:**
```
My Contributions                   [n proposals]
```

**List** (single column, full-width rows):

Each row:
```
┌────────────────────────────────────────────────────────────────┐
│  [Status badge]  Org Name                                      │
│  Sections: "Time Commitment", "Culture and Vibe"               │
│  Submitted Apr 1, 2026                        [View proposal →]│
└────────────────────────────────────────────────────────────────┘
```

**Status badge colors:**

| Status | Label | Color |
|--------|-------|-------|
| `pending` | Pending Review | Yellow |
| `needs_rebase` | Needs Rebase | Orange |
| `accepted` | Accepted | Green |
| `rejected` | Rejected | Red |

Sections are rendered as a comma-joined list of human-readable headings. The `section_slugs` array (e.g., `["time-commitment", "culture-and-vibe"]`) is converted to title case for display.

**"View proposal" link** navigates to `/wiki/[org-slug]/proposals/[proposal-id]` (the proposal detail page defined in FRD 4).

**Empty state** (no proposals):
```
No contributions yet.
Edit a wiki page to get started.

[Browse directory →]
```

### 4.4 Filtering

No filters for MVP. Future: filter by status, date range, org.

---

## 5. Component Tree and File Structure

### New Files

```
src/
  app/
    api/
      bookmarks/
        toggle/
          route.ts              ← POST /api/bookmarks/toggle (Route Handler)
    my/
      bookmarks/
        page.tsx                ← /my/bookmarks (replaces FRD 6 stub)
        loading.tsx             ← skeleton while RSC loads
      contributions/
        page.tsx                ← /my/contributions (replaces FRD 6 stub)
        loading.tsx             ← skeleton while RSC loads
  components/
    bookmarks/
      BookmarkButton.tsx        ← wiki page header icon + toggle logic
      BookmarkCard.tsx          ← card on /my/bookmarks list
    contributions/
      ContributionRow.tsx       ← row on /my/contributions list
      StatusBadge.tsx           ← status pill (pending / needs_rebase / accepted / rejected)
  lib/
    actions/
      bookmarks.ts              ← toggleBookmark server action (reused by route.ts + client)
```

### Modified Files

```
src/
  app/
    wiki/
      [slug]/
        page.tsx                ← add BookmarkButton to page header
```

---

## 6. Integration with Prior FRDs

### FRD 2 (Wiki Pages)

`BookmarkButton` is added to the wiki page header layout in `src/app/wiki/[slug]/page.tsx`. The server component queries the initial bookmark state (Section 1.4) and passes it as a prop to the client component.

### FRD 4 (PR-Edit System)

`/my/contributions` reads `edit_proposals` directly using `contributor_id`. No changes to FRD 4's data model or APIs — this is a read-only view.

The proposal detail link (`/wiki/[org-slug]/proposals/[proposal-id]`) navigates to the existing FRD 4 proposal detail route.

### FRD 6 (Auth UI)

FRD 6 already handles the complete unauthenticated bookmark flow:
- Defines `bookmark.toggle` as a pending action type with `page_id` and `desiredState` in the Zod schema.
- `savePendingAction()` stores it to localStorage when the bookmark button is clicked unauthenticated.
- `replayPendingAction()` calls `POST /api/bookmarks/toggle` on first authenticated load.
- FRD 8's `route.ts` is the endpoint FRD 6 references — it must match the contract exactly (Section 2 above).

FRD 8 replaces the stub content of `/my/bookmarks` and `/my/contributions` without touching routing, middleware, or the user menu links (those already work from FRD 6).

---

## 7. Error Handling

| Scenario | Behavior |
|----------|----------|
| Toggle fails (network error) | Revert optimistic UI; toast: "Something went wrong. Try again." |
| Toggle called while unauthenticated (direct API call) | 401 response; client redirects to sign-in |
| `page_id` not found | 404 response from toggle API; toast: "Page not found." |
| Bookmarks page load fails | Next.js error boundary; generic error page |
| Contributions page load fails | Next.js error boundary; generic error page |

---

## 8. Non-Functional Requirements

- **Optimistic UI latency:** Bookmark icon toggle must respond to click within one animation frame (no network wait).
- **Page load:** `/my/bookmarks` and `/my/contributions` must render above-the-fold content within 500ms on a warm Supabase connection.
- **Accessibility:** `BookmarkButton` must have a meaningful `aria-label` that updates with state ("Save page" / "Remove bookmark"). All interactive elements keyboard-navigable.
- **Empty state:** Both pages must have a non-empty empty state with a CTA when the user has no data.

---

## 9. Exit Criteria

All of the following must be true before FRD 8 is considered complete:

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | Bookmark icon appears in wiki page header for authenticated users | Render wiki page while signed in; icon is visible |
| 2 | Bookmark icon is visible (slightly dimmed) for unauthenticated users | Render wiki page while signed out; icon renders, hover shows tooltip |
| 3 | Clicking bookmark while authenticated toggles state and shows toast | Click icon signed in; icon fills; "Bookmarked." toast appears |
| 4 | Clicking filled bookmark while authenticated untogles it | Click again; icon empties; "Removed from bookmarks." toast appears |
| 5 | Toggle is idempotent | Call toggle API twice for same page_id + same desired_state; second call returns success without error |
| 6 | Optimistic update reverts on API error | Mock a 500 response from toggle API; icon should revert to pre-click state |
| 7 | Unauthenticated click opens AuthModal and queues pending action | Click bookmark signed out; AuthModal appears; localStorage has `pending_action` key |
| 8 | Pending bookmark fires after sign-in | Complete sign-in after clicking bookmark; page is bookmarked without additional clicks |
| 9 | `/my/bookmarks` requires authentication | Navigate to `/my/bookmarks` signed out; redirected to `/auth/sign-in?returnTo=/my/bookmarks` |
| 10 | `/my/bookmarks` lists saved pages in reverse-chronological order | Bookmark two pages; newer bookmark appears first |
| 11 | Bookmark card shows org name, category, and last-edited date | Verify all three fields render correctly |
| 12 | Clicking a bookmark card navigates to the wiki page | Click card; URL changes to `/wiki/[slug]` |
| 13 | Remove button on bookmark card removes the bookmark | Click remove; card disappears with optimistic update |
| 14 | `/my/bookmarks` shows empty state when no bookmarks exist | Sign in with fresh account; empty state message renders |
| 15 | `/my/contributions` requires authentication | Navigate signed out; redirected to sign-in with returnTo |
| 16 | `/my/contributions` lists user's proposals newest first | Submit two PRs; verify order |
| 17 | Contribution row shows org name, targeted sections, submission date, and status badge | Verify all four fields render correctly |
| 18 | `pending` status shows yellow badge labeled "Pending Review" | Submit a PR; check badge on contributions page |
| 19 | `accepted` status shows green badge labeled "Accepted" | Accept a PR via reviewer flow; badge updates |
| 20 | `rejected` status shows red badge labeled "Rejected" | Reject a PR via reviewer flow; badge updates |
| 21 | `needs_rebase` status shows orange badge labeled "Needs Rebase" | Trigger stale detection on a proposal; badge updates |
| 22 | "View proposal" link navigates to correct proposal detail page | Click link; URL is `/wiki/[slug]/proposals/[proposal-id]` |
| 23 | `/my/contributions` shows empty state when user has no proposals | Sign in with fresh account; empty state message renders |
| 24 | Both `/my/*` pages have loading skeletons | Navigate with slow network; skeleton renders before content |
| 25 | `POST /api/bookmarks/toggle` returns 401 for unauthenticated requests | Call API without session cookie; receive 401 |

---

## Appendix A: Zod Schema for `bookmark.toggle` Pending Action

Defined in FRD 6 Appendix B. Reproduced here for reference:

```ts
// Already in src/lib/pending-action/schemas.ts (FRD 6)
export const BookmarkTogglePayload = z.object({
  page_id: z.string().uuid(),
  desiredState: z.enum(["bookmarked", "unbookmarked"]),
});
```

FRD 8's toggle API must accept `desired_state` (snake_case, per HTTP convention) and map it to the Zod `desiredState` field internally. The FRD 6 replay handler uses `desiredState` as the payload key; the API route handler uses `desired_state` in the request body. Both are valid — just be consistent.

---

## Appendix B: Design Decisions

| Decision | Chosen | Rationale |
|----------|--------|-----------|
| Bookmark toggle as Route Handler vs server action | Both — server action for client-side calls, Route Handler for FRD 6 replay (which uses `fetch`) | FRD 6 replay calls `fetch("/api/bookmarks/toggle")` directly. Server actions require form data or `use server` invocation from a React component. Route Handler satisfies both callers. |
| Optimistic UI on bookmark toggle | Yes | Bookmark toggle should feel instant. A network round-trip delay on a simple icon click would feel sluggish. Reverting on error is straightforward with a `useOptimistic` hook or local state. |
| No pagination on `/my/bookmarks` | Deferred | MVP assumes low bookmark counts per user (< 50). Add infinite scroll in a future iteration. |
| `/my/contributions` read-only | Yes | Contributors see the status of their proposals but cannot edit or withdraw from this page. Proposal management (withdraw, rebase) happens on the proposal detail page (FRD 4). |
| section_slugs → human-readable heading | Title-case slug conversion in component | Avoids a database join to get the heading text. The slug `time-commitment` → `Time Commitment` covers all current section names. If a slug doesn't follow this pattern in the future, a lookup table can be added. |
