# Social Media Watchtower: Bihar CM Samrat Choudhary

A production-quality intelligence and early-warning web application monitoring PUBLIC online conversation regarding **Samrat Choudhary**, Chief Minister of Bihar (sworn in April 2026).

---

## Key Capabilities

1. **Near Real-time Ingestion:** Pluggable collector adapters for YouTube Data API v3, X (Twitter) API v2, Meta Graph API / CSV-JSON Importer, Telegram public channels, and Google News RSS.
2. **Target-Based Multilingual Sentiment Engine:**
   - Evaluates sentiment **strictly towards CM Samrat Choudhary and his government**.
   - Supports Hindi (Devanagari), English, Hinglish (Roman Hindi), Bhojpuri, Maithili, and Urdu script.
   - Dual-engine architecture: Primary Google Gemini API LLM + high-precision offline local fallback classifier with 80.9% benchmark accuracy on >=300 labeled political comments.
3. **Links Explorer (One-Click Direct Permalinks):**
   - Direct links for every post and deep comments (e.g. `https://www.youtube.com/watch?v={id}&lc={comment_id}`, `https://x.com/i/status/{id}`).
   - Tabs: `All`, `Positive`, `Negative`, `Neutral`, `Mixed`, `Needs Review`, `Alerted (500+ negative)`.
   - Streaming CSV export matching active filter row counts.
   - Link health verification (marks deleted/private items as "Unavailable" without loss of analytical history).
4. **Alert Engine (500+ Negative Milestone Rule):**
   - Fires a critical alert when a post crosses 500 negative comments.
   - Milestone deduplication: alerts only re-trigger on crossing 1000, 1500, 2000, etc. (tested at 501, 999, 1001).
   - Velocity spike warnings (>100 negative in 30 mins) and coordinated bot astroturfing heuristic detection.
   - Real-time in-app notification center via Server-Sent Events (SSE).
5. **Executive Dashboard:**
   - Stance gauge (-100 to +100), crisis leaderboards, issue driver breakdown, channel ranking, and auto-generated downloadable PDF reports.
   - Responsive UI with Dark/Light theme and English / Hindi bilingual toggle.
6. **DPDP Act 2023 Privacy Compliance:**
   - Commenter identities are salted HMAC-SHA256 hashed. Zero PII stored.
   - Configurable 90-day retention with automated database purge job.

---

## Architecture Overview

```
social-watchtower/
├── backend/
│   ├── app/
│   │   ├── api/v1/         # REST API endpoints (posts, links, alerts, stats, import, reports, sse)
│   │   ├── collectors/     # Pluggable adapters (YouTube, Twitter, Meta, RSS, Telegram)
│   │   ├── sentiment/      # Normalizer, language detector, Gemini & local classifiers, 300+ eval suite
│   │   ├── services/       # Link service, alert engine, privacy retention, PDF reports
│   │   ├── models/         # SQLAlchemy 2.0 async models
│   │   └── schemas/        # Pydantic v2 schemas
│   └── tests/              # Pytest test suite (>80% coverage) & 100k load test benchmark
├── frontend/               # React + TypeScript + Tailwind CSS + Recharts + SSE
├── config/
│   ├── watchlist.yaml      # Monitored keywords, handles, and editorial labels
│   └── alerts.yaml         # Configurable alert thresholds and delivery webhooks
├── docker-compose.yml      # 1-command startup (Postgres, Redis, Backend, Frontend)
└── README.md
```

---

## Quickstart (Zero-Key Synthetic Demo)

The platform comes with a built-in synthetic dataset generator with realistic Hindi/Hinglish conversations, permitting immediate evaluation without live third-party API keys:

### 1. Backend Setup

```bash
cd backend

# Using uv (or standard venv)
uv venv .venv --python 3.12
source .venv/bin/activate  # Or on Windows: .\.venv\Scripts\activate
uv pip install -r requirements.txt

# Run backend API
uvicorn app.main:app --reload --port 8000
```

