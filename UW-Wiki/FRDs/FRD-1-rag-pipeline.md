# Feature Requirements Document: FRD 1 -- RAG Pipeline (v1.0)

| Field | Value |
|---|---|
| **Project** | UW Wiki |
| **Parent Document** | [PRD v0.1](../PRD.md) |
| **FRD Order** | [FRD Order](../FRD-order.md) |
| **PRD Sections** | 6.1 (AI-Powered Search / RAG) |
| **Type** | Core infrastructure feature |
| **Depends On** | FRD 0 (Setup Document) |
| **Delivers** | Embedding service, section-based chunking, hybrid retrieval (pgvector + tsvector + RRF), `search_wiki` tool, RAG streaming endpoint, application-level re-embedding pipeline |
| **Created** | 2026-04-05 |

---

## Summary

FRD 1 builds the Retrieval-Augmented Generation (RAG) pipeline that powers UW Wiki's AI search -- the primary entry point into the product. The pipeline consists of three layers: an ingestion layer that parses ProseMirror JSON wiki pages into section-based chunks and embeds them as 512-dimensional vectors via OpenAI `text-embedding-3-small` (through OpenRouter), a hybrid retrieval engine that combines semantic search (pgvector cosine similarity) with keyword search (PostgreSQL full-text search) and merges results using Reciprocal Rank Fusion (RRF), and a synthesis layer where Gemini 2.5 Flash (via OpenRouter) generates streamed, cited answers using a `search_wiki` tool exposed through the Vercel AI SDK. Three chunk types populate the retrieval corpus: content chunks (wiki page sections), metadata chunks (Pulse ratings per org), and comment chunks (inline user comments). The LLM uses a tool-calling approach for multi-turn conversations, formulating its own search queries from conversation context. An application-level re-embedding pipeline keeps the corpus in sync when page edits are accepted, comments are created or deleted, or Pulse aggregates change. All answers include numbered inline citations with deep links to specific wiki page sections.

---

## Given Context (Preconditions)

The following are assumed to be in place from FRD 0:

| Prerequisite | FRD 0 Deliverable |
|---|---|
| Next.js 15 App Router project scaffolded | Project root with `src/app/` directory |
| Supabase project with PostgreSQL 17 + pgvector enabled | Supabase project configuration |
| Supabase Auth configured (Google OAuth + email/password) | `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts` |
| `universities`, `organizations`, `pages`, `page_versions`, `comments`, `pulse_aggregates` tables exist | Supabase migrations |
| OpenRouter API key configured | `.env.local` with `OPENROUTER_API_KEY` |
| Vercel AI SDK installed (`ai`, `@ai-sdk/openai`) | `package.json` dependencies |
| shadcn/ui + TailwindCSS v4 configured | Frontend setup |
| Environment variables template | `.env.example` |

### Terms

| Term | Definition |
|---|---|
| Chunk | A self-contained segment of text with associated metadata, stored as a single embedding row in the `chunks` table |
| Content chunk | A chunk derived from a wiki page section (e.g., "Time Commitment" for Midnight Sun) |
| Metadata chunk | A synthetic chunk per org containing Pulse ratings (selectivity, vibe check, co-op boost, tech stack) in natural language |
| Comment chunk | A chunk derived from a single inline user comment on a wiki page |
| Hybrid search | Retrieval combining semantic similarity (pgvector vectors) and keyword matching (PostgreSQL full-text search) into a single ranked result set |
| RRF (Reciprocal Rank Fusion) | A rank-based score combination algorithm that merges results from multiple retrieval methods without requiring score normalization |
| Ingestion | The process of parsing page content, chunking it, embedding the chunks, and storing them in the database |
| Re-embedding | Deleting stale chunks and creating new ones when source content changes (page edit accepted, comment added, Pulse updated) |
| Context header | A prefix prepended to chunk text before embedding (e.g., `[Midnight Sun > Time Commitment]`) to bake org/section context into the vector |
| Tool-calling | The pattern where the LLM decides when and how to call the `search_wiki` tool, rather than the application automatically reformulating queries |
| ProseMirror JSON | The structured document format used by the Tiptap editor to store wiki page content |

---

## Executive Summary (Gherkin-Style)

```gherkin
Feature: RAG Pipeline

  Background:
    Given  FRD 0 is complete
    And    PostgreSQL 17 with pgvector is running via Supabase
    And    the chunks table exists with HNSW and GIN indexes
    And    OpenRouter API key is configured

  Scenario: Embed a wiki page's content after edit proposal accepted
    When   an edit proposal for "Midnight Sun" is accepted
    Then   the system deletes all existing content chunks for that page
    And    parses the new ProseMirror JSON content
    And    splits it into section-based chunks at heading boundaries
    And    prepends context headers (e.g., "[Midnight Sun > Time Commitment]")
    And    skips the "External Links" section
    And    embeds each chunk as a 512-dimensional vector
    And    stores each chunk with org metadata and section metadata

  Scenario: Generate metadata chunk for an org's Pulse data
    When   Pulse aggregates are updated for "WATonomous"
    Then   the system deletes the existing metadata chunk for that org
    And    generates a natural-language summary of Pulse ratings
    And    embeds and stores the metadata chunk with chunk_type = "metadata"

  Scenario: Generate comment chunk when a comment is created
    When   a user posts a comment on the "Culture and Vibe" section of "Blueprint"
    Then   the system creates a comment chunk from the comment body
    And    stores it with the comment's own created_at timestamp
    And    sets anchored_section to "Culture and Vibe"

  Scenario: Semantic search returns relevant chunks
    Given  wiki pages have been ingested
    When   a search is performed for "best design team for hardware"
    Then   the system embeds the query as a 512-dimensional vector
    And    returns chunks semantically similar to the query

  Scenario: Keyword search returns exact term matches
    Given  wiki pages have been ingested
    When   a search is performed for "ROS2 WATonomous"
    Then   the system performs full-text search using plainto_tsquery
    And    returns chunks containing the exact terms "ROS2" and "WATonomous"

  Scenario: Hybrid search merges both result sets via RRF
    Given  wiki pages have been ingested
    When   a hybrid search is performed for "Which design team uses ROS2?"
    Then   the system runs semantic and keyword searches in parallel
    And    merges results using Reciprocal Rank Fusion
    And    deduplicates by chunk ID
    And    returns the top 8 chunks above the 0.35 similarity threshold

  Scenario: User asks a question and receives a streamed cited answer
    Given  the RAG pipeline is operational
    When   a user asks "Which design team is best for hardware?"
    Then   the LLM calls the search_wiki tool with a relevant query
    And    receives chunk results with org and section metadata
    And    generates a streamed response with inline citations [1], [2]
    And    appends a source list with deep links to wiki sections

  Scenario: User asks a follow-up question maintaining context
    Given  the user previously asked about hardware design teams
    When   the user asks "How about their time commitment?"
    Then   the LLM has conversation history and knows "their" refers to prior teams
    And    calls search_wiki with a query like "time commitment Midnight Sun Waterloo Rocketry"
    And    generates a contextual follow-up answer with citations

  Scenario: User asks an off-topic question
    When   a user asks "What's the weather in Waterloo?"
    Then   the LLM does not call search_wiki
    And    responds: "I can help with questions about UW clubs, design teams, and programs."

  Scenario: User asks about courses
    When   a user asks "Is CS 135 hard?"
    Then   the LLM does not call search_wiki
    And    responds: "For course reviews and information, check out UWFlow."

  Scenario: No relevant content exists for the query
    When   a user asks "What is the best cooking club at UW?"
    And    no chunks are above the 0.35 similarity threshold
    Then   the system does not send chunks to the LLM for synthesis
    And    uses below-threshold results to suggest related wiki pages
    And    responds: "I don't have enough information to answer this question."

  Scenario: Retrieved chunks are misaligned or incoherent
    When   the LLM receives chunks that don't make sense for the query
    Then   it treats them as if no relevant chunks were found
    And    follows the same fallback behavior

  Scenario: Re-embedding triggers on comment deletion
    When   a comment is deleted
    Then   the system deletes the corresponding comment chunk
    And    the comment is no longer retrievable via RAG search
```

