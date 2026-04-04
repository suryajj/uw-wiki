# FRD-08: Convex Migration

## Overview

This Feature Requirements Document outlines the migration strategy for transitioning Rosetta from a PostgreSQL/FastAPI-based data layer to a Convex-powered serverless architecture. The migration adopts a hybrid approach where Convex handles all data operations (database, CRUD, file storage, real-time subscriptions) while FastAPI remains responsible for ML/AI services.

**Related Documents:**
- [PRD](../PRD.md) - Product Requirements Document
- [FRD-00: Project Setup](./FRD-00-project-setup.md)
- [FRD-09: Authentication](./FRD-09-authentication.md)

---

## Migration Strategy

### Approach: Incremental Migration

The migration follows an incremental approach rather than a "big-bang" switch:

1. **Phase 1**: Set up Convex project and schema alongside existing backend
2. **Phase 2**: Implement Convex functions and migrate frontend incrementally
3. **Phase 3**: Deprecate PostgreSQL-based endpoints
4. **Phase 4**: Clean up legacy code

### What Stays in FastAPI

The following services remain in FastAPI due to ML model requirements:

| Service | Reason |
|---------|--------|
| Translation WebSocket | Real-time streaming + ElevenLabs integration |
| Transcription WebSocket | Audio processing |
| RAG Pipeline | Local ML models (BGE, KeyBERT, TinyBERT) |
| Note Generation | LLM integration via OpenRouter |
| Document Processing | Text extraction, chunking, embedding generation |
| TTS Service | ElevenLabs API integration |

### What Moves to Convex

| Component | Current | New (Convex) |
|-----------|---------|--------------|
| User Authentication | None | Convex Auth |
| Folders CRUD | PostgreSQL + REST | Convex Database + Queries/Mutations |
| Sessions CRUD | PostgreSQL + REST | Convex Database + Queries/Mutations |
| Documents Metadata | PostgreSQL + REST | Convex Database + Queries/Mutations |
| File Storage | Local Filesystem | Convex File Storage |
| Transcripts | PostgreSQL + REST | Convex Database + Queries/Mutations |
| Citations | PostgreSQL + REST | Convex Database + Queries/Mutations |
| Notes | PostgreSQL + REST | Convex Database + Queries/Mutations |
| Real-time Updates | Polling | Convex Subscriptions |

---

## Convex Schema Design

### Schema Definition

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const schema = defineSchema({
  // Auth tables (users, sessions, accounts, etc.)
  ...authTables,
  
  // Override users table to add custom fields
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
  }).index("email", ["email"]),

  // Folders - Course/subject organization
  folders: defineTable({
    userId: v.id("users"),
    name: v.string(),
    archivedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_active", ["userId", "archivedAt"]),

  // Sessions - Lecture sessions within folders
  sessions: defineTable({
    folderId: v.id("folders"),
    userId: v.id("users"),
    name: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("archived")
    ),
    sourceLanguage: v.string(),
    targetLanguage: v.string(),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
  })
    .index("by_folder", ["folderId"])
    .index("by_user", ["userId"])
    .index("by_status", ["userId", "status"]),

  // Documents - Uploaded PDF course materials
  documents: defineTable({
    sessionId: v.id("sessions"),
    userId: v.id("users"),
    name: v.string(),
    storageId: v.id("_storage"),
    fileSize: v.number(),
    mimeType: v.string(),
    pageCount: v.optional(v.number()),
    chunkCount: v.optional(v.number()),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("ready"),
      v.literal("error")
    ),
    processingProgress: v.number(),
    errorMessage: v.optional(v.string()),
    processedAt: v.optional(v.number()),
  })
    .index("by_session", ["sessionId"])
    .index("by_user", ["userId"])
    .index("by_status", ["userId", "status"]),

  // Transcripts - Speech-to-text segments
  transcripts: defineTable({
    sessionId: v.id("sessions"),
    originalText: v.string(),
    translatedText: v.optional(v.string()),
    timestamp: v.number(),
    windowIndex: v.number(),
    isFinal: v.boolean(),
  })
    .index("by_session", ["sessionId"])
    .index("by_session_time", ["sessionId", "timestamp"]),

  // Citations - RAG-retrieved document references
  citations: defineTable({
    sessionId: v.id("sessions"),
    transcriptId: v.optional(v.id("transcripts")),
    documentId: v.id("documents"),
    pageNumber: v.number(),
    chunkText: v.string(),
    relevanceScore: v.number(),
    rank: v.number(), // 1 = most relevant
    windowIndex: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_transcript", ["transcriptId"])
    .index("by_document", ["documentId"]),

  // Notes - Generated lecture notes
  notes: defineTable({
    sessionId: v.id("sessions"),
    userId: v.id("users"),
    contentMarkdown: v.string(),
    generatedAt: v.number(),
    lastEditedAt: v.number(),
    version: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_user", ["userId"]),
});

export default schema;
```

### Data Model Mapping

| PostgreSQL Table | Convex Table | Key Changes |
|------------------|--------------|-------------|
| `folders` | `folders` | `user_id` → `userId` (typed reference) |
| `sessions` | `sessions` | `folder_id` → `folderId` (typed reference), timestamps as numbers |
| `documents` | `documents` | `file_path` → `storageId` (Convex file reference) |
| `transcripts` | `transcripts` | Similar structure |
| `citations` | `citations` | References use Convex IDs |
| `notes` | `notes` | Similar structure |

---

## Convex Functions

### Folder Functions

```typescript
// convex/folders.ts
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// List all active folders for authenticated user
export const list = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    return await ctx.db
      .query("folders")
      .withIndex("by_user_active", (q) => 
        q.eq("userId", userId).eq("archivedAt", undefined)
      )
      .collect();
  },
});

