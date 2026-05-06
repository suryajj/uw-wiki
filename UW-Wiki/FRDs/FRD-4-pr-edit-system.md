# Feature Requirements Document: FRD 4 -- PR-Edit System (Section-Scoped) (v1.1)

| Field               | Value                                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Project**         | UW Wiki                                                                                                                                                            |
| **Parent Document** | [PRD v0.1](../PRD.md)                                                                                                                                              |
| **FRD Order**       | [FRD Order](../FRD-order.md)                                                                                                                                       |
| **PRD Sections**    | 6.3 (Wiki Pages and Version Control), 6.4 (PR-Style Edit Proposals), 7 (Editorial Model and Trust), 8 (Platform Editorial Values), 9 (Identity and Authentication) |
| **Type**            | Core workflow feature                                                                                                                                              |
| **Depends On**      | FRD 0, FRD 1, FRD 2, FRD 3                                                                                                                                         |
| **Delivers**        | Multi-section-scoped edit proposals, reviewer decision workflow, per-section conflict-safe merge, patchset revisions, conflict-of-interest enforcement |
| **Created**         | 2026-04-06                                                                                                                                                         |
| **Updated**         | 2026-04-07 -- v1.1: Upgraded from single-section to multi-section selection (contributors can include one or more sections in one proposal)                        |

---

## Summary

FRD 4 defines the PR-Edit system as a **section-scoped proposal workflow** where contributors select one or more sections to edit in a single proposal. This gives contributors the flexibility to make related changes across multiple sections (e.g., updating both "Time Commitment" and "Culture and Vibe" together) while preserving clean, per-section diffs for reviewers. Every section in a proposal is reviewed independently, but accepted atomically as a single version change.

The system includes deterministic per-section mergeability checks (a proposal is only mergeable if every selected section is unchanged since the base version), patchset-based resubmission for stale proposals, and a disclosure-only conflict-of-interest model: affiliated reviewers see a yellow banner on proposals for their orgs, but all decision actions remain available. Affiliation is captured in the audit log at decision time.

---

## Supersession and Overlap Resolution

This FRD resolves overlap with existing docs as follows:

1. FRD 2 remains the source of truth for page rendering, directory, editor primitives, lifecycle banners, and page claiming visuals.
2. FRD 4 becomes the source of truth for PR proposal lifecycle and reviewer decisions.
3. FRD 2 sections related to broad/full-page PR workflow are superseded by this FRD for implementation purposes.

Superseded areas in FRD 2 (implementation replaced by FRD 4):

1. PR submission flow details (FRD 2 Section 5)
2. Diff generation for proposal review (FRD 2 Section 6)
3. Reviewer decision semantics and accept flow specifics (FRD 2 Section 7)
4. Proposal-related API routes in FRD 2 Section 12

---

## Given Context (Preconditions)

| Prerequisite                                                                               | Source FRD |
| ------------------------------------------------------------------------------------------ | ---------- |
| Next.js 15 App Router app with Supabase clients                                            | FRD 0      |
| Baseline schema (`pages`, `page_versions`, `edit_proposals`, `users`, `user_affiliations`) | FRD 0      |
| RAG re-embedding pipeline and `reembedPage` integration points                             | FRD 1      |
| Wiki page rendering and section TOC model                                                  | FRD 2      |
| Comment re-anchoring behavior across accepted edits                                        | FRD 3      |

### Terms

| Term                     | Definition                                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Section-scoped proposal  | A proposal that targets one or more sections (H2 scope, including nested H3 content per selected H2)           |
| Selected sections        | The set of H2 sections a contributor has chosen to include in one proposal (minimum 1, maximum all sections)   |
| Base version             | The `page_versions.id` that the contributor edited against -- all selected sections must share the same base   |
| Section diff             | The per-section change record stored inside a patchset: original JSON, proposed JSON, computed diff            |
| Patchset                 | A new revision of the same proposal after requested changes or rebase                                           |
| Mergeability             | Whether all selected sections can be safely applied to the current page version                                 |
| Needs rebase             | Proposal cannot be accepted because at least one selected section changed since base version                    |
| Non-uploader approval    | Reviewer approving a proposal must not be the proposal author                                                   |

---

## Executive Summary (Gherkin-Style)

```gherkin
Feature: Section-scoped PR edit proposals (multi-section)

  Background:
    Given FRD 0-3 are complete
    And wiki pages render with stable section slugs

  Scenario: User proposes an edit to one section
    When a user clicks "Propose Edit" on the "Time Commitment" section
    Then the editor opens scoped to that section only
    And the user edits section content and adds rationale
    And the proposal is submitted with base_page_version_id and section_slugs

  Scenario: User proposes edits to multiple sections
    When a user opens the multi-section editor
    And selects "Time Commitment" and "Culture and Vibe"
    Then both sections are editable in a tabbed editor
    And the proposal is submitted with both section_slugs in a single PR
    And the reviewer sees a per-section diff card for each selected section

  Scenario: Reviewer makes final decision
    Given a proposal is pending review
    When a reviewer checks the per-section diffs and rationale
    Then the reviewer can accept or reject the whole proposal

  Scenario: Conflict-of-interest disclosure
    Given reviewer is affiliated with the target organization
    When reviewer opens a proposal for that organization
    Then a yellow disclosure banner is shown
    And all three decision actions (accept, reject, request changes) remain enabled
    And the affiliation status is captured in the audit log at decision time

  Scenario: One section becomes stale (out of several)
    Given a multi-section proposal is pending
    And one of its target sections changed since base version
    When reviewer attempts to accept
    Then the whole proposal status becomes needs_rebase
    And contributor must rebase all sections against the new page version

  Scenario: Accepted proposal updates page version
    When reviewer accepts a mergeable proposal
    Then system replaces all selected sections in the page content
    And creates a single new page version
    And updates pages.current_version_id
    And triggers FRD 1 re-embedding
    And triggers FRD 3 comment re-anchoring checks
```

