# FRD-07: Post-Lecture Note Generation

## Overview

Post-Lecture Note Generation transforms raw transcripts and citations into structured, well-organized lecture notes using LLM-powered processing. Students can trigger note generation during or after a lecture, then edit and refine the notes using a rich text editor before exporting to PDF.

**Key Design Decisions:**

1. **LLM-Powered Structuring** — An LLM (via OpenRouter) reorganizes raw transcript content into a logical note format with headings, bullet points, and summaries.

2. **Citation Preservation** — All RAG citations are preserved and properly formatted in the generated notes with page references.

3. **Editable Output** — Generated notes are fully editable in a TipTap-based rich text editor, allowing students to refine and personalize.

4. **Markdown-Based Storage** — Notes are stored as Markdown for flexibility, rendered in the editor, and converted to PDF for export.

5. **Regeneration Capability** — Students can regenerate notes at any time, with the option to preserve or discard their edits.

---

## User Stories

### Generating Notes After Lecture

A student has just finished a 50-minute lecture on machine learning. They click "End Session" and are prompted: "Generate structured notes?" They click "Yes, Generate Notes."

A loading indicator appears: "Generating notes from 47 transcript segments and 23 citations..." After about 15 seconds, the note editor opens with beautifully structured content:

**Key Concepts**
- Neural network fundamentals
- Backpropagation algorithm
- Gradient descent optimization

**Detailed Notes**
## Introduction to Neural Networks
The professor began by explaining that neural networks are...¹

## Backpropagation
Backpropagation is the key algorithm for training...² ³

[... more sections ...]

**Citations**
1. Machine Learning Textbook, p. 142
2. Lecture Slides, p. 5
3. Machine Learning Textbook, p. 156

The student is impressed — the notes are organized logically, not just in the order the professor spoke.

### Editing Generated Notes

The student notices a section that could use more detail. They click into the editor and add their own commentary. They also fix a minor grammatical issue and add a personal reminder in bold.

All changes auto-save. The student can see a "Last saved: just now" indicator.

### Regenerating Notes

After editing, the student realizes they'd prefer a fresh structure. They click "Regenerate Notes" in the toolbar. A warning appears: "This will replace your current notes. Regenerate anyway?"

They confirm, and the LLM generates a new version. Their previous edits are replaced with the fresh output.

### Exporting to PDF

The student wants to print their notes for study. They click "Export to PDF" in the toolbar. A PDF is generated and downloaded, preserving the formatting, headings, and citations.

The PDF includes:
- Header with session name and date
- All formatted content from the editor
- Citation section with full references

### Generating Notes Mid-Lecture

Partway through a long lecture, the student wants to capture notes before they forget context. They click "Structure into Notes" without ending the session.

The LLM generates notes from the transcript so far. The student continues listening, and later can regenerate to include the full lecture content.

### Reopening Saved Notes

Days later, the student returns to review. They navigate to the session in their folder and click "Notes." The editor opens with their previously saved notes, including any edits they made.

They continue editing, adding more study annotations. When ready, they export a fresh PDF.

---

## System Behavior

### Note Generation Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                    Input Collection                          │
│  - Full transcript text (all segments)                       │
│  - All citations with document references                    │
│  - Session metadata (name, date, languages)                  │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Prompt Construction                       │
│  - System prompt with note structure template               │
│  - User prompt with transcript and citations                │
│  - Instructions for organization and formatting             │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    LLM Processing                            │
│  OpenRouter API (Claude 3 Haiku or GPT-4o-mini)             │
│  - Reorganize content into logical structure                │
│  - Generate section headings                                 │
│  - Create bullet point summaries                            │
│  - Preserve and format citations                            │
│  - Generate summary paragraph                               │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Output Processing                         │
│  - Parse Markdown output                                    │
│  - Validate citation references                             │
│  - Store in database                                        │
│  - Render in editor                                         │
└─────────────────────────────────────────────────────────────┘
```

### Note Structure Template

Generated notes follow this structure:

```markdown
# [Session Name]
*[Date] | [Duration] | [Source → Target Language]*

