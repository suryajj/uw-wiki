# Feature Requirements Document: FRD 4 -- PR-Edit System (Section-Scoped) (v1.1)

| Field               | Value                                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Project**         | UW Wiki                                                                                                                                                            |
| **Parent Document** | [PRD v0.1](../PRD.md)                                                                                                                                              |
| **FRD Order**       | [FRD Order](../FRD-order.md)                                                                                                                                       |
| **PRD Sections**    | 6.3 (Wiki Pages and Version Control), 6.4 (PR-Style Edit Proposals), 7 (Editorial Model and Trust), 8 (Platform Editorial Values), 9 (Identity and Authentication) |
| **Type**            | Core workflow feature                                                                                                                                              |
| **Depends On**      | FRD 0, FRD 1, FRD 2, FRD 3                                                                                                                                         |
| **Delivers**        | Multi-section-scoped edit proposals, AI pre-screening, reviewer decision workflow, per-section conflict-safe merge, patchset revisions, conflict-of-interest enforcement |
| **Created**         | 2026-04-06                                                                                                                                                         |
| **Updated**         | 2026-04-07 -- v1.1: Upgraded from single-section to multi-section selection (contributors can include one or more sections in one proposal)                        |

---

## Summary

FRD 4 defines the PR-Edit system as a **section-scoped proposal workflow** where contributors select one or more sections to edit in a single proposal. This gives contributors the flexibility to make related changes across multiple sections (e.g., updating both "Time Commitment" and "Culture and Vibe" together) while preserving clean, per-section diffs for reviewers. Every section in a proposal is reviewed independently, but accepted atomically as a single version change.

The system includes deterministic per-section mergeability checks (a proposal is only mergeable if every selected section is unchanged since the base version), patchset-based resubmission for stale proposals, and hard conflict-of-interest rules so reviewers cannot approve proposals for organizations they are affiliated with. AI pre-screening evaluates the full set of proposed section changes as a single editorial assessment.

---

## Supersession and Overlap Resolution

This FRD resolves overlap with existing docs as follows:

1. FRD 2 remains the source of truth for page rendering, directory, editor primitives, lifecycle banners, and page claiming visuals.
2. FRD 4 becomes the source of truth for PR proposal lifecycle and reviewer decisions.
3. FRD 2 sections related to broad/full-page PR workflow are superseded by this FRD for implementation purposes.

Superseded areas in FRD 2 (implementation replaced by FRD 4):

