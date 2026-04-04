# RAG Pipeline Refinements

This document describes the optimizations made to the RAG (Retrieval-Augmented Generation) pipeline to reduce latency while maintaining retrieval accuracy.

## Overview

The original pipeline followed FRD-05 specifications but had significant latency due to external API calls for query enrichment and embeddings. These refinements reduce end-to-end latency from ~400-950ms to ~70-125ms.

---

## Changes Summary

| Component | Before | After | Latency Impact |
|-----------|--------|-------|----------------|
| Query Enrichment | 2× OpenRouter LLM calls | KeyBERT (local) | -200-570ms |
| Embedding Model | text-embedding-3-large (API) | bge-base-en-v1.5 (local) | -70-135ms |
| Re-ranking Candidates | Top 10 | Top 5 | -20-50ms |
| Cross-Encoder | ms-marco-MiniLM-L-6-v2 | ms-marco-TinyBERT-L-2-v2 | -30-50ms |
| Early Exit | None | Distance-based gating | Saves ~30-40ms when no matches |

---

## 1. Query Enrichment: KeyBERT

### Previous Approach
Two sequential LLM API calls via OpenRouter:
1. `extract_keywords()` — Extract 3-5 academic terms
2. `expand_concepts()` — Expand keywords with related concepts

**Latency:** ~200-600ms (network round-trips + LLM inference)

