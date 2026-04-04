# Rosetta Setup Guide

This guide walks you through setting up the Rosetta development environment, including all external dependencies, API keys, and local services.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [External Dependencies](#external-dependencies)
3. [API Key Registration](#api-key-registration)
4. [Environment Configuration](#environment-configuration)
5. [Local Development Setup](#local-development-setup)
6. [Running the Application](#running-the-application)
7. [Verifying the Setup](#verifying-the-setup)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, ensure you have the following installed:

| Tool | Version | Purpose |
|------|---------|---------|
| **Node.js** | 20+ | Frontend runtime |
| **pnpm** | 8+ | Frontend package manager |
| **Python** | 3.11+ | Backend runtime |
| **Docker** | 24+ | Container runtime |
| **Docker Compose** | 2.20+ | Multi-container orchestration |
| **Git** | 2.40+ | Version control |

### Verify installations

```bash
node --version      # Should be v20.x or higher
pnpm --version      # Should be 8.x or higher
python3 --version   # Should be 3.11.x or higher
docker --version    # Should be 24.x or higher
docker compose version  # Should be 2.20.x or higher
```

---

## External Dependencies

Rosetta relies on the following external services and tools:

### External APIs (Require API Keys)

| Service | Purpose | Pricing |
|---------|---------|---------|
| **ElevenLabs** | Speech-to-Speech translation with natural voice synthesis | Paid (Creator plan or higher recommended for Speech-to-Speech) |
| **OpenRouter** | Unified access to LLMs for embeddings, note generation, query enrichment, and question translation | Pay-per-use |

### Browser APIs (No Setup Required)

| API | Purpose | Notes |
|-----|---------|-------|
| **Google Web Speech API** | Live speech-to-text transcription | Built into Chrome/Edge browsers, no API key needed |

### Local Services (Via Docker)

| Service | Purpose | Container |
|---------|---------|-----------|
| **PostgreSQL** | Relational database for folders, sessions, notes, and document metadata | `postgres:16-alpine` |
| **Chroma** | Vector database for document embeddings and semantic search | `chromadb/chroma:latest` |

### Python Libraries (Local Installation)

| Library | Purpose |
|---------|---------|
| **Sentence Transformers** | Cross-encoder model for re-ranking RAG results |

---

## API Key Registration

### ElevenLabs

1. Go to [elevenlabs.io](https://elevenlabs.io) and create an account
2. Navigate to **Profile → API Keys**
3. Click **Create API Key** and copy the key
4. Ensure your plan includes **Speech-to-Speech** access (Creator plan or higher)
5. Note the supported languages: English, Hindi, Chinese, French, Spanish, Bengali

### OpenRouter

1. Go to [openrouter.ai](https://openrouter.ai) and create an account
2. Navigate to **Keys** in the dashboard
3. Click **Create Key** and copy the key
4. Add credits to your account (pay-as-you-go model)
5. Recommended models for Rosetta:
   - **Embeddings**: `openai/text-embedding-3-large` (both indexing and RAG queries must use same model)
   - **Note Generation**: `anthropic/claude-3-haiku` or `openai/gpt-4o-mini`
   - **Query Enrichment**: `anthropic/claude-3-haiku`
   - **Question Translation**: `openai/gpt-4o-mini`

---

## Environment Configuration

### Step 1: Copy the environment template

```bash
cp .env.example .env
```

### Step 2: Fill in your API keys

Edit the `.env` file with your credentials:

```bash
# ===================
# External API Keys
# ===================

# ElevenLabs - Speech-to-Speech translation
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here

# OpenRouter - LLM access for embeddings, notes, queries
OPENROUTER_API_KEY=your_openrouter_api_key_here

# ===================
# Database Configuration
# ===================

# PostgreSQL (via Docker)
DATABASE_URL=postgresql://lecturelens:lecturelens@localhost:5432/lecturelens
POSTGRES_USER=lecturelens
POSTGRES_PASSWORD=lecturelens
POSTGRES_DB=lecturelens

# Chroma Vector Database (via Docker)
CHROMA_HOST=localhost
CHROMA_PORT=8000

# ===================
# Application Settings
# ===================

# CORS - Frontend origin for API access
CORS_ORIGINS=http://localhost:5173

# Debug mode (disable in production)
DEBUG=true

# ===================
# Model Configuration
# ===================

# OpenRouter model IDs
# Note: Both embedding models MUST be the same for RAG vector search compatibility
EMBEDDING_MODEL_REALTIME=openai/text-embedding-3-large
EMBEDDING_MODEL_INDEXING=openai/text-embedding-3-large
NOTE_GENERATION_MODEL=anthropic/claude-3-haiku
QUERY_ENRICHMENT_MODEL=anthropic/claude-3-haiku
QUESTION_TRANSLATION_MODEL=openai/gpt-4o-mini
```

---

## Local Development Setup

### Step 1: Clone the repository

```bash
git clone <repository-url>
cd lecturelens
```

### Step 2: Start Docker services

Start PostgreSQL and Chroma containers:

```bash
docker compose up -d
```

Verify containers are running:

```bash
docker compose ps
```

You should see:
- `lecturelens-postgres` - Running on port 5432
- `lecturelens-chroma` - Running on port 8000

### Step 3: Set up the backend

Create and activate a Python virtual environment:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

Install Python dependencies:

```bash
pip install -r requirements.txt
```

Run database migrations:

```bash
alembic upgrade head
```

### Step 4: Set up the frontend

Install Node.js dependencies:

```bash
cd ../frontend
pnpm install
```

---

## Running the Application

### Terminal 1: Start the backend server

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

### Terminal 2: Start the frontend dev server

```bash
cd frontend
pnpm dev
```

The application will be available at `http://localhost:5173`

---

## Verifying the Setup

### 1. Check Docker services

```bash
# PostgreSQL
docker compose exec postgres pg_isready

# Chroma
curl http://localhost:8000/api/v1/heartbeat
```

### 2. Check backend API

```bash
# Health check
curl http://localhost:8000/health

# API documentation
open http://localhost:8000/docs
```

### 3. Check frontend

Open `http://localhost:5173` in Chrome or Edge (required for Web Speech API)

### 4. Test external API connections

The backend includes health endpoints that verify API key validity:

```bash
curl http://localhost:8000/health/elevenlabs
curl http://localhost:8000/health/openrouter
```

---

## Troubleshooting

### API Key Issues

**Problem**: `401 Unauthorized` from ElevenLabs
- Verify your API key is correct in `.env`
- Ensure your plan includes Speech-to-Speech access
- Check your usage limits haven't been exceeded

**Problem**: `401 Unauthorized` from OpenRouter
- Verify your API key is correct in `.env`
- Ensure you have credits in your account
- Check the model IDs are valid

### Database Connection Issues

**Problem**: Cannot connect to PostgreSQL
```bash
# Check if container is running
docker compose ps

# Check container logs
docker compose logs postgres

# Restart containers
docker compose down && docker compose up -d
```

**Problem**: Cannot connect to Chroma
```bash
# Check if container is running
docker compose ps

# Check container logs
docker compose logs chroma

# Verify Chroma is responding
curl http://localhost:8000/api/v1/heartbeat
```

### Browser Microphone Issues

**Problem**: Microphone access denied
- Ensure you're using HTTPS or localhost (required for microphone access)
- Check browser permissions: Settings → Privacy → Microphone
- Try a different browser (Chrome recommended)

**Problem**: Web Speech API not working
- Use Chrome or Edge (Safari/Firefox have limited support)
- Ensure you're on localhost or HTTPS
- Check browser console for errors

### Port Conflicts

**Problem**: Port already in use
```bash
# Find what's using the port
lsof -i :5432  # PostgreSQL
lsof -i :8000  # Backend/Chroma
lsof -i :5173  # Frontend

# Kill the process or change ports in docker-compose.yml / .env
```

---

## Next Steps

Once setup is complete:

1. Create a folder for your course
2. Upload PDF course materials
3. Start a new session and begin capturing lecture audio
4. View real-time translation and transcription with citations
5. Generate structured notes after the lecture

For feature-specific documentation, see the FRDs in `docs/FRDs/`.