1. PR submission flow details (FRD 2 Section 5)
2. AI pre-screening implementation details (FRD 2 Section 6)
3. Diff generation for proposal review (FRD 2 Section 7)
4. Reviewer decision semantics and accept flow specifics (FRD 2 Section 8.4-8.6)
5. Proposal-related API routes in FRD 2 Section 13

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
    And edit proposals require authenticated users

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

  Scenario: AI pre-screen runs on submission
    When a proposal is submitted (one or more sections)
    Then GPT-4o-mini evaluates all proposed section changes against editorial values
    And stores a single pass/fail + one-line reason for the proposal
    And both contributor and reviewers can see the assessment

  Scenario: Reviewer makes final decision
    Given a proposal is pending review
    When a reviewer checks the per-section diffs, rationale, and AI assessment
    Then the reviewer can accept or reject the whole proposal
    And AI output is advisory only

  Scenario: Conflict-of-interest rule
    Given reviewer is affiliated with the target organization
    When reviewer opens a proposal for that organization
    Then accept action is blocked by policy

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
5. [5. AI Pre-Screener](#5-ai-pre-screener)
6. [6. Reviewer Experience and Policy Enforcement](#6-reviewer-experience-and-policy-enforcement)
7. [7. Accept and Reject Pipelines](#7-accept-and-reject-pipelines)
8. [8. API Contracts](#8-api-contracts)
9. [9. Security, Abuse, and Auditability](#9-security-abuse-and-auditability)
10. [10. Non-Functional Requirements](#10-non-functional-requirements)
11. [11. Exit Criteria](#11-exit-criteria)
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
4. **Attribution toggle** (anonymous default).
5. **Submit Proposal** button -- submits all edited sections as one proposal.

For single-section proposals, the tab bar is hidden and the layout is the same as before.

### 1.5 Rationale and Validation

Rationale constraints:

1. Required (one rationale per proposal, covering all selected sections).
2. Minimum 20 characters.
3. Maximum 500 characters.
4. Must not be whitespace-only.

Submission constraints:

1. Auth required at submit time.
2. Proposal requires current `base_page_version_id`.
3. Proposal requires `section_slugs` (array, minimum length 1) and a `base_section_hash` per section.

### 1.6 Official Section Guard

When any selected section is inside the organization's Official block:

1. Only users affiliated with the org (or reviewer/admin) may submit proposals to that section.
2. Non-affiliated users receive a policy error and cannot submit a proposal that includes the Official section.
3. Non-affiliated users can still propose edits to non-Official sections on the same page in a separate proposal.

---

## 2. Proposal Lifecycle

### 2.1 Statuses

`edit_proposals.status` values:

1. `pending`
2. `needs_rebase`
3. `accepted`
4. `rejected`
5. `withdrawn`
6. `superseded`

### 2.2 Patchset Model

A proposal can have multiple patchsets, inspired by change revision workflows:

1. Patchset 1 created at initial submission.
2. If proposal becomes `needs_rebase`, contributor can submit patchset `n+1`.
3. Only one patchset is `is_current = true`.
4. Reviewer decisions always apply to current patchset.

### 2.3 Lifecycle Rules

1. Proposal starts as `pending`.
2. AI pre-screen attaches verdict to current patchset.
3. Accept/reject transitions proposal to terminal status.
4. If page/section drift is detected pre-accept, proposal becomes `needs_rebase`.
5. Contributor may withdraw while `pending` or `needs_rebase`.

### 2.4 Superseding Competing Proposals

On acceptance:

1. Other pending proposals on the same page that share **any** section slug with the accepted proposal are marked `superseded`.
2. Contributors of superseded proposals receive a message to reopen from the latest page version.
3. Proposals that target entirely non-overlapping sections are not affected.

---

## 3. Data Model and Migrations

### 3.1 `edit_proposals` Extensions

The key change from a single `section_slug` to `section_slugs TEXT[]` captures multi-section proposals. Per-section hashes and content live in the patchset's `section_diffs` JSONB array.

```sql
ALTER TABLE edit_proposals
  ADD COLUMN proposal_scope TEXT NOT NULL DEFAULT 'section'
    CHECK (proposal_scope IN ('section')),
  ADD COLUMN section_slugs TEXT[] NOT NULL,
  ADD COLUMN base_page_version_id UUID NOT NULL REFERENCES page_versions(id),
  ADD COLUMN current_patchset_number INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN mergeability_status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (mergeability_status IN ('unknown','mergeable','needs_rebase','conflict'));
```

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
  ai_verdict TEXT CHECK (ai_verdict IN ('pass','fail')),
  ai_reason TEXT,
  ai_scored_at TIMESTAMPTZ,
  is_current BOOLEAN NOT NULL DEFAULT true,
  contributor_id UUID NOT NULL REFERENCES users(id),
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
7. Accept operation requires current patchset AI verdict present (pass or fail). No silent skip.

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

---

## 5. AI Pre-Screener

### 5.1 Purpose

AI pre-screening provides advisory moderation support, not automated acceptance.

It evaluates whether proposal text aligns with Platform Editorial Values:

1. No Harm
2. Honest, Not Unhinged
3. Credible
4. Specific Over Vague
5. SLC Test

### 5.2 Model and Provider

1. Model: `openai/gpt-4o-mini` via OpenRouter.
2. Interface: Vercel AI SDK (`generateObject`) with schema validation.

### 5.3 Inputs

1. Organization name + category.
2. All selected section slugs and their heading text.
3. Before/after content for every selected section (full set of section diffs).
4. Contributor rationale (shared across all sections).
5. Editorial values rubric.

The AI pre-screener receives the full multi-section proposal in a single call and returns one verdict for the proposal as a whole. It does not produce per-section verdicts.

### 5.4 Output Contract

```typescript
interface SectionPreScreenResult {
  verdict: "pass" | "fail";
  reason: string; // <= 100 chars
  flags: string[]; // optional short tags, e.g. ["marketing_tone", "vague_claim"]
}
```

### 5.5 Visibility

1. Contributor sees verdict and reason on proposal detail page.
2. Reviewer sees same assessment in queue and proposal detail.
3. Assessment remains immutable per patchset after scoring.

### 5.6 Latency and Retry

1. Async execution after patchset insert.
2. One retry on transient provider/network failure.
3. On final failure, set AI status to `error` and allow human review.

---

## 6. Reviewer Experience and Policy Enforcement

### 6.1 Reviewer Queue

Queue columns:

1. Organization
2. Page
3. Sections (comma-separated list of section headings, e.g. "Time Commitment, Culture and Vibe")
4. Contributor (or Anonymous)
5. AI verdict badge
6. Overall mergeability badge
7. Submitted timestamp

Default sorting:

1. `pending` first
2. oldest first (FIFO)

### 6.2 Final Decision Rules

Only reviewer/admin can decide. Decision options:

1. `accept`
2. `reject`

### 6.3 Conflict-of-Interest Policy

Hard checks before accept:

1. Reviewer cannot accept own proposal.
2. Reviewer cannot accept proposal for affiliated org.
3. Reviewer cannot accept if proposal status not `pending`.
4. Reviewer cannot accept if mergeability not `mergeable`.

Minimum requirement from product direction is enforced: affiliated reviewer can never be accepting reviewer for own org page.

### 6.4 Optional Expanded Guard

Recommended policy toggle (enabled by default):

1. Affiliated reviewer cannot perform any final decision (accept or reject) on own org.

Reason: avoids both positive and negative bias in outcomes.

### 6.5 Reviewer Audit Fields

On decision, record:

1. `reviewer_id`
2. `reviewed_at`
3. `reviewer_comment` (required for reject)
4. decision source (`manual`)

---

## 7. Accept and Reject Pipelines

### 7.1 Accept Pipeline (Transactional)

Server algorithm:

1. Start DB transaction.
2. Lock target page row (`FOR UPDATE`).
3. Validate reviewer role and policy constraints.
4. Re-run mergeability check for **each section** in `section_diffs` against latest version.
5. If any section is `needs_rebase` or `conflict`, abort and set `mergeability_status = needs_rebase` on the proposal.
6. For each section in `section_diffs`, replace that section in the full page content with the proposed section JSON.
7. Insert single new `page_versions` row with the fully updated `content_json`.
8. Update `pages.current_version_id` and `pages.last_modified_at`.
9. Mark proposal as `accepted`.
10. Mark competing pending proposals that overlap any of the same sections as `superseded`.
11. Commit transaction.

Post-commit async jobs:

1. `reembedPage` (FRD 1).
2. `reanchorCommentsForPageSections` (FRD 3) -- invoked for all sections that changed.
3. Notification events (if enabled later).

### 7.2 Reject Pipeline

1. Validate reviewer role and policy.
2. Require reviewer comment (minimum 10 chars).
3. Mark proposal `rejected`.
4. Preserve patchsets and AI outputs for audit history.

### 7.3 Failure Handling

If accept fails after lock due to drift:

1. Set `mergeability_status = needs_rebase`.
2. Set proposal status `needs_rebase`.
3. Return structured error to reviewer UI.

---

## 8. API Contracts

### 8.1 Contributor Routes

| Route                           | Method | Auth                            | Purpose                                   |
| ------------------------------- | ------ | ------------------------------- | ----------------------------------------- |
| `/api/proposals`                | POST   | Required                        | Create section proposal (patchset 1)      |
| `/api/proposals/[id]`           | GET    | Required (owner/reviewer/admin) | Get proposal detail + current patchset    |
| `/api/proposals/[id]/patchsets` | POST   | Required (owner)                | Submit rebased patchset                   |
| `/api/proposals/[id]/withdraw`  | POST   | Required (owner)                | Withdraw pending or needs_rebase proposal |

### 8.2 Reviewer Routes

| Route                              | Method | Auth           | Purpose                    |
| ---------------------------------- | ------ | -------------- | -------------------------- |
| `/api/admin/proposals`             | GET    | Reviewer/Admin | Queue listing with filters |
| `/api/proposals/[id]/accept`       | POST   | Reviewer/Admin | Accept proposal            |
| `/api/proposals/[id]/reject`       | POST   | Reviewer/Admin | Reject proposal            |
| `/api/proposals/[id]/mergeability` | POST   | Reviewer/Admin | Force refresh mergeability |

### 8.3 Request Payload: Create Proposal

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

### 8.4 Response Payload: Proposal Detail

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
    | "needs_rebase"
    | "accepted"
    | "rejected"
    | "withdrawn"
    | "superseded";
  mergeabilityStatus: "unknown" | "mergeable" | "needs_rebase" | "conflict";
  currentPatchsetNumber: number;
  currentPatchset: {
    patchsetNumber: number;
    rationale: string;
    aiVerdict: "pass" | "fail" | null;
    aiReason: string | null;
    sectionDiffs: PerSectionDiff[];
    createdAt: string;
  };
}
```

---

## 9. Security, Abuse, and Auditability

### 9.1 Auth Requirements

1. Proposal submission requires authenticated user.
2. Decision endpoints require reviewer/admin role.
3. API must validate ownership for patchset and withdraw actions.

### 9.2 Rate Limiting

1. Proposal submissions: per-user limit (e.g., 10/hour/page).
2. Patchset submissions: per-proposal limit to prevent spam loops.

### 9.3 Audit Log

Every proposal mutation (create patchset, accept, reject, withdraw) logs:

1. actor user id
2. action type
3. proposal id
4. timestamp
5. minimal metadata snapshot

### 9.4 PII and Attribution

1. Public UI respects anonymous default.
2. Internal logs always persist contributor identity.
3. Reviewer decisions are always internally attributable.

---

## 10. Non-Functional Requirements

| Requirement                 | Target                            |
| --------------------------- | --------------------------------- |
| Section editor open latency | < 500 ms                          |
| Section diff generation     | < 300 ms for up to 4,000 words    |
| Proposal create API p95     | < 800 ms (excluding AI)           |
| AI pre-screen p95           | < 4 seconds                       |
| Reviewer queue load p95     | < 1 second                        |
| Accept transaction p95      | < 1 second (excluding async jobs) |
| Mergeability check p95      | < 250 ms                          |
| Availability                | 99.9% for proposal APIs           |

---

## 11. Exit Criteria

FRD 4 is complete when ALL of the following are satisfied:

| #   | Criterion                                                | Verification                                                                        |
| --- | -------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1   | Contributor can open single-section editor from heading | Click section-level propose action and verify only that section is editable         |
| 2   | Contributor can open multi-section selector             | Open multi-section editor and verify all H2 sections appear as checkboxes           |
| 3   | Contributor can select 2+ sections and edit all         | Select two sections, edit both in tabbed editor, submit as single proposal          |
| 4   | Submission requires rationale                           | Empty/short rationale fails validation                                              |
| 5   | Submission stores section_slugs array and per-section diffs | Inspect saved proposal and patchset records; verify section_diffs JSONB structure |
| 6   | AI pre-screen runs and is persisted                     | Proposal detail shows pass/fail + reason for the full multi-section proposal        |
| 7   | Contributor can view AI assessment                      | Proposal detail page shows same result as reviewer queue                            |
| 8   | Reviewer queue shows section list for multi-section proposals | Queue displays all section headings in the Sections column                    |
| 9   | Reviewer sees per-section diff cards                    | Proposal detail shows one diff card per section, in page order                     |
| 10  | Each diff card shows per-section mergeability badge     | Drifted section shows amber badge even if other sections are mergeable              |
| 11  | Reviewer can accept mergeable proposal                  | Accept creates new page version replacing all selected sections atomically          |
| 12  | Reviewer can reject with reason                         | Reject persists reviewer comment and terminal status                                |
| 13  | Affiliated reviewer cannot accept own-org proposal      | Accept endpoint returns policy error                                                |
| 14  | Reviewer cannot accept own proposal                     | Endpoint enforces non-uploader approval                                             |
| 15  | One stale section causes entire proposal needs_rebase   | Drift in any selected section transitions whole proposal to needs_rebase            |
| 16  | Contributor can rebase and resubmit all sections        | New patchset increments number and becomes current                                  |
| 17  | Competing proposals for any overlapping section superseded on accept | Proposals touching any same section are marked superseded             |
| 18  | FRD 1 re-embedding triggers post-accept                 | New chunks generation triggered asynchronously                                      |
| 19  | FRD 3 re-anchoring triggers for all changed sections    | Comment anchor maintenance routine invoked for each accepted section                |
| 20  | All decision actions are audit-logged                   | Create/accept/reject/withdraw events exist in audit log                             |
| 21  | Policy checks are server-enforced                       | Direct API call bypass attempts fail                                                |
| 22  | End-to-end multi-section flow passes                    | Submit 2-section proposal → pre-screen → review → accept works without manual DB edits |

---

## Appendix A: Status State Machine

```text
pending --> accepted
pending --> rejected
pending --> needs_rebase
pending --> withdrawn

needs_rebase --> pending (via new patchset)
needs_rebase --> withdrawn

accepted (terminal)
rejected (terminal)
withdrawn (terminal)
superseded (terminal)
```

---

## Appendix B: Schema SQL

```sql
-- Proposal status and mergeability enums can be represented as CHECK constraints (shown in section 3).

ALTER TABLE edit_proposals
  ADD COLUMN proposal_scope TEXT NOT NULL DEFAULT 'section'
    CHECK (proposal_scope IN ('section')),
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
  ai_verdict TEXT CHECK (ai_verdict IN ('pass','fail')),
  ai_reason TEXT,
  ai_scored_at TIMESTAMPTZ,
  is_current BOOLEAN NOT NULL DEFAULT true,
  contributor_id UUID NOT NULL REFERENCES users(id),
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
| Single AI verdict for the whole proposal                           | AI pre-screen evaluates editorial fitness of the combined set of changes; per-section verdicts would fragment the assessment and make the queue harder to triage  |
| Per-section mergeability inside JSONB `section_diffs`              | Keeps the schema flat (one patchset row) while supporting any number of sections; avoids a fan-out join table for a fundamentally bounded dataset                 |
| Overall mergeability = AND of all per-section checks               | Ensures the accept operation is safe: a proposal with even one stale section cannot be silently merged, preventing partial content corruption                     |
| Competing proposals superseded if any section overlaps             | Prevents contradictory concurrent merges; any proposal touching a section that was just accepted must be rebased against the new truth                           |
| Patchset support for rebases                                       | Mirrors proven review systems where updates to the same proposal are tracked without losing audit history                                                        |
| Non-uploader + non-affiliated accept rule                          | Implements conflict-of-interest and reviewer independence expectations from PRD/editorial model                                                                   |
| Mergeability based on base section hash                            | Deterministic stale/conflict detection without brittle positional assumptions                                                                                    |
| Structured diff with ProseMirror changeset                         | Better fidelity for rich-text editor output than plain string diff alone                                                                                         |
| AI pre-screen as advisory only                                     | Keeps human editorial authority while improving queue prioritization                                                                                             |
| Async post-accept jobs                                             | Follows deferred update pattern to keep accept action fast while still updating search/comment artifacts                                                         |

Research-informed implementation notes used in this FRD:

1. Wiki systems commonly support section-targeted edits and revision-based persistence.
2. Review systems with patchset revisions and non-uploader approval reduce merge risk and approval bias.
3. Rich-text change tracking benefits from structured range-based change sets for reviewer readability.

---

_This FRD defines the canonical PR-Edit workflow for UW Wiki. It supports multi-section proposals so contributors can group related section changes in one PR while preserving per-section diffs for clean, focused review. All sections in a proposal are merged atomically, and the overall proposal is only mergeable when every selected section remains unchanged from the contributor's base version._
