#!/usr/bin/env bash
# scripts/run_evaluation.sh
#
# Runs the local evaluation harness against the running service.
# Usage: bash scripts/run_evaluation.sh [base_url] [dataset_path] [api_key]
#
# Defaults: base_url=http://localhost:8000
#           dataset_path=./evaluation/public_dataset.json
#           api_key=$INTERNAL_API_KEY

set -euo pipefail

BASE_URL="${1:-http://localhost:8000}"
DATASET_PATH="${2:-./evaluation/public_dataset.json}"
API_KEY="${3:-${INTERNAL_API_KEY:-}}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "==> QueueStorm Investigator evaluation harness"
echo "    base_url    : $BASE_URL"
echo "    dataset     : $DATASET_PATH"
echo "    api_key     : ${API_KEY:+***set***}${API_KEY:-unset (open mode)}"

# 1. Wait for /health (Next.js App Router exposes it at the top level)
echo "==> Waiting for /health to respond..."
for i in {1..60}; do
  if curl -sSf "$BASE_URL/health" > /dev/null 2>&1; then
    echo "    service is up"
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "ERROR: service did not come up in 60s" >&2
    exit 1
  fi
  sleep 1
done

# 2. Check dataset exists
if [ ! -f "$DATASET_PATH" ]; then
  echo "ERROR: dataset file not found: $DATASET_PATH" >&2
  exit 1
fi

# 3. Build curl args
CURL_ARGS=(
  -sS
  -X POST
  -H "Content-Type: application/json"
  --data-binary "@$DATASET_PATH"
)
if [ -n "$API_KEY" ]; then
  CURL_ARGS+=(-H "X-Api-Key: $API_KEY")
fi

# 4. Send dataset as a batch
OUT_DIR="$SCRIPT_DIR/../evaluation/output"
mkdir -p "$OUT_DIR"
OUT_FILE="$OUT_DIR/result_$(date +%Y%m%d_%H%M%S).json"

echo "==> Submitting dataset to /analyze-ticket-batch"
HTTP_CODE=$(curl "${CURL_ARGS[@]}" -o "$OUT_FILE" -w "%{http_code}" \
  "$BASE_URL/analyze-ticket-batch")

if [ "$HTTP_CODE" -ne 200 ]; then
  echo "ERROR: HTTP $HTTP_CODE from /analyze-ticket-batch" >&2
  echo "Response body saved to: $OUT_FILE" >&2
  exit 1
fi

# 5. Quick stats
echo "==> Result saved to: $OUT_FILE"
if command -v jq > /dev/null 2>&1; then
  TOTAL=$(jq '.data.count' "$OUT_FILE")
  SUCCESS=$(jq '.data.success_count' "$OUT_FILE")
  FAILURE=$(jq '.data.failure_count' "$OUT_FILE")
  echo "    total    : $TOTAL"
  echo "    success  : $SUCCESS"
  echo "    failure  : $FAILURE"
fi

echo "==> Done."