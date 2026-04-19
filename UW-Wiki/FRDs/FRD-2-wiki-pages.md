# Feature Requirements Document: FRD 2 -- Wiki Pages, Directory, Editor, and Edit Proposals (v1.0)

| Field               | Value                                                                                                                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Project**         | UW Wiki                                                                                                                                                                                                                                                      |
| **Parent Document** | [PRD v0.1](../PRD.md)                                                                                                                                                                                                                                        |
| **FRD Order**       | [FRD Order](../FRD-order.md)                                                                                                                                                                                                                                 |
| **PRD Sections**    | 6.2 (Browsable Directory), 6.3 (Wiki Pages and Version Control), 6.4 (PR-Style Edit Proposals), 6.6 (The Pulse), 6.7 (Page Claiming), 6.9 (Automated Lifecycle Management)                                                                                   |
| **Type**            | Core product feature                                                                                                                                                                                                                                         |
| **Depends On**      | FRD 0 (Setup Document)                                                                                                                                                                                                                                       |
| **Delivers**        | Browsable directory with grid/list toggle, three-column wiki page view with auto-TOC, Pulse sidebar and voting widget, inline Tiptap editor with PR submission flow, AI pre-screening, reviewer dashboard, version history, lifecycle banners, page claiming |
| **Created**         | 2026-04-06                                                                                                                                                                                                                                                   |

---

## Summary

