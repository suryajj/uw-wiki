# Feature Requirements Document: FRD 2 -- Wiki Pages, Directory, Editor, and Edit Proposals (v1.0)

| Field               | Value                                                                                                                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Project**         | UW Wiki                                                                                                                                                                                                                                                      |
| **Parent Document** | [PRD v0.1](../PRD.md)                                                                                                                                                                                                                                        |
| **FRD Order**       | [FRD Order](../FRD-order.md)                                                                                                                                                                                                                                 |
| **PRD Sections**    | 6.2 (Browsable Directory), 6.3 (Wiki Pages and Version Control), 6.4 (PR-Style Edit Proposals), 6.6 (The Pulse), 6.7 (Page Claiming), 6.9 (Automated Lifecycle Management)                                                                                   |
| **Type**            | Core product feature                                                                                                                                                                                                                                         |
| **Depends On**      | FRD 0 (Setup Document)                                                                                                                                                                                                                                       |
| **Delivers**        | Browsable directory with grid/list toggle, three-column wiki page view with auto-TOC, Pulse sidebar and voting widget, inline Tiptap editor with PR submission flow, reviewer dashboard, version history, lifecycle banners, page claiming |
| **Created**         | 2026-04-06                                                                                                                                                                                                                                                   |

---

## Summary

FRD 2 builds the core content layer of UW Wiki -- everything a user sees and interacts with when browsing, reading, editing, and reviewing wiki pages. The feature set spans three layers. The **viewing layer** delivers a browsable landing-page directory (grid/list toggle, category sections, org cards with taglines), a three-column wiki page view (auto-generated TOC on the left, ProseMirror-rendered content in the center, Pulse infobox sidebar on the right), lifecycle staleness banners, and a page-claiming flow for orgs to establish an official section. The **editing layer** provides an inline Tiptap WYSIWYG editor (headings, lists, tables, images, code blocks, blockquotes, dividers) that transforms the page in place when a user clicks "Propose Edit," autosaves drafts to localStorage, and requires no account at any step — submission is anonymous by default; signed-in users get an optional attribution toggle. The **review layer** includes a PR submission flow with inline diff and rendered preview tabs, a rationale field, a reviewer dashboard with accept/reject/request-changes actions, and a version history view. Accepting a PR creates a new page version, updates the page, resets lifecycle timers, and triggers the re-embedding pipeline from FRD 1.

**Supersession Note:** FRD 4 is the canonical source for PR-Edit workflow implementation details (section-scoped proposals, patchsets/rebase, mergeability, and reviewer decision policy). FRD 2 remains canonical for page UX, editor primitives, and surrounding page experience.

---

## Given Context (Preconditions)

The following are assumed to be in place from FRD 0:

| Prerequisite                                                                                                                                                                 | FRD 0 Deliverable                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Next.js 15 App Router project scaffolded                                                                                                                                     | Project root with `src/app/` directory                     |
| Supabase project with PostgreSQL 17 + pgvector enabled                                                                                                                       | Supabase project configuration                             |
| Supabase Auth configured (Google OAuth + email/password)                                                                                                                     | `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts` |
| `universities`, `organizations`, `pages`, `page_versions`, `edit_proposals`, `pulse_ratings`, `pulse_aggregates`, `external_links`, `users`, `lifecycle_config` tables exist | Supabase migrations                                        |
| shadcn/ui + TailwindCSS v4 with UW dark theme configured                                                                                                                     | Frontend setup with color palette from PRD Section 12      |
| Tiptap base packages installed (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/pm`)                                                                                        | `package.json` dependencies                                |
| OpenRouter API key configured                                                                                                                                                | `.env.local` with `OPENROUTER_API_KEY`                     |
| Supabase Storage bucket for image uploads                                                                                                                                    | Supabase project configuration                             |
| Environment variables template                                                                                                                                               | `.env.example`                                             |

### Terms

| Term               | Definition                                                                                                                                                                          |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ProseMirror JSON   | The structured document format used by the Tiptap editor to store wiki page content. A tree of nodes (headings, paragraphs, lists, images) with attributes and text content.        |
| Inline edit mode   | The state where the wiki page content area transforms in place into an editable Tiptap instance. The user edits directly on the page rather than navigating to a separate editor.   |
| Edit proposal (PR) | A proposed set of changes to a wiki page, submitted by a contributor and reviewed by the editorial board before being merged. Stored as the full proposed ProseMirror JSON content. |
| Diff               | A visual representation of changes between the current page content and a proposed edit, rendered as inline additions (green) and deletions (red).                                  |
| Pulse              | The set of crowdsourced quantitative metrics displayed in a sidebar infobox: Selectivity, Vibe Check, Co-op Boost, Tech Stack, Health Status.                                       |
| Lifecycle banner   | A colored warning banner displayed at the top of a wiki page when it has not been updated within configurable time thresholds.                                                      |
| Page claiming      | The process by which an org establishes an official presence on its wiki page, gaining an "Official" section.                                                                       |
| TOC                | Table of Contents -- an auto-generated navigation sidebar derived from heading nodes in the page content.                                                                           |
| Tagline            | A one-line description of an org, set by contributors, displayed on directory cards.                                                                                                |

---

## Executive Summary (Gherkin-Style)

```gherkin
Feature: Wiki Pages, Directory, Editor, and Edit Proposals

  Background:
    Given  FRD 0 is complete
    And    Supabase is running with all required tables
    And    shadcn/ui with UW dark theme is configured
    And    Tiptap base packages are installed

  # --- Directory ---

  Scenario: User browses the landing page directory
    When   a user visits the landing page
    Then   a search bar is displayed at the top
    And    below it, all org categories are shown as sections
    And    each section contains org cards with name, category badge, and tagline
    And    the user can toggle between grid and list views

  Scenario: User filters directory by text search
    When   a user types "Midnight" into the directory search bar
    Then   only orgs whose name or tagline contains "Midnight" are displayed
    And    the filter updates instantly (client-side)

  Scenario: User sorts directory alphabetically
    When   a user selects "Sort by name" from the sort dropdown
    Then   orgs within each category section are sorted alphabetically

  # --- Wiki Page View ---

  Scenario: User views a wiki page
    When   a user navigates to /wiki/midnight-sun
    Then   a three-column layout is rendered
    And    the left column shows an auto-generated TOC from page headings
    And    the center column shows the rendered ProseMirror content
    And    the right column shows the Pulse sidebar infobox
    And    the page header shows org name, category badge, and last updated date

  Scenario: User clicks a TOC entry
    When   a user clicks "Time Commitment" in the TOC
    Then   the page scrolls to the Time Commitment section
    And    the URL updates to /wiki/midnight-sun#time-commitment
    And    the TOC entry is highlighted as active

  Scenario: User views a claimed page with an Official section
    Given  "Blueprint" has claimed their page
    When   a user views /wiki/blueprint
    Then   an "Official" section appears after the Overview section
    And    the section has a gold left border and "Official -- submitted by Blueprint" label
    And    a "Claimed" badge appears in the page header

  Scenario: User views a page with a lifecycle banner
    Given  "Old Club" has not been edited in 14 months
    And    the lifecycle threshold for its category is 12 months for "Stale"
    When   a user views /wiki/old-club
    Then   an orange "Stale" banner is displayed at the top of the page
    And    the Pulse sidebar Health Status shows "Stale"

  Scenario: Search engine crawls a wiki page
    When   Googlebot requests /wiki/midnight-sun
    Then   the page is server-side rendered with full HTML content
    And    og:title is set to "Midnight Sun -- UW Wiki"
    And    og:description is derived from the Overview section

  # --- Pulse Sidebar ---

  Scenario: User views the Pulse sidebar
    When   a user views a wiki page
    Then   the Pulse infobox shows Selectivity, Vibe Check, Co-op Boost, Tech Stack tags, and Health Status
    And    vote counts are displayed next to each metric for transparency

  Scenario: Authenticated user submits a Pulse vote
    Given  the user is signed in
    When   the user expands the "Rate This Org" widget
    And    selects "Application-Based" for Selectivity
    And    sets Vibe Check to 3
    And    sets Co-op Boost to 4
    And    clicks "Submit Rating"
    Then   the vote is recorded and linked to their account (user_id)
    And    the displayed aggregate values update
    And    the user cannot vote again for this org on this metric

  Scenario: Unauthenticated user attempts to vote on Pulse
    Given  the user is not signed in
    When   the user expands the "Rate This Org" widget
    And    clicks "Submit Rating"
    Then   an AuthModal appears prompting sign-in
    And    the pending Pulse vote is preserved for auto-resume after authentication

  # --- Inline Editor ---

  Scenario: User enters edit mode
    When   a user clicks "Propose Edit" on a wiki page
    Then   the content area transforms into an editable Tiptap instance
    And    a fixed toolbar appears at the top with formatting controls
    And    the TOC column and Pulse sidebar remain visible but non-editable

  Scenario: User edits content with the Tiptap editor
    Given  the user is in edit mode
    When   the user adds a new heading, types text, and inserts an image
    Then   the content updates in real time in the editor
    And    the changes are autosaved to localStorage every 10 seconds

  Scenario: User uploads an image via paste
    Given  the user is in edit mode
    When   the user pastes an image from clipboard
    Then   the image is uploaded to Supabase Storage
    And    the image URL is inserted inline in the editor at the cursor position

  Scenario: User recovers a draft after navigating away
    Given  the user previously edited /wiki/midnight-sun and navigated away
    When   the user returns and clicks "Propose Edit"
    Then   a banner appears: "You have unsaved changes from [timestamp]. Restore?"
    And    clicking "Restore" loads the draft content into the editor

  Scenario: Unauthenticated user edits freely
    Given  the user is not signed in
    When   the user clicks "Propose Edit" on a wiki page
    Then   the editor opens without requiring authentication
    And    the user can make changes freely

  # --- PR Submission ---

  Scenario: User submits an edit proposal
    Given  the user has made changes in the editor
    When   the user clicks "Submit Proposal"
    Then   a submission dialog appears with Diff and Preview tabs
    And    the Diff tab shows inline additions (green) and deletions (red)
    And    the Preview tab shows the proposed page as it would render
    And    a rationale field is required (min 20 characters)
    And    an attribution toggle defaults to anonymous

  Scenario: Anonymous user submits a PR proposal without an account
    Given  the user is not signed in
    And    the user has filled in the rationale and clicks "Submit"
    Then   the proposal is accepted with contributor_id = NULL
    And    the proposal is displayed publicly as "Anonymous"
    And    no auth modal appears

  # --- Reviewer Dashboard ---

  Scenario: Reviewer views pending proposals
    Given  the user has the "reviewer" role
    When   the user navigates to /admin/proposals (stub; canonical URL is /admin/reviews per FRD 7)
    Then   a list of pending PRs is shown
    And    each PR shows org name, submitter, AI verdict badge, and submission date

  Scenario: Reviewer accepts a proposal
    Given  a reviewer is viewing a pending PR
    When   the reviewer clicks "Accept"
    Then   a new page_versions record is created with the proposed content
    And    the page's current_version_id is updated
    And    the page's last_modified_at is reset to now
    And    lifecycle banners are cleared
    And    the re-embedding pipeline from FRD 1 is triggered
    And    the edit_proposals status changes to "accepted"

  Scenario: Reviewer requests changes on a proposal
    Given  a reviewer is viewing a pending PR
    When   the reviewer clicks "Request Changes" and types a comment
    Then   the edit_proposals status changes to "changes_requested"
    And    the reviewer's comment is stored on the proposal

  # --- Version History ---

  Scenario: User views version history
    When   a user clicks "View History" in the page header
    Then   a chronological list of versions is displayed at /wiki/midnight-sun/history
    And    each entry shows version number, date, summary, contributor, and AI verdict badge

  # --- Empty States ---

  Scenario: User views a page with no content
    Given  a wiki page exists for "New Club" but has no content
    When   a user views /wiki/new-club
    Then   a "This page needs content" call-to-action is displayed
    And    the suggested template sections appear as empty placeholders
    And    a prominent "Propose Edit" button is shown

  Scenario: User views an AI-generated cold-start page
    Given  a wiki page was generated by the cold start agent
    When   a user views the page
    Then   a banner reads "This content was AI-generated and is pending human review"
    And    the content is displayed normally below the banner
```

---

## Table of Contents

1. [Browsable Directory](#1-browsable-directory)
2. [Wiki Page View](#2-wiki-page-view)
3. [Pulse Sidebar and Voting Widget](#3-pulse-sidebar-and-voting-widget)
4. [Tiptap Editor](#4-tiptap-editor)
5. [PR Submission Flow](#5-pr-submission-flow)
6. [Diff Generation](#6-diff-generation)
7. [Reviewer Dashboard](#7-reviewer-dashboard)
8. [Version History](#8-version-history)
9. [Lifecycle Banners](#9-lifecycle-banners)
10. [Page Claiming](#10-page-claiming)
11. [Database Schema Additions](#11-database-schema-additions)
12. [API Routes](#12-api-routes)
13. [Non-Functional Requirements](#13-non-functional-requirements)
14. [Exit Criteria](#14-exit-criteria)
15. [Appendix A: Tiptap Extension Configuration](#appendix-a-tiptap-extension-configuration)
16. [Appendix B: Diff Rendering Example](#appendix-b-diff-rendering-example)
17. [Appendix C: Org Card Component Spec](#appendix-c-org-card-component-spec)
18. [Design Decisions Log](#design-decisions-log)

---

## 1. Browsable Directory

### 1.1 Overview

The browsable directory is the landing page of UW Wiki (`/`). A search bar sits at the top of the page, and below it, all organizations are displayed in category sections. Users can toggle between grid and list views, filter by text search, and sort alphabetically.

### 1.2 Layout

The landing page has two zones:

1. **Search bar (top):** A prominent input with placeholder "Ask anything about UW clubs, teams, and programs..." and a gold accent border on focus. Pressing Enter or clicking the search icon navigates to `/search?q={query}` (handled by FRD 1). This is a navigation entry point only -- the directory page itself does not render RAG results.
2. **Directory (below):** Category sections stacked vertically. Each section has a category heading (e.g., "Design Teams") and a collection of org cards below it.

A view-toggle control (grid/list icon pair) and a sort dropdown ("Sort by: Name") sit between the search bar and the first category section.

### 1.3 Org Cards

Each org is rendered as a card in the directory. Cards are the same component in both grid and list layouts, with layout differences handled by CSS grid/flex.

**Card content:**

| Field          | Source                   | Description                                                                                               |
| -------------- | ------------------------ | --------------------------------------------------------------------------------------------------------- |
| Org name       | `organizations.name`     | Primary text, bold, white                                                                                 |
| Category badge | `organizations.category` | Small badge with category name, gold accent                                                               |
| Tagline        | `organizations.tagline`  | One-line description, muted text. Editable through the standard PR flow. If null, shows "No tagline yet." |

**Grid view:** 3 columns on desktop, 2 on tablet, 1 on mobile. Cards are equal-height with consistent padding.

**List view:** Full-width rows. Org name on the left, tagline center, category badge right. Compact density.

### 1.4 Text Search Filter

The system shall:

1. Provide a filter input above the directory sections (separate from the RAG search bar).
2. Filter orgs client-side by matching the query against `organizations.name` and `organizations.tagline` (case-insensitive substring match).
3. Update results instantly on keypress (no debounce needed at launch scale of <50 orgs).
4. When a filter is active, hide category sections that contain zero matching orgs.

### 1.5 Sorting

The system shall support sorting orgs within each category section by name (A-Z, default). Sorting is client-side.

### 1.6 Data Fetching

The landing page fetches all organizations in a single server-side query (Next.js RSC):

```typescript
// src/app/page.tsx (server component)

const { data: orgs } = await supabase
  .from("organizations")
  .select("id, name, slug, category, tagline")
  .eq("university_id", UW_UNIVERSITY_ID)
  .order("name");
```

At launch scale (<50 orgs), fetching all orgs in a single query is appropriate. No pagination or infinite scroll.

### 1.7 Implementation

```typescript
// src/components/directory/DirectoryView.tsx

"use client";

import { useState } from "react";
import { OrgCard } from "./OrgCard";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Grid3X3, List } from "lucide-react";

