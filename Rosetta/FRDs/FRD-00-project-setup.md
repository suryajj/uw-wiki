# FRD-00: Project Setup and Infrastructure

## Overview

This FRD establishes the foundational project structure, technology stack, Docker configuration, and development environment for Rosetta. All subsequent features build upon this infrastructure.

**Key Design Decisions:**

1. **Monorepo Structure** — Frontend and backend live in a single repository with clear separation. This simplifies development workflow and ensures version consistency.

2. **Docker-First Development** — PostgreSQL and Chroma run in Docker containers. The application code runs locally for faster iteration with hot reload.

3. **Controller-Service-Repository Pattern** — Backend follows clean architecture with dependency injection for testability and maintainability.

4. **Type Safety Throughout** — TypeScript on frontend, Pydantic models on backend, with generated API client for end-to-end type safety.

5. **Material UI Design System** — Consistent, accessible UI components with custom theming for the Rosetta brand.

---

## Project Structure

```
lecturelens/
├── frontend/                    # React + TypeScript application
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   ├── features/            # Feature-specific modules
│   │   ├── hooks/               # Custom React hooks
│   │   ├── services/            # API client and external services
│   │   ├── stores/              # State management
│   │   ├── theme/               # Material UI theme configuration
│   │   ├── types/               # TypeScript type definitions
│   │   ├── utils/               # Utility functions
│   │   ├── App.tsx              # Root component
│   │   └── main.tsx             # Application entry point
│   ├── public/                  # Static assets
│   ├── index.html               # HTML template
│   ├── package.json             # Node.js dependencies
│   ├── tsconfig.json            # TypeScript configuration
│   └── vite.config.ts           # Vite build configuration
│
├── backend/                     # FastAPI + Python application
│   ├── app/
│   │   ├── api/                 # API routes (controllers)
│   │   │   ├── routes/          # Route modules by domain
│   │   │   └── deps.py          # Dependency injection
│   │   ├── core/                # Core configuration
│   │   │   ├── config.py        # Settings management
│   │   │   └── security.py      # Security utilities
│   │   ├── models/              # SQLAlchemy ORM models
│   │   ├── schemas/             # Pydantic DTOs
│   │   ├── services/            # Business logic layer
│   │   ├── repositories/        # Data access layer
│   │   ├── external/            # External API clients
│   │   │   ├── elevenlabs.py    # ElevenLabs client
│   │   │   ├── openrouter.py    # OpenRouter client
│   │   │   └── chroma.py        # Chroma client
│   │   └── main.py              # FastAPI application entry
│   ├── alembic/                 # Database migrations
│   ├── tests/                   # Test suite
│   ├── requirements.txt         # Python dependencies
│   └── alembic.ini              # Alembic configuration
│
├── docker/                      # Docker configuration
│   ├── docker-compose.yml       # Development services
│   └── docker-compose.prod.yml  # Production services (future)
│
├── docs/                        # Documentation
│   ├── PRD.md                   # Product Requirements Document
│   ├── SETUP_GUIDE.md           # Setup instructions
│   └── FRDs/                    # Feature Requirements Documents
│
├── .env.example                 # Environment variable template
├── .gitignore                   # Git ignore patterns
└── README.md                    # Project overview
```

---

## Technology Stack

### Frontend

| Technology         | Version | Purpose                   |
| ------------------ | ------- | ------------------------- |
| **React**          | 18.x    | UI framework              |
| **TypeScript**     | 5.x     | Type-safe JavaScript      |
| **Vite**           | 5.x     | Build tool and dev server |
| **Material UI**    | 5.x     | Component library         |
| **React Router**   | 6.x     | Client-side routing       |
| **TanStack Query** | 5.x     | Server state management   |
| **Zustand**        | 4.x     | Client state management   |
| **TipTap**         | 2.x     | Rich text editor          |
| **react-pdf**      | 7.x     | PDF rendering and export  |

### Backend

| Technology                | Version | Purpose                           |
| ------------------------- | ------- | --------------------------------- |
| **FastAPI**               | 0.109+  | Web framework                     |
| **Python**                | 3.11+   | Runtime                           |
| **Pydantic**              | 2.x     | Data validation and serialization |
| **SQLAlchemy**            | 2.x     | ORM for PostgreSQL                |
| **Alembic**               | 1.x     | Database migrations               |
| **Uvicorn**               | 0.27+   | ASGI server                       |
| **httpx**                 | 0.26+   | Async HTTP client                 |
| **python-multipart**      | 0.x     | File upload handling              |
| **PyPDF2**                | 3.x     | PDF text extraction               |
| **sentence-transformers** | 2.x     | Embeddings and re-ranking         |
| **keybert**               | 0.x     | Keyword extraction                |

