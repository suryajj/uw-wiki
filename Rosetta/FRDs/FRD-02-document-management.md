# FRD-02: Course Document Management

## Overview

Course document management enables users to upload, process, and organize PDF course materials that power the RAG citation system. Documents are uploaded to sessions, automatically processed (text extraction, chunking, embedding), and indexed in the vector database for semantic search during live lectures.

**Key Design Decisions:**

1. **Session-Scoped Documents** — Documents are linked to specific sessions. The same PDF can be uploaded to multiple sessions, creating separate embeddings for each context.

2. **Asynchronous Processing** — Document processing (extraction, chunking, embedding) runs in the background. Users can start a session while documents are still processing.

3. **Text-Based PDFs Only** — This version supports text-extractable PDFs. Scanned documents and image-heavy slides are not supported.

4. **Chunking with Overlap** — Documents are split into chunks with overlap to maintain context continuity across chunk boundaries.

5. **Page-Level Metadata** — Each chunk retains its source page number for citation references.

---

## User Stories

### Uploading Documents to a Session

A student is preparing for a lecture on machine learning. They navigate to their "CS 401" folder and click "New Session" to create "Lecture 5 - Neural Networks". Before starting the lecture, they want to upload relevant course materials.

In the left panel, they see a "Documents" section with an upload area. They drag and drop two PDF files: "Chapter5_NeuralNetworks.pdf" and "lecture_slides_5.pdf". Upload progress bars appear for each file. Once uploaded, the files show a "Processing" status as the system extracts text and generates embeddings.

After a few seconds, the status changes to "Ready" with a green checkmark. The student can now see the document names, page counts, and can click to preview. The documents are ready to power citations during the lecture.

### Viewing Document Processing Status

A student uploads a large textbook chapter (100 pages). The upload completes quickly, but processing takes longer. The document card shows:

- Upload: Complete (checkmark)
- Status: "Processing... 45%"
- Estimated time remaining

The student can start the lecture while processing continues. Any documents that finish processing will immediately begin contributing to RAG queries. If processing fails, the status shows "Error" with a retry button and error details.

### Previewing an Uploaded Document

Before starting a lecture, the student wants to verify they uploaded the correct document. They click on a document card and a preview modal opens showing:

- Document name and page count
- Thumbnail view of pages
- Full-page view on click
- Close button to return

This is a read-only preview — the original PDF is displayed, not the extracted text.

### Removing a Document

The student realizes they uploaded the wrong PDF. They click the delete icon on the document card. A confirmation dialog appears: "Remove this document? This will also remove its citations from the session."

After confirming, the document is removed from the session, its embeddings are deleted from the vector store, and any citations referencing it are cleaned up. The document file is deleted from storage.

### Uploading During an Active Session

The lecture is underway, but the professor mentions a paper that wasn't in the original materials. The student has the PDF on their laptop. They drag it into the document panel while the session is active.

The document uploads and begins processing. Once ready, it joins the other documents in the RAG index. New citations may appear as the professor continues discussing topics covered in the newly added document.

---

## System Behavior

### Document Upload Flow

```
┌─────────────────┐
│  User uploads   │
│     PDF file    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Validate file  │
│  (type, size)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Store file in  │
│  file storage   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Create document │
│ record (pending)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Queue async    │
│  processing job │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│           Background Processing          │
├──────────────────────────────────────────┤
│  1. Extract text with page boundaries    │
│  2. Detect and extract section headings  │
│  3. Chunk text with overlap              │
│  4. Generate embeddings via OpenRouter   │
│  5. Store embeddings in Chroma           │
│  6. Update document status to "ready"    │
└─────────────────────────────────────────┘
```

### Document Processing Pipeline

**Step 1: Text Extraction**

- Use PyPDF2 to extract text from each page
- Preserve page boundaries for citation references
- Handle encoding issues gracefully

**Step 2: Section Detection**

- Identify headings based on formatting patterns
- Extract section titles for metadata enrichment
- Fall back to page numbers if no headings detected

**Step 3: Chunking Strategy**

- Target chunk size: 512 tokens
- Overlap: 50 tokens between chunks
- Respect paragraph boundaries when possible
- Never split mid-sentence

**Step 4: Embedding Generation**

- Use local BAAI/bge-base-en-v1.5 model for embeddings
- Batch embeddings for efficiency
- Store embedding dimension: 768

**Step 5: Vector Storage**

- Store in Chroma with document and session metadata
- Metadata includes: document_id, session_id, page_number, section_heading, chunk_index

### Document Status States

| Status       | Description                               |
| ------------ | ----------------------------------------- |
| `pending`    | File uploaded, processing not started     |
| `processing` | Text extraction and embedding in progress |
| `ready`      | Processing complete, available for RAG    |
| `error`      | Processing failed, retry available        |

