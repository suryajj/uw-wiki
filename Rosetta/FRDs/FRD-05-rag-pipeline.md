# FRD-05: Real-Time RAG Pipeline

## Overview

The Real-Time RAG (Retrieval-Augmented Generation) Pipeline continuously analyzes professor speech to surface relevant course materials as citations. As transcription segments accumulate, the system triggers semantic searches against uploaded documents, ranks results, and returns the top 3 most relevant citations for display alongside the transcript.

**Key Design Decisions:**

1. **Sliding Window Trigger** — RAG queries are triggered after accumulating 2-3 sentences (roughly 5-10 seconds of speech), balancing context richness with latency.

2. **KeyBERT Query Enrichment** — Raw transcript text is enriched with extracted keywords using KeyBERT (sentence-transformers/all-MiniLM-L6-v2).

3. **Local Embeddings** — Query and document embeddings use local BAAI/bge-base-en-v1.5 model (768 dimensions) for fast inference.

4. **Distance-Based Early Exit** — If minimum distance > 1.5, skip re-ranking and return no citations (irrelevant query).

5. **TinyBERT Re-ranking** — Cross-encoder ms-marco-TinyBERT-L-2-v2 re-ranks candidates to select top 3.

6. **Async Non-Blocking** — RAG queries run asynchronously and never block the transcription or translation pipelines.

---

## User Stories

### Citations Appearing During Lecture

A professor is explaining the fundamental theorem of calculus. The student has uploaded the course textbook PDF, which includes a chapter on this topic.

As the professor speaks, the live transcription displays the text. After 2-3 sentences about the theorem, superscript citation numbers appear inline: "...and that is what the fundamental theorem of calculus tells us<sup>1, 2, 3</sup>..."

The numbers use varying opacity — citation 1 is darkest (most relevant), citation 3 is lightest (least relevant). The student hovers over citation 1 and sees a tooltip: "Calculus Textbook, page 142".

### Viewing Citation Details

The student clicks on citation number 1 in the transcript. The right panel scrolls to highlight the corresponding citation card, which shows:

- Document name: "Calculus_Textbook.pdf"
- Page number: 142
- Section: "Chapter 7: The Fundamental Theorem"
- Snippet: A preview of the relevant text from that section

The student can click "View in Document" to open a PDF preview focused on that page.

### Citations from Multiple Documents

The student has uploaded both the textbook and the professor's lecture notes. When the professor discusses a topic covered in both, the RAG pipeline may return citations from different documents:

- Citation 1: Textbook, page 142
- Citation 2: Lecture Notes, page 5
- Citation 3: Textbook, page 145

This helps the student understand which resources cover the current topic and compare perspectives.

### Low-Relevance Queries

The professor makes a tangential comment about their morning coffee. The RAG pipeline runs but finds no highly relevant matches. In this case:

- No citations are inserted (relevance threshold not met)
- The transcript continues without superscript numbers
- No false positives distract the student

### Citations Accumulating Over Time

As the lecture progresses, the citation panel on the right fills with citation cards. Each card shows:

- The citation number (matching the inline superscript)
- Document and page reference
- A text preview
- A timestamp of when it was generated

The student can scroll through all citations from the lecture, building a comprehensive list of referenced materials.

---

## System Behavior

### Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Transcription Stream                      │
│  "The fundamental theorem states that integration and..."    │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   Sliding Window Buffer                      │
│  Accumulates 2-3 sentences (~50-100 words)                  │
│  Triggers on sentence boundary detection                     │
└──────────────────────────┬──────────────────────────────────┘
                           │ Window complete
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    KeyBERT Keyword Extraction                 │
│  Model: sentence-transformers/all-MiniLM-L6-v2              │
│  Extract 3-5 key terms per window                            │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Local BGE Embedding                        │
│  BAAI/bge-base-en-v1.5 (768 dimensions)                      │
│  Enriched query = original text + keywords                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    ChromaDB Vector Search                     │
│  Filter: session_id = current session                        │
│  Returns: top 5 candidates with distances                    │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                Distance-Based Early Exit                      │
│  If min_distance > 1.5: return no citations                  │
│  (Query is not relevant to documents)                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    TinyBERT Cross-Encoder Re-ranking          │
│  Model: ms-marco-TinyBERT-L-2-v2                             │
│  Score each candidate against query                          │
│  Returns: top 3 with relevance scores                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Citation Output                           │
│  [                                                           │
│    { rank: 1, doc: "Textbook", page: 142, score: 0.92 },    │
│    { rank: 2, doc: "Notes", page: 5, score: 0.78 },         │
│    { rank: 3, doc: "Textbook", page: 145, score: 0.65 }     │
│  ]                                                           │
└─────────────────────────────────────────────────────────────┘
```

### Sliding Window Logic

**Window Accumulation:**

- Buffer incoming transcript segments
- Detect sentence boundaries using punctuation patterns
- Trigger after 2-3 complete sentences
- Minimum window size: 30 words
- Maximum window size: 150 words

**Sentence Detection:**

- End markers: `.`, `?`, `!`
- Ignore abbreviations: "Dr.", "Prof.", "etc."
- Handle ellipsis: "..." doesn't end sentence mid-thought

**Overlap Strategy:**

- New window starts from last sentence of previous window
- Ensures context continuity across queries

### Query Enrichment

**Keyword Extraction (KeyBERT):**

- Model: sentence-transformers/all-MiniLM-L6-v2
- Extract 3-5 key terms per window
- Uses MMR (Maximal Marginal Relevance) for diversity

**Query Construction:**

- Combine original window text with extracted keywords
- Format: "{original_text} {keyword1} {keyword2} ..."
- Keep query under 200 tokens for embedding

### Retrieval Configuration

**Vector Search:**

- Embedding model: `BAAI/bge-base-en-v1.5` (768 dimensions) — local model
- Similarity metric: L2 distance (Chroma default)
- Filter: session_id matches current session
- Top-k: 5 candidates

**Distance-Based Early Exit:**

- Threshold: 1.5 (L2 distance)
- If min(distances) > 1.5, return empty citations
- Prevents irrelevant queries from triggering re-ranking

**Re-ranking:**

- Model: `cross-encoder/ms-marco-TinyBERT-L-2-v2`
- Runs locally (no API call)
- Scores each candidate against query
- Returns top 3

### Latency Targets

| Stage                      | Target                           |
| -------------------------- | -------------------------------- |
| Window accumulation        | 5-10 seconds (natural speech)    |
| KeyBERT keyword extraction | < 20ms                           |
| Local BGE embedding        | < 50ms                           |
| ChromaDB vector search     | < 20ms                           |
| TinyBERT re-ranking        | < 30ms                           |
| **Total pipeline**         | **~100ms after window complete** |

---

## API Endpoints

### Query RAG

```
POST /api/v1/rag/query
```

Request Schema:

```
{
  session_id: UUID (required),
  transcript_text: string (required, the window text),
  window_index: integer (required, for ordering)
}
```

Response Schema:

```
{
  window_index: integer,
  citations: [
    {
      rank: integer (1, 2, or 3),
      document_id: UUID,
      document_name: string,
      page_number: integer,
      section_heading: string | null,
      snippet: string (100-200 chars),
      relevance_score: number (0-1)
    }
  ],
  query_metadata: {
    keywords: [string],
    expanded_concepts: [string],
    processing_time_ms: integer
  }
}
```

### Get Citation Details

```
GET /api/v1/citations/{citation_id}
```

Response Schema:

```
{
  id: UUID,
  document_id: UUID,
  document_name: string,
  page_number: integer,
  section_heading: string | null,
  full_chunk_text: string,
  relevance_score: number,
  created_at: datetime
}
```

### List Session Citations

```
GET /api/v1/sessions/{session_id}/citations
```

Response Schema:

```
{
  citations: [
    {
      id: UUID,
      window_index: integer,
      rank: integer,
      document_name: string,
      page_number: integer,
      snippet: string,
      created_at: datetime
    }
  ]
}
```

---

## System State

### Entities

**Citation**
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| session_id | UUID | Foreign key to session |
| transcript_id | UUID | Foreign key to transcript segment |
| window_index | INTEGER | Which window triggered this citation |
| rank | INTEGER | 1, 2, or 3 (relevance order) |
| document_id | UUID | Foreign key to document |
| chunk_id | UUID | Foreign key to document chunk |
| page_number | INTEGER | Page in source document |
| section_heading | VARCHAR(255) | Section title if available |
| snippet | TEXT | Preview text from chunk |
| relevance_score | FLOAT | Re-ranker score (0-1) |
| created_at | TIMESTAMP | When citation was generated |

### Relationships

```
Session (1) ──────── (n) Citation
Transcript (1) ────── (n) Citation
Document (1) ──────── (n) Citation
DocumentChunk (1) ─── (n) Citation
```

### Chroma Query Metadata

When querying Chroma, results include:

```
{
  ids: [chunk_embedding_ids],
  distances: [similarity_scores],
  metadatas: [
    {
      document_id: string,
      session_id: string,
      page_number: integer,
      section_heading: string | null,
      chunk_index: integer
    }
  ],
  documents: [chunk_texts]
}
```

---

## Frontend Behavior

### Citation Display in Transcript

**Inline Citations:**

- Superscript numbers appear after relevant transcript segments
- Format: `<sup>1, 2, 3</sup>`
- Styled with decreasing opacity: 1 (100%), 2 (70%), 3 (50%)
- Clickable — clicking scrolls citation panel to that citation

**Hover Behavior:**

- Tooltip shows: "Document Name, page X"
- Brief delay before showing (200ms)
- Tooltip follows cursor

**Click Behavior:**

- Highlight corresponding citation card in right panel
- Scroll citation panel if needed
- Brief pulse animation on the card

### Citation Panel (Right Sidebar)

**Panel Header:**

- "Citations" title
- Total citation count badge
- Filter/search option (future enhancement)

**Citation Card:**

```
┌─────────────────────────────────┐
│ [1]  Calculus Textbook          │
│      Page 142                   │
│      ─────────────────────────  │
│      "The fundamental theorem   │
│      of calculus establishes    │
│      the relationship between..." │
│                                 │
│      [View Page]                │
└─────────────────────────────────┘
```

**Card Elements:**

- Rank badge (1, 2, or 3 with matching opacity)
- Document name
- Page number
- Section heading (if available)
- Text snippet (truncated to ~150 chars)
- "View Page" link to document preview

**Ordering:**

- Grouped by transcript window
- Within group, ordered by rank (1, 2, 3)
- Newest windows at top (reverse chronological)

### Document Preview Modal

When "View Page" is clicked:

- Modal opens with PDF viewer
- Jumps to specific page
- Highlights the relevant section if possible
- Close button returns to session view

### Loading States

**During RAG Query:**

- No loading indicator in transcript (async, non-blocking)
- Citations appear when ready (smooth animation)

**Slow Query:**

- If query takes > 2 seconds, show subtle indicator
- "Finding citations..." in citation panel

### Empty States

**No Documents Uploaded:**

- Citation panel shows message: "Upload documents to see citations"
- Link to document upload

**No Citations Found:**

- After first few windows with no citations: "No relevant citations found yet"
- Suggests checking document relevance

---

## Backend Implementation

### Service Layer

**RAGService:**

```python
class RAGService:
    def query(self, session_id: UUID, transcript_text: str, window_index: int) -> RAGResult
    def build_enriched_query(self, text: str) -> EnrichedQuery
    def search_vectors(self, query_embedding: list[float], session_id: UUID) -> list[SearchResult]
    def rerank_results(self, query: str, candidates: list[SearchResult]) -> list[RankedResult]
