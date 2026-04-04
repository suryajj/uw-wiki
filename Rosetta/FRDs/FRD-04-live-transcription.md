# FRD-04: Live Transcription Display

## Overview

Live Transcription Display provides real-time speech-to-text transcription of the professor's lecture using the browser's Web Speech API. The transcript appears dynamically in the center panel, with in-text citations inserted by the RAG pipeline. This visual representation complements the audio translation, giving students both auditory and visual access to lecture content.

**Key Design Decisions:**

1. **Browser-Native Speech Recognition** — Uses the Web Speech API directly in the browser, eliminating server-side STT costs and latency.

2. **Parallel to Translation** — Transcription runs independently of and in parallel with the translation pipeline.

3. **In-Text Citation Integration** — RAG citations appear as superscript numbers inline with the transcript text.

4. **Progressive Display** — Text appears progressively as words are recognized, creating a natural "typing" effect.

5. **Session Persistence** — Transcript segments are saved to the database for note generation and review.

---

## User Stories

### Watching Transcription Appear

A student starts a lecture session and enables transcription. As the professor begins speaking, text appears in the center panel word by word, with a slight delay from the actual speech.

The current sentence being transcribed appears at the bottom of the panel, highlighted in a lighter color to indicate it's still being processed. Once the professor pauses or completes a thought, the text "finalizes" — moving up and becoming standard body text.

The display auto-scrolls to keep the latest content visible. The student can scroll up to review earlier content, which pauses auto-scroll until they scroll back to the bottom.

### Seeing Citations Appear

The professor discusses a concept covered in the uploaded textbook. The transcription shows: "...the central limit theorem states that the sampling distribution..."

After a brief moment, superscript numbers appear at the end of the segment: "...the sampling distribution<sup>1, 2</sup>". The numbers have varying opacity — 1 is darker (more relevant), 2 is lighter.

The student hovers over "1" and sees a tooltip: "Statistics Textbook, p. 89". Clicking it scrolls the right panel to show the full citation details.

### Adjusting Text Size

The student finds the transcription text too small. They click the accessibility button in the toolbar and adjust the font size slider. The text immediately grows larger. They can also toggle high-contrast mode for better readability.

### Transcription Errors

The professor uses a technical term that the speech recognition misinterprets. The transcript shows "neural net work" instead of "neural network". This is a known limitation of speech-to-text. The student understands from context and continues following along.

The raw transcript will be cleaned up during note generation, which uses the full context to correct such errors.

### Pausing Transcription

The student needs to step away briefly. They click the "Pause" button. Transcription stops, but the audio translation continues if active. A banner shows "Transcription Paused" with a resume button. When they return, they click resume, and transcription picks up from the current point.

### Reviewing Transcript After Lecture

After the session ends, the student can reopen the session to view the full transcript. All text and citations are preserved. They can scroll through the entire lecture, click citations to see references, and use this as a basis for note generation.

---

## System Behavior

### Transcription Flow

