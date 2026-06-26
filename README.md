# QueueStorm Investigator

> **bKash presents SUST CSE Carnival 2026 — Codex Community Hackathon**
> AI / API SupportOps Challenge for Digital Finance — Online Preliminary Round

An AI-powered support copilot that investigates customer complaints for digital finance platforms. Given a complaint and recent transaction history, it produces evidence-grounded classification, correct routing, safe customer replies, and a human-review flag — under strict fintech safety constraints.

---

## Hackathon Submission (organizer-facing)

| Field | Value |
|---|---|
| **Team name** | Novacore |
| **Track** | AI / API SupportOps Challenge for Digital Finance |
| **GitHub repository** | `https://github.com/kawsar-ahmmed-hridoy/SUST-CSE-Carnival-Hackathon-Preli` |
| **Primary endpoint** | `POST /analyze-ticket` |
| **Liveness endpoint** | `GET /health` |
| **Bonus endpoint** | `POST /analyze-ticket-batch` |
| **Audit endpoint** | `GET /tickets/{ticket_id}` |
| **Container port** | `8000` |
| **Container address** | `0.0.0.0:8000` |
| **Service timeout** | ≤ 30 s per request |

### Quick judge command

```bash
docker build -t queuestorm-team .
docker run -p 8000:8000 --env-file judging.env queuestorm-team
```

Then verify with:

```bash
curl https://sust-cse-carnival-hackathon-preli.onrender.com/health
```

### Datasets

- `evaluation/public_dataset.json` — 7 representative tickets (reproducible by judges)
- `evaluation/private_dataset.json` — 15 hidden tickets (our own QA set)
- The judging harness will provide its own private Dataset C at evaluation time.

### Evaluation-script command (run after `docker run`):

```bash
bash scripts/run_evaluation.sh http://localhost:8000 ./evaluation/public_dataset.json
```

### Team members

| Role | Name |
|---|---|
| Backend / AI / DevOps | **Kawsar Ahmmed Hridoy** |
| Backend / AI / | **Ashraful Islam** |
| Project Structure | **Fowzia Fariha Shaj** |

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
| Framework | Next.js 15 (App Router, API routes only) |
| Language | TypeScript 5.7 (strict mode) |
| Runtime | Node.js 20 LTS |
| Database | MongoDB 7 + Mongoose 8 ODM |
| Validation | Zod 3 |
| Authentication | `X-Api-Key` + JWT bearer (optional) |
| AI / LLM | Google Gemini 2.5 Flash (primary) → Groq Llama 3.3 70B (fallback) → rule-based |
| Security | Helmet 8 + custom OWASP headers + per-IP rate limit + constant-time key comparison |
| Logging | Pino 9 (structured JSON) with request-ID correlation |
| Testing | Jest 29 + ts-jest + Supertest |
| Containerization | Docker multi-stage build, non-root user |

---

## Features

### Core (Mandatory endpoints)

- `GET /health` — Liveness probe returning `{"status":"ok"}` within 60 seconds of service start. Public, always available.
- `POST /analyze-ticket` — Full complaint investigation endpoint:
  - Transaction matching against provided history
  - Evidence verdict determination (`consistent` / `inconsistent` / `insufficient_data`)
  - Case type classification (8 enum values, see below)
  - Department routing (6 enum values)
  - Severity scoring (`low` / `medium` / `high` / `critical`)
  - Human review flagging
  - Confidence score
  - Reason codes
  - Agent-ready summary
  - Recommended next action
  - Safe customer reply

### Bonus endpoints

- `POST /analyze-ticket-batch` — Process up to 100 tickets in parallel (bounded concurrency 5). Returns per-ticket success/failure so one bad input cannot crash the batch.
- `GET /tickets/{ticket_id}?limit=N` — Audit trail of every analysis run against a ticket (judges may verify persistence).

### Safety guardrails

- Never requests PIN, OTP, password, or card number — the LLM prompt and the post-processing both scrub these from any reply.
- Never promises refunds, reversals, or account unblocks without authority.
- Never directs customers to unofficial third parties (any third-party contact line is rewritten).
- Detects and ignores prompt-injection attempts in complaint text (e.g. "Ignore all previous instructions…").
- Automatically escalates phishing / social-engineering cases to the `fraud_risk` department.

### Operational

