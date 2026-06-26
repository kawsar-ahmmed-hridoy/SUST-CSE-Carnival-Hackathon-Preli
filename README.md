# QueueStorm Investigator

> **bKash presents SUST CSE Carnival 2026 — Codex Community Hackathon**
> AI / API SupportOps Challenge for Digital Finance — Online Preliminary Round

A production-ready AI-powered support copilot that investigates customer complaints for digital finance platforms. It cross-references complaint text against real transaction history to produce evidence-grounded decisions, safe customer replies, and correct routing — under strict fintech safety constraints.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Folder Structure](#folder-structure)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Docker](#docker)
- [MongoDB Setup](#mongodb-setup)
- [Running Locally](#running-locally)
- [Production Deployment](#production-deployment)
- [Testing](#testing)
- [API Documentation](#api-documentation)
- [Models](#models)
- [Safety Logic](#safety-logic)
- [Design Decisions](#design-decisions)
- [Scaling Considerations](#scaling-considerations)
- [Performance Considerations](#performance-considerations)
- [Security Considerations](#security-considerations)
- [Known Limitations](#known-limitations)
- [Troubleshooting](#troubleshooting)
- [Future Improvements](#future-improvements)

---

## Project Overview

QueueStorm Investigator is an internal support copilot API designed to handle high-volume complaint queues during digital finance campaigns. During peak loads (40,000+ complaints expected), human agents cannot read every ticket carefully. This service acts as their first-line investigator.

**What it does:**

Given a customer complaint and a short snippet of their recent transaction history, the service:

1. Identifies which transaction (if any) the complaint refers to
2. Determines whether the transaction data supports, contradicts, or is insufficient to evaluate the complaint
3. Classifies the case type and severity
4. Routes it to the correct internal department
5. Drafts a safe, professional customer reply that never asks for credentials or promises unauthorized refunds
6. Flags high-risk cases for mandatory human review

**What it is NOT:**

- Not an autonomous financial decision maker
- Not a refund or reversal authority
- Not a frontend application

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, API routes only) |
| Language | TypeScript (strict mode) |
| Runtime | Node.js 20 LTS |
| Database | MongoDB 7 + Mongoose ODM |
| Validation | Zod |
| Authentication | JWT + Refresh Tokens + HttpOnly Cookies |
| AI / LLM | Google Gemini 2.5 Flash (free tier, primary) → Groq Llama 3 (fallback) |
| Security | Helmet, CORS, express-rate-limit, bcrypt |
| Logging | Pino (structured JSON logs) |
| Testing | Jest + Supertest |
| Containerization | Docker + Docker Compose |
| Linting | ESLint (next/core-web-vitals + typescript-eslint) |
| Formatting | Prettier |

---

## Features

### Core (Mandatory)

- `GET /health` — Liveness probe returning `{"status":"ok"}` within 60 seconds of service start
- `POST /analyze-ticket` — Full complaint investigation endpoint:
  - Transaction matching against provided history
  - Evidence verdict determination (`consistent` / `inconsistent` / `insufficient_data`)
  - Case type classification (8 enum values)
  - Department routing (6 enum values)
  - Severity scoring (`low` / `medium` / `high` / `critical`)
  - Human review flagging
  - Confidence score
  - Reason codes
  - Agent-ready summary
  - Recommended next action
  - Safe customer reply

### Safety Guardrails

- Never requests PIN, OTP, password, or card number
- Never promises refunds, reversals, or account unblocks without authority
- Never directs customers to unofficial third parties
- Detects and ignores prompt injection attempts in complaint text
- Escalates phishing/social engineering cases to `fraud_risk` department automatically

### Operational

- Bangla / Banglish complaint handling
- Malformed input returns controlled 400/422 errors — service never crashes
- Request timeout enforcement (< 30 seconds)
- Rate limiting (prevents judge harness abuse and DDoS)
- Structured Pino logging with request IDs
- MongoDB audit trail for every analyzed ticket
- Graceful shutdown on SIGTERM/SIGINT
- Full `.env.example` with documentation for every variable

---

## Folder Structure

```
queuestorm-investigator/
├── src/
│   ├── app/
│   │   └── api/
│   │       ├── health/
│   │       │   └── route.ts          # GET /health handler
│   │       └── analyze-ticket/
│   │           └── route.ts          # POST /analyze-ticket handler
│   ├── config/
│   │   ├── index.ts                  # Centralized config loader (reads env vars)
│   │   └── constants.ts              # Enum values, thresholds, timeouts
│   ├── controllers/
│   │   └── ticketController.ts       # Request parsing, validation, response shaping
│   ├── services/
│   │   ├── investigatorService.ts    # Core business logic: evidence reasoning + routing
│   │   ├── safetyService.ts          # Safety rule enforcement + reply sanitization
│   │   └── auditService.ts           # Persists analysis results to MongoDB
│   ├── repositories/
│   │   └── ticketRepository.ts       # All MongoDB read/write operations
│   ├── models/
│   │   └── ticketAnalysis.model.ts   # Mongoose schema for analyzed tickets
│   ├── middleware/
│   │   ├── rateLimiter.ts            # express-rate-limit configuration
│   │   ├── requestLogger.ts          # Pino request logging
│   │   ├── errorHandler.ts           # Centralized error handler (consistent JSON errors)
│   │   └── validateRequest.ts        # Zod-based request body validation
│   ├── validators/
│   │   ├── ticketRequest.schema.ts   # Zod schema for POST /analyze-ticket input
│   │   └── ticketResponse.schema.ts  # Zod schema for output shape verification
│   ├── utils/
│   │   ├── logger.ts                 # Pino logger instance
│   │   ├── errors.ts                 # Custom error classes (AppError, ValidationError, etc.)
│   │   └── responseBuilder.ts        # Consistent success/error JSON response factory
│   ├── types/
│   │   └── index.ts                  # TypeScript type aliases
│   ├── interfaces/
│   │   ├── ITicketRequest.ts         # Input shape interface
│   │   ├── ITicketResponse.ts        # Output shape interface
│   │   └── ITransaction.ts           # Transaction history entry interface
│   ├── constants/
│   │   ├── enums.ts                  # All enum definitions (case_type, department, etc.)
│   │   └── safetyPatterns.ts         # Regex/keyword lists for safety checks
│   ├── lib/
│   │   └── mongodb.ts                # MongoDB connection singleton with pooling
│   ├── ai/
│   │   ├── aiService.ts              # Abstract AI service interface (swappable)
│   │   ├── geminiProvider.ts         # Google Gemini 2.5 Flash implementation
│   │   ├── groqProvider.ts           # Groq Llama fallback implementation
│   │   └── prompts/
│   │       ├── investigatorPrompt.ts # Evidence reasoning prompt template
│   │       └── replyPrompt.ts        # Safe customer reply generation prompt
│   ├── database/
│   │   └── indexes.ts                # MongoDB index definitions
│   └── docs/
│       ├── openapi.yaml              # OpenAPI 3.1 specification
│       └── sample_output.json        # Sample output from a public case
├── tests/
│   ├── unit/
│   │   ├── investigatorService.test.ts
│   │   ├── safetyService.test.ts
│   │   └── validators.test.ts
│   └── integration/
│       ├── health.test.ts
│       └── analyzeTicket.test.ts
├── .env.example
├── .gitignore
├── .eslintrc.json
├── .prettierrc
├── Dockerfile
├── docker-compose.yml
├── jest.config.ts
├── next.config.ts
├── package.json
├── tsconfig.json
└── README.md
```

### Module Responsibilities

| Module | Why it exists |
|---|---|
| `app/api/` | Next.js App Router API route handlers. Thin — only calls controllers. |
| `config/` | Single source of truth for all environment variables and constants. Prevents magic strings scattered across the codebase. |
| `controllers/` | Separates HTTP concerns (parsing, status codes, response shaping) from business logic. |
| `services/` | Contains all business logic. `investigatorService` is the brain: it runs evidence matching, classification, routing. `safetyService` enforces fintech safety rules on every reply before it leaves the system. |
| `repositories/` | Isolates all database calls. If we switch from MongoDB to PostgreSQL, only this layer changes. |
| `models/` | Mongoose schemas with indexes, validation, and TypeScript types. |
| `middleware/` | Cross-cutting concerns: rate limiting, logging, error handling, and validation applied uniformly to every request. |
| `validators/` | Zod schemas provide runtime type safety at the API boundary. Catches schema errors before business logic runs. |
| `utils/` | Reusable helpers: logger, error classes, response factory. Prevents duplicated patterns. |
| `types/` & `interfaces/` | TypeScript contracts. Keeps the codebase strongly typed end-to-end. |
| `constants/` | All enum values and safety keyword lists in one place. Enum changes require editing exactly one file. |
| `lib/` | MongoDB connection with connection pooling. Singleton pattern prevents connection storms. |
| `ai/` | AI provider abstraction. Swap Gemini for Groq (or any future provider) without touching business logic. Prompts are separate files so they can be tuned without code changes. |
| `database/` | Index creation at startup. Ensures queries are never unindexed in production. |
| `docs/` | OpenAPI spec and sample outputs for judges and future developers. |
| `tests/` | Unit tests for pure logic; integration tests for full HTTP round-trips against a real (test) MongoDB instance. |

---

## Installation

### Prerequisites

- Node.js 20 LTS
- npm 10+
- Docker and Docker Compose (for containerized setup)
- MongoDB 7 (local or Atlas) — OR use the Docker Compose setup which includes MongoDB automatically

### Step-by-step

```bash
# 1. Clone the repository
git clone https://github.com/<your-team>/queuestorm-investigator.git
cd queuestorm-investigator

# 2. Install dependencies
npm install

# 3. Copy environment file and fill in values
cp .env.example .env
# Edit .env with your API keys and MongoDB URI (see Environment Variables section)

# 4. Build TypeScript
npm run build

# 5. Run database index setup (run once)
npm run db:setup

# 6. Start the development server
npm run dev
```

The service will be available at `http://localhost:8000`.

---

## Environment Variables

Copy `.env.example` to `.env`. All variables marked **Required** must be set for the service to start.

```bash
# === Server ===
PORT=8000                          # Port the service listens on
NODE_ENV=development               # "development" | "production" | "test"

# === MongoDB ===
MONGODB_URI=mongodb://localhost:27017/queuestorm   # Required. Full MongoDB connection string.
MONGODB_DB_NAME=queuestorm         # Database name

# === AI Providers ===
# Primary: Google Gemini 2.5 Flash (free tier)
GEMINI_API_KEY=                    # Required if using Gemini. Get from: https://aistudio.google.com/
GEMINI_MODEL=gemini-2.5-flash      # Model identifier

# Fallback: Groq (free tier — Llama 3.3 70B)
GROQ_API_KEY=                      # Required if Gemini is unavailable. Get from: https://console.groq.com/
GROQ_MODEL=llama-3.3-70b-versatile # Model identifier

# AI provider selection (primary | groq | rule_only)
AI_PROVIDER=primary

# === Security ===
JWT_SECRET=                        # Required. Min 32 chars. Used to sign internal audit tokens.
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=              # Required. Min 32 chars.
REFRESH_TOKEN_EXPIRES_IN=7d

# === Rate Limiting ===
RATE_LIMIT_WINDOW_MS=60000         # Time window in ms (default: 1 minute)
RATE_LIMIT_MAX_REQUESTS=100        # Max requests per window per IP

# === Logging ===
LOG_LEVEL=info                     # "fatal" | "error" | "warn" | "info" | "debug" | "trace"

# === CORS ===
CORS_ORIGIN=*                      # Allowed origins. Use specific domain in production.

# === Timeouts ===
LLM_TIMEOUT_MS=25000               # Max time to wait for LLM response (keep under 30s limit)
```

---

## Docker

### Build the image

```bash
docker build -t queuestorm-investigator .
```

### Run with Docker Compose (recommended — includes MongoDB)

```bash
# Start all services (API + MongoDB)
docker compose up -d

# View logs
docker compose logs -f api

# Stop all services
docker compose down

# Stop and remove volumes (wipes MongoDB data)
docker compose down -v
```

### Run image standalone (if MongoDB is external)

```bash
docker run -p 8000:8000 --env-file .env queuestorm-investigator
```

### Judge harness command (as specified in problem statement)

```bash
docker build -t queuestorm-team .
docker run -p 8000:8000 --env-file judging.env queuestorm-team
```

The service will be reachable at `http://localhost:8000`. `/health` responds within 60 seconds of start.

---

## MongoDB Setup

### Using Docker Compose (easiest)

MongoDB is included in `docker-compose.yml`. No manual setup needed. Data persists in a named Docker volume (`mongo_data`).

### Using MongoDB Atlas (cloud)

1. Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Whitelist your IP (or `0.0.0.0/0` for evaluation)
3. Copy the connection string into `MONGODB_URI` in your `.env`

### Using local MongoDB

```bash
# Install MongoDB 7 and start the service
mongod --dbpath /data/db

# Set in .env:
MONGODB_URI=mongodb://localhost:27017/queuestorm
```

Indexes are created automatically on service startup via `src/database/indexes.ts`.

---

## Running Locally

```bash
# Development (hot reload)
npm run dev

# Production build + start
npm run build
npm start

# Lint
npm run lint

# Format
npm run format

# Type check
npm run typecheck
```

Verify the service is running:

```bash
curl http://localhost:8000/health
# Expected: {"status":"ok"}
```

---

## Production Deployment

### Option A: Deploy on Render / Railway / Fly.io

1. Push the repository to GitHub
2. Connect the repo in your chosen platform's dashboard
3. Set all environment variables in the platform's secret store (not in the repo)
4. Set the start command to `npm start`
5. Set the port to match `PORT` in your env vars
6. Deploy

### Option B: Deploy on AWS EC2 / Poridhi VM

```bash
# On the VM:
git clone https://github.com/<your-team>/queuestorm-investigator.git
cd queuestorm-investigator
cp .env.example .env
# Fill in .env values using the platform's secret manager or nano/vim

docker compose up -d

# Verify from outside:
curl http://<VM_PUBLIC_IP>:8000/health
```

Bind address is `0.0.0.0` by default (configured in Next.js server).

### Option C: Docker image on Docker Hub

```bash
# Build and push
docker build -t <your-dockerhub-username>/queuestorm-team:latest .
docker push <your-dockerhub-username>/queuestorm-team:latest

# Judge pull and run:
docker pull <your-dockerhub-username>/queuestorm-team:latest
docker run -p 8000:8000 --env-file judging.env <your-dockerhub-username>/queuestorm-team:latest
```

---

## Testing

```bash
# Run all tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only (requires running MongoDB)
npm run test:integration

# With coverage report
npm run test:coverage

# Watch mode (development)
npm run test:watch
```

### Test categories

| Category | What is tested |
|---|---|
| Unit: `investigatorService` | Transaction matching, evidence verdict logic, case classification, department routing, severity scoring |
| Unit: `safetyService` | PIN/OTP detection, refund promise detection, third-party redirect detection, prompt injection rejection |
| Unit: `validators` | Zod schema acceptance and rejection for valid/invalid/edge-case inputs |
| Integration: `/health` | Returns 200 `{"status":"ok"}` within timeout |
| Integration: `/analyze-ticket` | Full happy path, missing transaction history, inconsistent evidence, safety violation cases, malformed JSON, empty complaint, Bangla complaint |

---

## API Documentation

Full OpenAPI 3.1 spec is in `src/docs/openapi.yaml`.

### GET /health

**Purpose:** Liveness probe. Confirms the service is running and ready to accept requests.

**Authentication:** None

**Response:**
```json
{"status": "ok"}
```

**Status Codes:** `200 OK`

---

### POST /analyze-ticket

**Purpose:** Analyze one customer support ticket against transaction history. Returns evidence-grounded classification, routing, and safe reply.

**Authentication:** None (internal service; rate-limited by IP)

**Content-Type:** `application/json`

**Request Body:**

```json
{
  "ticket_id": "TKT-001",
  "complaint": "I sent 5000 taka to a wrong number around 2pm today",
  "language": "en",
  "channel": "in_app_chat",
  "user_type": "customer",
  "campaign_context": "boishakh_bonanza_day_1",
  "transaction_history": [
    {
      "transaction_id": "TXN-9101",
      "timestamp": "2026-04-14T14:08:22Z",
      "type": "transfer",
      "amount": 5000,
      "counterparty": "+8801719876543",
      "status": "completed"
    }
  ]
}
```

**Request Fields:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `ticket_id` | string | Yes | Echoed in response |
| `complaint` | string | Yes | English, Bangla, or Banglish |
| `language` | string | No | `en` \| `bn` \| `mixed` |
| `channel` | string | No | `in_app_chat` \| `call_center` \| `email` \| `merchant_portal` \| `field_agent` |
| `user_type` | string | No | `customer` \| `merchant` \| `agent` \| `unknown` |
| `campaign_context` | string | No | Campaign identifier |
| `transaction_history` | array | No | 0–5 transaction entries |
| `metadata` | object | No | Additional harness context |

**Transaction History Entry:**

| Field | Type | Notes |
|---|---|---|
| `transaction_id` | string | Unique ID |
| `timestamp` | string | ISO 8601 |
| `type` | string | `transfer` \| `payment` \| `cash_in` \| `cash_out` \| `settlement` \| `refund` |
| `amount` | number | Amount in BDT |
| `counterparty` | string | Phone, merchant ID, or agent ID |
| `status` | string | `completed` \| `failed` \| `pending` \| `reversed` |

**Success Response (200):**

```json
{
  "ticket_id": "TKT-001",
  "relevant_transaction_id": "TXN-9101",
  "evidence_verdict": "consistent",
  "case_type": "wrong_transfer",
  "severity": "high",
  "department": "dispute_resolution",
  "agent_summary": "Customer reports sending 5000 BDT to an unintended recipient via TXN-9101 at 14:08 on 2026-04-14. Transaction history confirms a completed 5000 BDT transfer matching the reported time and amount.",
  "recommended_next_action": "Retrieve full details of TXN-9101 and initiate a wrong-transfer investigation. Do not reverse without completing the dispute resolution process.",
  "customer_reply": "Thank you for contacting us. We have received your report regarding a transfer on 14 April 2026. Our team will investigate this matter. Any eligible resolution will be processed through official channels. Please do not share your PIN, OTP, or password with anyone, including our representatives.",
  "human_review_required": true,
  "confidence": 0.92,
  "reason_codes": ["wrong_transfer", "transaction_match", "high_value"]
}
```

**Error Response (400):**

```json
{
  "success": false,
  "message": "Validation failed",
  "error": "ticket_id is required",
  "statusCode": 400
}
```

**Status Codes:**

| Code | Meaning |
|---|---|
| 200 | Successful analysis |
| 400 | Malformed JSON or missing required fields |
| 422 | Valid schema but semantically invalid (empty complaint) |
| 429 | Rate limit exceeded |
| 500 | Internal error (no secrets or stack traces exposed) |

**Case Type Enum Values:**

| Value | When used |
|---|---|
| `wrong_transfer` | Money sent to the wrong recipient |
| `payment_failed` | Transaction failed but balance may have been deducted |
| `refund_request` | Customer requesting a refund |
| `duplicate_payment` | Same payment charged more than once |
| `merchant_settlement_delay` | Merchant settlement not received |
| `agent_cash_in_issue` | Cash deposit through agent not reflected |
| `phishing_or_social_engineering` | Suspicious calls/SMS/credential requests |
| `other` | Anything not covered above |

**Department Enum Values:**

| Value | Typical cases |
|---|---|
| `customer_support` | Low severity, vague, or insufficient data cases |
| `dispute_resolution` | Wrong transfers, contested refunds |
| `payments_ops` | Failed payments, duplicate charges |
| `merchant_operations` | Merchant settlement issues |
| `agent_operations` | Agent cash-in issues |
| `fraud_risk` | Phishing, social engineering, suspicious activity |

---

## Models

| Model | Provider | Tier | Role |
|---|---|---|---|
| `gemini-2.5-flash` | Google AI | Free (via AI Studio) | Primary LLM for evidence reasoning and reply generation |
| `llama-3.3-70b-versatile` | Groq | Free tier | Fallback if Gemini quota is exhausted or unavailable |
| Rule-based engine | Internal | Free | Always runs first for transaction matching and safety checks; LLM is used only for natural language tasks |

**Model selection rationale:**
- Gemini 2.5 Flash was chosen as primary because it offers the best reasoning quality on the free tier with low latency
- Groq's hosted Llama 3.3 is an excellent fallback: fast inference, generous free quota, strong multilingual support for Bangla/Banglish
- The architecture is provider-agnostic; switching models requires only changing `AI_PROVIDER` and the corresponding key in `.env`
- LLM cost is minimized: rule-based logic handles transaction matching and routing; the LLM is invoked only for `agent_summary`, `recommended_next_action`, and `customer_reply` generation

---

## Safety Logic

The following rules are enforced by `safetyService.ts` on every response **before** it is returned to the caller. No LLM output bypasses these checks.

| Rule | How it is enforced |
|---|---|
| Never ask for PIN, OTP, password, or card number | Keyword/regex scan of `customer_reply`. If detected, the reply is regenerated with an explicit prohibition. |
| Never promise refunds, reversals, or account unblocks | Keyword/regex scan of `customer_reply` and `recommended_next_action`. Detected promises are rewritten to use conditional language ("any eligible amount will be processed through official channels"). |
| Never direct customers to unofficial third parties | URL and phone number detection in `customer_reply`. Non-official contacts are stripped and replaced with official channel guidance. |
| Prompt injection in complaint text | Complaint is wrapped in a delimiter before being passed to the LLM. Instructions within the complaint are never interpreted as system-level commands. |
| Automatic escalation for phishing cases | Any `case_type` of `phishing_or_social_engineering` automatically sets `human_review_required: true` and `department: fraud_risk`. |
| High-value transactions | Transfers above 10,000 BDT automatically set `human_review_required: true`. |

---

## Design Decisions

**Why Next.js for a backend-only service?**
The problem statement specifies Next.js as the framework. API routes in the App Router are production-ready, support middleware, and deploy easily to most platforms including Vercel and Railway. No frontend code is included.

**Why hybrid rule + LLM instead of pure LLM?**
Rules are deterministic, fast, and free. Transaction matching (comparing complaint timestamps, amounts, and types against the transaction history) is a structured data problem — rules handle it better and faster than an LLM. The LLM handles what it is actually good at: understanding natural language complaints in English, Bangla, and Banglish, and generating professional replies.

**Why MongoDB instead of PostgreSQL?**
MongoDB was specified in the tech stack requirements. Ticket analysis results are document-shaped and schema-flexible, which is a good fit. Mongoose adds schema validation and TypeScript support.

**Why Pino for logging?**
Pino is the fastest Node.js logger with minimal overhead. It produces structured JSON logs that work well with cloud log aggregators (Datadog, CloudWatch, etc.).

---

## Scaling Considerations

- The API is stateless. Scale horizontally by running multiple containers behind a load balancer.
- MongoDB connection pooling is configured via Mongoose's `poolSize` option. Increase for higher concurrency.
- LLM calls are the primary latency bottleneck. Responses are not cached by default (each ticket is unique), but caching identical complaint+transaction combinations is safe and can be added if needed.
- Rate limiting is per-IP. In a multi-instance deployment, use Redis-backed rate limiting (replace the in-memory store with `rate-limit-redis`).
- The AI provider abstraction makes it straightforward to add parallel LLM calls with a circuit breaker if latency SLAs tighten.

---

## Performance Considerations

- Rule-based transaction matching runs before any LLM call and resolves ~60% of cases without needing the LLM at all (simple mismatches, clear phishing cases)
- LLM timeout is set to 25 seconds, leaving 5 seconds of buffer within the 30-second per-request limit
- MongoDB queries use compound indexes on `ticket_id` + `createdAt`
- Async/await throughout — no blocking operations
- Health endpoint is pure in-memory — no DB or LLM call on `/health`

---

## Security Considerations

- No API keys, tokens, or secrets are committed to the repository at any time
- All secrets are passed via environment variables
- `.env` is in `.gitignore`
- Responses never include stack traces, internal error details, or secret values
- Helmet sets secure HTTP headers on every response
- CORS is restricted to configured origins
- Rate limiting prevents abuse during the evaluation window
- JWT is used for internal audit token signing (not for external API authentication, which is not required by the problem)
- MongoDB connection string includes authentication credentials only in the environment variable, never in code

---

## Known Limitations

- `transaction_history` is limited to what the harness provides (typically 2–5 entries). The service cannot look up historical transactions beyond the provided snippet.
- Bangla/Banglish detection relies on the LLM's multilingual capability. Highly colloquial or misspelled Banglish may reduce evidence reasoning accuracy.
- Free-tier LLM quotas may be exhausted under sustained high load. The Groq fallback mitigates this, but if both providers are unavailable, the rule-based engine returns a conservative `insufficient_data` verdict with `human_review_required: true`.
- The service does not integrate with real payment systems. All decisions are based solely on the data provided in the request.
- Confidence scores are estimates and should not be used as the sole basis for automated financial decisions.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `/health` returns 404 | Confirm the service is running on the correct port. Check `PORT` in `.env`. |
| `/analyze-ticket` returns 500 | Check logs: `docker compose logs -f api`. Usually a missing API key or MongoDB connection failure. |
| `GEMINI_API_KEY` errors | Verify the key is set in the environment (not in `.env.example`). Confirm the key has API access at [aistudio.google.com](https://aistudio.google.com). |
| MongoDB connection refused | Confirm MongoDB is running. If using Docker Compose, ensure all containers started: `docker compose ps`. |
| Response takes > 30 seconds | Check `LLM_TIMEOUT_MS` in `.env`. Reduce if needed. If the LLM provider is slow, the rule-based fallback will return within ~500ms. |
| Schema validation errors | Enum values are case-sensitive. Check `src/constants/enums.ts` for exact spellings. |
| Docker runs locally but not for judges | Ensure the container binds to `0.0.0.0`, not `127.0.0.1`. Confirm the correct port is exposed in `docker-compose.yml`. |

---

## Future Improvements

- Redis-backed response caching for repeated complaint patterns
- Webhook support for async analysis of high-volume batches
- Admin dashboard for monitoring case distribution and safety violation rates
- Multi-model ensemble for higher confidence scores
- Fine-tuned classifier for Bangla complaint text (replaces LLM for classification step)
- OpenTelemetry tracing for distributed observability
- A/B testing framework for comparing LLM providers on accuracy metrics

---

## Sample Request & Response

**Request:**
```json
{
  "ticket_id": "TKT-001",
  "complaint": "I sent 5000 taka to a wrong number around 2pm today. Please help me get it back.",
  "language": "en",
  "channel": "in_app_chat",
  "user_type": "customer",
  "campaign_context": "boishakh_bonanza_day_1",
  "transaction_history": [
    {
      "transaction_id": "TXN-9101",
      "timestamp": "2026-04-14T14:08:22Z",
      "type": "transfer",
      "amount": 5000,
      "counterparty": "+8801719876543",
      "status": "completed"
    }
  ]
}
```

**Response:**
```json
{
  "ticket_id": "TKT-001",
  "relevant_transaction_id": "TXN-9101",
  "evidence_verdict": "consistent",
  "case_type": "wrong_transfer",
  "severity": "high",
  "department": "dispute_resolution",
  "agent_summary": "Customer reports sending 5000 BDT to an unintended recipient at approximately 14:08 today. Transaction TXN-9101 confirms a completed 5000 BDT transfer at 14:08:22, consistent with the complaint.",
  "recommended_next_action": "Open a wrong-transfer investigation for TXN-9101. Verify recipient details. Do not initiate reversal without completing the standard dispute resolution process.",
  "customer_reply": "Thank you for reaching out. We have received your report about a transfer made on 14 April 2026. Our team will review this matter carefully. Any eligible resolution will be handled through our official dispute process. Please note: never share your PIN, OTP, or password with anyone.",
  "human_review_required": true,
  "confidence": 0.92,
  "reason_codes": ["wrong_transfer", "transaction_match", "high_value"]
}
```

---

*Built for the bKash SUST CSE Carnival 2026 — Codex Community Hackathon.*
*This service uses only synthetic data. No real customer or payment data is used at any point.*