### File Validation

| Check        | Requirement                   |
| ------------ | ----------------------------- |
| File type    | Must be `application/pdf`     |
| File size    | Maximum 50 MB                 |
| Page count   | Maximum 500 pages             |
| Text content | Must contain extractable text |

---

## API Endpoints

### List Documents

```
GET /api/v1/sessions/{session_id}/documents
```

Response Schema:

```
{
  documents: [
    {
      id: UUID,
      name: string,
      file_size: integer,
      page_count: integer,
      chunk_count: integer,
      status: "pending" | "processing" | "ready" | "error",
      processing_progress: number (0-100),
      error_message: string | null,
      uploaded_at: datetime,
      processed_at: datetime | null
    }
  ]
}
```

### Upload Document

```
POST /api/v1/sessions/{session_id}/documents
Content-Type: multipart/form-data
```

Request:

- `file`: PDF file (required)

Response Schema:

```
{
  id: UUID,
  name: string,
  file_size: integer,
  status: "pending",
  uploaded_at: datetime
}
```

### Get Document

```
GET /api/v1/documents/{document_id}
```

Response Schema:

```
{
  id: UUID,
  session_id: UUID,
  name: string,
  file_size: integer,
  page_count: integer,
  chunk_count: integer,
  status: "pending" | "processing" | "ready" | "error",
  processing_progress: number,
  error_message: string | null,
  uploaded_at: datetime,
  processed_at: datetime | null
}
```

### Get Document Status

```
GET /api/v1/documents/{document_id}/status
```

Response Schema:

```
{
  status: "pending" | "processing" | "ready" | "error",
  progress: number (0-100),
  error_message: string | null,
  chunks_processed: integer,
  chunks_total: integer
}
```

### Delete Document

```
DELETE /api/v1/documents/{document_id}
```

Response: 204 No Content

Side Effects:

- Removes file from storage
- Removes embeddings from Chroma
- Removes citation references

### Get Document Preview URL

```
GET /api/v1/documents/{document_id}/preview
```

Response Schema:

```
{
  url: string,
  expires_at: datetime
}
```

### Retry Document Processing

```
POST /api/v1/documents/{document_id}/retry
```

Response Schema:

```
{
  id: UUID,
  status: "pending"
}
```

---

## System State

### Entities

**Document**
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| session_id | UUID | Foreign key to session |
| name | VARCHAR(255) | Original filename |
| file_path | VARCHAR(500) | Storage path |
| file_size | INTEGER | File size in bytes |
| page_count | INTEGER | Number of pages |
| chunk_count | INTEGER | Number of chunks created |
| status | ENUM | Processing status |
| processing_progress | INTEGER | Progress percentage |
| error_message | TEXT | Error details if failed |
| uploaded_at | TIMESTAMP | Upload time |
| processed_at | TIMESTAMP | Processing completion time |

**DocumentChunk**
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| document_id | UUID | Foreign key to document |
| chunk_index | INTEGER | Order within document |
| page_number | INTEGER | Source page number |
| section_heading | VARCHAR(255) | Section title if detected |
| content | TEXT | Chunk text content |
| token_count | INTEGER | Number of tokens |
| embedding_id | VARCHAR(255) | Chroma embedding ID |

### Relationships

```
Session (1) ──────── (n) Document
Document (1) ──────── (n) DocumentChunk
DocumentChunk (1) ──── (1) Chroma Embedding
```

### Chroma Collection Schema

Collection: `session_documents`

Metadata per embedding:

```
{
  document_id: string (UUID),
  session_id: string (UUID),
  chunk_index: integer,
  page_number: integer,
  section_heading: string | null,
  document_name: string
}
```

---

## Frontend Behavior

### Document Panel

The document panel appears in the left sidebar during session view.

**Panel Header:**

- "Documents" title
- Document count badge
- Collapse/expand toggle

**Upload Area:**

- Drag-and-drop zone with dashed border
- "Drop PDF files here or click to browse" text
- Click to open file picker
- Supports multiple file selection

**Document List:**

- Scrollable list of document cards
- Sorted by upload time (newest first)
- Shows processing status for each

### Document Card

**Card Contents:**

- Document icon (PDF)
- Filename (truncated with tooltip)
- File size and page count
- Status indicator:
  - Pending: Gray clock icon
  - Processing: Blue spinner with percentage
  - Ready: Green checkmark
  - Error: Red warning icon
- Actions: Preview, Delete

**Hover State:**

- Slight elevation change
- Preview and delete icons become visible

### Upload Progress

During upload:

- Progress bar fills as upload progresses
- Percentage shown
- Cancel button available

After upload:

- Status changes to "Processing"
- Progress bar shows processing percentage
- Polling updates progress every 2 seconds

### Preview Modal

**Modal Contents:**

- Document name in header
- Page navigation (prev/next, page number input)
- Zoom controls
- Page thumbnail strip on side
- Full page view in center
- Close button

**Keyboard Navigation:**

- Left/Right arrows: Navigate pages
- Escape: Close modal
- +/-: Zoom in/out

### Error States

**Upload Error:**

- Red border on upload area
- Error message: "Upload failed: [reason]"
- Retry button

**Processing Error:**

- Document card shows error state
- "Processing failed" message
- "Retry" button on card
- Click for error details modal

**Invalid File:**

- Immediate feedback before upload
- "Only PDF files are supported"
- "File too large (max 50 MB)"

### State Management

**Server State (TanStack Query):**

- `useSessionDocuments(sessionId)`: List documents with polling for processing status
- `useDocument(documentId)`: Single document details
- `useUploadDocument()`: Mutation for file upload
- `useDeleteDocument()`: Mutation for deletion

**Polling Strategy:**

- Poll every 2 seconds while any document is in "pending" or "processing" state
- Stop polling when all documents are "ready" or "error"

---

## Backend Implementation

### Repository Layer

**DocumentRepository:**

```python
class DocumentRepository:
    def list_by_session(self, session_id: UUID) -> list[Document]
    def get_by_id(self, document_id: UUID) -> Document | None
    def create(self, session_id: UUID, name: str, file_path: str, file_size: int) -> Document
    def update_status(self, document_id: UUID, status: str, progress: int = 0, error: str = None) -> Document
    def update_processed(self, document_id: UUID, page_count: int, chunk_count: int) -> Document
    def delete(self, document_id: UUID) -> None
```

**DocumentChunkRepository:**

```python
class DocumentChunkRepository:
    def create_batch(self, chunks: list[DocumentChunkCreate]) -> list[DocumentChunk]
    def list_by_document(self, document_id: UUID) -> list[DocumentChunk]
    def delete_by_document(self, document_id: UUID) -> None
```

### Service Layer

**DocumentService:**

```python
class DocumentService:
    def list_documents(self, session_id: UUID) -> list[DocumentSummary]
    def get_document(self, document_id: UUID) -> DocumentDetail
    def upload_document(self, session_id: UUID, file: UploadFile) -> Document
    def get_status(self, document_id: UUID) -> DocumentStatus
    def delete_document(self, document_id: UUID) -> None
    def retry_processing(self, document_id: UUID) -> Document
```

**DocumentProcessingService:**

```python
class DocumentProcessingService:
    def process_document(self, document_id: UUID) -> None
    def extract_text(self, file_path: str) -> list[PageContent]
    def chunk_text(self, pages: list[PageContent]) -> list[Chunk]
    def generate_embeddings(self, chunks: list[Chunk]) -> list[Embedding]
    def store_embeddings(self, document_id: UUID, session_id: UUID, embeddings: list[Embedding]) -> None
```

### External Integrations

**OpenRouter Embeddings:**

```python
class OpenRouterClient:
    def create_embeddings(self, texts: list[str], model: str) -> list[list[float]]
```

**Chroma Client:**

```python
class ChromaClient:
    def add_embeddings(self, collection: str, ids: list[str], embeddings: list[list[float]], metadatas: list[dict]) -> None
    def delete_by_document(self, collection: str, document_id: str) -> None
```

### Background Processing

Documents are processed asynchronously using FastAPI's background tasks:

```python
@router.post("/sessions/{session_id}/documents")
async def upload_document(
    session_id: UUID,
    file: UploadFile,
    background_tasks: BackgroundTasks,
    service: DocumentService = Depends(get_document_service)
):
    document = await service.upload_document(session_id, file)
    background_tasks.add_task(process_document_task, document.id)
    return document
```

### Chunking Algorithm

```python
def chunk_text(pages: list[PageContent], target_size: int = 500, overlap: int = 50) -> list[Chunk]:
    """
    Chunk document text with overlap.

    - Respects page boundaries for metadata
    - Tries to split at paragraph boundaries
    - Falls back to sentence boundaries
    - Maintains overlap between chunks for context
    """
    ...
```

### Error Handling

| Scenario            | Status | Code               |
| ------------------- | ------ | ------------------ |
| File not PDF        | 400    | INVALID_FILE_TYPE  |
| File too large      | 400    | FILE_TOO_LARGE     |
| Document not found  | 404    | DOCUMENT_NOT_FOUND |
| Session not found   | 404    | SESSION_NOT_FOUND  |
| Processing failed   | 500    | PROCESSING_ERROR   |
| No extractable text | 400    | NO_TEXT_CONTENT    |
