# Dooza AI - Deployment Context

> This file contains all deployment information for future reference.
> **DO NOT COMMIT SENSITIVE KEYS TO GIT** - They are stored in `.deploy-keys`

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         GitHub Repo                              │
│         https://github.com/sibi-narendran/intern.dooza.co       │
│                                                                  │
│  ┌─────────────────┐              ┌─────────────────┐           │
│  │   apps/web      │              │    apps/api     │           │
│  │  React + Vite   │              │ FastAPI+LangGraph│           │
│  └────────┬────────┘              └────────┬────────┘           │
└───────────┼─────────────────────────────────┼───────────────────┘
            │                                 │
            ▼                                 ▼
┌─────────────────────┐          ┌─────────────────────┐
│       VERCEL        │          │       RENDER        │
│                     │          │                     │
│ Project: web        │          │ Service: dooza-api  │
│ ID: prj_L6mlya6...  │          │ ID: srv-d5m9frbe... │
│                     │          │                     │
│ URL:                │          │ URL:                │
│ web-xxx.vercel.app  │   ───►   │ dooza-api.onrender  │
│                     │  (API)   │ .com                │
└─────────────────────┘          └─────────────────────┘
            │                                 │
            └────────────┬────────────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │      SUPABASE       │
              │                     │
              │ Project: rndikt...  │
              │ PostgreSQL + Auth   │
              └─────────────────────┘
```

---

## Platform Access

### Vercel (Frontend)

| Item | Value |
|------|-------|
| **Dashboard** | https://vercel.com/sibi-narendrans-projects/web |
| **Project ID** | `prj_L6mlya6Z9nTMyqNdAbjpV53AMRME` |
| **Project Name** | `web` |
| **Production URL** | https://web-j9rkvoou2-sibi-narendrans-projects.vercel.app |
| **Git Repo** | `sibi-narendran/intern.dooza.co` |
| **Root Directory** | `apps/web` |
| **Framework** | Vite |
| **Auto Deploy** | Yes (on push to `main`) |

**API Token:** See `.deploy-keys` file → `VERCEL_TOKEN`

**API Usage:**
```bash
# List projects
curl -H "Authorization: Bearer $VERCEL_TOKEN" https://api.vercel.com/v9/projects

# Get project details
curl -H "Authorization: Bearer $VERCEL_TOKEN" https://api.vercel.com/v9/projects/web

# Trigger deploy
git push origin main  # Auto-deploys
```

---

### Render (Backend)

| Item | Value |
|------|-------|
| **Dashboard** | https://dashboard.render.com/web/srv-d5m9frbe5dus73eb7mm0 |
| **Service ID** | `srv-d5m9frbe5dus73eb7mm0` |
| **Service Name** | `dooza-api` |
| **Owner ID** | `tea-cteopvpu0jms739ensog` |
| **Production URL** | https://dooza-api.onrender.com |
| **API Docs** | https://dooza-api.onrender.com/docs |
| **Git Repo** | `sibi-narendran/intern.dooza.co` |
| **Root Directory** | `apps/api` |
| **Runtime** | Python |
| **Auto Deploy** | Yes (on push to `main`) |

**API Key:** See `.deploy-keys` file → `RENDER_API_KEY`

**API Usage:**
```bash
# Get service info
curl -H "Authorization: Bearer $RENDER_API_KEY" \
  https://api.render.com/v1/services/srv-d5m9frbe5dus73eb7mm0

# List deploys
curl -H "Authorization: Bearer $RENDER_API_KEY" \
  https://api.render.com/v1/services/srv-d5m9frbe5dus73eb7mm0/deploys

# Trigger manual deploy
curl -X POST -H "Authorization: Bearer $RENDER_API_KEY" \
  https://api.render.com/v1/services/srv-d5m9frbe5dus73eb7mm0/deploys

# Update env vars
curl -X PUT -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '[{"key": "VAR_NAME", "value": "value"}]' \
  https://api.render.com/v1/services/srv-d5m9frbe5dus73eb7mm0/env-vars
```

---

### Supabase (Database & Auth)

| Item | Value |
|------|-------|
| **Dashboard** | https://supabase.com/dashboard/project/rndiktnoopmxcwdulspf |
| **Project Ref** | `rndiktnoopmxcwdulspf` |
| **Region** | us-west-1 |
| **API URL** | https://rndiktnoopmxcwdulspf.supabase.co |
| **DB Host (Pooler)** | aws-1-us-west-1.pooler.supabase.com |
| **DB Port** | 5432 (Session) / 6543 (Transaction) |

**Keys:** Stored in environment variables on Vercel/Render

---

## Environment Variables

### Vercel (Frontend) - `apps/web`

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | https://rndiktnoopmxcwdulspf.supabase.co |
| `VITE_SUPABASE_ANON_KEY` | eyJhbG... (JWT) |
| `VITE_API_URL` | https://dooza-api.onrender.com |
| `VITE_ACCOUNTS_URL` | https://accounts.dooza.ai |

### Render (Backend) - `apps/api`

| Variable | Description |
|----------|-------------|
| `OPENROUTER_API_KEY` | LLM API key |
| `DEFAULT_MODEL` | anthropic/claude-3.5-sonnet |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Service role key (backend only) |
| `SUPABASE_JWT_SECRET` | For validating user tokens |
| `DATABASE_URL` | PostgreSQL connection (pooler) |
| `CORS_ORIGINS` | Allowed frontend origins |
| `DEBUG` | false |

---

## GitHub Repository

| Item | Value |
|------|-------|
| **URL** | https://github.com/sibi-narendran/intern.dooza.co |
| **Owner** | sibi-narendran |
| **Default Branch** | main |
| **Structure** | Monorepo (`apps/web` + `apps/api`) |

---

## Quick Commands

```bash
# Load deployment keys
source .deploy-keys

# Check Render status
curl -s -H "Authorization: Bearer $RENDER_API_KEY" \
  https://api.render.com/v1/services/srv-d5m9frbe5dus73eb7mm0 | python3 -m json.tool

# Check Vercel status
curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
  https://api.vercel.com/v9/projects/web | python3 -m json.tool

# Test backend health
curl https://dooza-api.onrender.com/health

# Deploy (both auto-deploy on push)
git add -A && git commit -m "update" && git push
```

---

## Troubleshooting

### Backend not responding
1. Check Render dashboard for deploy status
2. Check logs: `https://dashboard.render.com/web/srv-d5m9frbe5dus73eb7mm0/logs`
3. Verify env vars are set correctly

### Frontend not updating
1. Check Vercel dashboard for deploy status
2. Verify Git connection in Settings → Git
3. Check build logs

### Database connection issues
1. Use pooler URL (not direct): `aws-1-us-west-1.pooler.supabase.com`
2. Check if Supabase project is active
3. Verify DATABASE_URL has correct password

---

## API Endpoints

### Backend (https://dooza-api.onrender.com)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/docs` | GET | Swagger API docs |
| `/v1/chat/{agent_id}` | POST | Chat with agent (SSE) |
| `/v1/threads` | GET | List user threads |
| `/v1/threads/{id}/messages` | GET | Get thread messages |

---

*Last updated: 2026-01-18*
