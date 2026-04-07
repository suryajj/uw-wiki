# Feature Requirements Document: FRD 4 -- PR-Edit System (Section-Scoped) (v1.0)

| Field               | Value                                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Project**         | UW Wiki                                                                                                                                                            |
| **Parent Document** | [PRD v0.1](../PRD.md)                                                                                                                                              |
| **FRD Order**       | [FRD Order](../FRD-order.md)                                                                                                                                       |
| **PRD Sections**    | 6.3 (Wiki Pages and Version Control), 6.4 (PR-Style Edit Proposals), 7 (Editorial Model and Trust), 8 (Platform Editorial Values), 9 (Identity and Authentication) |
| **Type**            | Core workflow feature                                                                                                                                              |
| **Depends On**      | FRD 0, FRD 1, FRD 2, FRD 3                                                                                                                                         |
| **Delivers**        | Section-scoped edit proposals, AI pre-screening, reviewer decision workflow, conflict-safe merge, patchset revisions, conflict-of-interest enforcement             |
| **Created**         | 2026-04-06                                                                                                                                                         |

---

## Summary

FRD 4 defines the PR-Edit system as a dedicated, section-scoped proposal workflow inspired by wiki moderation patterns and code review discipline. Contributors propose edits to a single section, provide rationale aligned to platform values, and receive an AI pre-screen assessment visible to both contributor and reviewers. Reviewers make the final accept/reject decision; AI is advisory only.

This FRD introduces deterministic mergeability checks, patchset-based resubmission for stale proposals, and hard conflict-of-interest rules so reviewers cannot approve proposals for organizations they are affiliated with.

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

| Term                    | Definition                                                                        |
| ----------------------- | --------------------------------------------------------------------------------- |
| Section-scoped proposal | A proposal that edits exactly one section (H2 scope, including nested H3 content) |
| Base version            | The `page_versions.id` that the contributor edited against                        |
| Patchset                | A new revision of the same proposal after requested changes or rebase             |
| Mergeability            | Whether the proposed section can be safely applied to the current page version    |
| Needs rebase            | Proposal cannot be accepted because target section changed since base version     |
| Non-uploader approval   | Reviewer approving a proposal must not be the proposal author                     |

---

## Executive Summary (Gherkin-Style)

```gherkin
Feature: Section-scoped PR edit proposals

  Background:
    Given FRD 0-3 are complete
    And wiki pages render with stable section slugs
    And edit proposals require authenticated users

  Scenario: User proposes an edit to one section
    When a user clicks "Propose Edit" on the "Time Commitment" section
    Then the editor opens scoped to that section only
    And the user edits section content and adds rationale
    And the proposal is submitted with base_page_version_id and section_slug

  Scenario: AI pre-screen runs on submission
    When a proposal is submitted
    Then GPT-4o-mini evaluates the diff against editorial values
    And stores pass/fail + one-line reason
    And both contributor and reviewers can see the assessment

  Scenario: Reviewer makes final decision
    Given a proposal is pending review
    When a reviewer checks diff, rationale, and AI assessment
    Then the reviewer can accept or reject
    And AI output is advisory only

  Scenario: Conflict-of-interest rule
    Given reviewer is affiliated with the target organization
    When reviewer opens a proposal for that organization
    Then accept action is blocked by policy

  Scenario: Proposal becomes stale
    Given page version changed after proposal submission
    And target section changed since base version
    When reviewer attempts to accept
    Then proposal status becomes needs_rebase
    And contributor must submit a new patchset

  Scenario: Accepted proposal updates page version
    When reviewer accepts a mergeable proposal
    Then system creates a new page version
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

### 1.1 Section-Scoped Editing (Primary Requirement)

The PR-Edit workflow in FRD 4 is section-scoped by default.

Rules:

1. A proposal targets one section slug (H2 scope).
2. Nested H3 content under that H2 is included in scope.
3. Contributor cannot edit content outside the selected section in a single proposal.
4. Multi-section edits require multiple proposals.

### 1.2 Entry Points

Contributors can initiate a proposal from:

1. Section header action button (`Propose Edit`) next to each H2 heading.
2. Overflow menu in section TOC.
3. Keyboard shortcut while focused in section (`e`) for accessibility.

### 1.3 Section Editor

The section editor must present:

1. Original section content (read-only snapshot).
2. Editable proposed section content.
3. Live diff preview (insertions/deletions).
4. Rationale field (required).
5. Attribution toggle (anonymous default).

### 1.4 Rationale and Validation

Rationale constraints:

1. Required.
2. Minimum 20 characters.
3. Maximum 500 characters.
4. Must not be whitespace-only.

Submission constraints:

1. Auth required at submit time.
2. Proposal requires current `base_page_version_id`.
3. Proposal requires `section_slug` and `base_section_hash`.

### 1.5 Official Section Guard

When section is inside the organization's Official block:

1. Only users affiliated with the org (or reviewer/admin) may submit proposals to that section.
2. Non-affiliated users receive a policy error message and cannot submit.

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

1. Other pending proposals on same page + same section are marked `superseded`.
2. Contributor receives message to reopen from latest version.

---

## 3. Data Model and Migrations

### 3.1 `edit_proposals` Extensions

```sql
ALTER TABLE edit_proposals
  ADD COLUMN proposal_scope TEXT NOT NULL DEFAULT 'section'
    CHECK (proposal_scope IN ('section')),
  ADD COLUMN section_slug TEXT NOT NULL,
  ADD COLUMN base_page_version_id UUID NOT NULL REFERENCES page_versions(id),
  ADD COLUMN base_section_hash TEXT NOT NULL,
  ADD COLUMN current_patchset_number INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN mergeability_status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (mergeability_status IN ('unknown','mergeable','needs_rebase','conflict'));