---

## Table of Contents

1. [Embedding Service](#1-embedding-service)
2. [Chunking Strategies](#2-chunking-strategies)
3. [Corpus Ingestion and Re-embedding](#3-corpus-ingestion-and-re-embedding)
4. [Hybrid Retrieval Engine](#4-hybrid-retrieval-engine)
5. [search_wiki Tool](#5-search_wiki-tool)
6. [RAG Search API Route](#6-rag-search-api-route)
7. [Synthesis and Streaming](#7-synthesis-and-streaming)
8. [Conversational Follow-ups](#8-conversational-follow-ups)
9. [Fallback and Uncertainty Handling](#9-fallback-and-uncertainty-handling)
10. [System Prompt and Prompting Guidelines](#10-system-prompt-and-prompting-guidelines)
11. [Database Schema](#11-database-schema)
12. [Non-Functional Requirements](#12-non-functional-requirements)
13. [Exit Criteria](#13-exit-criteria)
14. [Appendix A: Chunk Metadata Schemas](#appendix-a-chunk-metadata-schemas)
15. [Appendix B: Chunking Examples](#appendix-b-chunking-examples)
16. [Appendix C: Hybrid Search Worked Example](#appendix-c-hybrid-search-worked-example)
17. [Appendix D: Example Conversations](#appendix-d-example-conversations)
18. [Appendix E: System Prompt Template](#appendix-e-system-prompt-template)
19. [Design Decisions Log](#design-decisions-log)

---

## 1. Embedding Service

### 1.1 Overview

The embedding service (`src/lib/ai/embeddings.ts`) converts text strings into 512-dimensional float vectors using OpenAI `text-embedding-3-small` via the OpenRouter API. It is the sole embedding interface for the entire application -- all chunk ingestion and query embedding flows through this service.

512 dimensions chosen over the default 1536 because UW Wiki content is well-structured English with clear topic boundaries, and at launch scale (hundreds of pages) the 97.6% quality retention at 33% of the storage cost is the right tradeoff.

### 1.2 Functional Requirements

The system shall:

1. Provide an `embedText(text: string): Promise<number[]>` function that embeds a single text string and returns a 512-dimensional vector.
2. Provide an `embedBatch(texts: string[]): Promise<number[][]>` function that embeds multiple text strings and returns vectors in the same order as the input.
3. Call the OpenRouter API at the embeddings endpoint with model `openai/text-embedding-3-small` and `dimensions: 512`.
4. Implement batching for `embedBatch`: group texts into batches of up to **100 texts** or **8,000 tokens total** per batch (whichever limit is reached first).
5. Implement retry logic: **1 retry with a 1-second delay** on transient HTTP failures (429, 500, 502, 503, 504). Exponential backoff is unnecessary at this scale.
6. Raise a descriptive error if embedding fails after the retry.
7. Log embedding requests with text count for monitoring.

### 1.3 Token Estimation

The system shall implement a lightweight token estimator for batching purposes:

1. Use a simple heuristic: `Math.ceil(text.length / 4)` (approximate for English text).
2. This is used only for batch sizing -- the exact token count is handled by the API.

### 1.4 Request Format

Each embedding API call shall use the following request body:

```json
{
  "model": "openai/text-embedding-3-small",
  "input": ["text1", "text2"],
  "dimensions": 512
}
```

### 1.5 Implementation

```typescript
// src/lib/ai/embeddings.ts

const EMBEDDING_MODEL = "openai/text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 512;
const MAX_BATCH_SIZE = 100;
const MAX_BATCH_TOKENS = 8000;
const CHARS_PER_TOKEN = 4;

export async function embedText(text: string): Promise<number[]> {
  const [vector] = await embedBatch([text]);
  return vector;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const batches = createBatches(texts);
  const allVectors: number[][] = [];

  for (const batch of batches) {
    const vectors = await callEmbeddingAPI(batch);
    allVectors.push(...vectors);
  }

  return allVectors;
}

function createBatches(texts: string[]): string[][] {
  const batches: string[][] = [];
  let currentBatch: string[] = [];
  let currentTokens = 0;

  for (const text of texts) {
    const estimatedTokens = Math.ceil(text.length / CHARS_PER_TOKEN);

    if (
      currentBatch.length >= MAX_BATCH_SIZE ||
      currentTokens + estimatedTokens > MAX_BATCH_TOKENS
    ) {
      batches.push(currentBatch);
      currentBatch = [];
      currentTokens = 0;
    }

    currentBatch.push(text);
    currentTokens += estimatedTokens;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

async function callEmbeddingAPI(texts: string[]): Promise<number[][]> {
  const body = {
    model: EMBEDDING_MODEL,
    input: texts,
    dimensions: EMBEDDING_DIMENSIONS,
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const retryable = [429, 500, 502, 503, 504].includes(response.status);
        if (retryable && attempt === 0) {
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
        throw new Error(`Embedding API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data
        .sort((a: { index: number }, b: { index: number }) => a.index - b.index)
        .map((item: { embedding: number[] }) => item.embedding);
    } catch (error) {
      lastError = error as Error;
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  throw new Error(`Embedding failed after retry: ${lastError?.message}`);
}
```

### 1.6 Caching

No embedding cache is implemented for MVP. Each call produces a fresh embedding. Re-embedding is infrequent (triggered by content changes), and query embedding is fast enough at runtime.

---

## 2. Chunking Strategies

### 2.1 Overview

One chunking strategy handles all wiki page content: section-based chunking from ProseMirror JSON. Each heading-delimited section becomes a single chunk. Chunks that exceed the maximum token limit are split at sentence boundaries with overlap. Two additional chunk types (metadata and comment) are generated separately.

### 2.2 Section-Based Chunking from ProseMirror JSON

**Applies to:** Wiki page content stored as ProseMirror JSON (the native Tiptap document format).

**Strategy:** Walk the ProseMirror document tree, split at heading nodes. Each section (heading + body content until the next heading) becomes a single chunk.

The system shall:

1. Parse the ProseMirror JSON document and identify heading nodes.
2. Extract the text content between consecutive headings as a section.
3. Generate a `section_slug` from the heading text (e.g., "Time Commitment" -> "time-commitment") for deep-link URLs.
4. **Skip sections titled "External Links"** -- URL-only content has no semantic value for retrieval.
5. Prepend a context header to each chunk before embedding:
   ```
   [Midnight Sun > Time Commitment]
   ```
   This bakes the org name and section title into the vector, improving retrieval precision for ~10 extra tokens per chunk.
6. If a section exceeds **1,000 tokens** (approximately 4,000 characters), split it at the nearest sentence boundary with **100-token overlap** between sub-chunks. Append a part indicator (e.g., `[Part 1/2]`) to each sub-chunk's context header.
7. No minimum chunk size or merging. Every section becomes its own chunk regardless of length. Short sections are still useful through keyword search.

### 2.3 Metadata Chunks

**Applies to:** One per organization, containing Pulse ratings.

The system shall:

1. Generate a natural-language summary of the org's Pulse data:
   ```
   Midnight Sun: Selectivity is Application-Based. Vibe Check is 3.2/5 (balanced between
   social and corporate). Co-op Boost is 4.1/5. Tech Stack: Altium, SolidWorks, C++, Python.
   ```
2. Prepend a context header: `[Midnight Sun > Pulse Metadata]`.
3. Embed and store with `chunk_type = 'metadata'`.

### 2.4 Comment Chunks

**Applies to:** One per inline user comment on a wiki page.

The system shall:

1. Use the comment body as the chunk content.
2. Prepend a context header: `[Midnight Sun > Time Commitment > Comment]`.
3. Set `created_at` to the **comment's own `created_at`** timestamp (not the embedding timestamp), so the LLM can say "a commenter in 2024 noted..."
4. Set `anchored_section` to the section the comment is anchored to.
5. Set `references_previous_version = true` if the comment's anchor text was deleted during a page edit and re-anchoring failed. This depends on the anchor handling implementation in the Comments FRD.

### 2.5 Chunking Configuration

The system shall define chunking parameters as constants:

```typescript
// src/lib/ai/embeddings.ts

const CHUNKING_CONFIG = {
  MAX_TOKENS: 1000,
  OVERLAP_TOKENS: 100,
  CHARS_PER_TOKEN: 4,
  SKIP_SECTIONS: ["External Links"],
} as const;
```

### 2.6 Chunk Metadata

Each chunk carries two categories of fields:

**LLM-facing metadata** (returned to the LLM via the `search_wiki` tool):

| Field | Chunk Types | Description |
|---|---|---|
| `org_name` | All | Human-readable org name (e.g., "Midnight Sun") |
| `org_slug` | All | URL slug for deep links (e.g., "midnight-sun") |
| `section_title` | Content, Comment | Section heading text |
| `section_slug` | Content | URL anchor for deep links (e.g., "time-commitment") |
| `chunk_type` | All | "content", "metadata", or "comment" |
| `category` | All | Org category (e.g., "Design Teams") |
| `created_at` | All | When the content was created (comment's created_at for comment chunks) |
| `anchored_section` | Comment | Which section the comment is anchored to |
| `references_previous_version` | Comment | Whether the comment references deleted anchor text |
| `content` | All | The chunk text including context header |

**Internal-only columns** (on the database table for lifecycle operations, never returned to the LLM):

| Field | Purpose |
|---|---|
| `page_id` | Deletion: `DELETE FROM chunks WHERE page_id = $1 AND chunk_type = 'content'` |
| `source_comment_id` | Deletion: `DELETE FROM chunks WHERE source_comment_id = $1` |
| `university_id` | Multi-university query scoping (future) |
| `page_version_id` | Debugging and auditing (which version generated this chunk) |
| `chunk_index` | Ordering sub-chunks within a split section |

---

## 3. Corpus Ingestion and Re-embedding

### 3.1 Overview

The corpus is not static -- it changes whenever wiki pages are edited, comments are posted, or Pulse ratings are submitted. Re-embedding keeps the RAG corpus in sync with the current state of the platform.

### 3.2 Trigger Mechanism

**Application-level triggers.** The Next.js API route that performs the triggering action (accepting an edit proposal, creating a comment, etc.) fires an async background task to re-embed affected chunks. This was chosen over database triggers for MVP because it keeps all logic in one TypeScript codebase, is simpler to debug and test locally, and the small team benefits from reduced infrastructure.

### 3.3 Re-embedding Scenarios

| Trigger | Action | SQL |
|---|---|---|
| Page version accepted | Delete all content chunks for the page, re-chunk and re-embed the new content | `DELETE FROM chunks WHERE page_id = $1 AND chunk_type = 'content'` |
| Comment created | Create a new comment chunk, embed it | `INSERT INTO chunks ...` |
| Comment updated | Delete old comment chunk, create and embed new one | `DELETE FROM chunks WHERE source_comment_id = $1` then `INSERT` |
| Comment deleted | Delete the comment chunk | `DELETE FROM chunks WHERE source_comment_id = $1` |
| Comment anchor fails re-anchoring | Update the flag on the existing chunk | `UPDATE chunks SET references_previous_version = true WHERE source_comment_id = $1` |
| Pulse aggregates updated | Delete old metadata chunk, regenerate and re-embed | `DELETE FROM chunks WHERE org_id = $1 AND chunk_type = 'metadata'` |

### 3.4 Async Execution

All re-embedding runs **asynchronously** -- it does not block the user action. The user sees their edit accepted or comment posted immediately. There is a brief window (seconds) where the new content is not yet searchable via RAG. This is acceptable for MVP.

### 3.5 Implementation

```typescript
// src/lib/ai/embeddings.ts

import { createClient } from "@/lib/supabase/admin";

export async function reembedPage(pageId: string, orgMeta: OrgMeta, content: ProseMirrorDoc) {
  const supabase = createClient();

  await supabase.from("chunks").delete().match({ page_id: pageId, chunk_type: "content" });

  const chunks = chunkProseMirrorDoc(content, orgMeta);
  const texts = chunks.map((c) => c.contentWithHeader);
  const vectors = await embedBatch(texts);

  const rows = chunks.map((chunk, i) => ({
    university_id: orgMeta.universityId,
    org_id: orgMeta.orgId,
    page_id: pageId,
    page_version_id: orgMeta.pageVersionId,
    chunk_type: "content" as const,
    org_name: orgMeta.orgName,
    org_slug: orgMeta.orgSlug,
    category: orgMeta.category,
    section_title: chunk.sectionTitle,
    section_slug: chunk.sectionSlug,
    chunk_index: chunk.chunkIndex,
    content_text: chunk.contentWithHeader,
    embedding: vectors[i],
  }));

  await supabase.from("chunks").insert(rows);
}

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

export async function reembedPulse(orgId: string, orgMeta: OrgMeta, pulse: PulseData) {
  const supabase = createClient();

  await supabase.from("chunks").delete().match({ org_id: orgId, chunk_type: "metadata" });

  const summary = buildPulseSummary(orgMeta.orgName, pulse);
  const header = `[${orgMeta.orgName} > Pulse Metadata]`;
  const contentWithHeader = `${header}\n${summary}`;
  const [vector] = await embedBatch([contentWithHeader]);

  await supabase.from("chunks").insert({
    university_id: orgMeta.universityId,
    org_id: orgId,
    chunk_type: "metadata",
    org_name: orgMeta.orgName,
    org_slug: orgMeta.orgSlug,
    category: orgMeta.category,
    content_text: contentWithHeader,
    embedding: vector,
  });
}
```

---

## 4. Hybrid Retrieval Engine

### 4.1 Overview

The retrieval engine combines two search methods -- semantic (vector) and keyword (full-text) -- and merges results using Reciprocal Rank Fusion (RRF). This hybrid approach achieves ~84% retrieval precision compared to ~62% for semantic-only search.

### 4.2 Semantic Search

The system shall:

1. Embed the query string using `embedText`.
2. Execute a pgvector cosine similarity search against the `chunks` table, returning the top 20 candidates:

```sql
SELECT id, content_text, org_name, org_slug, section_title, section_slug,
       chunk_type, category, anchored_section, references_previous_version,
       created_at,
       1 - (embedding <=> $1::vector) AS similarity_score
FROM chunks
WHERE ($2::uuid IS NULL OR university_id = $2)
ORDER BY embedding <=> $1::vector
LIMIT 20
```

3. Record each result's rank (1-indexed) for RRF scoring.

### 4.3 Keyword Search

The system shall:

1. Convert the query to a `tsquery` using PostgreSQL's `plainto_tsquery`:

```sql
SELECT id, content_text, org_name, org_slug, section_title, section_slug,
       chunk_type, category, anchored_section, references_previous_version,
       created_at,
       ts_rank_cd(content_tsvector, query) AS rank_score
FROM chunks, plainto_tsquery('english', $1) AS query
WHERE content_tsvector @@ query
  AND ($2::uuid IS NULL OR university_id = $2)
ORDER BY rank_score DESC
LIMIT 20
```

2. `plainto_tsquery` tokenizes the query, removes stop words, stems each term, and joins them with AND. For example, `"Which design team uses ROS2"` becomes `'design' & 'team' & 'use' & 'ros2'`.
3. Record each result's rank (1-indexed) for RRF scoring.

### 4.4 Hybrid Search with RRF

The system shall merge results from both search methods using Reciprocal Rank Fusion:

1. Run semantic search and keyword search in parallel.
2. Merge the two result lists using RRF:
   ```
   RRF_score(d) = Σ 1 / (k + rank_i(d))
   ```
   Where `k = 60` (constant that dampens the effect of high rankings) and the sum is over all result lists where chunk `d` appears.
3. Deduplicate by chunk `id` (a chunk may appear in both result lists).
4. Apply the **similarity threshold of 0.35**: any chunk whose cosine similarity score is below 0.35 is excluded from the synthesis set but kept for fallback page suggestions.
5. Sort by descending RRF score and return the **top 8** above-threshold chunks.

### 4.5 Implementation

```typescript
// src/lib/ai/rag.ts

interface ChunkResult {
  id: string;
  content: string;
  orgName: string;
  orgSlug: string;
  sectionTitle: string | null;
  sectionSlug: string | null;
  chunkType: "content" | "metadata" | "comment";
  category: string;
  anchoredSection: string | null;
  referencesPreviousVersion: boolean;
  createdAt: string;
  similarityScore: number;
  rrfScore: number;
}

const RRF_K = 60;
const SIMILARITY_THRESHOLD = 0.35;
const TOP_K_PER_SEARCH = 20;
const TOP_K_RESULTS = 8;

export async function hybridSearch(
  query: string,
  universityId?: string
): Promise<{ results: ChunkResult[]; fallbackPages: { orgName: string; orgSlug: string }[] }> {
  const queryVector = await embedText(query);

  const [semanticResults, keywordResults] = await Promise.all([
    semanticSearch(queryVector, universityId),
    keywordSearch(query, universityId),
  ]);

  const merged = mergeWithRRF(semanticResults, keywordResults);

  const aboveThreshold = merged.filter((r) => r.similarityScore >= SIMILARITY_THRESHOLD);
  const belowThreshold = merged.filter((r) => r.similarityScore < SIMILARITY_THRESHOLD);

  const results = aboveThreshold.slice(0, TOP_K_RESULTS);

  const fallbackPages = [
    ...new Map(
      belowThreshold.map((r) => [r.orgSlug, { orgName: r.orgName, orgSlug: r.orgSlug }])
    ).values(),
  ].slice(0, 5);

  return { results, fallbackPages };
}

function mergeWithRRF(
  semanticResults: RankedResult[],
  keywordResults: RankedResult[]
): ChunkResult[] {
  const scoreMap = new Map<string, { chunk: ChunkResult; rrfScore: number }>();

  for (const [rank, result] of semanticResults.entries()) {
    const existing = scoreMap.get(result.id);
    const rrfContribution = 1 / (RRF_K + rank + 1);
    if (existing) {
      existing.rrfScore += rrfContribution;
    } else {
      scoreMap.set(result.id, { chunk: result, rrfScore: rrfContribution });
    }
  }

  for (const [rank, result] of keywordResults.entries()) {
    const existing = scoreMap.get(result.id);
    const rrfContribution = 1 / (RRF_K + rank + 1);
    if (existing) {
      existing.rrfScore += rrfContribution;
    } else {
      scoreMap.set(result.id, { chunk: result, rrfScore: rrfContribution });
    }
  }

  return [...scoreMap.values()]
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .map((entry) => ({ ...entry.chunk, rrfScore: entry.rrfScore }));
}
```

### 4.6 Search Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `query` | `string` | *(required)* | The search query text |
| `universityId` | `string \| undefined` | `undefined` | Filter by university (future multi-university support) |

---

## 5. search_wiki Tool

### 5.1 Overview

The `search_wiki` tool wraps the hybrid retrieval engine as a Vercel AI SDK tool that the LLM can call during response generation. The LLM decides when and how to call this tool based on the user's question and conversation context.

### 5.2 Tool Definition

```typescript
// src/lib/ai/rag.ts

import { tool } from "ai";
import { z } from "zod";

export const searchWikiTool = tool({
  description:
    "Search the UW Wiki knowledge base for information about UW clubs, design teams, " +
    "academic programs, and student organizations. Returns relevant wiki page sections, " +
    "Pulse metadata, and user comments with source attribution.",
  parameters: z.object({
    query: z
      .string()
      .describe("Natural language search query describing what information you need"),
    filters: z
      .object({
        category: z
          .string()
          .optional()
          .describe("Filter by org category: Design Teams, Engineering Clubs, etc."),
        orgSlug: z
          .string()
          .optional()
          .describe("Filter to a specific org by slug (e.g., 'midnight-sun')"),
      })
      .optional()
      .describe("Optional filters to narrow search scope"),
  }),
  execute: async ({ query, filters }) => {
    const { results, fallbackPages } = await hybridSearch(query);

    if (results.length === 0) {
      return {
        found: false,
        suggestedPages: fallbackPages,
        message: "No relevant content found above the relevance threshold.",
      };
    }

    return {
      found: true,
      chunks: results.map((r, i) => ({
        citationIndex: i + 1,
        content: r.content,
        orgName: r.orgName,
        orgSlug: r.orgSlug,
        sectionTitle: r.sectionTitle,
        sectionSlug: r.sectionSlug,
        chunkType: r.chunkType,
        category: r.category,
        anchoredSection: r.anchoredSection,
        referencesPreviousVersion: r.referencesPreviousVersion,
        createdAt: r.createdAt,
      })),
    };
  },
});
```

### 5.3 Tool Call Limits

The LLM is allowed up to **3 tool calls per turn**, configured via `maxSteps: 3` in the Vercel AI SDK `streamText` call. A limit of 1 would be too restrictive for comparison queries (e.g., "Compare Blueprint and Midnight Sun"); 3 provides flexibility while bounding cost.

---

## 6. RAG Search API Route

### 6.1 Overview

The RAG search endpoint is a Next.js App Router API route that receives conversation messages, passes them to the LLM with the `search_wiki` tool available, and streams the response back via SSE.

### 6.2 Endpoint

```
POST /api/search

Request Body:
{
  "messages": [
    { "role": "user", "content": "Which design team is best for hardware?" }
  ]
}

Response: Vercel AI SDK Data Stream Protocol (SSE)
Auth: None required (PRD Section 9)
```

### 6.3 Implementation

```typescript
// src/app/api/search/route.ts

import { streamText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { searchWikiTool } from "@/lib/ai/rag";
import { SYSTEM_PROMPT } from "@/lib/ai/prompts";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openrouter("google/gemini-2.5-flash"),
    system: SYSTEM_PROMPT,
    messages,
    tools: { search_wiki: searchWikiTool },
    maxSteps: 3,
  });

  return result.toDataStreamResponse();
}
```

---

## 7. Synthesis and Streaming

### 7.1 Model

Gemini 2.5 Flash via OpenRouter. Selected for cost-effectiveness, fast inference, large context window (1M tokens), and strong synthesis quality (PRD Section 6.1).

### 7.2 Streaming

The Vercel AI SDK `streamText` function handles token-by-token streaming via the Data Stream Protocol (Server-Sent Events). The frontend consumes this using the `useChat` hook from `ai/react`.

### 7.3 Citation Format

The LLM generates inline numbered citations `[1]`, `[2]`, etc. referencing specific chunks from the `search_wiki` tool response. After the answer text, a source list is included with:

- `org_name` -- e.g., "Midnight Sun"
- `section_title` -- e.g., "Time Commitment"
- Deep link URL -- `/wiki/{orgSlug}#{sectionSlug}` (e.g., `/wiki/midnight-sun#time-commitment`)

The frontend renders citation numbers as clickable badges. Hovering shows a preview with the source name and section. Clicking navigates to the deep link.

---

## 8. Conversational Follow-ups

### 8.1 Approach: Tool-Calling

The system uses a tool-calling approach rather than query rewriting. The LLM receives the full conversation history and decides when and how to call `search_wiki`. On follow-up questions, the LLM already has context from prior turns and formulates targeted search queries.

This is simpler than query rewriting (no separate LLM call to reformulate), more flexible (the LLM can make multiple searches per turn), and native to the Vercel AI SDK.

### 8.2 Context Management

The system shall:

1. Keep the last **5-8 turns** of raw messages in the conversation.
2. For conversations exceeding 8 turns, summarize older turns into a condensed context block.
3. Gemini 2.5 Flash's 1M token context window provides ample headroom at this scale.

### 8.3 Session Handling

- Conversation state is managed **client-side** via the `useChat` hook from `ai/react`.
- **No server-side session persistence for MVP.** Conversations are ephemeral -- refreshing the page starts a new conversation.
- Each conversation gets a client-side ID for analytics tracking.

---

## 9. Fallback and Uncertainty Handling

### 9.1 No Relevant Chunks

When retrieval returns no chunks above the 0.35 similarity threshold:

1. Do **not** send chunks to the LLM for synthesis.
2. Use the below-threshold results from the same search to extract related page names and slugs.
3. Return: "I don't have enough information to answer this question. You might find relevant information on these pages: [page links]"

### 9.2 Misaligned or Incoherent Chunks

When retrieved chunks don't make sense or aren't aligned with the query, the LLM shall treat them identically to the no-chunks case. It shall not attempt to force an answer from irrelevant or incoherent content.

### 9.3 Contested Information

When chunks from different sources disagree (e.g., a page says "5 hours/week" but a comment says "more like 15"), the LLM shall surface both perspectives with citations. Comments that contradict page content are presented as "however, a commenter noted..."

### 9.4 No Minimum Chunk Requirement

A single highly relevant chunk is sufficient for a good answer. The system shall not require a minimum number of chunks before generating a response.

---

## 10. System Prompt and Prompting Guidelines

### 10.1 Overview

The system prompt instructs Gemini 2.5 Flash on how to behave as UW Wiki's AI search assistant. The full template is in [Appendix E](#appendix-e-system-prompt-template). Key rules are summarized below.

### 10.2 Core Rules

1. **Only answer from retrieved chunks.** Do not use general training knowledge about UW organizations. If chunks don't contain the answer, follow fallback behavior.
2. **Cite every factual claim.** Every specific fact (hours, names, dates, ratings) must have a numbered inline citation `[1]`. General synthesis across multiple sources can go uncited.
3. **Treat ALL comments as anonymous.** Never attribute a comment to a specific person. Use "a commenter noted..." or "one user commented..." -- never names, even if attribution data exists.
4. **If retrieved chunks don't make sense or aren't aligned with the query, treat as if no relevant chunks were found.** Do not force an answer from irrelevant or incoherent content.

### 10.3 Tone and Editorial Stance

- Write like a helpful upper-year student, not a corporate FAQ. Match the PRD's "SLC Test" -- informative, direct, practical.
- **[CRITICAL] Never editorialize or add moral judgments.** Present information, don't judge. Don't say "sadly, this team has a toxic culture" -- say "multiple commenters described the culture as intense and competitive." The LLM is a search tool, not an advisor.
- **[CRITICAL] Handle comparisons fairly.** When comparing orgs, present both sides with equal depth. Never declare a "winner." Structure comparisons around clear dimensions (time commitment, culture, co-op value, etc.) and present tradeoffs so the student can decide.

### 10.4 Scope

- **[CRITICAL] Only answer questions about UW extracurriculars, programs, and campus life.** For off-topic questions, politely redirect: "I can help with questions about UW clubs, design teams, and programs."
- For course-related questions, redirect to UWFlow: "For course reviews and information, check out UWFlow."

### 10.5 Content Type Distinction

- When info comes from an official section, note it: "According to the team's official section..."
- When info comes from a comment, note it: "However, a commenter noted..."
- When info comes from Pulse data, note it: "Based on community ratings..."

### 10.6 Temporal Awareness

- When citing older comments, note the age: "A commenter in 2024 noted..." so the reader knows it may be outdated.
- When a chunk has `references_previous_version: true`, say: "A comment from a previous version of this page noted..."

### 10.7 Uncertainty

- When chunks disagree, present both perspectives with citations.
- When info is sparse (single comment, no page content), caveat: "Based on limited information..."
- Never present a single comment as established fact.

---

## 11. Database Schema

### 11.1 Chunks Table

```sql
CREATE TABLE chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Internal-only: lifecycle and scoping
  university_id UUID NOT NULL REFERENCES universities(id),
  org_id UUID NOT NULL REFERENCES organizations(id),
  page_id UUID REFERENCES pages(id),
  page_version_id UUID REFERENCES page_versions(id),
  source_comment_id UUID REFERENCES comments(id),

  -- LLM-facing: returned in search results
  chunk_type TEXT NOT NULL CHECK (chunk_type IN ('content', 'metadata', 'comment')),
  org_name TEXT NOT NULL,
  org_slug TEXT NOT NULL,
  category TEXT NOT NULL,
  section_title TEXT,
  section_slug TEXT,
  anchored_section TEXT,
  chunk_index INTEGER,
  references_previous_version BOOLEAN NOT NULL DEFAULT false,

  -- Content and search
  content_text TEXT NOT NULL,
  content_tsvector TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content_text)) STORED,
  embedding VECTOR(512) NOT NULL,

  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 11.2 Indexes

```sql
-- Semantic search: HNSW for approximate nearest neighbor
CREATE INDEX idx_chunks_embedding ON chunks USING hnsw (embedding vector_cosine_ops);

-- Keyword search: GIN for full-text search
CREATE INDEX idx_chunks_tsvector ON chunks USING gin (content_tsvector);

-- Lifecycle operations
CREATE INDEX idx_chunks_org_id ON chunks (org_id);
CREATE INDEX idx_chunks_page_id ON chunks (page_id);
CREATE INDEX idx_chunks_source_comment ON chunks (source_comment_id);
CREATE INDEX idx_chunks_type ON chunks (chunk_type);
```

---

## 12. Non-Functional Requirements

| Requirement | Target |
|---|---|
| **Latency** | First token within 2 seconds of query submission |
| **Streaming** | Full response streams token-by-token, not delivered as a block |
| **SEO** | Search results pages are NOT indexed (dynamic, per-session content) |
| **Rate limiting** | No rate limiting on RAG search for MVP (revisit if abuse occurs) |
| **Cost monitoring** | Track OpenRouter API spend per feature (embedding vs. synthesis) via API usage dashboard |

---

## 13. Exit Criteria

FRD 1 is complete when ALL of the following are satisfied:

| # | Criterion | Verification |
|---|---|---|
| 1 | Embedding service produces 512-dimensional vectors | Call `embedText("test")` and verify output length is 512 |
| 2 | Batch embedding handles multiple texts | Call `embedBatch(["text1", ..., "text10"])` and verify 10 vectors returned in order |
| 3 | Wiki page content is chunked by section | Parse a test ProseMirror doc and verify sections become separate chunks |
| 4 | Context headers are prepended | Verify chunk text starts with `[OrgName > SectionTitle]` |
| 5 | "External Links" section is skipped | Verify no chunk is created for a section titled "External Links" |
| 6 | Large sections are split with overlap | Create a section >1000 tokens and verify it splits with 100-token overlap |
| 7 | Metadata chunk is generated for Pulse data | Call `reembedPulse` and verify a chunk with `chunk_type = 'metadata'` exists |
| 8 | Comment chunk is generated | Call `reembedComment` and verify a chunk with `chunk_type = 'comment'` exists |
| 9 | Semantic search returns relevant results | Search for "hardware design team" and verify relevant chunks rank highly |
| 10 | Keyword search returns exact matches | Search for "ROS2" and verify chunks containing "ROS2" are returned |
| 11 | Hybrid search merges both methods via RRF | Verify hybrid results contain chunks from both semantic and keyword paths |
| 12 | `search_wiki` tool returns chunk results | Call the tool with a test query and verify formatted output with metadata |
| 13 | Streaming response works end-to-end | `POST /api/search` with a test question returns an SSE stream with tokens |
| 14 | Citations include deep links | Verify response source list contains `/wiki/{slug}#{section-slug}` URLs |
| 15 | Follow-up questions maintain context | Ask a follow-up referencing prior context and verify the LLM uses it |
| 16 | Off-topic questions are redirected | Ask "What's the weather?" and verify the response does not call `search_wiki` |
| 17 | Fallback suggests pages when no content matches | Ask about a topic with no wiki content and verify page suggestions appear |
| 18 | Re-embedding triggers on page edit | Accept an edit proposal and verify old chunks are deleted and new ones created |
| 19 | Re-embedding triggers on comment creation/deletion | Create and delete a comment and verify chunks are added/removed accordingly |

---

## Appendix A: Chunk Metadata Schemas

### A.1 Content Chunk Example

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "chunk_type": "content",
  "org_name": "Midnight Sun",
  "org_slug": "midnight-sun",
  "category": "Design Teams",
  "section_title": "Time Commitment",
  "section_slug": "time-commitment",
  "chunk_index": 0,
  "content_text": "[Midnight Sun > Time Commitment]\nMechanical subteam: 8-10 hours/week during build season, 3-4 hours otherwise. Electrical subteam members report similar hours. Competition season (May-July) can spike to 15-20 hours/week.",
  "created_at": "2026-04-05T14:30:00Z"
}
```

### A.2 Metadata Chunk Example

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "chunk_type": "metadata",
  "org_name": "WATonomous",
  "org_slug": "watonomous",
  "category": "Design Teams",
  "section_title": null,
  "section_slug": null,
  "content_text": "[WATonomous > Pulse Metadata]\nWATonomous: Selectivity is Application-Based. Vibe Check is 2.8/5 (leaning corporate). Co-op Boost is 4.5/5. Tech Stack: ROS2, C++, Python, PyTorch, Docker.",
  "created_at": "2026-04-05T14:30:00Z"
}
```

### A.3 Comment Chunk Example

```json
{
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "chunk_type": "comment",
  "org_name": "Blueprint",
  "org_slug": "blueprint",
  "category": "Engineering Clubs",
  "anchored_section": "Culture and Vibe",
  "references_previous_version": false,
  "content_text": "[Blueprint > Culture and Vibe > Comment]\nThe culture is genuinely collaborative. As a first-year I felt welcomed from day one. The leads are approachable and there's no weird hierarchy.",
  "created_at": "2026-03-15T09:20:00Z"
}
```

---

## Appendix B: Chunking Examples

### B.1 Section-Based Chunking from ProseMirror JSON

**Source ProseMirror JSON (simplified):**

```json
{
  "type": "doc",
  "content": [
    { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "Time Commitment" }] },
    { "type": "paragraph", "content": [{ "type": "text", "text": "Mechanical subteam: 8-10 hours/week during build season, 3-4 hours otherwise." }] },
    { "type": "paragraph", "content": [{ "type": "text", "text": "Competition season (May-July) can spike to 15-20 hours/week." }] },
    { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "Culture and Vibe" }] },
    { "type": "paragraph", "content": [{ "type": "text", "text": "Very engineering-focused culture. Members are passionate about solar car technology." }] },
    { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "External Links" }] },
    { "type": "paragraph", "content": [{ "type": "text", "text": "Website: https://www.midnightsun.design" }] }
  ]
}
```

**Resulting chunks (for org "Midnight Sun"):**

**Chunk 1:**
```
[Midnight Sun > Time Commitment]
Mechanical subteam: 8-10 hours/week during build season, 3-4 hours otherwise.
Competition season (May-July) can spike to 15-20 hours/week.
```

**Chunk 2:**
```
[Midnight Sun > Culture and Vibe]
Very engineering-focused culture. Members are passionate about solar car technology.
```

**"External Links" section is skipped -- no chunk created.**

### B.2 Large Section Split with Overlap

If "Past Projects" exceeds 1000 tokens, it splits into:

**Chunk 1:**
```
[Midnight Sun > Past Projects (Part 1/2)]
[First ~950 tokens of content...]
```

**Chunk 2:**
```
[Midnight Sun > Past Projects (Part 2/2)]
[...last 100 tokens of Chunk 1 repeated as overlap...]
[Remaining content...]
```

---

## Appendix C: Hybrid Search Worked Example

**Query:** `"Which design team uses ROS2?"`

**Step 1 -- Semantic search (top 5 of 20):**

| Rank | Chunk | Similarity |
|---|---|---|
| 1 | WATonomous > Overview ("autonomous vehicle team using ROS2...") | 0.82 |
| 2 | UW Robotics > Subteams ("software subteam works with ROS...") | 0.74 |
| 3 | WATonomous > Pulse Metadata ("Tech Stack: ROS2, C++...") | 0.71 |
| 4 | Midnight Sun > Overview ("solar car design team...") | 0.45 |
| 5 | Waterloo Rocketry > Overview ("rocket design team...") | 0.38 |

**Step 2 -- Keyword search (top 5 of 20):**

`plainto_tsquery('english', 'Which design team uses ROS2')` → `'design' & 'team' & 'use' & 'ros2'`

| Rank | Chunk | FTS Rank |
|---|---|---|
| 1 | WATonomous > Overview (contains "design team" and "ROS2") | 0.45 |
| 2 | WATonomous > Pulse Metadata (contains "ROS2") | 0.38 |
| 3 | UW Robotics > Subteams (contains "ROS" but not "ROS2") | 0.22 |

**Step 3 -- RRF merge (k=60):**

| Chunk | Semantic Rank | Keyword Rank | RRF Score | Final Rank |
|---|---|---|---|---|
| WATonomous > Overview | 1 | 1 | 1/61 + 1/61 = 0.0328 | **1** |
| WATonomous > Pulse Metadata | 3 | 2 | 1/63 + 1/62 = 0.0320 | **2** |
| UW Robotics > Subteams | 2 | 3 | 1/62 + 1/63 = 0.0320 | **3** |
| Midnight Sun > Overview | 4 | -- | 1/64 = 0.0156 | **4** |
| Waterloo Rocketry > Overview | 5 | -- | 1/65 = 0.0154 | **5** |

**Step 4 -- Threshold filter (0.35):**

Midnight Sun (0.45) and Waterloo Rocketry (0.38) are above threshold. All 5 chunks pass. Top 8 returned (only 5 in this example).

WATonomous > Overview ranks #1, boosted by appearing in both result lists. The keyword search caught "ROS2" as an exact match, which semantic search alone might have weighted less precisely.

---

## Appendix D: Example Conversations

### D.1 Single-Turn Factual Query

**User:** "How much time does Midnight Sun take per week?"

**LLM calls:** `search_wiki({ query: "time commitment Midnight Sun weekly hours" })`

**Response:**
> Based on contributor information, Midnight Sun's time commitment varies by subteam and season. The mechanical subteam reports 8-10 hours/week during build season and 3-4 hours otherwise [1]. Competition season (May-July) can spike to 15-20 hours/week [1]. However, a commenter noted that the actual hours tend to be higher than what's reported, especially close to competition deadlines [2].
>
> **Sources:**
> 1. [Midnight Sun - Time Commitment](/wiki/midnight-sun#time-commitment)
> 2. [Midnight Sun - Time Commitment (comment)](/wiki/midnight-sun#time-commitment)

### D.2 Multi-Turn Comparison

**User:** "Compare Blueprint and WATonomous for a first-year CS student"

**LLM calls:** `search_wiki({ query: "Blueprint first-year CS student culture time commitment" })`, `search_wiki({ query: "WATonomous first-year CS student culture time commitment" })`

**Response:**
> Here's a comparison across key dimensions:
>
> **Time Commitment:** Blueprint members report around 5-8 hours/week [1], while WATonomous typically expects 10-15 hours/week [2]. Both increase during crunch periods.
>
> **Culture:** Blueprint is described as genuinely collaborative with approachable leads [3]. WATonomous leans more corporate with a competitive environment [4]. Based on community ratings, Blueprint's Vibe Check is 2.1/5 (social-leaning) and WATonomous is 2.8/5 (slightly more corporate) [5][6].
>
> **Co-op Relevance:** Both rate highly for co-op boost. Blueprint (4.2/5) focuses on full-stack web development for nonprofits [5]. WATonomous (4.5/5) works with autonomous vehicle software -- ROS2, C++, PyTorch [6].
>
> **Sources:**
> 1. [Blueprint - Time Commitment](/wiki/blueprint#time-commitment)
> 2. [WATonomous - Time Commitment](/wiki/watonomous#time-commitment)
> 3. [Blueprint - Culture and Vibe (comment)](/wiki/blueprint#culture-and-vibe)
> 4. [WATonomous - Culture and Vibe](/wiki/watonomous#culture-and-vibe)
> 5. [Blueprint - Pulse Metadata](/wiki/blueprint)
> 6. [WATonomous - Pulse Metadata](/wiki/watonomous)

**User:** "Which one is easier to get into?"

**LLM calls:** `search_wiki({ query: "Blueprint WATonomous selectivity application process how to apply" })`

**Response:**
> Both are application-based [1][2]. Blueprint's application process includes a written application and an interview focused on motivation and teamwork [3]. A commenter in 2025 described it as "fairly accessible for first-years" [4]. WATonomous also requires an application and technical interview, with a commenter noting the technical bar is higher, especially for the perception and planning subteams [5].
>
> **Sources:**
> 1. [Blueprint - Pulse Metadata](/wiki/blueprint)
> 2. [WATonomous - Pulse Metadata](/wiki/watonomous)
> 3. [Blueprint - How to Apply](/wiki/blueprint#how-to-apply)
> 4. [Blueprint - How to Apply (comment)](/wiki/blueprint#how-to-apply)
> 5. [WATonomous - How to Apply (comment)](/wiki/watonomous#how-to-apply)

### D.3 Off-Topic Query

**User:** "What's the best restaurant near campus?"

**Response:**
> I can help with questions about UW clubs, design teams, and programs. For restaurant recommendations, you might want to check Reddit or Google Maps.

### D.4 Course Query Redirect

**User:** "Is CS 135 a hard course?"

**Response:**
> For course reviews and information, check out UWFlow. I focus on UW clubs, design teams, and extracurricular programs.

---

## Appendix E: System Prompt Template

```
You are UW Wiki's AI search assistant. You help University of Waterloo students find information about clubs, design teams, academic programs, and student organizations.

## How You Work

You have access to a search_wiki tool that searches the UW Wiki knowledge base. Use it to find relevant information before answering questions. You may call it up to 3 times per response if needed (e.g., for comparison queries).

## Core Rules

1. ONLY answer from retrieved wiki content. Never use your general training knowledge about UW organizations. If the wiki doesn't contain the answer, say so.

2. Cite every factual claim with inline numbered citations [1], [2], etc. Each citation corresponds to a chunk from the search results. General synthesis across multiple sources can go uncited.

3. Treat ALL comments as anonymous. Say "a commenter noted..." or "one user commented..." — never attribute to a specific person.

4. If retrieved chunks don't make sense for the question or seem irrelevant, treat it as if no relevant information was found. Do not force an answer from bad data.

## Tone

Write like a helpful upper-year student — informative, direct, practical. Not a corporate FAQ, not a rant. Match the "SLC Test": content should be what you'd say if a student stopped you in SLC and asked.

## CRITICAL Rules

- NEVER editorialize or add moral judgments. Present information, don't judge. Say "commenters described the culture as intense and competitive" — not "sadly, the team has a toxic culture." You are a search tool, not an advisor.

- NEVER declare a winner in comparisons. Present both sides with equal depth. Structure comparisons around dimensions (time commitment, culture, co-op value) and present tradeoffs. Let the student decide.

- ONLY answer questions about UW extracurriculars, programs, and campus life. For off-topic questions, politely redirect: "I can help with questions about UW clubs, design teams, and programs." For course questions, redirect: "For course reviews and information, check out UWFlow."

## Content Types

Distinguish between source types in your answers:
- Official sections: "According to the team's official section..."
- User comments: "However, a commenter noted..."
- Pulse ratings: "Based on community ratings..."
- Previous-version comments: "A comment from a previous version of this page noted..."

## Temporal Awareness

- Note when comments are old: "A commenter in 2024 noted..." to signal the info may be outdated.
- When a chunk has references_previous_version = true, say: "A comment from a previous version of this page noted..."

## Uncertainty

- When sources disagree, present both perspectives with citations.
- When information is sparse (e.g., only one comment, no page content), caveat it: "Based on limited information..."
- Never present a single comment as established fact.

## Citations Format

Use numbered inline citations [1], [2] in your response text. After your answer, include a Sources section:

Sources:
1. [Org Name - Section Title](/wiki/org-slug#section-slug)
2. [Org Name - Section Title (comment)](/wiki/org-slug#section-slug)

For Pulse metadata citations, link to the org page without a section anchor:
3. [Org Name - Pulse Metadata](/wiki/org-slug)
```

---

## Design Decisions Log

| Decision | Rationale |
|---|---|
| 512 dimensions over 1536 | UW Wiki content is well-structured English with clear topic boundaries. At launch scale (hundreds of pages), 97.6% quality retention at 33% storage cost is the right tradeoff. Can re-embed at 1536 later if needed. |
| Section-based chunking over fixed-size | Wiki pages have natural section structure (ProseMirror headings). Section-based chunking preserves semantic boundaries. Fixed-size chunks would split mid-section, losing context. |
| Context header prepended to chunks | Bakes org name and section title into the embedding vector, improving retrieval precision when generic content (e.g., "competitive culture") could match multiple orgs. ~10 extra tokens per chunk, negligible cost. |
| No min chunk size or merging | Adds complexity for marginal benefit. Short sections (e.g., a brief "Overview") are still useful through keyword search. Embedding quality for very short text is lower but acceptable. |
| Skip "External Links" section | URL-only content has no semantic value for retrieval. Keyword search on other chunks already catches org-specific queries. Saves embedding API calls. |
| Tool-calling over query rewriting | Tool-calling is native to the Vercel AI SDK (`streamText` with tools). More flexible than query rewriting -- the LLM can make multiple targeted searches per turn. Fewer LLM calls on follow-ups (no separate rewriting step). |
| Hybrid search with RRF over semantic-only | Pure semantic search achieves ~62% precision. Adding keyword search with RRF merging pushes it to ~84%. Critical for exact term matches (org names, tech stack terms like "ROS2"). ~2-4 hours additional implementation. |
| `plainto_tsquery` over `to_tsquery` | `plainto_tsquery` handles natural language input without requiring boolean operators. Users and the LLM send natural language queries. Joins terms with AND, which is strict but fine since semantic search handles fuzzy matching. |
| No reranker for MVP | Reranking (Cohere, cross-encoder) adds cost ($1/1000 queries) and latency (~200-300ms). Hybrid search with RRF provides sufficient precision for launch. Revisit post-launch if retrieval quality is insufficient. |
| Application-level re-embedding over DB triggers | Keeps all logic in one TypeScript codebase. Easier to debug and test locally. The small team (2-4 engineers) benefits from reduced infrastructure. Finite number of content change points makes it manageable. |
| 0.35 similarity threshold | Filters clearly irrelevant results while being lenient enough for loosely-related content. Starting point to be tuned with real user queries post-launch. |
| Top 8 chunks per search call | Balanced for both specific questions (need fewer chunks) and comparison queries (need chunks from multiple orgs). At ~100-500 tokens per chunk, 8 chunks is ~800-4000 tokens of context -- well within Gemini's window. |
| Max 3 tool calls per turn | Allows comparison queries (search each org separately) while bounding cost. Configured via one parameter (`maxSteps: 3`). Most queries need only 1 call. |
| Comments in RAG corpus | User comments contain valuable perspectives (disagreements, nuances, additional data points). Including them surfaces community knowledge beyond the primary article. Comments are distinguished by `chunk_type` so the LLM can treat them appropriately. |
| Separate metadata chunk per org | Cleanly separates Pulse data from page content. Allows Pulse queries ("How selective is WATonomous?") to be answered without retrieving full page content. Simple 1:1 mapping for re-embedding when aggregates change. |
| `created_at` only, no `last_updated_at` | Chunks are deleted and recreated, never updated in place (except `references_previous_version` flag). `created_at` captures when the content was authored. `last_updated_at` would always equal `created_at` for content and metadata chunks. |
| Ephemeral conversations for MVP | No server-side session storage needed. `useChat` manages state client-side. Reduces backend complexity. Persistent conversations can be added post-MVP if user research shows demand. |
| 1 retry with 1s delay over exponential backoff | At UW Wiki's scale (handful of embedding calls per content change, one per search query), exponential backoff is overengineering. A single retry catches transient failures; persistent failures should surface as errors. |
| `references_previous_version` flag on comment chunks | When a comment's anchor text is deleted and re-anchoring fails, the comment is still visible on the page. Keeping it in RAG with a flag lets the LLM contextualize it ("a comment from a previous version noted..."). Exact behavior depends on anchor handling in the Comments FRD. |