FRD 2 builds the core content layer of UW Wiki -- everything a user sees and interacts with when browsing, reading, editing, and reviewing wiki pages. The feature set spans three layers. The **viewing layer** delivers a browsable landing-page directory (grid/list toggle, category sections, org cards with taglines), a three-column wiki page view (auto-generated TOC on the left, ProseMirror-rendered content in the center, Pulse infobox sidebar on the right), lifecycle staleness banners, and a page-claiming flow for orgs to establish an official section. The **editing layer** provides an inline Tiptap WYSIWYG editor (headings, lists, tables, images, code blocks, blockquotes, dividers) that transforms the page in place when a user clicks "Propose Edit," autosaves drafts to localStorage, and gates authentication to the submission step rather than the editing step. The **review layer** includes a PR submission flow with inline diff and rendered preview tabs, a rationale field, an AI pre-screener (GPT-4o-mini pass/fail verdict), a reviewer dashboard with accept/reject/request-changes actions, and a version history view. Accepting a PR creates a new page version, updates the page, resets lifecycle timers, and triggers the re-embedding pipeline from FRD 1.

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
| AI pre-screen      | An automated pass/fail assessment of an edit proposal against the Platform Editorial Values, run by GPT-4o-mini on submission.                                                      |
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

  Scenario: User submits a Pulse vote
    When   a user expands the "Rate This Org" widget
    And    selects "Application-Based" for Selectivity
    And    sets Vibe Check to 3
    And    sets Co-op Boost to 4
    And    clicks "Submit Rating"
    Then   the vote is recorded with a session fingerprint
    And    the displayed aggregate values update
    And    the user cannot vote again for this org in this session

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

  Scenario: Unauthenticated user is prompted to sign in on submit
    Given  the user is not signed in
    And    the user has filled in the rationale and clicks "Submit"
    Then   an auth modal appears (Google OAuth or email/password)
    And    after successful sign-in, the submission proceeds automatically

  Scenario: PR receives an AI pre-screen verdict
    When   an edit proposal is submitted
    Then   the system calls GPT-4o-mini with the diff and editorial values
    And    receives a pass/fail verdict with a one-line reason
    And    stores the verdict on the edit_proposals record
    And    the user is redirected to a confirmation page showing the verdict

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
6. [AI Pre-Screening](#6-ai-pre-screening)
7. [Diff Generation](#7-diff-generation)
8. [Reviewer Dashboard](#8-reviewer-dashboard)
9. [Version History](#9-version-history)
10. [Lifecycle Banners](#10-lifecycle-banners)
11. [Page Claiming](#11-page-claiming)
12. [Database Schema Additions](#12-database-schema-additions)
13. [API Routes](#13-api-routes)
14. [Non-Functional Requirements](#14-non-functional-requirements)
15. [Exit Criteria](#15-exit-criteria)
16. [Appendix A: Tiptap Extension Configuration](#appendix-a-tiptap-extension-configuration)
17. [Appendix B: Diff Rendering Example](#appendix-b-diff-rendering-example)
18. [Appendix C: AI Pre-Screener Prompt Template](#appendix-c-ai-pre-screener-prompt-template)
19. [Appendix D: Org Card Component Spec](#appendix-d-org-card-component-spec)
20. [Design Decisions Log](#design-decisions-log)

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
5. The "Official" section (if the page is claimed) renders after the Overview section with a gold left border (`border-l-4 border-[#FEC93B]`) and a label.

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

The system shall:

1. Generate a session fingerprint from a combination of: user agent string + screen resolution + timezone. Store it as a hashed value.
2. Before inserting a vote, check `pulse_ratings` for an existing row with the same `session_id` + `org_id` + `metric`.
3. If a duplicate exists, reject the vote with a message: "You've already rated this metric for this org."
4. No account is required to vote.

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

When the cold-start agent (future FRD) generates a page, it also inserts initial `pulse_ratings` rows with a special `session_id` of `"cold-start-agent"`. These count as a single vote each. As human votes accumulate, the cold-start values are naturally diluted via the median/mode aggregation.

---

## 4. Tiptap Editor

### 4.1 Overview

The Tiptap editor provides the inline editing experience. When a user clicks "Propose Edit," the center content column transforms in place into an editable Tiptap instance. The TOC and Pulse sidebar remain visible but non-editable. A fixed toolbar appears at the top of the content area.

### 4.2 Extensions

The editor loads the following Tiptap extensions:

| Extension                                       | Purpose                                                                                                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `StarterKit`                                    | Paragraphs, bold, italic, strike, code, hard break, heading (H2, H3 only), bullet list, ordered list, blockquote, horizontal rule, history (undo/redo) |
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
  ],
};
```

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

### 4.7 Auth Gating

Unauthenticated users can click "Propose Edit" and edit freely. Authentication is only required at submission time (Section 5). This reduces friction -- users invest in their edits before being asked to sign in, increasing completion rates.

---

## 5. PR Submission Flow

### 5.1 Overview

After editing, the user clicks "Submit Proposal" in the editor toolbar. A multi-step submission dialog guides them through reviewing, explaining, and submitting their changes.

### 5.2 Submission Dialog

The submission dialog is a full-width panel that replaces the editor view (not a modal overlay -- avoids z-index issues with the three-column layout). It contains:

**Step 1 -- Review Changes:**

Two tabs:

- **Diff tab:** Inline diff showing additions (green background, `bg-green-900/30`) and deletions (red background, `bg-red-900/30`) against the current page version. This is the default tab.
- **Preview tab:** Rendered preview of the proposed page as it would appear to a reader.

**Step 2 -- Rationale and Attribution:**

Below the diff/preview area:

- **Rationale field:** A textarea with label "Why does this edit align with UW Wiki's editorial values?" Required, minimum 20 characters, maximum 500 characters. Character count displayed.
- **Attribution toggle:** A switch defaulting to "Anonymous." Toggling on shows the user's display name (from their account) with a preview: "This edit will be attributed to: [Name]."

**Step 3 -- Auth Gate:**

If the user is not signed in when they click "Submit":

1. An auth modal overlays the submission dialog with Google OAuth and email/password options.
2. After successful authentication, the submission proceeds automatically without requiring the user to click "Submit" again.
3. The auth modal uses Supabase Auth UI components.

**Step 4 -- Submit:**

Clicking "Submit" fires `POST /api/proposals` with the proposed content, rationale, page ID, and attribution preference.

### 5.3 Post-Submission Confirmation

After successful submission, the user is redirected to a confirmation page showing:

- **Status badge:** "Pending Review" (yellow)
- **AI pre-screen verdict:** "Pass" (green badge) or "Fail" (red badge) with the one-line reason
- **Summary:** "Your edit to [Org Name] has been submitted and is awaiting review by the editorial board."
- **Links:** "Back to [Org Name]" and "View your proposals" (links to user contribution history)

---

## 6. AI Pre-Screening

### 6.1 Overview

On edit proposal submission, the system runs an AI pre-screener that evaluates the proposed changes against the Platform Editorial Values (PRD Section 8). The pre-screener produces a pass/fail verdict with a one-line reason.

### 6.2 Model

GPT-4o-mini via OpenRouter. Selected because this is a simple classification task that does not require strong reasoning -- just editorial value alignment against five clear criteria.

### 6.3 Input

The pre-screener receives:

1. The diff between the current and proposed content (text representation of additions and removals).
2. The org name and category for context.
3. The contributor's rationale.

### 6.4 Output

```typescript
interface PreScreenResult {
  verdict: "pass" | "fail";
  reason: string; // One-line reason, max 100 chars
}
```

### 6.5 Implementation

```typescript
// src/lib/ai/pre-screener.ts

import { generateObject } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { PRE_SCREEN_PROMPT } from "./prompts";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

export async function preScreenProposal(input: {
  orgName: string;
  category: string;
  diffText: string;
  rationale: string;
}): Promise<{ verdict: "pass" | "fail"; reason: string }> {
  const { object } = await generateObject({
    model: openrouter("openai/gpt-4o-mini"),
    schema: z.object({
      verdict: z.enum(["pass", "fail"]),
      reason: z.string().max(100),
    }),
    prompt: PRE_SCREEN_PROMPT.replace("{{ORG_NAME}}", input.orgName)
      .replace("{{CATEGORY}}", input.category)
      .replace("{{DIFF}}", input.diffText)
      .replace("{{RATIONALE}}", input.rationale),
  });

  return object;
}
```

The full prompt template is in [Appendix C](#appendix-c-ai-pre-screener-prompt-template).

### 6.6 Storage

The verdict and reason are stored on the `edit_proposals` record:

- `ai_verdict`: `"pass"` or `"fail"`
- `ai_reason`: One-line string

### 6.7 Async Execution

Pre-screening runs asynchronously after the proposal is saved. The user sees the confirmation page immediately with a "Pre-screening in progress..." spinner. The verdict appears once the API call completes (typically <3 seconds). The confirmation page polls `GET /api/proposals/[id]` until the verdict is populated.

---

## 7. Diff Generation

### 7.1 Overview

Diffs are generated by comparing the current ProseMirror JSON with the proposed ProseMirror JSON. The diff is used in the submission dialog (contributor review), the reviewer dashboard, and the version history.

### 7.2 Approach

The system converts both ProseMirror JSON documents to plain text (preserving heading structure and paragraph breaks), then computes a word-level diff. This is simpler than structural ProseMirror diffing and produces readable output for both contributors and reviewers.

### 7.3 Implementation

```typescript
// src/lib/diff.ts

import { diffWords } from "diff";

export interface DiffSegment {
  type: "added" | "removed" | "unchanged";
  value: string;
}

export function generateDiff(
  currentJson: object,
  proposedJson: object,
): DiffSegment[] {
  const currentText = prosemirrorToPlainText(currentJson);
  const proposedText = prosemirrorToPlainText(proposedJson);

  const changes = diffWords(currentText, proposedText);

  return changes.map((change) => ({
    type: change.added ? "added" : change.removed ? "removed" : "unchanged",
    value: change.value,
  }));
}

function prosemirrorToPlainText(doc: any): string {
  const lines: string[] = [];

  function walk(node: any) {
    if (node.type === "heading") {
      const level = node.attrs?.level || 2;
      const prefix = "#".repeat(level);
      const text = extractText(node);
      lines.push(`${prefix} ${text}`);
    } else if (node.type === "paragraph") {
      lines.push(extractText(node));
    } else if (node.type === "bulletList" || node.type === "orderedList") {
      for (const item of node.content || []) {
        lines.push(`- ${extractText(item)}`);
      }
    }
    if (node.content) {
      for (const child of node.content) {
        if (
          !["heading", "paragraph", "bulletList", "orderedList"].includes(
            child.type,
          )
        ) {
          walk(child);
        }
      }
    }
  }

  function extractText(node: any): string {
    if (node.text) return node.text;
    if (!node.content) return "";
    return node.content.map(extractText).join("");
  }

  walk(doc);
  return lines.join("\n");
}
```

### 7.4 Diff Rendering

The diff is rendered as a `DiffView` React component that maps `DiffSegment[]` to styled spans:

- Added text: `bg-green-900/30 text-green-300`
- Removed text: `bg-red-900/30 text-red-300 line-through`
- Unchanged text: `text-zinc-300`

### 7.5 Storage

The full proposed ProseMirror JSON is stored on `edit_proposals.proposed_content_json`. The diff is not stored -- it is computed on demand from the proposed content and the current page version. This avoids stale diffs if the page is updated between submission and review.

---

## 8. Reviewer Dashboard

### 8.1 Overview

The reviewer dashboard at `/admin/proposals` is a protected route accessible only to users with the `reviewer` or `admin` role. It displays all pending edit proposals and provides accept/reject/request-changes actions.

> **Supersession note (FRD 7):** The fully-implemented reviewer dashboard lives at `/admin/reviews` (FRD 7 Section 3). The `/admin/proposals` route defined here serves as a scaffolding stub only. When implementing FRD 7, redirect `/admin/proposals` → `/admin/reviews` and defer to FRD 7 for all reviewer UI and decision logic.

### 8.2 Proposal List

The list shows all proposals with `status = 'pending'` or `status = 'changes_requested'`, ordered by `submitted_at` ascending (oldest first -- FIFO review).

**List columns:**

| Column     | Content                                            |
| ---------- | -------------------------------------------------- |
| Org        | `organizations.name` (linked to the wiki page)     |
| Submitter  | Display name if attributed, "Anonymous" otherwise  |
| AI Verdict | Pass (green badge) or Fail (red badge)             |
| Submitted  | Relative time (e.g., "2 hours ago")                |
| Status     | "Pending" (yellow) or "Changes Requested" (orange) |

### 8.3 Proposal Detail

Clicking a row expands an inline detail panel showing:

1. **Inline diff:** The full diff (Section 7) between the current page and the proposed content.
2. **Contributor rationale:** The text the contributor provided.
3. **AI pre-screen reason:** The one-line reason from GPT-4o-mini.
4. **Previous reviewer comments** (if status is `changes_requested`).

### 8.4 Reviewer Actions

Three action buttons at the bottom of the detail panel:

| Action              | Behavior                                                                                                                                                                                                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Accept**          | Creates a new `page_versions` record. Updates `pages.current_version_id` and `pages.last_modified_at`. Sets `edit_proposals.status = 'accepted'` and `edit_proposals.reviewer_id`. Clears lifecycle banners. Triggers `reembedPage` from FRD 1. Clears localStorage drafts for this page (via a broadcast channel). |
| **Reject**          | Sets `edit_proposals.status = 'rejected'` and `edit_proposals.reviewer_id`. Optionally stores a rejection reason in `edit_proposals.reviewer_comment`.                                                                                                                                                              |
| **Request Changes** | Sets `edit_proposals.status = 'changes_requested'` and stores the reviewer's comment in `edit_proposals.reviewer_comment`. The contributor can revise and resubmit (future: notification triggers).                                                                                                                 |

### 8.5 Conflict of Interest Guard

The system shall:

1. Load the reviewer's `affiliated_org_ids` (stored on the `users` table or a separate `user_affiliations` table).
2. If the proposal's org matches any of the reviewer's affiliations, the Accept button is disabled with a tooltip: "You cannot approve proposals for organizations you are affiliated with."

### 8.6 Accept Flow (Server-Side)

```typescript
// src/app/api/proposals/[id]/accept/route.ts

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Verify reviewer role
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !["reviewer", "admin"].includes(profile.role)) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Fetch proposal
  const { data: proposal } = await supabase
    .from("edit_proposals")
    .select("*, pages(org_id, current_version_id)")
    .eq("id", params.id)
    .single();

  // Get current max version number
  const { data: latestVersion } = await supabase
    .from("page_versions")
    .select("version_number")
    .eq("page_id", proposal.page_id)
    .order("version_number", { ascending: false })
    .limit(1)
    .single();

  const newVersionNumber = (latestVersion?.version_number || 0) + 1;

  // Create new page version
  const { data: newVersion } = await supabase
    .from("page_versions")
    .insert({
      page_id: proposal.page_id,
      version_number: newVersionNumber,
      content_json: proposal.proposed_content_json,
      summary: proposal.rationale.slice(0, 100),
      contributor_id: proposal.contributor_id,
      is_anonymous: proposal.is_anonymous,
    })
    .select("id")
    .single();

  // Update page
  await supabase
    .from("pages")
    .update({
      current_version_id: newVersion.id,
      last_modified_at: new Date().toISOString(),
    })
    .eq("id", proposal.page_id);

  // Update proposal status
  await supabase
    .from("edit_proposals")
    .update({
      status: "accepted",
      reviewer_id: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", params.id);

  // Trigger re-embedding (FRD 1) -- async, non-blocking
  const orgMeta = await getOrgMeta(proposal.pages.org_id);
  reembedPage(proposal.page_id, orgMeta, proposal.proposed_content_json).catch(
    console.error,
  );

  return Response.json({ success: true, versionId: newVersion.id });
}
```

---

## 9. Version History

### 9.1 Overview

Each wiki page has a version history accessible via a "View History" link in the page header. The history is a chronological summary list -- it does not support reconstructing or viewing full old versions.

### 9.2 Route

`/wiki/[slug]/history`

### 9.3 Display

A vertical list of version entries, ordered by `version_number` descending (newest first):

| Field          | Source                                                                              |
| -------------- | ----------------------------------------------------------------------------------- |
| Version number | `page_versions.version_number` (e.g., "v12")                                        |
| Date           | `page_versions.created_at` (formatted as "April 5, 2026 at 2:30 PM")                |
| Summary        | `page_versions.summary` (the contributor's rationale, truncated to 100 chars)       |
| Contributor    | Display name if not anonymous, "Anonymous contributor" otherwise                    |
| AI verdict     | Badge showing the pre-screen verdict from the corresponding `edit_proposals` record |

### 9.4 Data Fetching

```typescript
// src/app/wiki/[slug]/history/page.tsx

const { data: versions } = await supabase
  .from("page_versions")
  .select(
    `
    id, version_number, summary, created_at, is_anonymous,
    contributor:users(display_name),
    edit_proposals(ai_verdict)
  `,
  )
  .eq("page_id", page.id)
  .order("version_number", { ascending: false });
```

### 9.5 No Version Reconstruction

Clicking a version entry does not navigate to a reconstructed view. The history is informational only -- it shows what changed and when, not the full content at that point. Full version reconstruction is a post-MVP feature.

---

## 10. Lifecycle Banners

### 10.1 Overview

Wiki pages that have not been updated within configurable time thresholds display a colored warning banner at the top of the page. This prevents users from relying on outdated information.

### 10.2 Threshold Configuration

Thresholds are stored in the `lifecycle_config` table and loaded at page render time:

| Category              | Needs Update (months) | Stale (months) | Potentially Defunct (months) |
| --------------------- | --------------------- | -------------- | ---------------------------- |
| Design Teams          | 9                     | 15             | 24                           |
| Engineering Clubs     | 6                     | 12             | 18                           |
| Non-Engineering Clubs | 6                     | 12             | 18                           |
| Academic Programs     | 12                    | 24             | 36                           |
| Student Societies     | 6                     | 12             | 18                           |
| Campus Organizations  | 12                    | 24             | 36                           |

### 10.3 Computation

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

### 10.4 Banner Rendering

Banners are rendered at the top of the wiki page content area, below the page header and above the three-column layout:

| Status                | Color                                         | Message                                                                                |
| --------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------- |
| `needs_update`        | Yellow (`bg-yellow-900/30 border-yellow-600`) | "This page hasn't been updated in a while. Information may be outdated."               |
| `stale`               | Orange (`bg-orange-900/30 border-orange-600`) | "This page is stale. The information here may no longer be accurate."                  |
| `potentially_defunct` | Red (`bg-red-900/30 border-red-600`)          | "This organization may be defunct. This page has not been updated in over [N] months." |

Each banner includes a "Propose Edit" link to encourage contribution.

### 10.5 Health Status in Pulse Sidebar

The Health Status metric in the Pulse infobox mirrors the computed lifecycle status:

- `active`: Green dot + "Active"
- `needs_update`: Yellow dot + "Needs Update"
- `stale`: Orange dot + "Stale"
- `potentially_defunct`: Red dot + "Potentially Defunct"

### 10.6 Reset on Accept

When a PR is accepted (Section 8.6), `pages.last_modified_at` is updated to `now()`. The next page load computes the status as `active`, and no banner is shown.

---

## 11. Page Claiming

### 11.1 Overview

Organizations can claim their wiki page to establish an official presence. Claiming adds a "Claimed" badge to the page header and enables an "Official" section.

### 11.2 Claim Request Flow

1. A "Claim This Page" button is visible on all unclaimed pages (below the Pulse sidebar).
2. Clicking the button navigates to a claim request form with fields: requester name, email, role in org, and a short justification.
3. The form submits to `POST /api/claims` and creates a row in a `claim_requests` table (status: `pending`).
4. An admin reviews the claim at `/admin/claims` and approves or rejects it.
5. On approval, `organizations.claimed_by` is set to the requester's user ID and `organizations.claimed_at` is set to now.

### 11.3 Official Section

On claimed pages, an "Official" section is rendered after the Overview section. It is stored as a separate field on the `organizations` table: `official_content_json` (ProseMirror JSON). Edits to the Official section go through the standard PR pipeline -- the submitter's org affiliation is noted on the PR, and the same editorial review applies.

### 11.4 Visual Treatment

The Official section has:

- A gold left border: `border-l-4 border-[#FEC93B]`
- A header label: "Official -- submitted by [org name]" in gold text
- A subtle surface background: `bg-[#141414]` (elevated surface)

---

## 12. Database Schema Additions

The following columns or tables are needed beyond the FRD 0 baseline:

### 12.1 Column Additions

```sql
-- organizations table
ALTER TABLE organizations ADD COLUMN tagline TEXT;
ALTER TABLE organizations ADD COLUMN official_content_json JSONB;

-- edit_proposals table
ALTER TABLE edit_proposals ADD COLUMN is_anonymous BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE edit_proposals ADD COLUMN reviewer_comment TEXT;
ALTER TABLE edit_proposals ADD COLUMN contributor_id UUID REFERENCES users(id);

-- page_versions table
ALTER TABLE page_versions ADD COLUMN is_anonymous BOOLEAN NOT NULL DEFAULT true;
```

### 12.2 New Tables

```sql
CREATE TABLE claim_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  requester_id UUID REFERENCES users(id),
  requester_name TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  requester_role TEXT NOT NULL,
  justification TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  decision_reason TEXT,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_affiliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  org_id UUID NOT NULL REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, org_id)
);
```

### 12.3 Indexes

```sql
CREATE INDEX idx_edit_proposals_status ON edit_proposals (status);
CREATE INDEX idx_edit_proposals_page_id ON edit_proposals (page_id);
CREATE INDEX idx_claim_requests_status ON claim_requests (status);
CREATE INDEX idx_claim_requests_org_id ON claim_requests (org_id);
CREATE INDEX idx_user_affiliations_user_id ON user_affiliations (user_id);
```

---

## 13. API Routes

| Route                                 | Method | Auth     | Purpose                                      |
| ------------------------------------- | ------ | -------- | -------------------------------------------- |
| `/api/proposals`                      | POST   | Required | Submit an edit proposal                      |
| `/api/proposals/[id]`                 | GET    | None     | Get proposal status (for polling AI verdict) |
| `/api/proposals/[id]/accept`          | POST   | Reviewer | Accept a proposal                            |
| `/api/proposals/[id]/reject`          | POST   | Reviewer | Reject a proposal                            |
| `/api/proposals/[id]/request-changes` | POST   | Reviewer | Request changes with comment                 |
| `/api/pulse/vote`                     | POST   | None     | Submit a Pulse rating                        |
| `/api/claims`                         | POST   | Required | Submit a claim request                       |
| `/api/claims/[id]/approve`            | POST   | Admin    | Approve a claim                              |
| `/api/claims/[id]/reject`             | POST   | Admin    | Reject a claim (body: `{ decision_reason: string }`) |

---

## 14. Non-Functional Requirements

| Requirement               | Target                                                                        |
| ------------------------- | ----------------------------------------------------------------------------- |
| **Wiki page load (SSR)**  | < 2 seconds for full server-rendered page                                     |
| **Editor initialization** | < 1 second from "Propose Edit" click to editable state                        |
| **Diff generation**       | < 500ms for typical page-length documents                                     |
| **AI pre-screen latency** | < 5 seconds (async, does not block submission)                                |
| **Image upload**          | < 3 seconds for a 2MB image                                                   |
| **Directory page load**   | < 1 second (all orgs fetched in one query)                                    |
| **SEO**                   | All wiki pages server-side rendered with og:title and og:description          |
| **Accessibility**         | WCAG 2.1 AA: keyboard navigation, screen reader labels, color contrast ratios |

---

## 15. Exit Criteria

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
| 9   | Pulse rate limiting prevents duplicate votes                 | Attempt to vote twice in the same session and verify the second is rejected                                            |
| 10  | "Propose Edit" transforms page into inline editor            | Click the button and verify the Tiptap toolbar appears and content becomes editable                                    |
| 11  | All Tiptap extensions work                                   | Test headings, bold, lists, links, images, tables, code blocks, blockquotes, dividers                                  |
| 12  | Image upload works via paste, drag-drop, and toolbar         | Upload an image via each method and verify it appears in the editor                                                    |
| 13  | Autosave to localStorage works                               | Edit content, navigate away, return, and verify the draft recovery banner appears                                      |
| 14  | Submission dialog shows diff and preview tabs                | Click "Submit Proposal" and verify both tabs render correctly                                                          |
| 15  | Auth modal appears for unauthenticated users on submit       | Attempt to submit without signing in and verify the auth modal                                                         |
| 16  | AI pre-screen returns a verdict                              | Submit a proposal and verify a pass/fail badge appears on the confirmation page                                        |
| 17  | Reviewer dashboard lists pending proposals                   | Sign in as a reviewer, visit `/admin/reviews` (FRD 7; `/admin/proposals` stub redirects there), and verify pending PRs appear |
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

## Appendix C: AI Pre-Screener Prompt Template

```
You are an editorial pre-screener for UW Wiki, a student-driven knowledge base about University of Waterloo clubs, design teams, and programs.

Evaluate the following proposed edit against UW Wiki's editorial values and return a verdict.

## Editorial Values

1. The SLC Test: Content should be what you'd say if a student stopped you in SLC and asked. Nothing more extreme, nothing less honest.
2. No Harm: Opinions are valid, but defamation, identifying individuals negatively by name, or unverifiable accusations are not.
3. Honest, Not Unhinged: Student-journalism tone. Candid and grounded, not a press release or a rant.
4. Credible: Should be believable as a student experience, not an axe-grind or PR campaign.
5. Specific Over Vague: Specific numbers beat vague impressions. "8-10 hours a week" beats "a lot of time."

## Context

Organization: {{ORG_NAME}} ({{CATEGORY}})
Contributor's rationale: {{RATIONALE}}

## Proposed Changes (Diff)

{{DIFF}}

## Instructions

Return a JSON object with:
- "verdict": "pass" if the edit broadly aligns with editorial values, "fail" if it clearly violates one or more values.
- "reason": A single sentence (max 100 characters) explaining your verdict.

Be lenient. Minor tone issues are a "pass" with a note. Only "fail" clear violations: marketing fluff, defamation, rants without substance, or completely vague content.
```

---

## Appendix D: Org Card Component Spec

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
| **Auth gated at submit, not at edit**                           | Letting users invest effort before asking for auth dramatically increases completion rates. The sunk-cost effect works in the platform's favor. Users who have already written content are far more likely to create an account than those stopped at the door.                 |
| **GPT-4o-mini for pre-screening over Gemini Flash**             | The pre-screener is a simple classification task (pass/fail against 5 criteria). GPT-4o-mini is the cheapest model that reliably produces structured JSON output. Gemini Flash would work but GPT-4o-mini's structured output support (JSON mode) is more reliable.             |
| **Inline diff over side-by-side diff**                          | Inline diff takes less horizontal space (important in the three-column layout and the reviewer dashboard). Side-by-side requires duplicating the full page content. The diff library produces clean inline output.                                                              |
| **Three actions (Accept/Reject/Request Changes) over binary**   | Request Changes enables a conversation between reviewer and contributor without rejecting the PR entirely. This encourages iteration and keeps contributors engaged rather than discouraging them with outright rejections.                                                     |
| **Summary-only version history over full reconstruction**       | Full version reconstruction requires replaying diffs or storing full content snapshots for every version. At launch, the version history is primarily for transparency ("who changed what when"), not for restoring old content. Keeps the implementation simple.               |
| **Lifecycle status computed on load, not stored**               | Avoids a cron job or scheduled function to update status fields. The computation is trivial (date comparison) and runs server-side during SSR. No stale data risk.                                                                                                              |
| **TOC in left column over sidebar/top-of-page**                 | Left-column TOC is a well-understood pattern (MDN, Tailwind docs, Stripe docs). It stays visible while scrolling without occupying the content area. Combined with the Pulse sidebar on the right, it creates a natural three-column layout that uses screen width effectively. |
| **All sections expanded over collapsible**                      | Wiki pages are meant to be scanned and searched. Collapsed sections hide content from both users and search engines. The TOC provides navigation without requiring collapse/expand interaction.                                                                                 |
| **Pulse voting with session fingerprint over account-required** | Requiring an account for voting adds too much friction for a low-stakes action. Session fingerprinting prevents casual ballot-stuffing while keeping the barrier to contribution zero. Determined abuse is handled by the editorial board monitoring aggregates.                |
| **Categories as sections on one page over separate routes**     | At launch scale (<50 orgs, 6 categories), a single scrollable page is faster to browse than navigating between 6 separate pages. The filter bar provides instant refinement. Separate category pages can be added later if the directory grows.                                 |