```
┌─────────────────────────────────────────────────────────────┐
│                       Browser                                │
│                                                             │
│  ┌─────────────┐    ┌─────────────────────────────────────┐ │
│  │ Microphone  │───▶│ SpeechRecognition API               │ │
│  │ (MediaStream)│   │ (Web Speech API)                    │ │
│  └─────────────┘    └──────────────┬──────────────────────┘ │
│                                    │                         │
│                     Interim and final results               │
│                                    │                         │
│  ┌─────────────────────────────────▼──────────────────────┐ │
│  │              Transcript State Manager                   │ │
│  │  - Buffer interim results                               │ │
│  │  - Finalize completed segments                         │ │
│  │  - Send to backend for RAG + storage                   │ │
│  └─────────────────────────────────┬──────────────────────┘ │
│                                    │                         │
│                     Display in UI                           │
│                                    ▼                         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                 Transcription Panel                      ││
│  │  Previously finalized text with citations               ││
│  │  ...                                                     ││
│  │  Current sentence being transcribed (highlighted)       ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                               │
           Finalized segments  │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                       Backend                                │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  POST /api/v1/sessions/{id}/transcript                  ││
│  │  - Save segment to database                             ││
│  │  - Trigger RAG query if window complete                 ││
│  │  - Return with citations (async via WebSocket)          ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Web Speech API Integration

**Configuration:**

- Language: English (en-US)
- Continuous: true (keeps listening)
- Interim results: true (show partial results)

**Event Handling:**

`onresult`: Fires with recognition results

- `event.results[i].isFinal`: Whether the result is finalized
- `event.results[i][0].transcript`: The recognized text
- `event.results[i][0].confidence`: Confidence score (0-1)

`onerror`: Fires on recognition errors

- `no-speech`: No speech detected
- `audio-capture`: No microphone available
- `not-allowed`: Permission denied
- `network`: Network error

`onend`: Recognition stopped

- Auto-restart if session is still active

### Transcript Segment Management

**Interim Results:**

- Displayed immediately in "current" text area
- Updated as recognition improves
- Not sent to backend yet

**Final Results:**

- Marked complete when SpeechRecognition finalizes
- Added to transcript history
- Sent to backend for storage and RAG

**Segment Structure:**

```typescript
interface TranscriptSegment {
  id: string;
  text: string;
  startTime: number; // Relative to session start
  endTime: number;
  isFinal: boolean;
  confidence: number;
  citations: Citation[];
}
```

### RAG Integration

When a transcript segment is finalized:

1. Segment is sent to backend via WebSocket
2. Backend accumulates segments into sliding window
3. When window is complete (2-3 sentences), RAG query triggers
4. Citations are returned via WebSocket
5. Frontend inserts citation superscripts into the relevant segment

**Citation Insertion Logic:**

- Citations attach to the segment that triggered the RAG query
- Superscripts appear after the final word of that segment
- Format: `<sup>1, 2, 3</sup>` with opacity styling

### Latency Targets

| Stage                  | Target                                  |
| ---------------------- | --------------------------------------- |
| Speech to interim text | < 300ms                                 |
| Interim to final       | 500-1500ms (depends on pause detection) |
| Final to backend       | < 100ms                                 |
| Citation insertion     | ~500ms after RAG completes              |

---

## API Endpoints

### WebSocket for Transcript + Citations

```
WebSocket /api/v1/transcribe/stream
```

**Connection Parameters:**

```
session_id: UUID (required)
```

**Client → Server Messages:**

```json
{
  "type": "segment",
  "segment": {
    "text": "The fundamental theorem of calculus...",
    "start_time": 125.5,
    "end_time": 128.3,
    "confidence": 0.92
  }
}
```

```json
{ "type": "ping" }
```

**Server → Client Messages:**

```json
{
  "type": "citations",
  "window_index": 5,
  "segment_id": "abc-123",
  "citations": [
    {
      "rank": 1,
      "document_name": "Calculus Textbook",
      "page_number": 142,
      "snippet": "The fundamental theorem..."
    }
  ]
}
```

```json
{
  "type": "segment_saved",
  "segment_id": "abc-123"
}
```

```json
{ "type": "pong" }
```

### Save Transcript Segment (REST fallback)

```
POST /api/v1/sessions/{session_id}/transcript
```

Request Schema:

```
{
  text: string (required),
  start_time: number (seconds from session start),
  end_time: number,
  confidence: number (0-1)
}
```

Response Schema:

```
{
  id: UUID,
  text: string,
  start_time: number,
  end_time: number,
  created_at: datetime
}
```

### Get Session Transcript

```
GET /api/v1/sessions/{session_id}/transcript
```

Response Schema:

```
{
  segments: [
    {
      id: UUID,
      text: string,
      start_time: number,
      end_time: number,
      confidence: number,
      citations: [
        {
          rank: integer,
          document_name: string,
          page_number: integer,
          snippet: string
        }
      ]
    }
  ],
  total_duration: number,
  word_count: integer
}
```

---

## System State

### Entities

**Transcript**
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| session_id | UUID | Foreign key to session |
| segment_index | INTEGER | Order within session |
| text | TEXT | Transcribed text |
| start_time | FLOAT | Start time in seconds |
| end_time | FLOAT | End time in seconds |
| confidence | FLOAT | Recognition confidence |
| created_at | TIMESTAMP | When segment was saved |

### Relationships

```
Session (1) ──────── (n) Transcript
Transcript (1) ────── (n) Citation
```

### Indexes

- `transcript`: Index on `session_id` for listing
- `transcript`: Index on `session_id, segment_index` for ordering

---

## Frontend Behavior

### Transcription Panel

The transcription panel occupies the center of the session view:

```
┌─────────────────────────────────────────────────────────────┐
│  Live Transcription                        [Aa] [⏸] [⚙]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [00:05] Welcome to today's lecture on neural networks.     │
│  We'll be covering the fundamentals of how these systems    │
│  learn from data.¹ ² ³                                      │
│                                                             │
│  [00:32] The basic unit is the neuron, which takes inputs   │
│  applies weights and produces an output.¹ ²                 │
│                                                             │
│  [01:15] Let me explain backpropagation, which is how...    │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ the network learns by adjusting weights based on err... ││
│  │ (currently transcribing)                                ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Panel Header:**

- Title: "Live Transcription"
- Font size button (Aa): Opens accessibility settings
- Pause button (⏸): Pause/resume transcription
- Settings button (⚙): Transcription settings

### Text Display

**Finalized Segments:**

- Standard body text styling
- Timestamp markers at start of significant segments
- Citation superscripts inline with text
- Click to select and highlight

**Current Segment:**

- Highlighted with subtle background color
- "Typing" effect as words appear
- No citations yet (appear after finalization)

**Auto-Scroll:**

- Panel scrolls automatically to show latest content
- User scroll up disables auto-scroll (shows "Jump to Latest" button)
- Scrolling to bottom re-enables auto-scroll

### Citation Superscripts

**Appearance:**

- Superscript numbers: ¹ ² ³
- Relevance-based opacity:
  - Rank 1: 100% opacity (darkest)
  - Rank 2: 70% opacity
  - Rank 3: 50% opacity (lightest)