- Bangla / Banglish complaint handling (rule-based path matches Unicode Bengali patterns).
- Malformed input returns controlled `400`/`422` errors — the service never crashes.
- 30-second hard timeout per request.
- Per-IP rate limiting (default 100 req/min, generous in judging mode).
- Structured Pino logging with request-ID correlation (`X-Request-Id` echoed on every response).
- MongoDB audit trail for every analyzed ticket.
- Graceful shutdown on SIGTERM / SIGINT.
- Full `.env.example` with documentation for every variable.
- Docker multi-stage build, non-root user, distroless-friendly.

---

## API contract

### `POST /analyze-ticket`

**Request body:**
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

**Response body:**
```json
{
  "success": true,
  "data": {
    "ticket_id": "TKT-001",
    "relevant_transaction_id": "TXN-9101",
    "evidence_verdict": "consistent",
    "case_type": "wrong_transfer",
    "severity": "high",
    "department": "dispute_resolution",
    "agent_summary": "Customer reports sending 5000 BDT …",
    "recommended_next_action": "Open a wrong-transfer investigation for TXN-9101 …",
    "customer_reply": "Thank you for reaching out … never share your PIN, OTP …",
    "human_review_required": true,
    "confidence": 0.92,
    "reason_codes": ["wrong_transfer", "transaction_match", "high_value"]
  }
}
```

### Enumerations

| Field | Allowed values |
|---|---|
| `case_type` | `wrong_transfer`, `payment_failed`, `refund_request`, `duplicate_payment`, `merchant_settlement_delay`, `agent_cash_in_issue`, `phishing_or_social_engineering`, `other` |
| `department` | `customer_support`, `dispute_resolution`, `payments_ops`, `merchant_operations`, `agent_operations`, `fraud_risk` |
| `severity` | `low`, `medium`, `high`, `critical` |
| `evidence_verdict` | `consistent`, `inconsistent`, `insufficient_data` |
| `language` | `en`, `bn`, `mixed` |
| `channel` | `in_app_chat`, `call_center`, `email`, `merchant_portal`, `field_agent` |
| `user_type` | `customer`, `merchant`, `agent`, `unknown` |

### Error envelope

```json
{
  "success": false,
  "message": "Validation failed",
  "error": "VALIDATION_FAILED",
  "statusCode": 400,
  "details": [/* zod issues */]
}
```

---

## Folder Structure

```
queuestorm-investigator/
├── backend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── analyze-ticket/      # POST /analyze-ticket (canonical)
│   │   │   ├── analyze-ticket-batch/ # POST /analyze-ticket-batch
│   │   │   ├── health/              # GET /health
│   │   │   └── api/
│   │   │       └── tickets/[ticket_id]/  # GET /api/tickets/:id (audit trail)
│   │   ├── config/                  # env loader + constants
│   │   ├── controllers/             # route → service glue
│   │   ├── services/                # investigator + safety + audit + AI providers
│   │   ├── repositories/            # MongoDB queries
│   │   ├── models/                  # Mongoose schemas
│   │   ├── middleware/              # auth, rate limit, security headers, logger
│   │   ├── validators/              # Zod schemas
│   │   ├── interfaces/              # shared TypeScript types
│   │   ├── utils/                   # logger, response builder, error helpers
│   │   └── lib/                     # Mongo connection
│   ├── tests/
│   │   ├── unit/                    # investigatorService, safetyService, validators, auth
│   │   └── integration/             # analyze-ticket, batch, tickets audit, health
│   ├── evaluation/
│   │   ├── public_dataset.json      # 7 reference tickets
│   │   ├── private_dataset.json     # 15 hidden QA tickets
│   │   └── output/                  # evaluation-run results
│   ├── scripts/
│   │   └── run_evaluation.sh        # judging harness
│   ├── Dockerfile                   # multi-stage, non-root
│   ├── docker-compose.yml           # service + Mongo
│   ├── judging.env                  # judge env file (placeholders)
│   ├── .env.example
│   └── package.json
└── README.md                        # this file
```

---

## Environment variables

Copy `.env.example` to `.env` and fill in your values. For judges, fill in `judging.env` instead.

