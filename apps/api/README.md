# Dooza AI API

FastAPI backend for Dooza Workforce, powered by LangGraph.

## Setup

### 1. Create virtual environment

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure environment

```bash
cp env.example .env
# Edit .env with your credentials
```

### 4. Run locally

```bash
uvicorn app.main:app --reload --port 8000
```

API docs available at: http://localhost:8000/docs

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/v1/chat/{agent_id}` | POST | Chat with agent (SSE streaming) |
| `/v1/threads` | GET | List user's threads |
| `/v1/threads/{thread_id}/messages` | GET | Get thread messages |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENROUTER_API_KEY` | OpenRouter API key |
| `DEFAULT_MODEL` | Default LLM model (e.g., `anthropic/claude-3.5-sonnet`) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key |
| `SUPABASE_JWT_SECRET` | JWT secret for token validation |
| `DATABASE_URL` | PostgreSQL connection string |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `DEBUG` | Enable debug mode and API docs |

## Deployment (Railway)

1. Connect your repo to Railway
2. Set Root Directory to `apps/api`
3. Add environment variables
4. Railway auto-detects Python and deploys

Or use Docker:
```bash
docker build -t dooza-api .
docker run -p 8000:8000 --env-file .env dooza-api
```