interface Org {
  id: string;
  name: string;
  slug: string;
  category: string;
  tagline: string | null;
}

const CATEGORIES = [
  "Design Teams",
  "Engineering Clubs",
  "Non-Engineering Clubs",
  "Academic Programs",
  "Student Societies",
  "Campus Organizations",
];

export function DirectoryView({ orgs }: { orgs: Org[] }) {
  const [filter, setFilter] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");

  const filtered = orgs.filter(
    (org) =>
      org.name.toLowerCase().includes(filter.toLowerCase()) ||
      (org.tagline?.toLowerCase().includes(filter.toLowerCase()) ?? false)
  );

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Input
          placeholder="Filter organizations..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex-1"
        />
        <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as "grid" | "list")}>
          <ToggleGroupItem value="grid"><Grid3X3 className="h-4 w-4" /></ToggleGroupItem>
          <ToggleGroupItem value="list"><List className="h-4 w-4" /></ToggleGroupItem>
        </ToggleGroup>
      </div>

      {CATEGORIES.map((category) => {
        const categoryOrgs = filtered
          .filter((org) => org.category === category)
          .sort((a, b) => a.name.localeCompare(b.name));

        if (categoryOrgs.length === 0) return null;

        return (
          <section key={category} className="mb-12">
            <h2 className="text-xl font-bold text-white mb-4">{category}</h2>
            <div className={view === "grid"
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              : "flex flex-col gap-2"
            }>
              {categoryOrgs.map((org) => (
                <OrgCard key={org.id} org={org} layout={view} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
```

---

## 2. Wiki Page View

### 2.1 Overview

Each wiki page is rendered at `/wiki/[slug]` as a three-column layout: auto-generated TOC (left), ProseMirror-rendered content (center), and Pulse sidebar (right). The page is server-side rendered for SEO.

### 2.2 Three-Column Layout

| Column                    | Width            | Content                                                                                                                               |
| ------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **TOC (left)**            | ~15% (200px min) | Auto-generated table of contents from heading nodes. Sticky within viewport on desktop. Hidden on mobile (collapses into a dropdown). |
| **Content (center)**      | ~60% (flex-grow) | Rendered ProseMirror JSON content. Scrollable. All sections always expanded.                                                          |
| **Pulse sidebar (right)** | ~25% (280px min) | Pulse infobox card, external links, "Rate This Org" widget. Scrolls with content.                                                     |

On screens below 1024px, the layout collapses: TOC becomes a floating dropdown button, Pulse sidebar moves above the content, and content goes full-width.

### 2.3 Page Header

The page header sits above the three-column layout and contains:

- **Org name:** Large heading (`text-3xl font-bold text-white`)
- **Category badge:** Gold-outlined badge with the category name
- **"Claimed" badge:** If `organizations.claimed_by` is not null, a green "Claimed" badge appears
- **Last updated:** Muted text showing "Last updated: [relative time]" computed from `pages.last_modified_at`
- **Actions (right-aligned):**
  - "Propose Edit" button (gold accent, primary CTA)
  - "View History" text link (muted)

### 2.4 Auto-Generated TOC

The system shall:

1. Parse the ProseMirror JSON content and extract all heading nodes (H2 and H3).
2. Generate a slug for each heading (e.g., "Time Commitment" -> `time-commitment`).
3. Render the TOC as a vertical list of links. H3 entries are indented under their parent H2.
4. Use an `IntersectionObserver` to highlight the currently visible section's TOC entry as the user scrolls.
5. Clicking a TOC entry smooth-scrolls to the corresponding section and updates the URL hash.

```typescript
// src/components/wiki/TableOfContents.tsx

"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface TocEntry {
  id: string;
  text: string;
  level: number;
}

export function TableOfContents({ entries }: { entries: TocEntry[] }) {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (observerEntries) => {
        for (const entry of observerEntries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px" }
    );

    for (const tocEntry of entries) {
      const el = document.getElementById(tocEntry.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [entries]);

  return (
    <nav className="sticky top-20 space-y-1">
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
        On this page
      </p>
      {entries.map((entry) => (
        <a
          key={entry.id}
          href={`#${entry.id}`}
          className={cn(
            "block text-sm py-1 transition-colors",
            entry.level === 3 && "pl-4",
            activeId === entry.id
              ? "text-[#FEC93B] font-medium"
              : "text-zinc-400 hover:text-white"
          )}
        >
          {entry.text}
        </a>
      ))}
    </nav>
  );
}
```

### 2.5 Content Rendering

The system shall:

1. Fetch the current page version's `content_json` (ProseMirror JSON) from the `page_versions` table via `pages.current_version_id`.
2. Render the ProseMirror JSON into HTML using Tiptap's `generateHTML` utility (server-side) or a read-only Tiptap editor instance.
3. Inject `id` attributes on all heading elements for anchor link support.
4. Images reference Supabase Storage URLs and are rendered as `<img>` tags with lazy loading.
5. The "Official" section (if the page is claimed) renders inline — it is part of `content_json` as an H2 node with `attrs.official: true`. The renderer applies the gold border (`border-l-4 border-[#FEC93B]`) and org-name label when it encounters this attribute. No separate query is required.

### 2.6 SEO

The system shall:

1. Server-side render all wiki pages using Next.js App Router `page.tsx` server components.
2. Generate dynamic metadata via `generateMetadata`:

```typescript
// src/app/wiki/[slug]/page.tsx

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}) {
  const org = await getOrgBySlug(params.slug);
  const overview = extractOverviewText(org.currentVersion.contentJson);

  return {
    title: `${org.name} -- UW Wiki`,
    description:
      overview?.slice(0, 160) ||
      `Student-sourced information about ${org.name} at the University of Waterloo.`,
    openGraph: {
      title: `${org.name} -- UW Wiki`,
      description: overview?.slice(0, 160),
    },
  };
}
```

### 2.7 URL Structure

| Route                  | Purpose                               |
| ---------------------- | ------------------------------------- |
| `/`                    | Landing page (directory + search bar) |
| `/wiki/[slug]`         | Wiki page view                        |
| `/wiki/[slug]/history` | Version history                       |
| `/search`              | RAG search (FRD 1)                    |
| `/admin/proposals`     | Reviewer dashboard stub (→ `/admin/reviews` per FRD 7) |
| `/admin/claims`        | Claim management                      |

### 2.8 Empty Page States

The system handles three empty page scenarios:

1. **No content (blank page):** Display the suggested template sections as grey placeholder text ("No content yet for this section.") with a prominent gold "Propose Edit" CTA in the center.
2. **Cold-start generated (AI draft):** Display the content normally but with a yellow banner at the top: "This content was AI-generated and is pending human review. Propose an edit to improve it."
3. **No page exists for this org:** Show a 404-style page with "This organization doesn't have a wiki page yet" and a "Create Page" button (opens editor with the suggested template).

---

## 3. Pulse Sidebar and Voting Widget

### 3.1 Pulse Infobox

The Pulse infobox is a card rendered in the right column of the wiki page. It displays aggregated community ratings.

**Layout:**

```
┌─────────────────────────┐
│  THE PULSE              │
├─────────────────────────┤
│  Selectivity            │
│  [Application-Based]    │  <- badge
│  12 votes               │
├─────────────────────────┤
│  Vibe Check             │
│  ● ● ● ○ ○  3.2/5      │  <- filled/empty dots
│  Social ←──→ Corporate  │
│  18 votes               │
├─────────────────────────┤
│  Co-op Boost            │
│  ★ ★ ★ ★ ☆  4.1/5      │  <- stars
│  15 votes               │
├─────────────────────────┤
│  Tech Stack             │
│  [Altium] [SolidWorks]  │  <- tag chips
│  [C++] [Python]         │
├─────────────────────────┤
│  Health Status           │
│  ● Active               │  <- colored dot + label
├─────────────────────────┤
│  ▼ Rate This Org        │  <- collapsible
└─────────────────────────┘
```

### 3.2 Metrics Display

| Metric            | Display                                                         | Source                                                                  |
| ----------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Selectivity**   | Badge: "Open Membership", "Application-Based", or "Invite-Only" | `pulse_aggregates` where `metric = 'selectivity'`                       |
| **Vibe Check**    | 5-dot indicator (filled/empty) + numeric value + scale labels   | `pulse_aggregates` where `metric = 'vibe_check'`                        |
| **Co-op Boost**   | 5-star rating + numeric value                                   | `pulse_aggregates` where `metric = 'coop_boost'`                        |
| **Tech Stack**    | Tag chips (up to 10 shown, "+N more" overflow)                  | `pulse_aggregates` where `metric = 'tech_stack'` (stored as JSON array) |
| **Health Status** | Colored dot + label (Active/Stale/Potentially Defunct)          | Computed from `pages.last_modified_at` and `lifecycle_config`           |

Vote counts are shown next to each numeric metric for transparency (e.g., "18 votes").

### 3.3 Voting Widget

A collapsible "Rate This Org" section below the infobox. Expanded by default on the first visit, collapsed on subsequent visits (tracked via localStorage).

**Voting fields:**

| Field       | Input Type                                           | Validation |
| ----------- | ---------------------------------------------------- | ---------- |
| Selectivity | Dropdown: Open / Application-Based / Invite-Only     | Required   |
| Vibe Check  | Slider: 1 (Social) to 5 (Corporate)                  | Required   |
| Co-op Boost | Star rating: 1 to 5                                  | Required   |
| Tech Stack  | Tag input with autocomplete (freeform, deduplicated) | Optional   |

The user submits all ratings in one form. A "Submit Rating" button fires the API route.

### 3.4 Rate Limiting

The system uses two layers of protection:

**Authentication:** `POST /api/pulse/vote` requires a signed-in user (`requireUser()`). Unauthenticated users who click "Submit Rating" see the AuthModal; the pending vote is preserved via FRD 6's pending-action system (`pulse.vote` action type) and auto-replayed after sign-in.

**Primary dedup — DB-enforced unique constraint:**

1. `pulse_ratings` has a `UNIQUE(user_id, org_id, metric)` constraint.
2. Before inserting a vote, the DB rejects duplicate rows with a conflict error.
3. The API maps this to a `409` response with message: "You've already rated this metric for this org."

**Secondary — Upstash rate limit (anti-script backstop):**

4. Run an Upstash sliding-window check keyed on `pulse:user:${userId}`: **30 votes / 10 minutes** per user across all orgs and metrics.
5. If exceeded, return `429` with `Retry-After` header. UI shows "Too many ratings — please try again in a few minutes."
6. Rationale: the DB unique constraint handles honest per-metric dedup; the Upstash cap catches a script that creates one vote per org across many orgs in rapid succession.

Applied to: `POST /api/pulse/vote`. Uses `src/lib/rate-limit.ts` shared helper (see FRD 5 Section 12).

### 3.4.1 Schema Amendment

The `pulse_ratings` table (created in FRD 0) must be migrated:

```sql
-- Remove old session-based column and constraint
ALTER TABLE pulse_ratings DROP COLUMN IF EXISTS session_id;
ALTER TABLE pulse_ratings DROP CONSTRAINT IF EXISTS pulse_ratings_session_org_metric_key;

-- Add user-based column and constraint
ALTER TABLE pulse_ratings
  ADD COLUMN user_id UUID NOT NULL REFERENCES users(id);

ALTER TABLE pulse_ratings
  ADD CONSTRAINT pulse_ratings_user_org_metric_key UNIQUE (user_id, org_id, metric);
```

### 3.5 Aggregation

When a new vote is inserted, the system recomputes the aggregate for that org + metric:

```typescript
// src/lib/pulse.ts

export async function recomputeAggregate(orgId: string, metric: string) {
  const supabase = createAdminClient();

  const { data: ratings } = await supabase
    .from("pulse_ratings")
    .select("value")
    .eq("org_id", orgId)
    .eq("metric", metric);

  if (!ratings || ratings.length === 0) return;

  let aggregateValue: string;
  if (metric === "selectivity") {
    const counts = new Map<string, number>();
    for (const r of ratings) {
      counts.set(r.value, (counts.get(r.value) || 0) + 1);
    }
    aggregateValue = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  } else if (metric === "tech_stack") {
    const allTags = ratings.flatMap((r) => JSON.parse(r.value));
    const tagCounts = new Map<string, number>();
    for (const tag of allTags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
    aggregateValue = JSON.stringify(
      [...tagCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([tag]) => tag),
    );
  } else {
    const values = ratings
      .map((r) => parseFloat(r.value))
      .sort((a, b) => a - b);
    const mid = Math.floor(values.length / 2);
    const median =
      values.length % 2 !== 0
        ? values[mid]
        : (values[mid - 1] + values[mid]) / 2;
    aggregateValue = median.toFixed(1);
  }

  await supabase.from("pulse_aggregates").upsert(
    {
      org_id: orgId,
      metric,
      aggregate_value: aggregateValue,
      vote_count: ratings.length,
      last_computed_at: new Date().toISOString(),
    },
    { onConflict: "org_id,metric" },
  );
}
```

### 3.6 Cold-Start Seeded Values

When the cold-start agent (FRD 5) generates a page, it seeds two factual Pulse metrics — **Selectivity** and **Tech Stack** — using the admin service account's `user_id` (`COLD_START_AGENT_USER_ID`), but only when clear evidence exists in the research sources. **Vibe Check and Co-op Boost are never seeded by the agent** — they require subjective human experience and are populated only by authenticated users voting via the Pulse widget. The unique constraint on `(user_id, org_id, metric)` ensures the system account can seed each metric only once per org.

---

## 4. Tiptap Editor

### 4.1 Overview

The Tiptap editor provides the inline editing experience. When a user clicks "Propose Edit," the center content column transforms in place into an editable Tiptap instance. The TOC and Pulse sidebar remain visible but non-editable. A fixed toolbar appears at the top of the content area.

### 4.2 Extensions

The editor loads the following Tiptap extensions:

| Extension                                       | Purpose                                                                                                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `StarterKit`                                    | Paragraphs, bold, italic, strike, code, hard break, heading (H2, H3 only), bullet list, ordered list, blockquote, horizontal rule, history (undo/redo) |
| `Underline`                                     | Underline inline mark (`@tiptap/extension-underline`)                                                                                                  |
| `Highlight`                                     | Text highlight inline mark (`@tiptap/extension-highlight`)                                                                                             |
| `Link`                                          | Inline hyperlinks with `autolink: true` and `openOnClick: false` in edit mode                                                                          |
| `Image`                                         | Inline images with custom upload handler                                                                                                               |
| `Table`, `TableRow`, `TableHeader`, `TableCell` | Table support                                                                                                                                          |
| `CodeBlockLowlight`                             | Syntax-highlighted code blocks                                                                                                                         |
| `Placeholder`                                   | Placeholder text for empty paragraphs ("Start writing...")                                                                                             |

Heading levels are restricted to H2 and H3 only. H1 is reserved for the page title (org name), which is not editable through the Tiptap editor.

### 4.3 Toolbar

A fixed toolbar at the top of the editor area (Google Docs style). The toolbar is a single row with icon buttons grouped by function:

```
[H2] [H3] | [B] [I] [S] | [UL] [OL] [Quote] | [Link] [Image] [Table] | [Code] [---] | [Undo] [Redo]
```

| Group             | Buttons                               |
| ----------------- | ------------------------------------- |
| Headings          | H2, H3                                |
| Inline formatting | Bold, Italic, Strikethrough           |
| Block elements    | Bullet list, Ordered list, Blockquote |
| Inserts           | Link, Image upload, Table             |
| Special           | Code block, Horizontal divider        |
| History           | Undo, Redo                            |

Active formatting states are indicated by a gold highlight on the corresponding button.

### 4.4 Image Upload

The system supports three image insertion methods, all routing through the same upload handler:

1. **Paste from clipboard:** The editor's `handlePaste` hook detects image data in the clipboard.
2. **Drag-and-drop:** The editor's `handleDrop` hook detects dropped image files.
3. **Toolbar button:** Opens a native file picker dialog.

**Upload flow:**

```typescript
// src/lib/editor/upload.ts

export async function uploadEditorImage(file: File): Promise<string> {
  const supabase = createBrowserClient();
  const filename = `wiki-images/${crypto.randomUUID()}-${file.name}`;

  const { error } = await supabase.storage
    .from("wiki-images")
    .upload(filename, file, { contentType: file.type });

  if (error) throw new Error(`Image upload failed: ${error.message}`);

  const {
    data: { publicUrl },
  } = supabase.storage.from("wiki-images").getPublicUrl(filename);

  return publicUrl;
}
```

Images are uploaded to the `wiki-images` Supabase Storage bucket. The returned public URL is inserted into the ProseMirror document as an `image` node.

### 4.5 Template Pre-Fill

When a user creates a new page (no existing content), the editor loads with the suggested template as initial ProseMirror JSON content:

```typescript
// src/lib/editor/template.ts

export const SUGGESTED_TEMPLATE = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Overview" }],
    },
    { type: "paragraph", content: [{ type: "text", text: "" }] },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Time Commitment" }],
    },
    { type: "paragraph", content: [{ type: "text", text: "" }] },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Culture and Vibe" }],
    },
    { type: "paragraph", content: [{ type: "text", text: "" }] },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Subteams and Roles" }],
    },
    { type: "paragraph", content: [{ type: "text", text: "" }] },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Past Projects" }],
    },
    { type: "paragraph", content: [{ type: "text", text: "" }] },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Exec History" }],
    },
    { type: "paragraph", content: [{ type: "text", text: "" }] },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "How to Apply" }],
    },
    { type: "paragraph", content: [{ type: "text", text: "" }] },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "External Links" }],
    },
    { type: "paragraph", content: [{ type: "text", text: "" }] },
  ],
};
```

> **Note on External Links**: The `External Links` section is for free-form prose linking to resources the org wants to highlight (e.g. "Find us on the SLC bulletin board, room 3034," external websites, social profiles, etc.). The structured sidebar fields (Website, Instagram, GitHub) in the Pulse infobox are separate and are managed via FRD-7 admin tooling — they live alongside the body content, not inside it.

Users can delete, reorder, or add sections freely.

### 4.6 Autosave to localStorage

The system shall:

1. Every 10 seconds while the editor is active, save the current ProseMirror JSON to `localStorage` under the key `uw-wiki-draft:{pageId}`.
2. Also save on `blur` (when the user clicks away from the editor) and on `beforeunload` (page close/navigate).
3. Store alongside the content: the timestamp of the save and the `page_version_id` the draft was based on.
4. When the user returns to edit the same page, check for a matching draft. If found and the `page_version_id` matches the current version, show a recovery banner: "You have unsaved changes from [relative time ago]. Restore?"
5. If the `page_version_id` does not match (the page was updated since the draft), discard the draft silently and load the current version.
6. Clear the draft from localStorage when the user successfully submits a PR or clicks "Discard."

```typescript
// src/lib/editor/autosave.ts

interface Draft {
  content: object;
  pageVersionId: string;
  savedAt: string;
}

export function saveDraft(
  pageId: string,
  content: object,
  pageVersionId: string,
) {
  const draft: Draft = {
    content,
    pageVersionId,
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(`uw-wiki-draft:${pageId}`, JSON.stringify(draft));
}

export function loadDraft(
  pageId: string,
  currentVersionId: string,
): Draft | null {
  const raw = localStorage.getItem(`uw-wiki-draft:${pageId}`);
  if (!raw) return null;

  const draft: Draft = JSON.parse(raw);
  if (draft.pageVersionId !== currentVersionId) {
    localStorage.removeItem(`uw-wiki-draft:${pageId}`);
    return null;
  }

  return draft;
}

export function clearDraft(pageId: string) {
  localStorage.removeItem(`uw-wiki-draft:${pageId}`);
}
```

### 4.7 Anonymous Editing

No account is required to click "Propose Edit," edit content, or submit a proposal. Proposals submitted without an account have `contributor_id = NULL` and display publicly as "Anonymous." The attribution toggle (Section 5.2 Step 2) is shown only to signed-in users; unauthenticated users always submit anonymously.

---

## 5. PR Submission Flow

> **Superseded by FRD 4.** The canonical PR submission flow, rationale validation, attribution toggle, section selection UI, and post-submission confirmation are fully specified in [FRD-4 §1](FRD-4-pr-edit-system.md#1-workflow-scope-and-ux). Original content removed during the FRD-4 reconciliation pass. When implementing, defer entirely to FRD-4 for all submission behavior.

---

## 6. Diff Generation

> **Superseded by FRD 4.** The canonical diff engine uses `prosemirror-changeset` for structured per-section diffs (not plain-text `diffWords`). Full specification in [FRD-4 §4](FRD-4-pr-edit-system.md#4-diff-and-mergeability-engine). `proposed_content_json` (full-document storage) is superseded by the per-section `section_diffs` JSONB model in `edit_proposal_patchsets` (FRD-4 §3.2). Original content removed during the FRD-4 reconciliation pass.

---

## 7. Reviewer Dashboard

> **Superseded by FRD 4 and FRD 7.** The canonical reviewer decision workflow (accept, reject, request-changes), conflict-of-interest enforcement, accept pipeline, and per-section diff cards are fully specified in [FRD-4 §5–6](FRD-4-pr-edit-system.md#5-reviewer-experience-and-policy-enforcement). The admin UI surface lives at `/admin/reviews` per [FRD-7 §2](FRD-7-admin-dashboard.md). The `/admin/proposals` scaffolding route may redirect to `/admin/reviews` on implementation. Original content (§§7.2–7.6, accept server code) removed during the FRD-4 reconciliation pass — defer to FRD-4 for all reviewer and accept logic.

---

## 8. Version History

### 8.1 Overview

Each wiki page has a version history accessible via a "View History" link in the page header. The history is a chronological summary list -- it does not support reconstructing or viewing full old versions.

### 8.2 Route

`/wiki/[slug]/history`

### 8.3 Display

A vertical list of version entries, ordered by `version_number` descending (newest first):

| Field          | Source                                                                              |
| -------------- | ----------------------------------------------------------------------------------- |
| Version number | `page_versions.version_number` (e.g., "v12")                                        |
| Date           | `page_versions.created_at` (formatted as "April 5, 2026 at 2:30 PM")                |
| Summary        | `page_versions.summary` (the contributor's rationale, truncated to 100 chars)       |
| Contributor    | Display name if not anonymous, "Anonymous contributor" otherwise                    |

### 8.4 Data Fetching

```typescript
// src/app/wiki/[slug]/history/page.tsx

const { data: versions } = await supabase
  .from("page_versions")
  .select(
    `
    id, version_number, summary, created_at, is_anonymous,
    contributor:users(display_name)
  `,
  )
  .eq("page_id", page.id)
  .order("version_number", { ascending: false });
```

### 8.5 No Version Reconstruction

Clicking a version entry does not navigate to a reconstructed view. The history is informational only -- it shows what changed and when, not the full content at that point. Full version reconstruction is a post-MVP feature.

---

## 9. Lifecycle Banners

### 9.1 Overview

Wiki pages that have not been updated within configurable time thresholds display a colored warning banner at the top of the page. This prevents users from relying on outdated information.

### 9.2 Threshold Configuration

Thresholds are stored in the `lifecycle_config` table and loaded at page render time:

| Category              | Needs Update (months) | Stale (months) | Potentially Defunct (months) |
| --------------------- | --------------------- | -------------- | ---------------------------- |
| Design Teams          | 9                     | 15             | 24                           |
| Engineering Clubs     | 6                     | 12             | 18                           |
| Non-Engineering Clubs | 6                     | 12             | 18                           |
| Academic Programs     | 12                    | 24             | 36                           |
| Student Societies     | 12                    | 12             | 18                           |
| Campus Organizations  | 12                    | 24             | 36                           |

### 9.3 Computation

The lifecycle status is computed server-side on each page load (not stored as a field):

```typescript
// src/lib/lifecycle.ts

export type LifecycleStatus =
  | "active"
  | "needs_update"
  | "stale"
  | "potentially_defunct";

export function computeLifecycleStatus(
  lastModifiedAt: string,
  config: {
    needs_update_months: number;
    stale_months: number;
    defunct_months: number;
  },
): LifecycleStatus {
  const lastModified = new Date(lastModifiedAt);
  const now = new Date();
  const monthsSinceUpdate =
    (now.getTime() - lastModified.getTime()) / (1000 * 60 * 60 * 24 * 30.44);

  if (monthsSinceUpdate >= config.defunct_months) return "potentially_defunct";
  if (monthsSinceUpdate >= config.stale_months) return "stale";
  if (monthsSinceUpdate >= config.needs_update_months) return "needs_update";
  return "active";
}
```

### 9.4 Banner Rendering

Banners are rendered at the top of the wiki page content area, below the page header and above the three-column layout:

| Status                | Color                                         | Message                                                                                |
| --------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------- |
| `needs_update`        | Yellow (`bg-yellow-900/30 border-yellow-600`) | "This page hasn't been updated in a while. Information may be outdated."               |
| `stale`               | Orange (`bg-orange-900/30 border-orange-600`) | "This page is stale. The information here may no longer be accurate."                  |
| `potentially_defunct` | Red (`bg-red-900/30 border-red-600`)          | "This organization may be defunct. This page has not been updated in over [N] months." |

Each banner includes a "Propose Edit" link to encourage contribution.

### 9.5 Health Status in Pulse Sidebar

The Health Status metric in the Pulse infobox mirrors the computed lifecycle status:

- `active`: Green dot + "Active"
- `needs_update`: Yellow dot + "Needs Update"
- `stale`: Orange dot + "Stale"
- `potentially_defunct`: Red dot + "Potentially Defunct"

### 9.6 Reset on Accept

When a PR is accepted (see FRD-4 §6.1 post-commit step 3), `pages.last_modified_at` is updated to `now()`. The next page load computes the status as `active`, and no banner is shown.

---

## 10. Affiliation and Official Sections

### 10.1 Affiliation

Users self-declare their affiliations with organizations from their profile settings at `/my/profile` (managed by FRD-6). Declaring an affiliation adds a row to `user_affiliations` — no admin verification step is required. Admins can revoke any affiliation from the admin dashboard (FRD-7 §5).

There is no "Claim This Page" button. The claim flow, `claim_requests` table, and `/api/claims` routes are not part of this product. An org's presence on the wiki is established by the community contributing content; the Official section (§10.2) provides a path for affiliated members to add authoritative content.

### 10.2 Official Sections

The Official section is an H2 section stored **inline within `pages.content_json`** with `attrs.official: true` on the heading node:

```json
{
  "type": "heading",
  "attrs": { "level": 2, "slug": "official", "official": true },
  "content": [{ "type": "text", "text": "Official" }]
}
```

There are two paths for seeding an Official section on a page:

1. **Affiliated user PR**: A user affiliated with the org submits a regular PR that includes a new H2 section with `official: true`. A reviewer accepts via the standard FRD-4 pipeline. The affiliation guard (FRD-4 §1.6) ensures that only affiliated users can propose changes to Official sections.

2. **Admin direct seed**: An admin uses the Official Section seeder in the admin dashboard (FRD-7) to insert Official content directly. This creates a new `page_versions` row with `is_admin_seeded: true` and the H2 `attrs.official: true`. FRD-1 re-embedding and FRD-3 re-anchoring are triggered as usual.

Contributors cannot grant or remove the `official` attribute through the PR system — FRD-4's accept pipeline preserves the existing attribute value, and the ProseMirror allowlist validation (FRD-4 §8.3) rejects submissions that attempt to modify it.

The Official section participates in the standard PR pipeline uniformly with all other sections: it appears in the version history, is chunked for RAG search, and comment anchors apply normally.

### 10.3 Affiliation Badge on PRs

When an affiliated user submits a PR for an org they are affiliated with, the proposal is stamped with `is_from_affiliated_contributor = true` at submission time. This badge is visible to reviewers in the PR queue and on the proposal detail page. It is informational only — it does not block or require any additional action.

### 10.4 Visual Treatment

The render layer detects Official sections by reading `attrs.official === true` on H2 heading nodes during ProseMirror-to-HTML conversion. No special query or separate data source is needed — the attribute is embedded in `content_json`.

The Official section has:

- A gold left border: `border-l-4 border-[#FEC93B]`
- A header label: "Official — contributed by affiliated members" in gold text
- A subtle surface background: `bg-[#141414]` (elevated surface)

---

## 11. Database Schema Additions

The following columns or tables are needed beyond the FRD 0 baseline:

### 11.1 Column Additions

```sql
-- organizations table
ALTER TABLE organizations ADD COLUMN tagline TEXT;
-- Note: claimed_by and claimed_at are NOT added. The claim flow is removed.
-- Official section content is stored inline within pages.content_json as an H2 node
-- with attrs.official = true (see §10.2). No claim_requests table.

-- edit_proposals table
ALTER TABLE edit_proposals ADD COLUMN is_anonymous BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE edit_proposals ADD COLUMN reviewer_comment TEXT;
ALTER TABLE edit_proposals ADD COLUMN contributor_id UUID REFERENCES users(id);
ALTER TABLE edit_proposals ADD COLUMN is_from_affiliated_contributor BOOLEAN NOT NULL DEFAULT false;
-- Note: section_slugs, base_page_version_id, current_patchset_number, mergeability_status
-- are added by FRD-4 §3.1 (not duplicated here).

-- page_versions table
ALTER TABLE page_versions ADD COLUMN is_anonymous BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE page_versions ADD COLUMN is_admin_seeded BOOLEAN NOT NULL DEFAULT false;
```

### 11.2 New Tables

```sql
-- claim_requests table is removed. The claim flow is replaced by the self-declared
-- affiliation model (§10.1). See FRD-0 for user_affiliations baseline schema.

CREATE TABLE user_affiliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  org_id UUID NOT NULL REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, org_id)
);
```

### 11.3 Indexes

```sql
CREATE INDEX idx_edit_proposals_status ON edit_proposals (status);
CREATE INDEX idx_edit_proposals_page_id ON edit_proposals (page_id);
CREATE INDEX idx_user_affiliations_user_id ON user_affiliations (user_id);
```

---

## 12. API Routes

| Route                                 | Method | Auth     | Purpose                                      |
| ------------------------------------- | ------ | -------- | -------------------------------------------- |
| `/api/proposals` (and all sub-routes) | —      | —        | **Superseded by FRD 4 §7.** See [FRD-4 API Contracts](FRD-4-pr-edit-system.md#7-api-contracts) for the full proposal route table (create, patchset, withdraw, accept, reject, request-changes, mergeability). |
| `/api/pulse/vote`                     | POST   | Required | Submit a Pulse rating                        |

---

## 13. Non-Functional Requirements

| Requirement               | Target                                                                        |
| ------------------------- | ----------------------------------------------------------------------------- |
| **Wiki page load (SSR)**  | < 2 seconds for full server-rendered page                                     |
| **Editor initialization** | < 1 second from "Propose Edit" click to editable state                        |
| **Diff generation**       | < 500ms for typical page-length documents                                     |
| **Image upload**          | < 3 seconds for a 2MB image                                                   |
| **Directory page load**   | < 1 second (all orgs fetched in one query)                                    |
| **SEO**                   | All wiki pages server-side rendered with og:title and og:description          |
| **Accessibility**         | WCAG 2.1 AA: keyboard navigation, screen reader labels, color contrast ratios |

---

## 14. Exit Criteria

FRD 2 is complete when ALL of the following are satisfied:

| #   | Criterion                                                    | Verification                                                                                                           |
| --- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| 1   | Landing page renders the directory with category sections    | Visit `/` and verify all 6 category sections appear with org cards                                                     |
| 2   | Grid/list toggle works                                       | Switch between grid and list views and verify layout changes                                                           |
| 3   | Directory text filter works                                  | Type a partial org name and verify only matching orgs appear                                                           |
| 4   | Wiki page renders with three-column layout                   | Visit `/wiki/[slug]` and verify TOC, content, and Pulse sidebar columns                                                |
| 5   | Auto-generated TOC highlights on scroll                      | Scroll through a page and verify the active TOC entry updates                                                          |
| 6   | Page header shows org name, category badge, and last updated | Verify all metadata is visible in the header                                                                           |
| 7   | Pulse sidebar displays all metrics                           | Verify Selectivity, Vibe Check, Co-op Boost, Tech Stack, and Health Status appear                                      |
| 8   | Pulse voting widget submits a rating                         | Submit a rating and verify the aggregate updates                                                                       |
| 9   | Pulse voting requires authentication                         | Attempt to vote while signed out and verify the AuthModal appears; sign in and verify the vote is recorded and linked to `user_id` |
| 9b  | Pulse dedup prevents duplicate votes per authenticated user  | Submit a vote, then attempt the same metric again as the same user and verify the second is rejected with 409           |
| 10  | "Propose Edit" transforms page into inline editor            | Click the button and verify the Tiptap toolbar appears and content becomes editable                                    |
| 11  | All Tiptap extensions work                                   | Test headings, bold, lists, links, images, tables, code blocks, blockquotes, dividers                                  |
| 12  | Image upload works via paste, drag-drop, and toolbar         | Upload an image via each method and verify it appears in the editor                                                    |
| 13  | Autosave to localStorage works                               | Edit content, navigate away, return, and verify the draft recovery banner appears                                      |
| 14  | Submission dialog shows diff and preview tabs                | Click "Submit Proposal" and verify both tabs render correctly                                                          |
| 15  | PR proposals can be submitted anonymously                    | Attempt to submit a proposal without signing in and verify it succeeds, with contributor shown as "Anonymous"          |
| 15b | Auth modal appears for unauthenticated users attempting to vote Pulse | Attempt to submit a Pulse vote without signing in and verify the auth modal appears                           |
| 16  | Reviewer dashboard lists pending proposals                   | Sign in as a reviewer, visit `/admin/reviews` (FRD 7; `/admin/proposals` stub redirects there), and verify pending PRs appear |
| 18  | Accept creates a new page version                            | Accept a proposal and verify the page content updates and version number increments                                    |
| 19  | Request Changes stores reviewer comment                      | Request changes and verify the comment is stored on the proposal                                                       |
| 20  | Re-embedding triggers on accept                              | Accept a proposal and verify new chunks are created in the `chunks` table (FRD 1 integration)                          |
| 21  | Version history displays correctly                           | Click "View History" and verify the version list with summaries and dates                                              |
| 22  | Lifecycle banner appears on stale pages                      | Set a page's `last_modified_at` to 13 months ago (for an Engineering Club) and verify an orange "Stale" banner appears |
| 23  | Lifecycle banner clears on accept                            | Accept a PR for the stale page and verify the banner disappears                                                        |
| 24  | Official section renders on claimed pages                    | Claim a page and add official content; verify the gold-bordered section appears after Overview                         |
| 25  | Empty page shows CTA                                         | View a page with no content and verify the placeholder template and "Propose Edit" CTA                                 |
| 26  | SEO metadata is set                                          | Check the page source for og:title and og:description on a wiki page                                                   |
| 27  | Conflict of interest guard works                             | Attempt to accept a PR for an affiliated org and verify the Accept button is disabled                                  |

---

## Appendix A: Tiptap Extension Configuration

```typescript
// src/lib/editor/extensions.ts

import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Placeholder from "@tiptap/extension-placeholder";
import { common, createLowlight } from "lowlight";

const lowlight = createLowlight(common);

export const editorExtensions = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    codeBlock: false, // replaced by CodeBlockLowlight
  }),
  Underline,
  Highlight.configure({ multicolor: false }),
  Link.configure({
    autolink: true,
    openOnClick: false,
    HTMLAttributes: { class: "text-[#FEC93B] underline hover:text-[#FFD700]" },
  }),
  Image.configure({
    inline: true,
    allowBase64: false,
  }),
  Table.configure({ resizable: true }),
  TableRow,
  TableHeader,
  TableCell,
  CodeBlockLowlight.configure({ lowlight }),
  Placeholder.configure({
    placeholder: "Start writing...",
  }),
];
```

---

## Appendix B: Diff Rendering Example

**Current content:**

> ## Time Commitment
>
> Mechanical subteam: 8-10 hours/week during build season.

**Proposed content:**

> ## Time Commitment
>
> Mechanical subteam: 8-10 hours/week during build season, 3-4 hours otherwise. Competition season (May-July) can spike to 15-20 hours/week.

**Rendered inline diff:**

> ## Time Commitment
>
> Mechanical subteam: 8-10 hours/week during build season<span style="background: rgba(239,68,68,0.2); text-decoration: line-through">.</span><span style="background: rgba(34,197,94,0.2)">, 3-4 hours otherwise. Competition season (May-July) can spike to 15-20 hours/week.</span>

In the UI, added text has a green-tinted background and removed text has a red-tinted background with strikethrough, both using the dark theme opacity levels (`bg-green-900/30`, `bg-red-900/30`).

---

## Appendix C: Org Card Component Spec

```typescript
// src/components/directory/OrgCard.tsx

import Link from "next/link";
import { Badge } from "@/components/ui/badge";

interface OrgCardProps {
  org: {
    name: string;
    slug: string;
    category: string;
    tagline: string | null;
  };
  layout: "grid" | "list";
}

export function OrgCard({ org, layout }: OrgCardProps) {
  if (layout === "list") {
    return (
      <Link
        href={`/wiki/${org.slug}`}
        className="flex items-center justify-between p-3 rounded-lg border border-[#262626] hover:border-[#FEC93B]/50 transition-colors"
      >
        <span className="font-medium text-white">{org.name}</span>
        <span className="text-sm text-zinc-400 flex-1 mx-4 truncate">
          {org.tagline || "No tagline yet."}
        </span>
        <Badge variant="outline" className="border-[#FEC93B]/30 text-[#FEC93B] text-xs">
          {org.category}
        </Badge>
      </Link>
    );
  }

  return (
    <Link
      href={`/wiki/${org.slug}`}
      className="block p-4 rounded-lg border border-[#262626] hover:border-[#FEC93B]/50 transition-colors"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="font-medium text-white">{org.name}</span>
        <Badge variant="outline" className="border-[#FEC93B]/30 text-[#FEC93B] text-xs">
          {org.category}
        </Badge>
      </div>
      <p className="text-sm text-zinc-400 line-clamp-2">
        {org.tagline || "No tagline yet."}
      </p>
    </Link>
  );
}
```

---

## Design Decisions Log

| Decision                                                        | Rationale                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Inline editor (same page) over separate /edit page**          | Reduces context switching. The user sees exactly what they're editing in the same layout they're reading. Simpler routing. The three-column layout naturally accommodates the transformation.                                                                                   |
| **Fixed toolbar over floating bubble**                          | Fixed toolbar is more discoverable and familiar (Google Docs pattern). Floating bubbles are elegant but harder to use for block-level formatting (headings, lists, tables).                                                                                                     |
| **localStorage autosave over server-side drafts**               | Zero-auth requirement for drafts. No server round-trips. Instantaneous saves. At launch, the editorial overhead of server-side draft management is unnecessary.                                                                                                                 |
| **Full proposed content JSON stored, not just diff**            | Enables rendering the preview tab without reconstructing from diff. Diffs are computed on demand so they stay current if the page is edited between submission and review. Slightly more storage but negligible at launch scale.                                                |
| **Word-level diff over ProseMirror structural diff**            | Structural ProseMirror diffing (prosemirror-changeset) is complex and produces diffs that are hard for non-technical users to read. Word-level diff via the `diff` npm package is simple, readable, and sufficient for editorial review.                                        |
| **No auth required for PR submission**                          | Removing all auth friction for edit proposals maximises the contributor pool. Anonymous PRs still go through editorial review before any content goes live, so the trust model is maintained without requiring an account. Signed-in users can optionally attribute proposals to their account. |
| **Inline diff over side-by-side diff**                          | Inline diff takes less horizontal space (important in the three-column layout and the reviewer dashboard). Side-by-side requires duplicating the full page content. The diff library produces clean inline output.                                                              |
| **Three actions (Accept/Reject/Request Changes) over binary**   | Request Changes enables a conversation between reviewer and contributor without rejecting the PR entirely. This encourages iteration and keeps contributors engaged rather than discouraging them with outright rejections.                                                     |
| **Summary-only version history over full reconstruction**       | Full version reconstruction requires replaying diffs or storing full content snapshots for every version. At launch, the version history is primarily for transparency ("who changed what when"), not for restoring old content. Keeps the implementation simple.               |
| **Lifecycle status computed on load, not stored**               | Avoids a cron job or scheduled function to update status fields. The computation is trivial (date comparison) and runs server-side during SSR. No stale data risk.                                                                                                              |
| **TOC in left column over sidebar/top-of-page**                 | Left-column TOC is a well-understood pattern (MDN, Tailwind docs, Stripe docs). It stays visible while scrolling without occupying the content area. Combined with the Pulse sidebar on the right, it creates a natural three-column layout that uses screen width effectively. |
| **All sections expanded over collapsible**                      | Wiki pages are meant to be scanned and searched. Collapsed sections hide content from both users and search engines. The TOC provides navigation without requiring collapse/expand interaction.                                                                                 |
| **Pulse voting with session fingerprint over account-required** | Requiring an account for voting adds too much friction for a low-stakes action. Session fingerprinting prevents casual ballot-stuffing while keeping the barrier to contribution zero. Determined abuse is handled by the editorial board monitoring aggregates.                |
| **Categories as sections on one page over separate routes**     | At launch scale (<50 orgs, 6 categories), a single scrollable page is faster to browse than navigating between 6 separate pages. The filter bar provides instant refinement. Separate category pages can be added later if the directory grows.                                 |
