# FRD-01: Folder-Based Organization System

## Overview

The folder-based organization system provides hierarchical storage for courses, lecture sessions, and associated content. Users create folders to represent courses or subjects, then create sessions within folders to capture individual lectures. Each session contains transcripts, citations, notes, and linked documents.

**Key Design Decisions:**

1. **Two-Level Hierarchy** — Folders contain sessions. No nested folders to keep the model simple and match the course → lecture mental model.

2. **Session Lifecycle** — Sessions progress through states: active (recording), completed (ended), archived (hidden from default view).

3. **Soft Delete** — Folders and sessions are soft-deleted (archived) rather than hard-deleted, allowing recovery.

4. **Session Isolation** — Each session has its own set of linked documents. The same document can be linked to multiple sessions.

---

## User Stories

### Creating a New Course Folder

A student starts a new semester and wants to organize their courses. They click the "New Folder" button in the sidebar and enter "CS 401 - Machine Learning" as the folder name. The folder appears in the sidebar immediately, sorted alphabetically among other folders. The student can now create sessions within this folder for each lecture.

### Starting a Lecture Session

The student arrives at lecture and opens Rosetta. They navigate to their "CS 401" folder and click "New Session". A dialog appears asking for a session name — they enter "Lecture 5 - Neural Networks". The session is created in "active" state and the main workspace transitions to the live session view, ready for transcription and translation.

### Browsing Past Sessions

After several weeks, the student wants to review notes from an earlier lecture. They click on the "CS 401" folder in the sidebar and see a list of all sessions, ordered by date (newest first). Each session card shows the session name, date, duration, and a status badge. Completed sessions show a "Notes" indicator if structured notes have been generated. The student clicks on "Lecture 2 - Linear Regression" to open and review the notes.

### Renaming a Folder

The student realizes they named a folder incorrectly. They right-click on the folder and select "Rename". An inline edit field appears with the current name selected. They type the new name and press Enter. The folder updates immediately in the sidebar.

### Deleting a Session

A session was created by mistake. The student right-clicks on the session card and selects "Delete". A confirmation dialog appears warning that this will archive the session and its associated notes. The student confirms, and the session disappears from the list. It can be recovered from an "Archived" filter if needed.

### Ending a Session

The lecture has ended. The student clicks the "End Session" button in the session controls. A dialog appears with two options: "Generate Notes" or "Save Transcript Only". If they choose "Generate Notes", the system processes the transcript and generates structured notes before completing the session. The session status changes to "completed" and the workspace transitions to the notes view.

---

## System Behavior

### Folder Operations

**Create Folder:**

- Validates name is non-empty
- Creates folder record with current timestamp
- Returns created folder with ID

**List Folders:**

- Returns all non-archived folders
- Ordered alphabetically by name
- Includes session count per folder

**Get Folder:**

- Returns folder details with list of sessions
- Sessions ordered by start date descending
- Includes session metadata (name, dates, status, has_notes)

**Update Folder:**

- Updates folder name
- Returns updated folder

**Delete Folder:**

- Soft-deletes folder (sets archived_at timestamp)
- Cascades archive to all sessions in folder
- Sessions retain their data for potential recovery

### Session Operations

**Create Session:**

- Validates folder exists and is not archived
- Creates session in "active" state
- Sets started_at to current timestamp
- Returns created session with ID

**Get Session:**

- Returns full session details
- Includes linked documents
- Includes notes if generated

**Update Session:**

- Updates session name
- Cannot change folder_id after creation
- Returns updated session

**End Session:**

- Validates session is in "active" state
- Sets ended_at to current timestamp
- Changes status to "completed"
- Optionally triggers note generation
- Returns completed session

**Delete Session:**

- Soft-deletes session (sets archived_at timestamp)
- Retains all associated data for recovery
- Does not delete linked documents (they may be used elsewhere)

### Session Lifecycle

```
┌─────────────┐
│   Created   │
│  (active)   │
└──────┬──────┘
       │ User clicks "End Session"
       ▼
┌─────────────┐
│  Completed  │
└──────┬──────┘
       │ User deletes session
       ▼
┌─────────────┐
│  Archived   │
│  (hidden)   │
└─────────────┘
```

