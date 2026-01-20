# Workforce Platform - Claude Code Context

## Project Overview
An AI agent orchestration platform with a Python (FastAPI) backend and React (Vite/TypeScript) frontend.

## Architecture
- **Monorepo structure**: `apps/api` (backend), `apps/web` (frontend)
- **Backend**: FastAPI + LangGraph for AI agent orchestration, Supabase for auth/DB
- **Frontend**: React + TypeScript + Vite, uses Supabase client for auth

## Quick Commands

### Backend (FastAPI)
```bash
cd apps/api
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

### Frontend (React/Vite)
```bash
cd apps/web
npm install
npm run dev
```

## Key Files

### Backend
- `apps/api/app/main.py` - FastAPI entrypoint
- `apps/api/app/agents/` - AI agent definitions (SEO agents, etc.)
- `apps/api/app/routers/` - API routes
- `apps/api/app/tools/` - Agent tools/capabilities

### Frontend
- `apps/web/src/App.tsx` - React app entry
- `apps/web/src/pages/ChatPage.tsx` - Main chat interface
- `apps/web/src/lib/chat-api.ts` - Backend API client
- `apps/web/src/context/AuthContext.tsx` - Auth state management

## Code Conventions
- Backend uses Python 3.11+, type hints required
- Frontend uses TypeScript strict mode
- Keep code production-ready, no shortcuts
- Prefer long-term maintainability over quick fixes

## Environment
- Backend needs `.env` file (see `apps/api/env.example`)
- Frontend uses Vite env variables (`VITE_*` prefix)
- Supabase for auth and database