### Infrastructure

| Technology         | Version | Purpose               |
| ------------------ | ------- | --------------------- |
| **PostgreSQL**     | 16      | Relational database   |
| **Chroma**         | 0.4+    | Vector database       |
| **Docker**         | 24+     | Container runtime     |
| **Docker Compose** | 2.20+   | Service orchestration |

---

## Docker Compose Configuration

### Services

**PostgreSQL Container:**

- Image: `postgres:16-alpine`
- Port: 5432
- Persistent volume for data
- Health check enabled

**Chroma Container:**

- Image: `chromadb/chroma:latest`
- Port: 8000
- Persistent volume for embeddings
- Health check enabled

### Docker Compose Schema

```yaml
# docker-compose.yml structure
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 5s
      timeout: 5s
      retries: 5

  chroma:
    image: chromadb/chroma:latest
    ports:
      - "8000:8000"
    volumes:
      - chroma_data:/chroma/chroma
    environment:
      - ANONYMIZED_TELEMETRY=false

volumes:
  postgres_data:
  chroma_data:
```

---

## Backend Architecture

### Layer Responsibilities

**Controller Layer (app/api/routes/):**

- Define API endpoints with FastAPI decorators
- Handle request/response serialization via Pydantic schemas
- Validate input parameters
- Delegate to service layer for business logic
- Return appropriate HTTP status codes

**Service Layer (app/services/):**

- Implement business logic
- Orchestrate calls to repositories and external APIs
- Handle transactions and error recovery
- Enforce business rules and validation

**Repository Layer (app/repositories/):**

- Abstract database operations
- Execute SQLAlchemy queries
- Handle Chroma vector operations
- Provide clean interfaces for data access

**External Layer (app/external/):**

- Wrap external API clients (ElevenLabs, OpenRouter)
- Handle authentication and error mapping
- Implement retry logic and rate limiting

### Dependency Injection

All dependencies are injected via FastAPI's `Depends()`:

```python
# Pattern for dependency injection
def get_db() -> Generator[Session, None, None]:
    ...

def get_folder_repository(db: Session = Depends(get_db)) -> FolderRepository:
    ...

def get_folder_service(
    folder_repo: FolderRepository = Depends(get_folder_repository)
) -> FolderService:
    ...
```

---

## API Design

### Base URL

- Development: `http://localhost:8000`
- API prefix: `/api/v1`

### Standard Response Formats

**Success Response:**

```json
{
  "data": { ... },
  "message": "Operation successful"
}
```

**Error Response:**

```json
{
  "detail": "Error description",
  "code": "ERROR_CODE",
  "field": "optional_field_name"
}
```

### Common HTTP Status Codes

| Code | Usage                                      |
| ---- | ------------------------------------------ |
| 200  | Successful GET, PUT                        |
| 201  | Successful POST (resource created)         |
| 204  | Successful DELETE                          |
| 400  | Validation error, bad request              |
| 401  | Authentication required                    |
| 404  | Resource not found                         |
| 422  | Unprocessable entity (Pydantic validation) |
| 500  | Internal server error                      |

### Health Endpoints

| Endpoint                 | Purpose                     |
| ------------------------ | --------------------------- |
| `GET /health`            | Basic health check          |
| `GET /health/db`         | Database connectivity       |
| `GET /health/chroma`     | Chroma connectivity         |
| `GET /health/elevenlabs` | ElevenLabs API key validity |
| `GET /health/openrouter` | OpenRouter API key validity |

---

## Frontend Architecture

### Component Organization