// Get a single folder
export const get = query({
  args: { id: v.id("folders") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const folder = await ctx.db.get(args.id);
    if (!folder || folder.userId !== userId) {
      throw new Error("Folder not found");
    }
    return folder;
  },
});

// Create a new folder
export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    return await ctx.db.insert("folders", {
      userId,
      name: args.name,
    });
  },
});

// Update folder name
export const update = mutation({
  args: { id: v.id("folders"), name: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const folder = await ctx.db.get(args.id);
    if (!folder || folder.userId !== userId) {
      throw new Error("Folder not found");
    }
    
    await ctx.db.patch(args.id, { name: args.name });
  },
});

// Archive folder (soft delete)
export const archive = mutation({
  args: { id: v.id("folders") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const folder = await ctx.db.get(args.id);
    if (!folder || folder.userId !== userId) {
      throw new Error("Folder not found");
    }
    
    await ctx.db.patch(args.id, { archivedAt: Date.now() });
  },
});

// Permanently delete folder and all contents
export const remove = mutation({
  args: { id: v.id("folders") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const folder = await ctx.db.get(args.id);
    if (!folder || folder.userId !== userId) {
      throw new Error("Folder not found");
    }
    
    // Delete all sessions in folder (cascades to documents, transcripts, etc.)
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_folder", (q) => q.eq("folderId", args.id))
      .collect();
    
    for (const session of sessions) {
      // Delete documents
      const documents = await ctx.db
        .query("documents")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect();
      
      for (const doc of documents) {
        await ctx.storage.delete(doc.storageId);
        await ctx.db.delete(doc._id);
      }
      
      // Delete transcripts, citations, notes
      const transcripts = await ctx.db
        .query("transcripts")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect();
      for (const t of transcripts) await ctx.db.delete(t._id);
      
      const citations = await ctx.db
        .query("citations")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect();
      for (const c of citations) await ctx.db.delete(c._id);
      
      const notes = await ctx.db
        .query("notes")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect();
      for (const n of notes) await ctx.db.delete(n._id);
      
      await ctx.db.delete(session._id);
    }
    
    await ctx.db.delete(args.id);
  },
});
```

### Session Functions

```typescript
// convex/sessions.ts
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const listByFolder = query({
  args: { folderId: v.id("folders") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    // Verify folder ownership
    const folder = await ctx.db.get(args.folderId);
    if (!folder || folder.userId !== userId) {
      throw new Error("Folder not found");
    }
    
    return await ctx.db
      .query("sessions")
      .withIndex("by_folder", (q) => q.eq("folderId", args.folderId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const session = await ctx.db.get(args.id);
    if (!session || session.userId !== userId) {
      throw new Error("Session not found");
    }
    return session;
  },
});

export const create = mutation({
  args: {
    folderId: v.id("folders"),
    name: v.string(),
    sourceLanguage: v.string(),
    targetLanguage: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    // Verify folder ownership
    const folder = await ctx.db.get(args.folderId);
    if (!folder || folder.userId !== userId) {
      throw new Error("Folder not found");
    }
    
    return await ctx.db.insert("sessions", {
      folderId: args.folderId,
      userId,
      name: args.name,
      status: "active",
      sourceLanguage: args.sourceLanguage,
      targetLanguage: args.targetLanguage,
      startedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("sessions"),
    name: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("archived")
    )),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const session = await ctx.db.get(args.id);
    if (!session || session.userId !== userId) {
      throw new Error("Session not found");
    }
    
    const updates: any = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.status !== undefined) updates.status = args.status;
    
    await ctx.db.patch(args.id, updates);
  },
});

export const end = mutation({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const session = await ctx.db.get(args.id);
    if (!session || session.userId !== userId) {
      throw new Error("Session not found");
    }
    
    await ctx.db.patch(args.id, {
      status: "completed",
      endedAt: Date.now(),
    });
  },
});
```

### Document Functions

```typescript
// convex/documents.ts
import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "./_generated/api";