---

## API Endpoints

### Folders

**List Folders**

```
GET /api/v1/folders
```

Response Schema:

```
{
  folders: [
    {
      id: UUID,
      name: string,
      created_at: datetime,
      updated_at: datetime,
      session_count: integer
    }
  ]
}
```

**Create Folder**

```
POST /api/v1/folders
```

Request Schema:

```
{
  name: string (required, max 255 chars)
}
```

Response Schema:

```
{
  id: UUID,
  name: string,
  created_at: datetime,
  updated_at: datetime,
  session_count: 0
}
```

**Get Folder**

```
GET /api/v1/folders/{folder_id}
```

Response Schema:

```
{
  id: UUID,
  name: string,
  created_at: datetime,
  updated_at: datetime,
  sessions: [
    {
      id: UUID,
      name: string,
      status: "active" | "completed" | "archived",
      source_language: string,
      target_language: string,
      started_at: datetime,
      ended_at: datetime | null,
      has_notes: boolean,
      document_count: integer
    }
  ]
}
```

**Update Folder**

```
PUT /api/v1/folders/{folder_id}
```

Request Schema:

```
{
  name: string (required, max 255 chars)
}
```

**Delete Folder**

```
DELETE /api/v1/folders/{folder_id}
```

Response: 204 No Content

### Sessions

**Create Session**

```
POST /api/v1/folders/{folder_id}/sessions
```

Request Schema:

```
{
  name: string (required, max 255 chars),
  source_language: string (default: "en"),
  target_language: string (required)
}
```

Response Schema:

```
{
  id: UUID,
  folder_id: UUID,
  name: string,
  status: "active",
  source_language: string,
  target_language: string,
  started_at: datetime,
  ended_at: null,
  has_notes: false
}
```

**Get Session**

```
GET /api/v1/sessions/{session_id}
```

Response Schema:

```
{
  id: UUID,
  folder_id: UUID,
  name: string,
  status: "active" | "completed" | "archived",
  source_language: string,
  target_language: string,
  started_at: datetime,
  ended_at: datetime | null,
  documents: [
    {
      id: UUID,
      name: string,
      page_count: integer,
      status: "pending" | "processing" | "ready" | "error"
    }
  ],
  has_notes: boolean
}
```

**Update Session**

```
PUT /api/v1/sessions/{session_id}
```

Request Schema:

```
{
  name: string (optional, max 255 chars)
}
```

**End Session**

```
POST /api/v1/sessions/{session_id}/end
```

Request Schema:

```
{
  generate_notes: boolean (default: false)
}
```

Response Schema:

```
{
  id: UUID,
  status: "completed",
  ended_at: datetime,
  notes_generated: boolean
}
```

**Delete Session**

```
DELETE /api/v1/sessions/{session_id}
```

Response: 204 No Content

---

## System State

### Entities

**Folder**
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR(255) | Folder name |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Last update time |
| archived_at | TIMESTAMP | Soft delete time (null if active) |

**Session**
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| folder_id | UUID | Foreign key to folder |
| name | VARCHAR(255) | Session name |
| status | ENUM | 'active', 'completed', 'archived' |
| source_language | VARCHAR(10) | Source language code |
| target_language | VARCHAR(10) | Target language code |
| started_at | TIMESTAMP | Session start time |
| ended_at | TIMESTAMP | Session end time (null if active) |
| archived_at | TIMESTAMP | Soft delete time (null if active) |

### Relationships

```
Folder (1) ──────────── (n) Session
   │                         │
   │                         ├── (n) SessionDocument
   │                         ├── (n) Transcript
   │                         └── (1) Note
```

### Indexes

- `folders`: Index on `archived_at` for filtering
- `sessions`: Index on `folder_id` for folder queries
- `sessions`: Index on `status` for filtering
- `sessions`: Index on `started_at` for ordering

---

## Frontend Behavior

### Sidebar Navigation

The sidebar displays a tree of folders with expandable sections for sessions.

**Folder List:**

- Folders sorted alphabetically by name
- Each folder shows name and session count badge
- Click to expand and show sessions
- Right-click for context menu (Rename, Delete)
- "New Folder" button at the bottom

