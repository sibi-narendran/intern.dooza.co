# Central Knowledge Base (Brain AI)

> Feature spec for shared knowledge that ALL agents can access

---

## What This Solves

**Problem:** Users have to repeat context (brand voice, products, company info) every time they chat with an agent.

**Solution:** A central "Brain" where users upload their knowledge ONCE, and all agents (SEOmi, Soshie, etc.) automatically have access to it.

---

## How Sintra Does It

Sintra calls this feature **"Brain AI"**:
- Users upload company documents, brand guidelines, product data
- All agents draw from this shared Brain
- Agents stay consistent with brand tone and factual data
- No need to re-prompt each agent individually

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    USER UPLOADS                              │
│  PDFs, Docs, Text, URLs, Images                              │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    BRAIN (per organization)                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Vector Database (embeddings)                        │    │
│  │  - Brand guidelines chunks                           │    │
│  │  - Product descriptions                              │    │
│  │  - Company FAQ                                       │    │
│  │  - Tone examples                                     │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────┬───────────────────────────────────┘
                          │ RAG retrieval
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    AGENTS (with context)                     │
│                                                              │
│  User: "Write a LinkedIn post about our voice recovery"      │
│                          │                                   │
│                          ▼                                   │
│  1. Query Brain: "voice recovery product info"               │
│  2. Get relevant chunks from vector DB                       │
│  3. Inject into agent context                                │
│  4. Agent responds with brand-aware content                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow

```
1. User goes to "Brain" or "Knowledge Base" page
2. Uploads: brand_guidelines.pdf, product_catalog.pdf, company_faq.txt
3. System processes → chunks → embeds → stores
4. User chats with SEOmi: "Analyze my site and suggest content"
5. SEOmi queries Brain: gets company context
6. SEOmi responds with brand-aware recommendations
```

---

## Implementation Components

| Component | Purpose | Tech |
|-----------|---------|------|
| **Document Upload** | User uploads PDFs, docs, text | File API + Supabase Storage |
| **Chunking** | Split docs into searchable pieces | LangChain text splitters |
| **Embedding** | Convert chunks to vectors | OpenAI `text-embedding-3-small` |
| **Vector Store** | Store & search embeddings | Supabase pgvector OR Pinecone |
| **Retrieval** | Find relevant context | Similarity search |
| **Injection** | Add context to agent prompts | LangChain RAG pattern |

---

## Database Schema

```sql
-- Brain documents (what user uploaded)
CREATE TABLE brain_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50),              -- 'pdf', 'url', 'text', 'brand_guide'
    source_url TEXT,               -- Original file URL in storage
    file_size INTEGER,
    status VARCHAR(20) DEFAULT 'processing',  -- 'processing', 'ready', 'failed'
    error_message TEXT,
    chunk_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Chunked content with embeddings
CREATE TABLE brain_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES brain_documents(id) ON DELETE CASCADE,
    org_id UUID NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),        -- OpenAI text-embedding-3-small dimension
    metadata JSONB,                -- page number, section, source, etc.
    token_count INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable vector similarity search
CREATE INDEX idx_brain_chunks_embedding ON brain_chunks 
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- Fast org lookup
CREATE INDEX idx_brain_chunks_org ON brain_chunks(org_id);
CREATE INDEX idx_brain_documents_org ON brain_documents(org_id);

-- RLS policies
ALTER TABLE brain_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org documents" ON brain_documents
    FOR SELECT USING (org_id = auth.jwt() ->> 'org_id');

CREATE POLICY "Users can insert own org documents" ON brain_documents
    FOR INSERT WITH CHECK (org_id = auth.jwt() ->> 'org_id');

CREATE POLICY "Users can delete own org documents" ON brain_documents
    FOR DELETE USING (org_id = auth.jwt() ->> 'org_id');
```

---

## API Endpoints

### Documents

```
POST   /api/brain/documents          Upload a document
GET    /api/brain/documents          List all documents for org
GET    /api/brain/documents/:id      Get document details
DELETE /api/brain/documents/:id      Delete document and chunks
```

### Search

```
POST   /api/brain/search             Search brain for relevant context
       Body: { "query": "voice recovery products", "limit": 5 }
       Returns: relevant chunks with similarity scores
```

### Quick Setup (MVP)

```
GET    /api/brain/profile            Get org's brain profile
PUT    /api/brain/profile            Update org's brain profile
       Body: { 
         "company_name": "TMR-G Solutions",
         "industry": "Voice Recovery / Medical",
         "products": "...",
         "tone": "...",
         "keywords": ["lost voice", "voice recovery"]
       }
```

---

## Backend Service

### File: `app/services/brain.py`