export const listBySession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    // Verify session ownership
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) {
      throw new Error("Session not found");
    }
    
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    
    // Add download URLs
    return Promise.all(
      documents.map(async (doc) => ({
        ...doc,
        url: await ctx.storage.getUrl(doc.storageId),
      }))
    );
  },
});

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveDocument = mutation({
  args: {
    sessionId: v.id("sessions"),
    storageId: v.id("_storage"),
    name: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    // Verify session ownership
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) {
      throw new Error("Session not found");
    }
    
    const documentId = await ctx.db.insert("documents", {
      sessionId: args.sessionId,
      userId,
      name: args.name,
      storageId: args.storageId,
      fileSize: args.fileSize,
      mimeType: args.mimeType,
      status: "pending",
      processingProgress: 0,
    });
    
    // Trigger processing via HTTP action to FastAPI
    await ctx.scheduler.runAfter(0, internal.documents.processDocument, {
      documentId,
    });
    
    return documentId;
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("documents"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("ready"),
      v.literal("error")
    ),
    processingProgress: v.optional(v.number()),
    pageCount: v.optional(v.number()),
    chunkCount: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: any = { status: args.status };
    if (args.processingProgress !== undefined) {
      updates.processingProgress = args.processingProgress;
    }
    if (args.pageCount !== undefined) updates.pageCount = args.pageCount;
    if (args.chunkCount !== undefined) updates.chunkCount = args.chunkCount;
    if (args.errorMessage !== undefined) updates.errorMessage = args.errorMessage;
    if (args.status === "ready") updates.processedAt = Date.now();
    
    await ctx.db.patch(args.id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const document = await ctx.db.get(args.id);
    if (!document || document.userId !== userId) {
      throw new Error("Document not found");
    }
    
    // Delete file from storage
    await ctx.storage.delete(document.storageId);
    
    // Delete associated citations
    const citations = await ctx.db
      .query("citations")
      .withIndex("by_document", (q) => q.eq("documentId", args.id))
      .collect();
    for (const c of citations) await ctx.db.delete(c._id);
    
    await ctx.db.delete(args.id);
  },
});