```

### 3.2 Patchset Table

```sql
CREATE TABLE edit_proposal_patchsets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES edit_proposals(id) ON DELETE CASCADE,
  patchset_number INTEGER NOT NULL,
  base_page_version_id UUID NOT NULL REFERENCES page_versions(id),
  base_section_hash TEXT NOT NULL,
  original_section_json JSONB NOT NULL,
  proposed_section_json JSONB NOT NULL,
  diff_json JSONB,
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
2. Patchset numbers must be monotonic.
3. `accepted` and `rejected` are terminal.
4. Accept operation requires current patchset AI verdict present (pass or fail). No silent skip.

### 3.4 Performance Indexes

```sql
CREATE INDEX idx_edit_proposals_status_created
  ON edit_proposals (status, submitted_at);

CREATE INDEX idx_edit_proposals_page_section
  ON edit_proposals (page_id, section_slug);

CREATE INDEX idx_edit_proposals_base_version
  ON edit_proposals (base_page_version_id);
```

---

## 4. Diff and Mergeability Engine

### 4.1 Diff Representation

Section diff is generated from ProseMirror JSON with change tracking using `prosemirror-changeset`.

Rationale:

1. Structured insert/delete ranges are more reliable than plain text for editor-originated content.
2. `simplifyChanges` improves readability by expanding word-boundary edits for display.

### 4.2 Section Extraction

Given a page `content_json`, extract section by H2 slug:

1. Traverse ProseMirror doc.
2. Identify H2 node with matching slug.
3. Include all nodes until next H2.
4. Serialize to `section_json`.
5. Compute normalized hash for mergeability checks.

### 4.3 Mergeability Algorithm

At accept time:

1. Load proposal current patchset.
2. Load page current version content.
3. Extract current section by `section_slug`.
4. Compute current section hash.
5. Compare with patchset `base_section_hash`.

Outcomes:

1. Hash matches: `mergeable`.
2. Hash differs: `needs_rebase`.
3. Section missing entirely: `conflict`.

### 4.4 Rebase Flow

If `needs_rebase`:

1. Proposal cannot be accepted.
2. Contributor opens rebase UI with latest section content.
3. Contributor submits new patchset with updated base version/hash.
4. Proposal returns to `pending`.

### 4.5 Rendering Rules

Diff view for reviewers must show:

1. Added text (green).
2. Removed text (red + strike).
3. Unchanged context.
4. Heading-level context label for the edited section.

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
2. Section slug + heading text.
3. Before/after section text.
4. Contributor rationale.
5. Editorial values rubric.

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
3. Section
4. Contributor (or Anonymous)
5. AI verdict badge
6. Mergeability badge
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
4. Re-run mergeability check against latest version.
5. Replace target section in full page content with proposed section.
6. Insert new `page_versions` row.
7. Update `pages.current_version_id` and `pages.last_modified_at`.
8. Mark proposal as `accepted`.
9. Mark competing pending proposals for same section as `superseded`.
10. Commit transaction.

Post-commit async jobs:

1. `reembedPage` (FRD 1).
2. `reanchorCommentsForPageSection` (FRD 3).
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
interface CreateSectionProposalRequest {
  pageId: string;
  sectionSlug: string;
  basePageVersionId: string;
  baseSectionHash: string;
  proposedSectionJson: Record<string, unknown>;
  rationale: string;
  isAnonymous: boolean;
}
```

### 8.4 Response Payload: Proposal Detail

```typescript
interface SectionProposalDetail {
  id: string;
  pageId: string;
  orgId: string;
  sectionSlug: string;
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
    diffJson: unknown;
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

| #   | Criterion                                          | Verification                                                                  |
| --- | -------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | Contributor can open section-scoped editor         | Click section-level propose action and verify only one section is editable    |
| 2   | Submission requires rationale                      | Empty/short rationale fails validation                                        |
| 3   | Submission stores base version and section hash    | Inspect saved proposal and patchset records                                   |
| 4   | AI pre-screen runs and is persisted                | Proposal detail shows pass/fail + reason                                      |
| 5   | Contributor can view AI assessment                 | Proposal detail page shows same result as reviewer queue                      |
| 6   | Reviewer queue shows section-level proposals       | Queue displays org/page/section/AI/mergeability                               |
| 7   | Reviewer can accept mergeable proposal             | Accept creates new page version and marks proposal accepted                   |
| 8   | Reviewer can reject with reason                    | Reject persists reviewer comment and terminal status                          |
| 9   | Affiliated reviewer cannot accept own-org proposal | Accept endpoint returns policy error                                          |
| 10  | Reviewer cannot accept own proposal                | Endpoint enforces non-uploader approval                                       |
| 11  | Stale section change produces needs_rebase         | Drifted section transitions proposal to needs_rebase                          |
| 12  | Contributor can submit patchset 2+                 | New patchset increments number and becomes current                            |
| 13  | Competing pending proposals superseded on accept   | Same page/section pending proposals marked superseded                         |
| 14  | FRD 1 re-embedding triggers post-accept            | New chunks generation triggered asynchronously                                |
| 15  | FRD 3 re-anchoring triggers post-accept            | Comment anchor maintenance routine is invoked                                 |
| 16  | All decision actions are audit-logged              | Create/accept/reject/withdraw events exist in audit log                       |
| 17  | Policy checks are server-enforced                  | Direct API call bypass attempts fail                                          |
| 18  | End-to-end flow passes                             | submit -> pre-screen -> review -> accept/reject works without manual DB edits |

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
  ADD COLUMN section_slug TEXT NOT NULL,
  ADD COLUMN base_page_version_id UUID NOT NULL REFERENCES page_versions(id),
  ADD COLUMN base_section_hash TEXT NOT NULL,
  ADD COLUMN current_patchset_number INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN mergeability_status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (mergeability_status IN ('unknown','mergeable','needs_rebase','conflict'));

CREATE TABLE edit_proposal_patchsets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES edit_proposals(id) ON DELETE CASCADE,
  patchset_number INTEGER NOT NULL,
  base_page_version_id UUID NOT NULL REFERENCES page_versions(id),
  base_section_hash TEXT NOT NULL,
  original_section_json JSONB NOT NULL,
  proposed_section_json JSONB NOT NULL,
  diff_json JSONB,
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

CREATE INDEX idx_edit_proposals_page_section
  ON edit_proposals (page_id, section_slug);

CREATE INDEX idx_edit_proposals_base_version
  ON edit_proposals (base_page_version_id);
```

---

## Appendix C: Design Decisions Log

| Decision                                             | Rationale                                                                                                |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Section-scoped proposals over full-page proposals    | Reduces review scope, lowers conflict rate, and aligns with wiki section-linked content model            |
| Patchset support for rebases                         | Mirrors proven review systems where updates to same proposal are tracked without losing audit history    |
| Non-uploader + non-affiliated accept rule            | Implements conflict-of-interest and reviewer independence expectations from PRD/editorial model          |
| Mergeability based on base section hash              | Deterministic stale/conflict detection without brittle positional assumptions                            |
| Structured diff with ProseMirror changeset           | Better fidelity for rich-text editor output than plain string diff alone                                 |
| AI pre-screen as advisory only                       | Keeps human editorial authority while improving queue prioritization                                     |
| Async post-accept jobs                               | Follows deferred update pattern to keep accept action fast while still updating search/comment artifacts |
| Superseding competing section proposals after accept | Prevents duplicate/contradictory merges and forces contributor refresh on latest truth                   |

Research-informed implementation notes used in this FRD:

1. Wiki systems commonly support section-targeted edits and revision-based persistence.
2. Review systems with patchset revisions and non-uploader approval reduce merge risk and approval bias.
3. Rich-text change tracking benefits from structured range-based change sets for reviewer readability.

---

_This FRD defines the canonical PR-Edit workflow for UW Wiki. It narrows proposal scope to one section per proposal, preserves reviewer authority, and adds conflict-safe, auditable merge behavior aligned with the existing architecture._