```python
"""
Brain Service - Central Knowledge Base

Handles document processing, embedding, and retrieval
for the organization's shared knowledge.
"""

from typing import List, Optional
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from app.core.database import get_supabase_client

class BrainService:
    def __init__(self, org_id: str):
        self.org_id = org_id
        self.embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
        )
    
    async def add_document(self, name: str, content: str, doc_type: str) -> str:
        """Process and store a document in the brain."""
        # 1. Create document record
        # 2. Split into chunks
        # 3. Generate embeddings
        # 4. Store chunks with embeddings
        pass
    
    async def search(self, query: str, limit: int = 5) -> List[dict]:
        """Search brain for relevant context."""
        # 1. Embed the query
        # 2. Vector similarity search
        # 3. Return top chunks
        pass
    
    async def get_context_for_agent(self, user_message: str) -> str:
        """Get relevant context to inject into agent prompt."""
        chunks = await self.search(user_message, limit=3)
        if not chunks:
            return ""
        
        context = "## Relevant Knowledge from Brain\n\n"
        for chunk in chunks:
            context += f"- {chunk['content']}\n\n"
        return context
```

---

## Agent Integration

### How agents use the Brain

```python
# In chat flow (simplified)

async def handle_message(user_message: str, org_id: str, agent_slug: str):
    # 1. Get relevant context from Brain
    brain = BrainService(org_id)
    context = await brain.get_context_for_agent(user_message)
    
    # 2. Inject context into the conversation
    if context:
        system_addendum = f"""
## Organization Context
The user belongs to an organization with the following relevant information:

{context}

Use this context to provide more relevant, brand-aligned responses.
"""
        # Add to system message or inject as context
    
    # 3. Run agent as normal
    agent = get_agent(agent_slug)
    response = await agent.ainvoke(...)
```

---

## UI Design

### Knowledge Base Page

```
┌─────────────────────────────────────────────────────────────┐
│  Knowledge Base                                    [+ Add]   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  QUICK SETUP                                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Company: [TMR-G Solutions                        ]    │   │
│  │ Industry: [Voice Recovery / Medical Health       ]    │   │
│  │ Products: [Voice recovery solutions for...       ]    │   │
│  │ Brand Tone: [Professional, empathetic            ]    │   │
│  │ Keywords: [lost voice, voice recovery, speech    ]    │   │
│  │                                          [Save]       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  DOCUMENTS                                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 📄 brand_guidelines.pdf          Ready    [Delete]    │   │
│  │    42 chunks • Uploaded 2 days ago                    │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │ 📄 product_catalog.pdf           Ready    [Delete]    │   │
│  │    128 chunks • Uploaded 1 week ago                   │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │ 🔗 https://tmrgsolutions.com     Ready    [Delete]    │   │
│  │    23 chunks • Crawled 3 days ago                     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Add Document Modal

```
┌─────────────────────────────────────────────────────────────┐
│  Add to Knowledge Base                              [X]      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │  📄     │ │  🔗     │ │  📝     │ │  ❓     │           │
│  │ Upload  │ │  URL    │ │  Text   │ │  FAQ    │           │
│  │  File   │ │ Scrape  │ │  Paste  │ │ Builder │           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                                                       │   │
│  │     Drag & drop files here                           │   │
│  │     or click to browse                               │   │
│  │                                                       │   │
│  │     Supported: PDF, DOCX, TXT, MD                    │   │
│  │     Max size: 10MB                                   │   │
│  │                                                       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│                                          [Cancel] [Upload]   │
└─────────────────────────────────────────────────────────────┘
```

---

## MVP vs Full Version

### MVP (4-6 hours)

Simple text-based profile, no file upload:

| Feature | Included |
|---------|----------|
| Company name, industry, products text fields | ✅ |
| Keywords list | ✅ |
| Brand tone description | ✅ |
| Inject into agent prompts | ✅ |
| File upload | ❌ |
| Vector search | ❌ |
| Document chunking | ❌ |

### Full Version (22-26 hours)

| Feature | Included |
|---------|----------|
| Everything in MVP | ✅ |
| PDF/DOCX file upload | ✅ |
| URL scraping | ✅ |
| Document chunking | ✅ |
| Vector embeddings | ✅ |
| Semantic search | ✅ |
| Multiple documents | ✅ |

---

## Time Estimates

| Task | MVP | Full |
|------|-----|------|
| Database schema | 30 min | 1 hr |
| API endpoints | 1 hr | 3 hrs |
| Brain service (text only) | 1 hr | - |
| Brain service (full RAG) | - | 8 hrs |
| Agent integration | 2 hrs | 4 hrs |
| UI - Quick setup form | 2 hrs | 2 hrs |
| UI - Document upload | - | 6 hrs |
| UI - Document list/delete | - | 3 hrs |
| **Total** | **6.5 hrs** | **27 hrs** |

---

## Priority

1. **MVP First** - Simple text profile that injects into all agents
2. **Then** - Add file upload + chunking
3. **Then** - Add vector search for semantic retrieval
4. **Finally** - URL scraping, FAQ builder, etc.

---

## Dependencies

```
# Python
langchain
langchain-openai
pgvector  # or pinecone-client

# Already have
supabase
openai
```

---

## Related Files

When implementing:

```
apps/api/
├── app/
│   ├── services/
│   │   └── brain.py           # Brain service (NEW)
│   ├── routers/
│   │   └── brain.py           # API endpoints (NEW)
│   └── agents/
│       └── context/           # Agent context injection (MODIFY)
├── migrations/
│   └── 00X_brain_tables.sql   # Database schema (NEW)

apps/web/
└── src/
    └── pages/
        └── KnowledgeBasePage.tsx  # UI (MODIFY existing)
```