---

## Table of Contents

1. [1. Workflow Scope and UX](#1-workflow-scope-and-ux)
2. [2. Proposal Lifecycle](#2-proposal-lifecycle)
3. [3. Data Model and Migrations](#3-data-model-and-migrations)
4. [4. Diff and Mergeability Engine](#4-diff-and-mergeability-engine)
5. [5. Reviewer Experience and Policy Enforcement](#5-reviewer-experience-and-policy-enforcement)
6. [6. Accept and Reject Pipelines](#6-accept-and-reject-pipelines)
7. [7. API Contracts](#7-api-contracts)
8. [8. Security, Abuse, and Auditability](#8-security-abuse-and-auditability)
9. [9. Non-Functional Requirements](#9-non-functional-requirements)
10. [10. Exit Criteria](#10-exit-criteria)
12. [Appendix A: Status State Machine](#appendix-a-status-state-machine)
13. [Appendix B: Schema SQL](#appendix-b-schema-sql)
14. [Appendix C: Design Decisions Log](#appendix-c-design-decisions-log)

---

## 1. Workflow Scope and UX

### 1.1 Section-Scoped Editing with Multi-Section Selection

The PR-Edit workflow is section-scoped. Contributors select one or more H2 sections to edit in a single proposal.

Rules:

1. A proposal targets one or more section slugs (H2 scope).
2. Nested H3 content under each selected H2 is included in scope.
3. Contributors cannot edit content outside their selected sections in a single proposal.
4. All selected sections must share the same `base_page_version_id` -- the contributor cannot edit one section from an older version and another from a newer version.
5. There is no hard cap on the number of sections per proposal, but the UI presents all H2 sections as checkboxes so the natural maximum is the number of H2 sections on the page (typically 7 for the standard template).

### 1.2 Entry Points

Contributors can initiate a proposal from:

1. **Single-section entry:** `Propose Edit` button next to any H2 section heading. Opens the editor with that section pre-selected.
2. **Multi-section entry:** `Propose Multi-Section Edit` in the page action menu (top of content area). Opens the section selection UI where contributors check which sections to include.
3. **Overflow menu in section TOC:** Same single-section entry as (1).
4. **Keyboard shortcut while focused in section (`e`):** Opens single-section editor for the focused section.

### 1.3 Section Selection UI (Multi-Section Entry)

When a contributor opens the multi-section editor, the system shows a checklist of all H2 sections on the page:

```
Select sections to edit:

☐ Overview
☑ Time Commitment          ← checked
☑ Culture and Vibe         ← checked
☐ Subteams and Roles
☐ Past Projects
☐ Exec History
☐ How to Apply

[ Continue to Editor → ]
```

Rules:
1. At least one section must be selected before continuing.
2. Selected sections are stored as `section_slugs: string[]` on the proposal.
3. After selection, the editor opens all selected sections in a **tabbed layout** -- one tab per section.

### 1.4 Section Editor (Tabbed Layout for Multi-Section)

When editing multiple sections, the editor presents:

1. **Section tabs** at the top: one tab per selected section (e.g., "Time Commitment", "Culture and Vibe"). The active tab is highlighted in gold.
2. For the active tab:
   - Original section content (read-only snapshot on the left or in a toggleable panel).
   - Editable proposed section content.
   - Live diff indicator (badge showing added/removed word count).
3. **Rationale field** (single, shared across all selected sections) below the tabbed editor area.
4. **Attribution toggle** — only shown when the user is signed in. Defaults to "Anonymous." If the user is not signed in, no toggle is shown and the proposal is always submitted as "Anonymous" (`contributor_id = NULL`).
5. **Submit Proposal** button — submits all edited sections as one proposal. No authentication is required to submit; anonymous submissions are accepted.

**Anonymous submit nudge**: When an unauthenticated user clicks "Submit Proposal," a soft modal is shown before the submission is sent:

```
┌────────────────────────────────────────────────┐
│  Submit anonymously?                            │
│                                                 │
│  You're about to submit without an account.     │
│  Note: anonymous proposals can't be revised —  │
│  if a reviewer asks for changes, the proposal  │
│  would need to be resubmitted as a new one.    │
│                                                 │
│  [Submit Anonymously]    [Sign In to Attribute] │
└────────────────────────────────────────────────┘
```

- "Submit Anonymously" proceeds immediately with `contributor_id = NULL`.
- "Sign In to Attribute" opens the AuthModal without losing draft content.
- The modal is shown once per submission attempt; no repeat gate on the same session.

For single-section proposals, the tab bar is hidden and the layout is the same as before.

### 1.5 Rationale and Validation

Rationale constraints:

1. Required (one rationale per proposal, covering all selected sections).
2. Minimum 20 characters.
3. Maximum 500 characters.
4. Must not be whitespace-only.

Submission constraints:

1. Auth optional; anonymous submissions allowed (see §8.1).
2. Proposal requires current `base_page_version_id`.
3. Proposal requires `section_slugs` (array, minimum length 1) and a `base_section_hash` per section.

### 1.6 Official Section Guard and Seeding Paths

The Official section is an H2 section stored inline in `pages.content_json` with `attrs.official: true` on its heading node (see FRD-2 §10.2). The proposal submission route detects it by inspecting the `official` attribute of each selected section's H2 node.

**Affiliation guard** (PR path):

1. Only users affiliated with the org (or reviewer/admin) may submit proposals to that section.
2. Non-affiliated users receive a policy error and cannot submit a proposal that includes the Official section.
3. Non-affiliated users can still propose edits to non-Official sections on the same page in a separate proposal.

**Two seeding paths for Official content** (per FRD-2 §10.2):

1. **Affiliated user PR**: An affiliated user includes a new H2 with `attrs.official: true` in their PR. After reviewer acceptance via the standard pipeline, the Official section is live. The accept pipeline (§6.1) preserves `attrs.official` values on existing H2s and inserts the new one.
2. **Admin direct seed**: An admin uses the Official Section seeder in FRD-7 §4. This bypasses the PR pipeline entirely, inserting the section and producing a `page_versions` row with `is_admin_seeded: true`. FRD-1 re-embedding and FRD-3 anchor updates fire as usual.

In both cases, once an Official section exists, subsequent PRs targeting it are subject to the affiliation guard above.

---

## 2. Proposal Lifecycle

### 2.1 Statuses

`edit_proposals.status` values:

1. `pending`
2. `changes_requested`
3. `needs_rebase`
4. `accepted`
5. `rejected`
6. `withdrawn`

### 2.2 Patchset Model

A proposal can have multiple patchsets, inspired by change revision workflows:

1. Patchset 1 created at initial submission.
2. If proposal becomes `needs_rebase`, contributor can submit patchset `n+1`.
3. Only one patchset is `is_current = true`.
4. Reviewer decisions always apply to current patchset.

### 2.3 Lifecycle Rules

1. Proposal starts as `pending`.
2. Accept/reject transitions proposal to terminal status.
3. If page/section drift is detected pre-accept, proposal becomes `needs_rebase`.
4. `changes_requested` is a non-terminal reviewer action; contributor may respond with a new patchset.
5. Contributor may withdraw while `pending`, `changes_requested`, or `needs_rebase`.

### 2.4 Marking Competing Proposals Stale

On acceptance:

1. Other `pending` or `changes_requested` proposals on the same page that share **any** section slug with the accepted proposal are marked `needs_rebase` — their base content has shifted under them.
2. Contributors of affected proposals receive a notification to rebase against the latest page version.
3. Proposals that target entirely non-overlapping sections are not affected.

---

## 3. Data Model and Migrations

### 3.1 `edit_proposals` Extensions

The key change from a single `section_slug` to `section_slugs TEXT[]` captures multi-section proposals. Per-section hashes and content live in the patchset's `section_diffs` JSONB array.

```sql
ALTER TABLE edit_proposals
  ADD COLUMN section_slugs TEXT[] NOT NULL,
  ADD COLUMN base_page_version_id UUID NOT NULL REFERENCES page_versions(id),
  ADD COLUMN current_patchset_number INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN mergeability_status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (mergeability_status IN ('unknown','mergeable','needs_rebase','conflict'));
```

> **Amendment (FRD 7 + FRD 4 reconciliation):** The `edit_proposals.status` column must accept `'changes_requested'` (added by FRD 7) and does **not** include `'superseded'` (collapsed into `needs_rebase` during FRD-4 reconciliation). Apply to the baseline migration:
> ```sql
> ALTER TABLE edit_proposals DROP CONSTRAINT IF EXISTS edit_proposals_status_check;
> ALTER TABLE edit_proposals ADD CONSTRAINT edit_proposals_status_check
>   CHECK (status IN ('pending','changes_requested','needs_rebase','accepted','rejected','withdrawn'));
> ```

`section_slugs` must contain at least one element. The overall `mergeability_status` is `mergeable` only when every section in `section_slugs` passes its individual mergeability check (see Section 4.3).

### 3.2 Patchset Table

Per-section data (original content, proposed content, diff, hash) is stored as a JSONB array in `section_diffs`. This keeps the schema flat while naturally supporting any number of sections per patchset.

```sql
CREATE TABLE edit_proposal_patchsets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES edit_proposals(id) ON DELETE CASCADE,
  patchset_number INTEGER NOT NULL,
  base_page_version_id UUID NOT NULL REFERENCES page_versions(id),
  -- section_diffs is a JSONB array with one element per selected section:
  -- [
  --   {
  --     "section_slug": "time-commitment",
  --     "base_section_hash": "abc123",
  --     "original_section_json": {...},
  --     "proposed_section_json": {...},
  --     "diff_json": {...},
  --     "mergeability_status": "mergeable" | "needs_rebase" | "conflict" | "unknown"
  --   },
  --   { ... }
  -- ]
  section_diffs JSONB NOT NULL,
  rationale TEXT NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT true,
  contributor_id UUID REFERENCES users(id),  -- NULL for anonymous patchset 1; patchset_number > 1 requires auth (enforced in application logic)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proposal_id, patchset_number)
);

CREATE UNIQUE INDEX idx_edit_proposal_patchsets_current
  ON edit_proposal_patchsets (proposal_id)
  WHERE is_current = true;
```

### 3.3 Integrity Constraints

1. `edit_proposals.contributor_id` must equal current patchset `contributor_id`.
2. `section_slugs` must have at least 1 element.
3. `section_diffs` array length must equal `section_slugs` array length.
4. `section_diffs[*].section_slug` values must match `section_slugs` exactly.
5. Patchset numbers must be monotonic.
6. `accepted` and `rejected` are terminal.
7. Accept operation requires current patchset to be `is_current = true`.
8. When a new patchset with `patchset_number = N+1` is inserted, the prior patchset (`N`) must be set `is_current = false` in the same transaction.

### 3.4 Performance Indexes

```sql
CREATE INDEX idx_edit_proposals_status_created
  ON edit_proposals (status, submitted_at);

CREATE INDEX idx_edit_proposals_page_sections
  ON edit_proposals USING GIN (section_slugs);

CREATE INDEX idx_edit_proposals_base_version
  ON edit_proposals (base_page_version_id);
```

---

## 4. Diff and Mergeability Engine

### 4.1 Diff Representation

Each section diff is generated from ProseMirror JSON using `prosemirror-changeset`.

Rationale:

1. Structured insert/delete ranges are more reliable than plain text for editor-originated content.
2. `simplifyChanges` improves readability by expanding word-boundary edits for display.

### 4.2 Section Extraction

Given a page `content_json`, extract a section by H2 slug:

1. Traverse ProseMirror doc.
2. Identify H2 node with matching slug.
3. Include all nodes until next H2.
4. Serialize to `section_json`.
5. Compute normalized hash for mergeability checks.

For a multi-section proposal, this extraction runs once per selected section.

### 4.3 Mergeability Algorithm

**Per-section check** (runs for each element in `section_diffs`):

At accept time, for each section in the proposal:

1. Load the section diff entry from the current patchset.
2. Load page current version content.
3. Extract the current section by `section_slug`.
4. Compute current section hash.
5. Compare with `section_diffs[i].base_section_hash`.

Per-section outcomes:

| Outcome        | Condition                          |
| -------------- | ---------------------------------- |
| `mergeable`    | Hash matches                       |
| `needs_rebase` | Hash differs (section was changed) |
| `conflict`     | Section no longer exists on page   |

**Overall proposal mergeability** (stored on `edit_proposals.mergeability_status`):

| Overall Status | Condition                                               |
| -------------- | ------------------------------------------------------- |
| `mergeable`    | All sections are `mergeable`                            |
| `needs_rebase` | At least one section is `needs_rebase` or `conflict`   |
| `conflict`     | All sections are `conflict` (entire page rewritten)     |

A proposal can only be accepted when overall `mergeability_status = 'mergeable'`.

Per-section statuses are written back to `section_diffs[i].mergeability_status` for display in the reviewer UI (so reviewers can see which specific sections have drifted).

### 4.4 Rebase Flow

If `needs_rebase`:

1. Proposal cannot be accepted.
2. Contributor opens rebase UI showing all sections -- each with its current live content alongside the contributor's previously proposed content.
3. Contributor updates each stale section against the new version.
4. Contributor submits new patchset with all sections rebased against the updated `base_page_version_id`.
5. Proposal returns to `pending`.

A contributor is not required to re-edit sections that are still mergeable -- only the drifted sections need updating. However, all sections must be re-submitted together in the new patchset (no partial patchset updates).

### 4.5 Rendering Rules

Diff view for reviewers must show:

1. **Per-section diff cards:** one card per section in the proposal, labeled with the section heading.
2. Within each card: added text (green), removed text (red + strikethrough), unchanged context.
3. **Mergeability badge** on each card: `mergeable` (green), `needs_rebase` (amber), `conflict` (red).
4. Sections are displayed in the order they appear on the page (top to bottom), not in the order the contributor selected them.

### 4.6 When Mergeability Runs

Mergeability is checked at three distinct points:

1. **On proposal/patchset submission** — initial check run server-side before storing the patchset; sets `mergeability_status` for immediate badge display in the queue.
2. **On any accepted page version that touches an overlapping section** — background recompute for all proposals sharing any section slug with the just-accepted proposal; keeps queue badges current without polling.
3. **At accept-time inside the row lock** — final authoritative check (Section 6.1 step 4). This is the only check that can block the accept transaction. Steps 1 and 2 are best-effort optimizations.

### 4.7 Section Slug Stability

Section slugs are stable identifiers: generated once when a section is first authored (or on initial page creation) and persisted as a `slug` attribute on the H2 node in the ProseMirror JSON. If an H2 heading's display text is later changed, its slug does **not** change — the slug is decoupled from the visible heading text after creation.

Normalization rules (applied only at slug creation time):

1. Lowercase the heading text.
2. Replace spaces and non-alphanumeric characters with hyphens.
3. Collapse consecutive hyphens to one.
4. Trim leading and trailing hyphens.
5. On collision within the same page, append `-2`, `-3`, etc.

The mergeability hash model (Section 4.3) depends on slugs remaining stable; a slug change would invalidate all existing base section hashes for that section.

---

## 5. Reviewer Experience and Policy Enforcement

### 5.1 Reviewer Queue

Queue columns:

1. Organization
2. Page
3. Sections (comma-separated list of section headings, e.g. "Time Commitment, Culture and Vibe")
4. Contributor (or Anonymous)
5. Overall mergeability badge
6. Submitted timestamp

Default sorting:

1. `pending` first
2. oldest first (FIFO)

### 5.2 Final Decision Rules

Only reviewer/admin can decide. Decision options:

1. `accept`
2. `reject`
3. `request-changes` (non-terminal; see §6.3)

### 5.3 Conflict-of-Interest Policy (Disclosure-Only)

COI is now disclosure-only. No decision action is blocked for affiliated reviewers.

Hard checks before any decision action (accept, reject, or request changes):

1. Reviewer cannot act on their own proposal.
2. If the reviewer is affiliated with the target org (via `user_affiliations`): a yellow disclosure banner is shown on the proposal detail page — "You are affiliated with this organization. Your decision on this proposal will be logged with your affiliation status." All three action buttons (Accept, Reject, Request Changes) remain **enabled**.
3. Reviewer cannot accept if proposal status is not `pending`.
4. Reviewer cannot accept if mergeability is not `mergeable`.

The affiliation status at the moment of decision is captured in the `admin_activity_log` payload (see §5.4 below).

### 5.4 Reviewer Audit Fields

On decision, record:

1. `reviewer_id`
2. `reviewed_at`
3. `reviewer_comment` (required for reject)
4. `is_reviewer_affiliated` boolean in the `admin_activity_log` metadata payload — set by checking `user_affiliations` at decision time

---

## 6. Accept and Reject Pipelines

### 6.1 Accept Pipeline (Transactional)

Server algorithm:

1. Start DB transaction.
2. Lock target page row (`FOR UPDATE`).
3. Validate reviewer role and policy constraints.
4. Re-run mergeability check for **each section** in `section_diffs` against latest version.
5. If any section is `needs_rebase` or `conflict`, abort and set `mergeability_status = needs_rebase` on the proposal.
6. For each section in `section_diffs`, replace that section in the full page content with the proposed section JSON. The `official: true` attribute on the H2 heading node is preserved from the existing page content — contributors cannot grant or remove it via the proposal content.
7. Insert single new `page_versions` row with the fully updated `content_json`.
8. Update `pages.current_version_id` and `pages.last_modified_at`.
9. Mark proposal as `accepted`.
10. Mark competing `pending` and `changes_requested` proposals that share any section slug as `needs_rebase`.
11. Commit transaction.

Post-commit async jobs:

1. `reembedSections(pageId, sectionSlugs, orgMeta, newContent)` (FRD 1 §3.3) — re-embeds only the changed sections, not the full page.
2. `updateAnchorStatusForPage(pageId, newContentJson)` (FRD 3) — checks all page comments against the merged content for anchor drift.
3. Clear lifecycle staleness banner per FRD 2 §9.6 (page is no longer stale after accept).
4. `emitNotification({ userId: proposal.contributor_id, type: 'pr.accepted', payload: { proposal_id, page_slug, org_name } })` (FRD 9 §3.1). Skip if `contributor_id = NULL` (anonymous PR).
5. For each competing proposal marked `needs_rebase` (step 10): `emitNotification({ userId: competing.contributor_id, type: 'pr.needs_rebase', ... })` (FRD 9 §3.1). Skip if anonymous.

### 6.2 Reject Pipeline

1. Validate reviewer role and policy.
2. Require reviewer comment (minimum 10 chars).
3. Mark proposal `rejected`.
4. Preserve patchsets for audit history.
5. `emitNotification({ userId: proposal.contributor_id, type: 'pr.rejected', payload: { proposal_id, page_slug, org_name, reviewer_comment } })` (FRD 9 §3.1). Skip if anonymous.

### 6.3 Request Changes Pipeline

When a reviewer wants to keep the proposal open but requires revisions:

1. Validate reviewer role (`requireReviewer()`).
2. Confirm proposal status is `pending`. If not, return `INVALID_STATE`.
3. Validate input: `message` (10–2000 chars, required) + optional `section_suggestions` array.
4. Insert row into `proposal_review_comments` (per FRD 7 Section 3.2).
5. Update `edit_proposals.status = 'changes_requested'`, set `reviewer_id = currentUser.id`, `reviewed_at = now()`.
6. Do **not** mark competing proposals as `needs_rebase` — the proposal is not yet accepted; no page version has changed.
7. Write `admin_activity_log` row (action = `request_changes`, with `is_reviewer_affiliated` in payload).
8. `emitNotification({ userId: proposal.contributor_id, type: 'pr.changes_requested', payload: { proposal_id, page_slug, org_name, reviewer_message: message } })` (FRD 9 §3.1). Skip if anonymous.

The contributor sees the reviewer's `message` and optional per-section `suggestions` on their proposal detail page. Submitting a new patchset transitions the proposal back to `pending` and returns it to the reviewer queue.

### 6.4 Failure Handling

If accept fails after lock due to drift:

1. Set `mergeability_status = needs_rebase`.
2. Set proposal status `needs_rebase`.
3. Return structured error to reviewer UI.

---

## 7. API Contracts

### 7.1 Contributor Routes

| Route                           | Method | Auth                            | Purpose                                   |
| ------------------------------- | ------ | ------------------------------- | ----------------------------------------- |
| `/api/proposals`                | POST   | Optional (anonymous allowed)    | Create section proposal (patchset 1)      |
| `/api/proposals/[id]`           | GET    | Required (owner/reviewer/admin) | Get proposal detail + current patchset    |
| `/api/proposals/[id]/patchsets` | POST   | Required (owner)                | Submit rebased patchset                   |
| `/api/proposals/[id]/withdraw`  | POST   | Required (owner)                | Withdraw pending or needs_rebase proposal |

### 7.2 Reviewer Routes

| Route                                  | Method | Auth           | Purpose                                   |
| -------------------------------------- | ------ | -------------- | ----------------------------------------- |
| `/api/admin/proposals`                 | GET    | Reviewer/Admin | Queue listing with filters                |
| `/api/proposals/[id]/accept`           | POST   | Reviewer/Admin | Accept proposal                           |
| `/api/proposals/[id]/reject`           | POST   | Reviewer/Admin | Reject proposal                           |
| `/api/proposals/[id]/request-changes`  | POST   | Reviewer/Admin | Request changes (non-terminal decision)   |
| `/api/proposals/[id]/mergeability`     | POST   | Reviewer/Admin | Force refresh mergeability                |

### 7.3 Request Payload: Create Proposal

```typescript
interface SectionDiffInput {
  sectionSlug: string;
  baseSectionHash: string;
  proposedSectionJson: Record<string, unknown>;
}

interface CreateSectionProposalRequest {
  pageId: string;
  sectionSlugs: string[];               // minimum length 1
  basePageVersionId: string;
  sectionDiffs: SectionDiffInput[];     // one entry per sectionSlugs element
  rationale: string;
  isAnonymous: boolean;
}
```

### 7.4 Response Payload: Proposal Detail

```typescript
interface PerSectionDiff {
  sectionSlug: string;
  baseSectionHash: string;
  diffJson: unknown;
  mergeabilityStatus: "unknown" | "mergeable" | "needs_rebase" | "conflict";
}

interface SectionProposalDetail {
  id: string;
  pageId: string;
  orgId: string;
  sectionSlugs: string[];
  status:
    | "pending"
    | "changes_requested"
    | "needs_rebase"
    | "accepted"
    | "rejected"
    | "withdrawn";
  mergeabilityStatus: "unknown" | "mergeable" | "needs_rebase" | "conflict";
  currentPatchsetNumber: number;
  currentPatchset: {
    patchsetNumber: number;
    rationale: string;
    sectionDiffs: PerSectionDiff[];
    createdAt: string;
  };
}
```

---

## 8. Security, Abuse, and Auditability

### 8.1 Auth Requirements

1. **Proposal submission (`POST /api/proposals`) is public** — no authentication required. Anonymous proposals set `contributor_id = NULL` and appear as "Anonymous" to reviewers and readers.
2. **Decision endpoints** (accept, reject, request-changes) require `reviewer` or `admin` role.
3. **Patchset submission (`POST /api/proposals/[id]/patchsets`)** requires authentication — ownership must be verified (`contributor_id` must equal current user). Anonymous proposals (contributor_id = NULL) **cannot** receive patchsets; only the original reviewer can take action on them.
4. **Withdraw (`POST /api/proposals/[id]/withdraw`)** requires authentication and ownership verification. Anonymous proposals cannot be withdrawn (no owner to verify).
5. **COI check for anonymous proposals:** since `contributor_id` is NULL, the "reviewer cannot act on own proposal" check is skipped. A reviewer can act on any anonymous proposal.

### 8.2 Rate Limiting

All limits use Upstash sliding windows and run before any DB writes. Because proposal submission is now public (no auth required), limits are keyed on IP for anonymous users and `user_id` for signed-in users.

**Proposal creation (`POST /api/proposals`):**

| Requester | Key | Limit |
|-----------|-----|-------|
| Anonymous | `proposals:create:ip:${hashedIp}` | **3 proposals / hour** per IP |
| Authenticated | `proposals:create:user:${userId}` | **5 proposals / hour** per user |

Rationale: IP cap is lower (3 vs 5) because IP is a weaker identity signal and more likely to be shared. 3/hour is still generous for real contributors. On limit hit: `429` + `Retry-After`. Response: `{ ok: false, error: "Too many proposals — please wait before submitting again.", code: "RATE_LIMITED" }`.

**Patchset submission (`POST /api/proposals/[id]/patchsets`):**

- Requires authentication (anonymous proposals cannot receive patchsets — no owner to verify ownership).
- **3 patchsets / 10 minutes** per user per proposal (Upstash sliding window, key = `proposals:patchset:${userId}:${proposalId}`)
- Rationale: prevents a contributor from spamming patchsets to force repeated reviewer re-reads.
- On limit hit: `429` + `Retry-After`. Response: `{ ok: false, error: "You're submitting patchsets too quickly — please wait a moment.", code: "RATE_LIMITED" }`.

Uses `src/lib/rate-limit.ts` shared helper (see FRD 5 Section 12).

### 8.3 Input Sanitization — ProseMirror JSON Node Validation

**Risk:** `section_diffs` in `edit_proposal_patchsets` stores arbitrary JSONB submitted by contributors (including anonymous ones). If a malicious actor crafts a JSON payload with an unsupported node type, an injected `script` attribute, or a `data:` URI in an image node, that content renders in every reviewer's browser and on the live wiki page after merge. This is the widest XSS attack surface on the platform.

**Mitigation: server-side node allowlist validation before any DB write.**

The `POST /api/proposals` and `POST /api/proposals/[id]/patchsets` route handlers must validate all `proposed_section_json` values against the canonical Tiptap extension list before inserting into the DB. Any payload containing a node type not in the allowlist is rejected with `422 Unprocessable Entity`.

**Allowed node types (mirrors the registered Tiptap extension set from FRD 2 Section 4.2, which was updated during the FRD-4 reconciliation pass to include `Underline` and `Highlight` extensions):**

```typescript
// src/lib/prosemirror/validate.ts

const ALLOWED_NODES = new Set([
  "doc", "paragraph", "text",
  "heading",         // attrs: { level: 1|2|3 }
  "bulletList", "orderedList", "listItem",
  "blockquote", "codeBlock", "horizontalRule",
  "hardBreak", "image",
  "table", "tableRow", "tableCell", "tableHeader",
]);

const ALLOWED_MARKS = new Set([
  "bold", "italic", "underline", "strike",
  "code", "link",   // link: attrs must pass URL allowlist below
  "highlight",
]);

// Image src must be a Supabase Storage URL or relative path — no data: URIs, no external arbitrary hosts
const ALLOWED_IMAGE_SRC = /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/|^\//;

// Link href must be http(s):// or a relative path — no javascript: or data: URIs
const ALLOWED_LINK_HREF = /^https?:\/\/|^\//;

export function validateProseMirrorNode(node: unknown): boolean {
  // Recursively walk the JSON tree and enforce:
  // 1. node.type is in ALLOWED_NODES
  // 2. node.marks[].type is in ALLOWED_MARKS
  // 3. image src passes ALLOWED_IMAGE_SRC
  // 4. link href passes ALLOWED_LINK_HREF
  // 5. No extra keys on node objects beyond: type, attrs, content, marks, text
  // 6. heading nodes: attrs.official must not be present in contributor-submitted JSON
  //    (the accept pipeline re-stamps the server-side value; contributor cannot grant/revoke Official status)
  // Returns false (reject) if any violation found
  // Implementation: recursive walk, throw on first violation
}
```

**Response on validation failure:**

```json
{
  "ok": false,
  "error": "Proposal content contains unsupported formatting. Please remove any custom embeds or scripts and try again.",
  "code": "INVALID_CONTENT"
}
```

**Implementation location:** `src/lib/prosemirror/validate.ts`. Called at the top of both `POST /api/proposals` and `POST /api/proposals/[id]/patchsets` before any Zod schema check or DB insert.

**Exit criterion:** attempt to submit a patchset with a node type not in the allowlist (e.g. `{ type: "iframe", attrs: { src: "https://evil.com" } }`) and verify the API returns `422` and the content is not stored.

### 8.4 Audit Log

Every proposal mutation (create patchset, accept, reject, withdraw) logs:

1. actor user id
2. action type
3. proposal id
4. timestamp
5. minimal metadata snapshot

### 8.5 PII and Attribution

1. Public UI respects anonymous default. If `contributor_id` is NULL the proposal shows "Anonymous" contributor everywhere.
2. If a signed-in user submits with attribution toggled off, `contributor_id` is stored internally but the public display still shows "Anonymous."
3. Truly anonymous proposals (NULL `contributor_id`) have no internal identity record; abuse is managed via IP rate limiting and reviewer moderation.
4. Reviewer decisions are always internally attributable (reviewer is always authenticated).
5. **FRD-8 contribution history:** `/my/contributions` only shows proposals where `contributor_id = current_user.id`. Anonymous proposals submitted without an account never appear in contribution history.

---

## 9. Non-Functional Requirements

| Requirement                 | Target                            |
| --------------------------- | --------------------------------- |
| Section editor open latency | < 500 ms                          |
| Section diff generation     | < 300 ms for up to 4,000 words    |
| Proposal create API p95     | < 800 ms                          |
| Reviewer queue load p95     | < 1 second                        |
| Accept transaction p95      | < 1 second (excluding async jobs) |
| Mergeability check p95      | < 250 ms                          |
| Availability                | 99.9% for proposal APIs           |

---

## 10. Exit Criteria

FRD 4 is complete when ALL of the following are satisfied:

| #   | Criterion                                                | Verification                                                                        |
| --- | -------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1   | Contributor can open single-section editor from heading | Click section-level propose action and verify only that section is editable         |
| 2   | Contributor can open multi-section selector             | Open multi-section editor and verify all H2 sections appear as checkboxes           |
| 3   | Contributor can select 2+ sections and edit all         | Select two sections, edit both in tabbed editor, submit as single proposal          |
| 4   | Submission requires rationale                           | Empty/short rationale fails validation                                              |
| 5   | Submission stores section_slugs array and per-section diffs | Inspect saved proposal and patchset records; verify section_diffs JSONB structure |
| 6   | Reviewer queue shows section list for multi-section proposals | Queue displays all section headings in the Sections column                    |
| 7   | Reviewer sees per-section diff cards                    | Proposal detail shows one diff card per section, in page order                     |
| 8   | Each diff card shows per-section mergeability badge     | Drifted section shows amber badge even if other sections are mergeable              |
| 9   | Reviewer can accept mergeable proposal                  | Accept creates new page version replacing all selected sections atomically          |
| 10  | Reviewer can reject with reason                         | Reject persists reviewer comment and terminal status                                |
| 11  | Affiliated reviewer cannot accept own-org proposal      | Accept endpoint returns policy error                                                |
| 12  | Reviewer cannot accept own proposal                     | Endpoint enforces non-uploader approval                                             |
| 13  | One stale section causes entire proposal needs_rebase   | Drift in any selected section transitions whole proposal to needs_rebase            |
| 14  | Contributor can rebase and resubmit all sections        | New patchset increments number and becomes current                                  |
| 15  | Competing proposals for any overlapping section marked needs_rebase on accept | Proposals touching any same section are marked needs_rebase; contributor can rebase and resubmit |
| 16  | FRD 1 re-embedding triggers post-accept                 | New chunks generation triggered asynchronously                                      |
| 17  | FRD 3 re-anchoring triggers for all changed sections    | Comment anchor maintenance routine invoked for each accepted section                |
| 18  | Reviewer can request changes with a required message         | `request-changes` endpoint transitions proposal to `changes_requested` and creates `proposal_review_comments` row |
| 19  | Contributor sees reviewer message on proposal detail when `changes_requested` | Proposal detail shows reviewer's message and per-section suggestions  |
| 20  | New patchset from `changes_requested` transitions back to `pending` | Status becomes `pending` and proposal reappears in reviewer queue      |
| 21  | Policy checks are server-enforced                            | Direct API call bypass attempts fail                                                |
| 22  | End-to-end multi-section flow passes                         | Submit 2-section proposal → review → accept works without manual DB edits |
| 23  | Anonymous proposal submission works                          | Submit a proposal while signed out; verify it succeeds and shows "Anonymous" as contributor in reviewer queue |
| 24  | Signed-in proposal shows attributed contributor              | Submit as signed-in user with attribution on; verify display name appears |
| 25  | Anonymous proposals cannot receive patchsets                 | Attempt to POST a patchset to a proposal with NULL contributor_id; verify 403 |
| 26  | Authenticated proposal creation rate limit enforced          | Submit 6 proposals in under 1 hour as the same signed-in user; verify the 6th returns 429 |
| 27  | Anonymous proposal creation rate limit enforced              | Submit 4 proposals in under 1 hour from the same IP (unsigned); verify the 4th returns 429 |
| 28  | Patchset rate limit enforced                                 | Submit 4 patchsets on the same proposal within 10 minutes; verify the 4th returns 429 |

---

## Appendix A: Status State Machine

```text
pending --> accepted              (reviewer accepts)
pending --> rejected              (reviewer rejects)
pending --> needs_rebase          (section drift detected, or competing proposal accepted on same section)
pending --> withdrawn             (contributor withdraws)
pending --> changes_requested     (reviewer requests changes; non-terminal)

changes_requested --> pending     (contributor submits new patchset)
changes_requested --> needs_rebase (section drift while awaiting contributor response)
changes_requested --> rejected    (reviewer rejects after waiting)
changes_requested --> withdrawn   (contributor withdraws)

needs_rebase --> pending          (contributor submits rebased patchset)
needs_rebase --> withdrawn        (contributor withdraws)

accepted  (terminal)
rejected  (terminal)
withdrawn (terminal)
```

Note: `superseded` has been removed. Proposals that were previously terminal-superseded (competing proposal accepted on same section) are now marked `needs_rebase` and remain recoverable via rebase.

---

## Appendix B: Schema SQL

```sql
-- Proposal status and mergeability enums can be represented as CHECK constraints (shown in section 3).

-- Make contributor_id nullable to support anonymous proposals (NULL = no account)
ALTER TABLE edit_proposals ALTER COLUMN contributor_id DROP NOT NULL;

ALTER TABLE edit_proposals
  ADD COLUMN section_slugs TEXT[] NOT NULL,
  ADD COLUMN base_page_version_id UUID NOT NULL REFERENCES page_versions(id),
  ADD COLUMN current_patchset_number INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN mergeability_status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (mergeability_status IN ('unknown','mergeable','needs_rebase','conflict'));

-- section_diffs JSONB structure (per-element):
-- {
--   "section_slug": "time-commitment",
--   "base_section_hash": "abc123",
--   "original_section_json": { ... ProseMirror JSON ... },
--   "proposed_section_json": { ... ProseMirror JSON ... },
--   "diff_json": { ... prosemirror-changeset output ... },
--   "mergeability_status": "mergeable" | "needs_rebase" | "conflict" | "unknown"
-- }

CREATE TABLE edit_proposal_patchsets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES edit_proposals(id) ON DELETE CASCADE,
  patchset_number INTEGER NOT NULL,
  base_page_version_id UUID NOT NULL REFERENCES page_versions(id),
  section_diffs JSONB NOT NULL,
  rationale TEXT NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT true,
  contributor_id UUID REFERENCES users(id),  -- NULL for anonymous patchset 1; subsequent patchsets require auth (patchset_number > 1 must have contributor_id NOT NULL enforced in application logic)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proposal_id, patchset_number)
);

CREATE UNIQUE INDEX idx_edit_proposal_patchsets_current
  ON edit_proposal_patchsets (proposal_id)
  WHERE is_current = true;

CREATE INDEX idx_edit_proposals_status_created
  ON edit_proposals (status, submitted_at);

CREATE INDEX idx_edit_proposals_page_sections
  ON edit_proposals USING GIN (section_slugs);

CREATE INDEX idx_edit_proposals_base_version
  ON edit_proposals (base_page_version_id);
```

---

## Appendix C: Design Decisions Log

| Decision                                                           | Rationale                                                                                                                                                        |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Multi-section selection within one proposal                        | Gives contributors full-page flexibility while keeping per-section diffs clean and reviewable; avoids the "blob diff" problem of full-page PRs                   |
| Section-scoped proposals over full-page proposals                  | Reduces review cognitive load, lowers conflict probability, and aligns with wiki section-linked content model                                                    |
| Tabbed editor for multi-section editing                            | Keeps each section's original/proposed content side-by-side without overwhelming the contributor with a wall of diff; one rationale field covers all sections     |
| Per-section mergeability inside JSONB `section_diffs`              | Keeps the schema flat (one patchset row) while supporting any number of sections; avoids a fan-out join table for a fundamentally bounded dataset                 |
| Overall mergeability = AND of all per-section checks               | Ensures the accept operation is safe: a proposal with even one stale section cannot be silently merged, preventing partial content corruption                     |
| Competing proposals marked needs_rebase if any section overlaps    | Prevents contradictory concurrent merges; any proposal touching a section that was just accepted must be rebased against the new truth. Originally `superseded` (terminal); changed to `needs_rebase` (recoverable) because contributor edits are not necessarily invalidated just because another proposal was accepted first — they may target different content within the same section, or represent a superior alternative. |
| Patchset support for rebases                                       | Mirrors proven review systems where updates to the same proposal are tracked without losing audit history                                                        |
| `superseded` status collapsed into `needs_rebase`                  | Both statuses represent the same condition (base content shifted); a single recoverable status is simpler and more contributor-friendly than a terminal one. The rebase UI + patchset model already exists and handles both cases identically. |
| `aiVerdict` / `aiReason` removed from patchset response payload    | No FRD defines an AI verification pipeline that populates these fields. Removed to avoid misleading empty/null fields. Re-introduce when an AI moderation FRD is written. |
| `proposal_scope` column removed                                    | Single-value enum (`'section'`) provides no discriminating information. Section-scoped proposals are the only supported type; the column is unnecessary until a future scope type (e.g. `'full-page'`) is introduced. |
| Non-uploader + non-affiliated accept rule                          | Implements conflict-of-interest and reviewer independence expectations from PRD/editorial model                                                                   |
| Mergeability based on base section hash                            | Deterministic stale/conflict detection without brittle positional assumptions                                                                                    |
| Structured diff with ProseMirror changeset                         | Better fidelity for rich-text editor output than plain string diff alone                                                                                         |
| Async post-accept jobs                                             | Follows deferred update pattern to keep accept action fast while still updating search/comment artifacts                                                         |

Research-informed implementation notes used in this FRD:

1. Wiki systems commonly support section-targeted edits and revision-based persistence.
2. Review systems with patchset revisions and non-uploader approval reduce merge risk and approval bias.
3. Rich-text change tracking benefits from structured range-based change sets for reviewer readability.

---

_This FRD defines the canonical PR-Edit workflow for UW Wiki. It supports multi-section proposals so contributors can group related section changes in one PR while preserving per-section diffs for clean, focused review. All sections in a proposal are merged atomically, and the overall proposal is only mergeable when every selected section remains unchanged from the contributor's base version._