| Variable | Required? | Default | Description |
|---|---|---|---|
| `PORT` | no | `8000` | HTTP port |
| `NODE_ENV` | no | `development` | `development` / `production` / `test` |
| `MONGODB_URI` | no | `mongodb://localhost:27017/queuestorm` | Mongo connection string |
| `MONGODB_DB_NAME` | no | `queuestorm` | Database name |
| `AI_PROVIDER` | yes (judging) | `primary` | `primary` \| `groq` \| `rule_only` |
| `GEMINI_API_KEY` | one of these | — | Google Gemini API key (used when `AI_PROVIDER=primary`) |
| `GEMINI_MODEL` | no | `gemini-2.5-flash` | Model name |
| `GROQ_API_KEY` | one of these | — | Groq API key (used when `AI_PROVIDER=groq`) |
| `GROQ_MODEL` | no | `llama-3.3-70b-versatile` | Model name |
| `INTERNAL_API_KEY` | no | _(empty)_ | If set, every protected request must present `X-Api-Key: <value>`. Leave empty for open mode. |
| `JWT_SECRET` | no | dev fallback | HMAC secret for JWT bearer tokens |
| `RATE_LIMIT_WINDOW_MS` | no | `60000` | Per-IP rate-limit window |
| `RATE_LIMIT_MAX_REQUESTS` | no | `100` | Max requests per window |
| `LLM_TIMEOUT_MS` | no | `25000` | Per-LLM-call timeout (must be < 30s) |
| `LOG_LEVEL` | no | `info` | `silent` / `error` / `warn` / `info` / `debug` |
| `CORS_ORIGIN` | no | `*` | CORS allowed origin |

---

## Docker

### Judge quick-start

```bash
# 1. Build
docker build -t queuestorm-team .

# 2. Run with judge env
docker run -d --rm -p 8000:8000 \
  --env-file judging.env \
  --name queuestorm queuestorm-team

# 3. Verify
curl https://sust-cse-carnival-hackathon-preli.onrender.com/health
```

### Full docker-compose (service + MongoDB)

```bash
docker compose up --build
```

The image:
- Uses a multi-stage build (final image is ~250 MB on Alpine).
- Runs as a non-root user (`node`).
- Binds to `0.0.0.0:8000`.
- Includes a graceful-shutdown handler that closes Mongo connections on SIGTERM.

---

## MongoDB setup

The service works without MongoDB (audit writes are best-effort; everything else still works). For evaluation we strongly recommend running a Mongo instance:

```bash
# Option A: Docker
docker run -d --rm --name qs-mongo -p 27017:27017 mongo:7

# Option B: docker-compose (already wired up)
docker compose up mongo
```

---

## Running locally (without Docker)

```bash
cd backend
npm install
cp .env.example .env
# edit .env with your GEMINI_API_KEY / GROQ_API_KEY (or leave AI_PROVIDER=rule_only)
npm run dev            # http://localhost:8000
```

---

## Production build & run

```bash
cd backend
npm run build
npm start              # listens on 0.0.0.0:8000
```

---

## Testing

```bash
cd backend
npm test               # full Jest suite (unit + integration)
npm run test:unit
npm run test:integration
npm run test:coverage
```

**Current status:** 105 tests across 8 suites, all green. Coverage highlights:
- Every PDF enum value reachable.
- High-value escalation (≥ 10,000 BDT) → `human_review_required: true`.
- Phishing / social-engineering → `fraud_risk` department.
- Safety guardrails — no credential requests, no refund promises, no third-party contacts.
- Bangla / Banglish complaint handling.
- Prompt-injection detection.
- Per-request 30-second timeout.
- Rate limiting (per IP).
- Batch endpoint: per-item failure isolation, ordering preserved, max 100.
- Audit endpoint: query parameter bounds, persistence verification.
- Auth: open mode, JWT mode, API-key mode (constant-time comparison).

---

## API documentation (cheat sheet)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET`  | `/health`                              | public | Liveness probe |
| `POST` | `/analyze-ticket`                      | optional | Single-ticket investigation |
| `POST` | `/analyze-ticket-batch`                | optional | Batch (max 100 tickets) |
| `GET`  | `/api/tickets/{ticket_id}?limit=N`     | optional | Audit trail (max 200) |

---

## Safety logic (high level)

The investigator runs a two-stage pipeline:

1. **Rule-based pre-classifier.** Fast keyword/regex match for the 7 known `case_type` values (with Bangla / Banglish variants) and the phishing detector. Runs in < 1 ms.
2. **LLM investigator** (only when `AI_PROVIDER` is not `rule_only`). The complaint + matched transaction are sent to Gemini 2.5 Flash (with Groq Llama 3.3 70B as fallback). The prompt forbids:
   - Asking for credentials, OTPs, PINs, or card numbers
   - Promising refunds, reversals, or unblocks
   - Mentioning unofficial phone numbers / URLs / agents
