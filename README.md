# Dooza AI

AI agent platform powered by LangGraph.

## Project Structure

```
/dooza-ai
├── apps/
│   ├── web/     # React frontend (Vite) → Deploy to Vercel
│   └── api/     # Python backend (FastAPI + LangGraph) → Deploy to Railway
```

## Quick Start

### Frontend

```bash
cd apps/web
npm install
npm run dev
```

### Backend

```bash
cd apps/api
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Edit with your credentials
uvicorn app.main:app --reload
```

## Deployment

| Component | Platform | Root Directory |
|-----------|----------|----------------|
| Frontend | Vercel | `apps/web` |
| Backend | Railway | `apps/api` |

## Tech Stack

- **Frontend**: React, Vite, TypeScript, Supabase Auth
- **Backend**: FastAPI, LangGraph, OpenRouter
- **Database**: Supabase (PostgreSQL)
- **LLM**: OpenRouter (Claude, GPT-4, etc.)