## Key Concepts
- Bullet point summary of main topics covered
- 3-5 key takeaways from the lecture

## Detailed Notes

### [Section Heading 1]
Organized content from the lecture...¹

### [Section Heading 2]
More content with logical grouping...² ³

### [Section Heading 3]
Additional sections as needed...

## Summary
A paragraph summarizing the main points and their significance.

---

## Citations

1. [Document Name], Page [X] - "[Relevant excerpt]"
2. [Document Name], Page [X] - "[Relevant excerpt]"
3. [Document Name], Page [X] - "[Relevant excerpt]"
```

### LLM Prompt Design

**System Prompt:**
```
You are an expert note-taking assistant that helps students create clear, well-organized lecture notes.

Your task is to transform a raw lecture transcript into structured study notes.

Guidelines:
1. Reorganize content by topic, not chronologically
2. Create clear section headings that reflect main themes
3. Use bullet points for key concepts and lists
4. Preserve all citation numbers exactly as provided
5. Write in clear, academic language
6. Include a "Key Concepts" section at the start
7. End with a brief summary paragraph
8. Format the citation section with document names and page numbers

Output format: Markdown
```

**User Prompt:**
```
Please create structured lecture notes from the following:

Session: {session_name}
Date: {date}
Duration: {duration}

TRANSCRIPT:
{full_transcript_text}

CITATIONS:
{formatted_citations_list}

Generate well-organized notes following the template structure.
```

### Model Configuration

| Setting | Value |
|---------|-------|
| Model | `anthropic/claude-3-haiku` or `openai/gpt-4o-mini` |
| Temperature | 0.3 (focused, consistent output) |
| Max tokens | 4000 (allows for detailed notes) |
| Timeout | 60 seconds |

### Generation Time Targets

| Lecture Length | Target Time |
|----------------|-------------|
| 15 minutes | < 10 seconds |
| 30 minutes | < 15 seconds |
| 60 minutes | < 30 seconds |
| 90 minutes | < 45 seconds |

---

## API Endpoints

### Generate Notes

```
POST /api/v1/sessions/{session_id}/notes/generate
```

Request Schema:
```
{
  force_regenerate: boolean (default: false)
}
```

Response Schema:
```
{
  id: UUID,
  session_id: UUID,
  content_markdown: string,
  generated_at: datetime,
  word_count: integer,
  citation_count: integer
}
```

### Get Notes

```
GET /api/v1/sessions/{session_id}/notes
```

Response Schema:
```
{
  id: UUID,
  session_id: UUID,
  content_markdown: string,
  generated_at: datetime,
  last_edited_at: datetime,
  version: integer
}
```

### Update Notes

```
PUT /api/v1/sessions/{session_id}/notes
```

Request Schema:
```
{
  content_markdown: string
}
```

Response Schema:
```
{
  id: UUID,
  content_markdown: string,
  last_edited_at: datetime,
  version: integer
}
```

### Export Notes to PDF

```
GET /api/v1/sessions/{session_id}/notes/export
```

Response:
- Content-Type: `application/pdf`
- Content-Disposition: `attachment; filename="{session_name}_notes.pdf"`

### Get Generation Status

```
GET /api/v1/sessions/{session_id}/notes/status
```

Response Schema:
```
{
  status: "not_generated" | "generating" | "ready" | "error",
  progress: number (0-100, if generating),
  error_message: string | null
}
```

---

## System State

### Entities

**Note**
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| session_id | UUID | Foreign key to session (unique) |
| content_markdown | TEXT | Note content in Markdown |
| generated_at | TIMESTAMP | When initially generated |
| last_edited_at | TIMESTAMP | Last user edit |
| version | INTEGER | Edit version number |

### Relationships

```
Session (1) ──────── (1) Note
```

### Note Lifecycle

```
┌──────────────┐
│ Not Generated│
└───────┬──────┘
        │ Generate triggered
        ▼
┌──────────────┐
│  Generating  │
└───────┬──────┘
        │ LLM complete
        ▼
┌──────────────┐
│    Ready     │◄──────────────┐
└───────┬──────┘               │
        │ User edits           │ Regenerate
        ▼                      │
