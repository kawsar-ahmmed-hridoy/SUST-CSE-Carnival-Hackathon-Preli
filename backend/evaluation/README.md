# QueueStorm Investigator — Evaluation Datasets

This directory contains the **publicly disclosed** samples for the evaluation harness.

## Files

| File | Tickets | Purpose |
|------|---------|---------|
| `public_dataset.json` | 7 | Reference examples; results reproducible by anyone. |
| `private_dataset.json` | 15 | Hidden hold-out used by the local harness for our own QA. |

The **judging harness** uses its own private Dataset C (10-25 tickets, not
committed to this repo) at evaluation time.

## How to reproduce locally

```bash
# 1. Boot the service
docker build -t queuestorm-team .
docker run -d --rm -p 8000:8000 \
  --env-file judging.env \
  --name queuestorm queuestorm-team

# 2. Wait for /health (the script does this for you)
bash scripts/run_evaluation.sh \
  http://localhost:8000 \
  ./evaluation/public_dataset.json \
  $INTERNAL_API_KEY
```

The script posts the dataset to `POST /api/analyze-ticket-batch` (max 100
tickets per call, bounded-concurrency processing) and writes the response to
`evaluation/output/result_<timestamp>.json`.

## Schema

Each ticket is a JSON object matching `ITicketRequest`:

```ts
{
  ticket_id: string;
  complaint: string;
  language?: 'en' | 'bn' | 'mixed';
  channel?: 'in_app_chat' | 'call_center' | 'email' | 'merchant_portal' | 'field_agent';
  user_type?: 'customer' | 'merchant' | 'agent' | 'unknown';
  campaign_context?: string;
  transaction_history?: ITransaction[];   // see src/interfaces/ITransaction.ts
  metadata?: Record<string, unknown>;
}
```

A complete ticket must include `ticket_id` and `complaint`; everything else is
optional but improves classification accuracy.