**Session List (within folder):**

- Sessions sorted by date (newest first)
- Each session shows name, date, and status icon
- Active sessions highlighted with pulsing indicator
- Click to navigate to session view
- Right-click for context menu (Rename, Delete)
- "New Session" button at the top of list

### Folder/Session Cards

**Session Card Contents:**

- Session name (editable on double-click)
- Date and time
- Duration (if completed)
- Status badge (Active, Completed)
- Document count indicator
- Notes indicator (if generated)

### State Management

**Client State (Zustand):**

- `selectedFolderId`: Currently selected folder
- `expandedFolderIds`: Set of expanded folder IDs
- `sidebarWidth`: Resizable sidebar width

**Server State (TanStack Query):**

- `useFolders()`: List of all folders
- `useFolder(folderId)`: Single folder with sessions
- `useSession(sessionId)`: Single session details
- Mutations for create, update, delete operations

### Optimistic Updates

- Creating folder/session: Show immediately in list
- Renaming: Update name immediately, revert on error
- Deleting: Remove from list immediately, restore on error

### Empty States

**No Folders:**

- Large illustration with "Create your first folder" prompt
- Prominent "New Folder" button

**Empty Folder:**

- Message: "No sessions yet"
- "Start a Session" button

### Error Handling

- Network errors: Toast notification with retry option
- Validation errors: Inline field errors
- Not found: Redirect to folder list with message

---

## Backend Implementation

### Repository Layer

**FolderRepository:**

```python
class FolderRepository:
    def list_all(self, include_archived: bool = False) -> list[Folder]
    def get_by_id(self, folder_id: UUID) -> Folder | None
    def get_with_sessions(self, folder_id: UUID) -> Folder | None
    def create(self, name: str) -> Folder
    def update(self, folder_id: UUID, name: str) -> Folder
    def archive(self, folder_id: UUID) -> None
    def name_exists(self, name: str, exclude_id: UUID | None = None) -> bool
```

**SessionRepository:**

```python
class SessionRepository:
    def get_by_id(self, session_id: UUID) -> Session | None
    def get_with_documents(self, session_id: UUID) -> Session | None
    def list_by_folder(self, folder_id: UUID, include_archived: bool = False) -> list[Session]
    def create(self, folder_id: UUID, name: str, source_lang: str, target_lang: str) -> Session
    def update(self, session_id: UUID, name: str) -> Session
    def end_session(self, session_id: UUID) -> Session
    def archive(self, session_id: UUID) -> None
```

### Service Layer

**FolderService:**

```python
class FolderService:
    def list_folders(self) -> list[FolderSummary]
    def get_folder(self, folder_id: UUID) -> FolderDetail
    def create_folder(self, name: str) -> Folder
    def update_folder(self, folder_id: UUID, name: str) -> Folder
    def delete_folder(self, folder_id: UUID) -> None
```

**SessionService:**

```python
class SessionService:
    def get_session(self, session_id: UUID) -> SessionDetail
    def create_session(self, folder_id: UUID, data: CreateSessionRequest) -> Session
    def update_session(self, session_id: UUID, data: UpdateSessionRequest) -> Session
    def end_session(self, session_id: UUID, generate_notes: bool) -> Session
    def delete_session(self, session_id: UUID) -> None
```

### Validation Rules

**Folder Name:**

- Required, non-empty
- Maximum 255 characters
- Trimmed of leading/trailing whitespace

**Session Name:**

- Required, non-empty
- Maximum 255 characters
- Trimmed of leading/trailing whitespace

**Language Codes:**

- Must be valid ISO 639-1 codes
- Must be in supported language list: en, hi, zh, fr, es, bn

### Error Responses

| Scenario                     | Status | Code               |
| ---------------------------- | ------ | ------------------ |
| Folder not found             | 404    | FOLDER_NOT_FOUND   |
| Session not found            | 404    | SESSION_NOT_FOUND  |
| Session not active (for end) | 400    | SESSION_NOT_ACTIVE |
| Invalid language code        | 400    | INVALID_LANGUAGE   |
| Folder is archived           | 400    | FOLDER_ARCHIVED    |