┌──────────────┐               │
│    Edited    │───────────────┘
└──────────────┘
```

---

## Frontend Behavior

### Note Editor View

The note editor occupies the full center panel when viewing notes:

```
┌─────────────────────────────────────────────────────────────┐
│  [↻ Regenerate]     Lecture 5 Notes      [📄 Export PDF]   │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐│
│  │ B  I  U  H1 H2 H3  • ─ 1. ─  " ─                       ││
│  └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  # Lecture 5 - Neural Networks                              │
│  *January 24, 2026 | 50 min | English → Chinese*           │
│                                                             │
│  ## Key Concepts                                            │
│  - Neural network fundamentals                              │
│  - Backpropagation algorithm                               │
│  - Gradient descent optimization                            │
│                                                             │
│  ## Detailed Notes                                          │
│                                                             │
│  ### Introduction to Neural Networks                        │
│  The professor began by explaining that neural networks     │
│  are computational systems inspired by biological...¹       │
│                                                             │
│  [... more content ...]                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
│  Last saved: 2 seconds ago                    Word count: 847│
└─────────────────────────────────────────────────────────────┘
```

### Editor Toolbar

**Left Section:**
- Regenerate button: Regenerate notes from transcript

**Center Section:**
- Session name (editable)

**Right Section:**
- Export to PDF button

**Formatting Bar:**
- Bold (B)
- Italic (I)
- Underline (U)
- Heading levels (H1, H2, H3)
- Bullet list
- Numbered list
- Quote block

### TipTap Editor Configuration

**Extensions:**
- StarterKit (basic formatting)
- Heading (H1-H3)
- BulletList
- OrderedList
- Blockquote
- Superscript (for citations)
- Link
- Placeholder

**Features:**
- Markdown shortcuts (# for headings, - for lists)
- Keyboard shortcuts (Ctrl+B for bold, etc.)
- Auto-save every 5 seconds
- Undo/redo history

### Generation Loading State

While notes are generating:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    ⟳                                        │
│                                                             │
│            Generating notes...                              │
│                                                             │
│     Processing 47 transcript segments                       │
│     Incorporating 23 citations                              │
│                                                             │
│            ████████████░░░░░░░░  62%                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Regeneration Confirmation

When regenerating with existing edits:

```
┌─────────────────────────────────────────────────────────────┐
│  ⚠ Regenerate Notes?                                        │
│                                                             │
│  This will replace your current notes with a fresh          │
│  generation from the transcript. Your edits will be lost.   │
│                                                             │
│  [Cancel]                            [Regenerate]           │
└─────────────────────────────────────────────────────────────┘
```

### PDF Export

**PDF Layout:**
- Page size: Letter (8.5" x 11")
- Margins: 1 inch
- Font: Serif for body, sans-serif for headings
- Header: Session name, date
- Footer: Page numbers
- Citations section starts on new page if long

### State Management

**Client State (Zustand):**
```typescript
interface NoteEditorState {
  content: string;
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: Date | null;
  generationStatus: 'idle' | 'generating' | 'ready' | 'error';
  generationProgress: number;
  
  // Actions
  setContent: (content: string) => void;
  save: () => Promise<void>;
  regenerate: () => Promise<void>;
}
```

**Server State (TanStack Query):**
```typescript
// Queries
useNotes(sessionId): Note | null
useNoteStatus(sessionId): NoteStatus

// Mutations
useGenerateNotes(): mutation
useUpdateNotes(): mutation
```

### Auto-Save Logic

```typescript
// Debounced save on content change
useEffect(() => {
  if (!isDirty) return;
  
  const timer = setTimeout(() => {
    save();
  }, 5000); // 5 second debounce
  
  return () => clearTimeout(timer);
}, [content, isDirty]);