**components/** — Reusable, stateless UI components:

- Layout components (Header, Sidebar, Panel)
- Form components (Input, Select, Button)
- Display components (Card, List, Modal)

**features/** — Feature-specific modules with co-located components, hooks, and logic:

- folders/ — Folder management UI
- sessions/ — Session management UI
- documents/ — Document upload and management
- transcription/ — Live transcription display
- translation/ — Speech translation controls
- citations/ — Citation panel and preview
- notes/ — Note editor and generation
- questions/ — Question translation assistant

### State Management

**Server State (TanStack Query):**

- API data fetching and caching
- Optimistic updates
- Background refetching

**Client State (Zustand):**

- UI state (sidebar open/closed)
- Audio playback state
- Session recording state
- User preferences

### API Client

Generated TypeScript client from OpenAPI schema:

```typescript
// Generated client structure
interface ApiClient {
  folders: FolderApi;
  sessions: SessionApi;
  documents: DocumentApi;
  notes: NoteApi;
  rag: RagApi;
  translate: TranslateApi;
}
```

---

## Database Schema Overview

### Core Tables

| Table             | Purpose                                             |
| ----------------- | --------------------------------------------------- |
| `folders`         | Course/subject organization                         |
| `sessions`        | Lecture recording sessions                          |
| `documents`       | Uploaded PDF metadata                               |
| `document_chunks` | Chunked document segments with embeddings reference |
| `transcripts`     | Session transcription segments                      |
| `citations`       | Retrieved citations per transcript segment          |
| `notes`           | Generated lecture notes                             |

### Relationships

```
folders (1) ──── (n) sessions
sessions (1) ──── (n) session_documents
sessions (1) ──── (n) transcripts
sessions (1) ──── (1) notes
transcripts (1) ──── (n) citations
documents (1) ──── (n) document_chunks
documents (1) ──── (n) session_documents
```

---

## Environment Variables

### Required Variables

| Variable             | Description                             |
| -------------------- | --------------------------------------- |
| `ELEVENLABS_API_KEY` | ElevenLabs API key for speech-to-speech |
| `OPENROUTER_API_KEY` | OpenRouter API key for LLM access       |
| `DATABASE_URL`       | PostgreSQL connection string            |
| `CHROMA_HOST`        | Chroma server hostname                  |
| `CHROMA_PORT`        | Chroma server port                      |

### Optional Variables

| Variable          | Default                                  | Description              |
| ----------------- | ---------------------------------------- | ------------------------ |
| `CORS_ORIGINS`    | `http://localhost:5173`                  | Allowed frontend origins |
| `DEBUG`           | `true`                                   | Enable debug mode        |
| `LOG_LEVEL`       | `INFO`                                   | Logging verbosity        |
| `EMBEDDING_MODEL` | `BAAI/bge-base-en-v1.5`                  | Local embedding model    |
| `RERANKER_MODEL`  | `cross-encoder/ms-marco-TinyBERT-L-2-v2` | Cross-encoder model      |

---

## Code Quality Tooling

### Backend (Python)

| Tool           | Purpose                |
| -------------- | ---------------------- |
| **Ruff**       | Linting and formatting |
| **mypy**       | Static type checking   |
| **pytest**     | Testing framework      |
| **pytest-cov** | Coverage reporting     |

### Frontend (TypeScript)

| Tool           | Purpose           |
| -------------- | ----------------- |
| **ESLint**     | Linting           |
| **Prettier**   | Code formatting   |
| **TypeScript** | Type checking     |
| **Vitest**     | Testing framework |

### Git Hooks

Pre-commit hooks for:

- Linting (Ruff, ESLint)
- Formatting (Ruff, Prettier)
- Type checking (mypy, tsc)

---

## Development Workflow

### Starting Development

```bash
# 1. Start infrastructure
docker compose up -d

# 2. Start backend (Terminal 1)
cd backend
source venv/bin/activate
uvicorn app.main:app --reload

# 3. Start frontend (Terminal 2)
cd frontend
pnpm dev
```

### Database Migrations

```bash
# Create new migration
alembic revision --autogenerate -m "Description"

# Apply migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1
```

### Running Tests

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
pnpm test
```

---

## Security Considerations

### API Security

- CORS configured to allow only specified origins
- All API keys stored in environment variables, never committed
- Input validation on all endpoints via Pydantic

### Data Security

- Audio streams processed in real-time, not stored on server
- User data isolated by session
- File uploads validated for type and size

### Browser Security

- Microphone access requires user consent
- HTTPS required in production for microphone access
- Content Security Policy headers configured

---

## Dependencies Reference

### Backend requirements.txt

```
fastapi>=0.109.0
uvicorn>=0.27.0
pydantic>=2.5.0
pydantic-settings>=2.1.0
sqlalchemy>=2.0.0
alembic>=1.13.0
asyncpg>=0.29.0
psycopg2-binary>=2.9.0
httpx>=0.26.0
python-multipart>=0.0.6
PyPDF2>=3.0.0
chromadb>=0.4.0
sentence-transformers>=2.2.0
websockets>=12.0
python-dotenv>=1.0.0
```

### Frontend package.json dependencies

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.21.0",
    "@mui/material": "^5.15.0",
    "@mui/icons-material": "^5.15.0",
    "@emotion/react": "^11.11.0",
    "@emotion/styled": "^11.11.0",
    "@tanstack/react-query": "^5.17.0",
    "zustand": "^4.4.0",
    "@tiptap/react": "^2.1.0",
    "@tiptap/starter-kit": "^2.1.0",
    "react-pdf": "^7.6.0",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "eslint": "^8.56.0",
    "prettier": "^3.2.0",
    "vitest": "^1.2.0"
  }
}
```