```

**QueryEnrichmentService:**

```python
class QueryEnrichmentService:
    def extract_keywords(self, text: str) -> list[str]
    def expand_concepts(self, keywords: list[str]) -> list[str]
    def build_query(self, original_text: str, keywords: list[str], concepts: list[str]) -> str
```

### Repository Layer

**CitationRepository:**

```python
class CitationRepository:
    def create(self, citation: CitationCreate) -> Citation
    def create_batch(self, citations: list[CitationCreate]) -> list[Citation]
    def list_by_session(self, session_id: UUID) -> list[Citation]
    def get_by_id(self, citation_id: UUID) -> Citation | None
```

### External Integrations

**Local Embeddings (sentence-transformers):**

```python
class EmbeddingService:
    def __init__(self):
        self.model = SentenceTransformer('BAAI/bge-base-en-v1.5')

    def embed(self, text: str) -> list[float]
```

**Chroma (Vector Search):**

```python
class ChromaClient:
    def query(
        self,
        collection: str,
        query_embedding: list[float],
        n_results: int,
        where: dict
    ) -> QueryResult
```

**Sentence Transformers (Re-ranking):**

```python
class RerankerService:
    def __init__(self, model_name: str = "cross-encoder/ms-marco-TinyBERT-L-2-v2")
    def rerank(self, query: str, candidates: list[str]) -> list[tuple[int, float]]
```

### Query Enrichment with KeyBERT

**Keyword Extraction:**

```python
from keybert import KeyBERT
kw_model = KeyBERT(model='sentence-transformers/all-MiniLM-L6-v2')
keywords = kw_model.extract_keywords(text, keyphrase_ngram_range=(1, 2), top_n=5)
```

### Re-ranking Implementation

```python
from sentence_transformers import CrossEncoder

class RerankerService:
    def __init__(self):
        self.model = CrossEncoder('cross-encoder/ms-marco-TinyBERT-L-2-v2')

    def rerank(self, query: str, candidates: list[str], top_k: int = 3) -> list[RankedResult]:
        pairs = [[query, candidate] for candidate in candidates]
        scores = self.model.predict(pairs)

        ranked = sorted(
            zip(range(len(candidates)), scores),
            key=lambda x: x[1],
            reverse=True
        )

        return [
            RankedResult(index=idx, score=score)
            for idx, score in ranked[:top_k]
        ]
```

### Error Handling

| Scenario                   | Handling                               |
| -------------------------- | -------------------------------------- |
| No documents in session    | Return empty citations                 |
| Embedding API timeout      | Retry once, return empty on failure    |
| Chroma unavailable         | Log error, return empty citations      |
| Re-ranker error            | Fall back to vector similarity ranking |
| All scores below threshold | Return empty citations                 |

### Performance Optimizations

1. **Embedding Cache:** Cache recent query embeddings to avoid redundant API calls
2. **Batch Processing:** Group multiple windows if they arrive quickly
3. **Async Execution:** Run RAG queries on separate thread pool
4. **Model Preloading:** Load cross-encoder model at startup
5. **Connection Pooling:** Reuse Chroma and OpenRouter connections