// Also save on blur/navigation
useEffect(() => {
  const handleBeforeUnload = () => {
    if (isDirty) save();
  };
  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [isDirty]);
```

---

## Backend Implementation

### Service Layer

**NoteService:**
```python
class NoteService:
    def get_notes(self, session_id: UUID) -> Note | None
    def generate_notes(self, session_id: UUID, force: bool = False) -> Note
    def update_notes(self, session_id: UUID, content: str) -> Note
    def export_to_pdf(self, session_id: UUID) -> bytes
    def get_generation_status(self, session_id: UUID) -> NoteStatus
```

**NoteGenerationService:**
```python
class NoteGenerationService:
    def __init__(self, openrouter: OpenRouterClient):
        self.client = openrouter
    
    async def generate(
        self, 
        transcript: str, 
        citations: list[Citation],
        session: Session
    ) -> str:
        prompt = self._build_prompt(transcript, citations, session)
        response = await self.client.generate(
            model="anthropic/claude-3-haiku",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=4000
        )
        return response.content
```

### Repository Layer

**NoteRepository:**
```python
class NoteRepository:
    def get_by_session(self, session_id: UUID) -> Note | None
    def create(self, session_id: UUID, content: str) -> Note
    def update(self, note_id: UUID, content: str) -> Note
    def increment_version(self, note_id: UUID) -> Note
```

### PDF Generation

**PDF Service:**
```python
class PDFService:
    def generate_from_markdown(
        self, 
        markdown: str, 
        session: Session
    ) -> bytes:
        # Convert Markdown to HTML
        html = markdown_to_html(markdown)
        
        # Add PDF styling
        styled_html = self._apply_pdf_styles(html, session)
        
        # Generate PDF
        pdf_bytes = html_to_pdf(styled_html)
        
        return pdf_bytes
```

**Library Options:**
- `weasyprint`: HTML to PDF conversion
- `pdfkit`: wkhtmltopdf wrapper
- `reportlab`: Programmatic PDF generation

### Prompt Templates

**System Prompt (full):**
```python
SYSTEM_PROMPT = """
You are an expert academic note-taking assistant. Transform lecture transcripts into clear, well-organized study notes.

OUTPUT FORMAT: Markdown

STRUCTURE:
1. Title with session name
2. Metadata line (date, duration, languages)
3. "Key Concepts" section (3-5 bullet points)
4. "Detailed Notes" section with topic headings (##)
5. "Summary" paragraph
6. "Citations" section listing all references

GUIDELINES:
- Reorganize content by TOPIC, not chronologically
- Create clear, descriptive section headings
- Use bullet points for lists and key points
- Preserve citation numbers EXACTLY as provided (¹, ², ³)
- Write in clear, academic language
- Be concise but comprehensive
- Include all important details from the transcript
- Group related concepts together

CITATION FORMAT:
- In text: Use superscript numbers (¹, ², ³)
- In citations section: "1. [Document], Page [X] - \"[brief excerpt]\""
"""
```

### Error Handling

| Scenario | Handling |
|----------|----------|
| No transcript segments | Return error "No transcript available" |
| LLM timeout | Retry once, then return error |
| LLM returns invalid Markdown | Attempt cleanup, return with warning |
| PDF generation fails | Return error, offer Markdown download |
| Note already generating | Return current status, don't restart |

### Background Generation

For long lectures, generation runs in background:

```python
@router.post("/sessions/{session_id}/notes/generate")
async def generate_notes(
    session_id: UUID,
    background_tasks: BackgroundTasks,
    force_regenerate: bool = False,
    service: NoteService = Depends(get_note_service)
):
    # Check if already generating
    status = await service.get_generation_status(session_id)
    if status.status == "generating":
        return status
    
    # Start background generation
    background_tasks.add_task(generate_notes_task, session_id, force_regenerate)
    
    return {"status": "generating", "progress": 0}
```

---

## Performance Considerations

### Transcript Chunking for Long Lectures

For lectures > 60 minutes:
- Split transcript into ~20 minute chunks
- Generate notes for each chunk
- Merge into final document
- LLM pass for overall coherence

### Caching

- Cache generated notes in database (already done via Note entity)
- Cache PDF for repeated downloads (TTL: 1 hour)
- Invalidate cache on note edit

### Optimistic UI

- Show "saving..." immediately on edit
- Update UI before server confirmation
- Revert on error