**Hover Behavior:**

- Tooltip shows: "Document Name, page X"
- 200ms delay before tooltip appears

**Click Behavior:**

- Scrolls citation panel to show details
- Highlights the clicked citation card

### Accessibility Settings

**Font Size:**

- Range: 14px to 24px
- Default: 16px
- Persisted in user preferences

**High Contrast Mode:**

- Increases text/background contrast
- Uses accessible color palette

**Line Spacing:**

- Options: Normal, Wide, Extra Wide
- Default: Normal

### State Management

**Client State (Zustand):**

```typescript
interface TranscriptionState {
  segments: TranscriptSegment[];
  currentSegment: string;
  isTranscribing: boolean;
  isPaused: boolean;
  autoScroll: boolean;
  fontSize: number;
  highContrast: boolean;

  // Actions
  addSegment: (segment: TranscriptSegment) => void;
  updateCurrentSegment: (text: string) => void;
  attachCitations: (segmentId: string, citations: Citation[]) => void;
  togglePause: () => void;
  setAutoScroll: (enabled: boolean) => void;
}
```

**Speech Recognition Hook:**

```typescript
function useSpeechRecognition() {
  return {
    isListening: boolean,
    isSupported: boolean,
    interimTranscript: string,
    finalTranscript: string,
    error: string | null,
    start: () => void,
    stop: () => void,
    pause: () => void,
    resume: () => void
  };
}
```

### Browser Compatibility

| Browser | Support                      |
| ------- | ---------------------------- |
| Chrome  | Full support                 |
| Edge    | Full support                 |
| Safari  | Partial (no continuous mode) |
| Firefox | Not supported                |

**Unsupported Browser:**

- Display message: "Live transcription requires Chrome or Edge"
- Provide alternative: Manual notes mode

---

## Backend Implementation

### WebSocket Handler

```python
@router.websocket("/transcribe/stream")
async def transcription_stream(
    websocket: WebSocket,
    session_id: UUID,
    transcript_service: TranscriptService = Depends(get_transcript_service),
    rag_service: RAGService = Depends(get_rag_service)
):
    await websocket.accept()
    window_buffer = SlidingWindowBuffer()

    try:
        async for message in websocket.iter_text():
            data = json.loads(message)

            if data["type"] == "segment":
                # Save segment
                segment = await transcript_service.save_segment(
                    session_id, data["segment"]
                )
                await websocket.send_json({
                    "type": "segment_saved",
                    "segment_id": str(segment.id)
                })

                # Add to window buffer
                window_buffer.add(segment)

                # Check if RAG should trigger
                if window_buffer.is_complete():
                    citations = await rag_service.query(
                        session_id,
                        window_buffer.get_text(),
                        window_buffer.index
                    )
                    await websocket.send_json({
                        "type": "citations",
                        "window_index": window_buffer.index,
                        "segment_id": str(segment.id),
                        "citations": [c.dict() for c in citations]
                    })
                    window_buffer.advance()

    except WebSocketDisconnect:
        pass
```

### Service Layer

**TranscriptService:**

```python
class TranscriptService:
    def save_segment(self, session_id: UUID, segment: SegmentCreate) -> Transcript
    def list_segments(self, session_id: UUID) -> list[TranscriptWithCitations]
    def get_full_text(self, session_id: UUID) -> str
```

### Repository Layer

**TranscriptRepository:**

```python
class TranscriptRepository:
    def create(self, session_id: UUID, segment: SegmentCreate) -> Transcript
    def list_by_session(self, session_id: UUID) -> list[Transcript]
    def get_next_index(self, session_id: UUID) -> int
```

### Sliding Window Buffer

```python
class SlidingWindowBuffer:
    def __init__(self, target_sentences: int = 3):
        self.segments: list[Transcript] = []
        self.target_sentences = target_sentences
        self.index = 0

    def add(self, segment: Transcript) -> None:
        self.segments.append(segment)

    def is_complete(self) -> bool:
        text = self.get_text()
        sentence_count = len(re.findall(r'[.!?]', text))
        return sentence_count >= self.target_sentences

    def get_text(self) -> str:
        return " ".join(s.text for s in self.segments)

    def advance(self) -> None:
        # Keep last segment for overlap
        if self.segments:
            self.segments = [self.segments[-1]]
        self.index += 1
```

### Error Handling

| Scenario                | Handling                     |
| ----------------------- | ---------------------------- |
| WebSocket disconnect    | Clean up, no error           |
| Invalid segment format  | Skip segment, log warning    |
| Database write failure  | Return error, client retries |
| RAG service unavailable | Save segment, skip citations |

---

## Performance Considerations

### Segment Batching

To reduce database writes:

- Buffer segments client-side for 2-3 seconds
- Send as batch if multiple segments complete quickly
- Individual sends for slow speech

### Citation Caching

- Cache citation display data client-side
- Avoid re-fetching on scroll
- Invalidate on session reload

### Transcript Virtualization

For long lectures:

- Virtualize transcript list (only render visible segments)
- Lazy load older segments on scroll up
- Keep ~100 segments in memory at a time