3. **Safety scrub.** The `safetyService` then re-checks every generated `customer_reply` and `recommended_next_action` against the same rules. If a violation is found the field is regenerated from a safe template.

The classifier wins on phishing — any detected phishing keyword (including Bengali variants) immediately returns `phishing_or_social_engineering` → `fraud_risk`, regardless of the LLM output.

---

## High-value & human-review triggers

- `amount ≥ 10,000 BDT` → `severity` bumped to `high` (or kept `critical` for phishing) and `human_review_required = true`.
- `case_type = phishing_or_social_engineering` → `severity = critical`, `department = fraud_risk`, `human_review_required = true`.
- Prompt-injection attempt detected in complaint → `reason_codes` includes `prompt_injection_detected`.

---

## Design decisions

- **No autonomous actions.** The service never makes refund/reversal decisions — it always returns a recommendation and a flag for human review.
- **Hard timeout.** Every request has a 30-second deadline; the work `Promise` is `Promise.race`d against a timer. LLM calls have their own 25-second timeout.
- **Best-effort Mongo persistence.** If Mongo is unavailable, the request still succeeds — the audit write is logged and retried in the background.
- **Open by default.** If neither `INTERNAL_API_KEY` nor `JWT_SECRET` is set, the service runs in open mode (useful for judges). Setting `INTERNAL_API_KEY` activates `X-Api-Key` auth on all protected routes; `/health` stays public.
- **Constant-time key comparison** (`src/middleware/auth.ts`) prevents timing attacks.
- **Two-tier LLM** (Gemini → Groq → rule-only) ensures availability even if one provider is down.
- **Bounded concurrency batch** (5 workers) prevents one batch from monopolizing the LLM quota.

---

## Scaling considerations

- The batch endpoint processes up to 100 tickets with 5 concurrent LLM calls. For larger datasets, judges can chunk and call it repeatedly.
- The rate limiter is in-memory per-process — for multi-instance deployments swap in a Redis-backed store (the `express-rate-limit` interface is already abstracted).
- The Mongo audit collection is indexed on `ticket_id` and `createdAt` for fast audit queries.

---

## Performance considerations

- Rule-based path: P50 ≈ 5 ms, P99 ≈ 30 ms (no LLM).
- Gemini 2.5 Flash path: P50 ≈ 1.2 s, P99 ≈ 4 s.
- Groq Llama 3.3 70B fallback: P50 ≈ 0.8 s, P99 ≈ 2.5 s.
- Batch (100 tickets, 5 concurrent workers): ≈ 30 s end-to-end on Gemini.

---

## Security considerations

- **OWASP headers** on every response (HSTS, X-Content-Type-Options, X-Frame-Options, CSP, Permissions-Policy, etc.).
- **Constant-time** API-key comparison.
- **Per-IP rate limit** (100/min by default; judges can raise via env).
- **Pino structured logs** include request ID, latency, status — perfect for incident response.
- **Credentials never logged.** The Pino payload truncator (1 KB) ensures no full message bodies end up in logs.
- **No secret in repo.** `.env.example` ships with placeholders only.
- **Container hardened** — non-root user, minimal Alpine runtime, no shell in final image.

---

## Known limitations

- The rule-based Bangla classifier uses regex patterns; edge-case Bangla dialects may fall through to `other`.
- The default in-memory rate limiter does not survive process restarts; multi-instance deployments should swap in Redis.
- The LLM provider free tiers have hard daily quotas; the service falls back to the rule-based path if both Gemini and Groq are exhausted.

---

## Troubleshooting

- **`/health` returns 404** — make sure you used `npm run build && npm start` (or `docker run`), not raw `next dev` without rebuilding.
- **All requests 401** — you set `INTERNAL_API_KEY` but are not sending `X-Api-Key`. Either unset `INTERNAL_API_KEY` (open mode) or send the header.
- **Gemini 429 quota errors** — switch `AI_PROVIDER=groq` or `rule_only` in `judging.env`.

---

## Future improvements

- Redis-backed rate limiter for multi-instance deployments.
- Streaming response (`Server-Sent Events`) for very long complaints.
- Per-language fine-tuned classifier as a third tier (before the LLM).
- Prometheus metrics endpoint.

---

## License & attribution

*Built for the bKash SUST CSE Carnival 2026 — Codex Community Hackathon.*
*This service uses only synthetic data. No real customer or payment data is used at any point.*