// Internal action to process document via FastAPI
export const processDocument = action({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const document = await ctx.runQuery(api.documents.getInternal, {
      id: args.documentId,
    });
    
    if (!document) throw new Error("Document not found");
    
    // Get file URL
    const fileUrl = await ctx.storage.getUrl(document.storageId);
    
    // Update status to processing
    await ctx.runMutation(api.documents.updateStatus, {
      id: args.documentId,
      status: "processing",
      processingProgress: 0,
    });
    
    try {
      // Call FastAPI to process document
      const response = await fetch(
        `${process.env.FASTAPI_URL}/api/v1/documents/process`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentId: args.documentId,
            fileUrl,
            fileName: document.name,
          }),
        }
      );
      
      if (!response.ok) {
        throw new Error(`Processing failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Update with results
      await ctx.runMutation(api.documents.updateStatus, {
        id: args.documentId,
        status: "ready",
        processingProgress: 100,
        pageCount: result.pageCount,
        chunkCount: result.chunkCount,
      });
    } catch (error) {
      await ctx.runMutation(api.documents.updateStatus, {
        id: args.documentId,
        status: "error",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
});
```

### Notes Functions

```typescript
// convex/notes.ts
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getBySession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) {
      throw new Error("Session not found");
    }
    
    return await ctx.db
      .query("notes")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();
  },
});

export const create = mutation({
  args: {
    sessionId: v.id("sessions"),
    contentMarkdown: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) {
      throw new Error("Session not found");
    }
    
    // Check if notes already exist
    const existing = await ctx.db
      .query("notes")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();
    
    if (existing) {
      throw new Error("Notes already exist for this session");
    }
    
    const now = Date.now();
    return await ctx.db.insert("notes", {
      sessionId: args.sessionId,
      userId,
      contentMarkdown: args.contentMarkdown,
      generatedAt: now,
      lastEditedAt: now,
      version: 1,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("notes"),
    contentMarkdown: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const notes = await ctx.db.get(args.id);
    if (!notes || notes.userId !== userId) {
      throw new Error("Notes not found");
    }
    
    await ctx.db.patch(args.id, {
      contentMarkdown: args.contentMarkdown,
      lastEditedAt: Date.now(),
      version: notes.version + 1,
    });
  },
});
```

---

## File Storage Migration

### Current State (Local Filesystem)

```
backend/uploads/
├── {session_id}/
│   ├── {timestamp}_{filename}.pdf
│   └── ...
```

### New State (Convex File Storage)

Files are stored in Convex's built-in file storage with:
- Automatic CDN distribution
- Secure signed URLs
- Automatic cleanup on document deletion

### Upload Flow

**Current Flow:**
1. Frontend sends file to FastAPI endpoint
2. FastAPI saves file to local filesystem
3. File path stored in PostgreSQL

**New Flow:**
1. Frontend requests upload URL from Convex (`documents.generateUploadUrl`)
2. Frontend uploads file directly to Convex Storage
3. Frontend calls `documents.saveDocument` with storage ID
4. Convex triggers processing via HTTP action to FastAPI
5. FastAPI downloads file from Convex, processes it, stores embeddings in ChromaDB
6. FastAPI calls back to Convex to update document status

---

## Frontend Migration

### API Layer Changes

**Before (axios):**
```typescript
// frontend/src/services/api.ts
export const folderApi = {
  list: () => api.get('/folders'),
  create: (data) => api.post('/folders', data),
  update: (id, data) => api.put(`/folders/${id}`, data),
  delete: (id) => api.delete(`/folders/${id}`),
};
```

**After (Convex):**
```typescript
// frontend/src/features/home/HomePage.tsx
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

function HomePage() {
  const folders = useQuery(api.folders.list);
  const createFolder = useMutation(api.folders.create);
  
  const handleCreate = async (name: string) => {
    await createFolder({ name });
    // No need to refetch - Convex subscriptions update automatically
  };
  
  return (
    <div>
      {folders?.map(folder => (
        <FolderCard key={folder._id} folder={folder} />
      ))}
    </div>
  );
}
```

### File Upload Changes

**Before:**
```typescript
const uploadDocument = async (file: File, sessionId: string) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('session_id', sessionId);
  await api.post('/documents', formData);
};
```

**After:**
```typescript
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

function DocumentUpload({ sessionId }) {
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const saveDocument = useMutation(api.documents.saveDocument);
  
  const uploadDocument = async (file: File) => {
    // Step 1: Get upload URL
    const uploadUrl = await generateUploadUrl();
    
    // Step 2: Upload file directly to Convex
    const result = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    const { storageId } = await result.json();
    
    // Step 3: Save document metadata
    await saveDocument({
      sessionId,
      storageId,
      name: file.name,
      fileSize: file.size,
      mimeType: file.type,
    });
  };
}
```

---

## FastAPI Endpoint Updates

### New Endpoint: Process Document

```python
# backend/app/api/routes/documents.py

@router.post("/process")
async def process_document(
    request: DocumentProcessRequest,
    document_service: DocumentService = Depends(get_document_service),
):
    """
    Process a document from Convex file storage.
    Called by Convex HTTP action after file upload.
    """
    # Download file from Convex
    async with httpx.AsyncClient() as client:
        response = await client.get(request.file_url)
        file_content = response.content
    
    # Process document (extract text, chunk, embed)
    result = await document_service.process_pdf(
        file_content=file_content,
        file_name=request.file_name,
        document_id=request.document_id,
    )
    
    return {
        "pageCount": result.page_count,
        "chunkCount": result.chunk_count,
    }
```

### Callback to Convex

```python
# backend/app/services/document.py

async def update_convex_status(
    document_id: str,
    status: str,
    progress: int = 0,
    page_count: int = None,
    chunk_count: int = None,
    error_message: str = None,
):
    """Call back to Convex to update document status."""
    async with httpx.AsyncClient() as client:
        await client.post(
            f"{settings.convex_url}/api/mutation",
            json={
                "path": "documents:updateStatus",
                "args": {
                    "id": document_id,
                    "status": status,
                    "processingProgress": progress,
                    "pageCount": page_count,
                    "chunkCount": chunk_count,
                    "errorMessage": error_message,
                },
            },
            headers={"Authorization": f"Bearer {settings.convex_deploy_key}"},
        )
```

---

## Environment Variables

### Frontend (.env)

```bash
VITE_CONVEX_URL=https://your-project.convex.cloud
VITE_FASTAPI_URL=http://localhost:8001
```

### Convex Dashboard

```bash
SITE_URL=http://localhost:5173
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
JWKS={"keys":[...]}
FASTAPI_URL=http://localhost:8001
AUTH_GITHUB_ID=xxx
AUTH_GITHUB_SECRET=xxx
AUTH_GOOGLE_ID=xxx
AUTH_GOOGLE_SECRET=xxx
AUTH_APPLE_ID=xxx
AUTH_APPLE_SECRET=xxx
AUTH_RESEND_KEY=xxx
```

### Backend (.env)

```bash
# Existing
OPENROUTER_API_KEY=xxx
ELEVENLABS_API_KEY=xxx
CHROMA_HOST=localhost
CHROMA_PORT=8000

# New
CONVEX_URL=https://your-project.convex.cloud
CONVEX_DEPLOY_KEY=xxx
```

---

## Rollback Plan

If issues arise during migration:

1. **Phase 1-2**: Frontend can fall back to axios API calls
2. **Phase 3**: Re-enable FastAPI REST endpoints
3. **Data Recovery**: PostgreSQL remains as source of truth until migration validated

### Feature Flags

```typescript
// frontend/src/config/features.ts
export const features = {
  useConvex: import.meta.env.VITE_USE_CONVEX === 'true',
};

// Usage
const folders = features.useConvex 
  ? useQuery(api.folders.list)
  : useTanstackQuery({ queryKey: ['folders'], queryFn: folderApi.list });
```

---

## Testing Strategy

### Unit Tests
- Test each Convex function in isolation
- Mock `ctx.db` and `ctx.storage` operations

### Integration Tests
- Test Convex → FastAPI communication
- Test file upload flow end-to-end

### Migration Tests
- Verify data consistency between PostgreSQL and Convex
- Test real-time subscriptions work correctly

---

## Timeline

| Week | Milestone |
|------|-----------|
| 1 | Convex setup, schema, auth implementation |
| 2 | Folders and sessions migration, file storage |
| 3 | Documents, transcripts, citations, notes migration |
| 4 | Testing, cleanup, documentation |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-31 | Rosetta Team | Initial FRD for Convex migration |