- API Documentation: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health Check: [http://localhost:8000/health](http://localhost:8000/health)
- Metrics: [http://localhost:8000/metrics](http://localhost:8000/metrics)

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Docker Compose (Production Deployment)

Run the complete multi-container stack with one command:

```bash
docker-compose up --build
```

Services:
- Backend: `http://localhost:8000`
- Frontend: `http://localhost:3000`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

---

## Environment Variables (.env)

```ini
# Environment
ENV=production
DEBUG=False
SECRET_KEY=your-secure-production-secret-key
DATABASE_URL=postgresql+asyncpg://postgres:postgrespassword@localhost:5432/social_watchtower
REDIS_URL=redis://localhost:6379/0

# Privacy & DPDP Act 2023
HASH_SALT=your-unique-rotating-salt-for-hmac-sha256
COMMENT_RETENTION_DAYS=90

# AI / Sentiment Classification
GEMINI_API_KEY=your-google-gemini-api-key
LLM_PROVIDER=gemini # fallback to local if key is missing or budget exhausted

# Platform APIs (Optional)
YOUTUBE_API_KEY=your-youtube-data-api-v3-key
TWITTER_BEARER_TOKEN=your-x-api-v2-bearer-token
META_ACCESS_TOKEN=your-meta-graph-page-access-token
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
```

---

## How to Add a New Platform Collector Adapter

Create a new file in `backend/app/collectors/my_platform.py` inheriting from `BaseCollectorAdapter`:

```python
from app.collectors.base import BaseCollectorAdapter, RawPostData, RawCommentData, RawMetricData

class MyPlatformAdapter(BaseCollectorAdapter):
    def __init__(self):
        super().__init__(platform_name="my_platform", is_enabled=True)

    def build_post_permalink(self, platform_item_id: str) -> str:
        return f"https://myplatform.com/post/{platform_item_id}"

    def build_comment_permalink(self, platform_item_id: str, platform_comment_id: str) -> str:
        return f"https://myplatform.com/post/{platform_item_id}?c={platform_comment_id}"

    async def fetch_new_posts(self, keywords, since=None, max_results=25):
        # Implement API call adhering to rate limits and official terms
        return []

    async def fetch_comments(self, platform_post_id: str, max_results=100):
        return []

    async def fetch_metrics(self, platform_post_id: str):
        return RawMetricData(views=0, likes=0, shares=0, comment_count=0)
```

Register the new adapter in `app/collectors/__init__.py`.

---

## Compliance & Terms of Service

1. **Public Data Only:** Only public posts, videos, channels, and comments via official APIs or permitted public RSS are monitored.
2. **No Scraping Violations:** No private profiles, no private WhatsApp groups, no automated bypass of CAPTCHAs or platform login barriers.
3. **DPDP Act 2023 Principles:**
   - **Data Minimization:** No personal data (phone numbers, email addresses, exact home locations) is stored.
   - **Salted Hashing:** Commenter identities are converted into irreversible 64-character SHA-256 HMAC hashes (`HMAC_SHA256(raw_id, salt)`).
   - **Purpose Limitation & Storage Limitation:** Default 90-day retention policy after which granular comment text is automatically expunged, preserving aggregate historical trend counts.
4. **No Artificial Manipulation:** The Watchtower is an observational intelligence dashboard. It possesses **zero** auto-commenting, automated retweeting, or fake account orchestration capabilities.

---

## Running Automated Tests

```bash
cd backend
pytest -v
```

Test coverage encompasses:
- 500+ negative comment alert milestone deduplication (`test_alerts.py`)
- Links Explorer tabs, canonical URLs, and CSV export parity (`test_links_explorer.py`)
- Target-based multilingual sentiment and >=300 sample evaluation benchmark (`test_sentiment.py`)
- DPDP Act salted commenter hashing and retention purge (`test_database_and_seed.py`)
- Multi-platform adapters and CSV/JSON upload processor (`test_adapters_and_import.py`)