### New Approach
Use [KeyBERT](https://github.com/MaartenGr/KeyBERT) for local keyword extraction:

```python
from keybert import KeyBERT

kw_model = KeyBERT("sentence-transformers/all-MiniLM-L6-v2")
keywords = kw_model.extract_keywords(
    text,
    keyphrase_ngram_range=(1, 2),
    stop_words="english",
    top_n=5,
)
```

**Latency:** ~10-30ms (local inference)

### Rationale
- KeyBERT uses embedding similarity to identify semantically important terms
- No network latency or API rate limits
- Concept expansion is removed — the embedding model captures semantic relationships
- Lightweight model (`all-MiniLM-L6-v2`) is sufficient for keyword extraction

### Query Construction
Keywords are appended to the original text for embedding:
```python
enriched_query = f"{original_text} {' '.join(keywords)}"
```

---

## 2. Embedding Model: bge-base-en-v1.5

### Previous Approach
OpenRouter API call for `text-embedding-3-large`:
- 3072 dimensions
- ~80-150ms per embedding (network latency)

### New Approach
Local inference with `BAAI/bge-base-en-v1.5`:
- 768 dimensions
- ~5-15ms per embedding (local)

```python
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("BAAI/bge-base-en-v1.5")
embedding = model.encode(text, normalize_embeddings=True)
```

### Rationale
- BGE models achieve ~98% of OpenAI embedding quality on MTEB benchmarks
- Eliminates network latency entirely
- No API costs or rate limits
- Smaller dimensions (768 vs 3072) = faster Chroma queries and smaller index

### Migration Note
Switching embedding models requires re-indexing all documents. The database will be reset to accommodate the new embedding dimensions.

### Model Comparison

| Model | Dimensions | MTEB Score | Inference |
|-------|-----------|------------|-----------|
| text-embedding-3-large | 3072 | ~64.6 | API (~100ms) |
| bge-base-en-v1.5 | 768 | ~63.5 | Local (~10ms) |
| bge-small-en-v1.5 | 384 | ~62.2 | Local (~5ms) |

---

## 3. Reduced Re-ranking Candidates

### Previous Approach
- Retrieve top 10 candidates from Chroma
- Re-rank all 10 with cross-encoder
- Return top 3

### New Approach
- Retrieve top 5 candidates from Chroma
- Re-rank all 5 with cross-encoder
- Return top 3

### Rationale
- Cross-encoder inference scales linearly with candidate count
- Empirically, the top 3 results are almost always within the top 5 by vector similarity
- Reduces re-ranking time by ~50%

---

## 4. Faster Cross-Encoder: TinyBERT

### Previous Approach
`cross-encoder/ms-marco-MiniLM-L-6-v2`:
- 6 transformer layers
- ~100-150ms for 10 candidates

### New Approach
`cross-encoder/ms-marco-TinyBERT-L-2-v2`:
- 2 transformer layers
- ~30-50ms for 5 candidates

```python
from sentence_transformers import CrossEncoder

reranker = CrossEncoder("cross-encoder/ms-marco-TinyBERT-L-2-v2")
scores = reranker.predict([(query, doc) for doc in candidates])
```

### Rationale
- 3x fewer layers = ~3x faster inference
- Quality difference is minimal for educational content retrieval
- Combined with fewer candidates, re-ranking becomes negligible in total latency

---

## 5. Distance-Based Early Exit

### Problem
When a transcript window has no relevant matches in the uploaded documents, the pipeline still runs the full cross-encoder re-ranking on low-quality candidates. This wastes ~30-40ms on results that will be filtered out anyway.

### Solution
After vector search, check if the best candidate's distance exceeds a threshold. If all candidates are too distant (semantically dissimilar), skip re-ranking and return empty citations immediately.

### Implementation

```python
# After Chroma query returns results
distances = results["distances"][0]  # List of distances for top 5

# Distance threshold - Chroma uses L2 distance (lower = more similar)
# Typical good matches have distance < 1.0
# Poor matches have distance > 1.5
DISTANCE_THRESHOLD = 1.5

if not distances or min(distances) > DISTANCE_THRESHOLD:
    # No candidates are close enough - skip re-ranking
    return RAGQueryResponse(
        window_index=window_index,
        citations=[],
        query_metadata=QueryMetadata(
            keywords=enrichment["keywords"],
            expanded_concepts=[],
            processing_time_ms=processing_time,
        ),
    )

# Continue to re-ranking only if we have promising candidates...
```

### Rationale
- **Zero overhead:** Uses data already returned from Chroma
- **Saves re-ranking cost:** ~30-40ms when no good matches exist
- **Reduces false positives:** Prevents low-quality citations from appearing
- **Complements relevance threshold:** First filter by vector distance, then by cross-encoder score

### Threshold Tuning
The distance threshold (1.5) should be tuned based on your data:
- Lower threshold (1.0-1.2): More aggressive filtering, may miss edge cases
- Higher threshold (1.5-2.0): Conservative, lets more through to re-ranker

Monitor the skip rate and citation quality to adjust.

---

## Refined Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Transcript Window                         │
│  "The fundamental theorem states that integration and..."    │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              KeyBERT Keyword Extraction                      │
│              Model: all-MiniLM-L6-v2 (local)                │
│              Extracts: [fundamental theorem, integration]    │
│              Latency: ~15ms                                  │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Query Embedding                                 │
│              Model: bge-base-en-v1.5 (local)                │
│              Dimensions: 768                                 │
│              Latency: ~10ms                                  │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Vector Search (Chroma)                          │
│              Top 5 candidates                                │
│              Filter: session_id                              │
│              Latency: ~20-30ms                               │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Distance-Based Early Exit                       │
│              IF min(distances) > 1.5:                        │
│                 → Return empty citations (skip re-ranking)   │
│              Latency: ~0ms (no additional computation)       │
└──────────────────────────┬──────────────────────────────────┘
                           │ (has promising candidates)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Cross-Encoder Re-ranking                        │
│              Model: ms-marco-TinyBERT-L-2-v2 (local)        │
│              Candidates: 5 → Top 3                           │
│              Threshold: 0.5                                  │
│              Latency: ~30-40ms                               │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Citation Output                                 │
│              Total Latency: ~75-100ms (with re-ranking)      │
│                            ~45-55ms (early exit)             │
└─────────────────────────────────────────────────────────────┘
```

---

## Future Enhancement: Early Exit Classification

### Opportunity
A classification model at the pipeline entry point could detect off-topic transcript windows and skip the entire RAG pipeline, saving computation for irrelevant queries.

### Use Cases for Early Exit
- Professor tangents: "Let me get a sip of water..."
- Administrative remarks: "Remember, the exam is next Tuesday"
- Casual conversation: "As I was telling my colleague yesterday..."
- Filler speech: "Um, so, where were we..."

### Proposed Placement

```
┌─────────────────────────────────────────────────────────────┐
│                    Transcript Window                         │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│         [NEW] Relevance Classifier                           │
│         Model: Fine-tuned BERT or DistilBERT                │
│         Classes: academic_content | off_topic               │
│         Latency: ~5-10ms                                     │
│                                                              │
│         IF off_topic with confidence > 0.8:                  │
│            → SKIP pipeline, return empty citations           │
└──────────────────────────┬──────────────────────────────────┘
                           │ (academic_content)
                           ▼
               [Continue to KeyBERT...]
```

### Implementation Options

**Option A: Fine-tuned DistilBERT Classifier**
```python
from transformers import pipeline

classifier = pipeline(
    "text-classification",
    model="distilbert-base-uncased",  # Fine-tune on academic vs casual dataset
)
result = classifier(text)
if result["label"] == "off_topic" and result["score"] > 0.8:
    return empty_citations()
```

**Option B: Zero-Shot Classification**
```python
from transformers import pipeline

classifier = pipeline("zero-shot-classification")
result = classifier(
    text,
    candidate_labels=["academic lecture content", "casual conversation", "administrative remarks"],
)
if result["labels"][0] != "academic lecture content":
    return empty_citations()
```

**Option C: Embedding-Based Classifier**
Reuse the embedding model and add a lightweight classification head:
```python
embedding = embed(text)  # bge-base-en-v1.5
is_academic = classifier_head(embedding)  # Simple MLP
```

### Training Data Suggestions
- **Academic content:** Lecture transcripts, textbook excerpts, educational videos
- **Off-topic:** Casual conversation datasets, filler phrases, administrative speech

### Expected Impact
- Skip rate: ~10-20% of transcript windows (estimated)
- Savings per skip: ~60-90ms (entire pipeline cost)
- Classifier overhead: ~5-10ms per window
- Net benefit: Positive when skip rate > 10%

---

## Dependencies

### New Python Packages
```
keybert>=0.8.0
sentence-transformers>=2.2.0
```

### Models to Download (First Run)
- `sentence-transformers/all-MiniLM-L6-v2` — KeyBERT backbone
- `BAAI/bge-base-en-v1.5` — Query/document embeddings
- `cross-encoder/ms-marco-TinyBERT-L-2-v2` — Re-ranking

### Chroma Configuration
Update collection to use 768-dimensional vectors (reset required).

---

## Performance Targets

| Metric | FRD-05 Target | Refined Target |
|--------|---------------|----------------|
| Query enrichment | < 100ms | < 20ms |
| Embedding generation | < 100ms | < 15ms |
| Vector search | < 50ms | < 30ms |
| Re-ranking | < 150ms | < 50ms |
| **Total pipeline** | **< 500ms** | **< 120ms** |
