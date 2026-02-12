#!/bin/bash
# Test script for inbox classify-inbox-item Edge Function
# Uses test artisan: b1a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d

SUPABASE_URL="https://zvmvrhdcjprlbqfzslhg.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2bXZyaGRjanBybGJxZnpzbGhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NzM2NzgsImV4cCI6MjA4NjI0OTY3OH0.K5955heWVB0EdCIQWjcUrE89QZp27tGeJhmpyMCQKVk"
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2bXZyaGRjanBybGJxZnpzbGhnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDY3MzY3OCwiZXhwIjoyMDg2MjQ5Njc4fQ.MTZN-EDAmpFNjlEToYHLb54c5vzcdOEr8UOQPziGtpE"
ARTISAN_ID="b1a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "========================================"
echo "  TEST INBOX AI CLASSIFICATION"
echo "========================================"
echo ""

for file in "$SCRIPT_DIR"/*.txt; do
  filename=$(basename "$file")
  [ "$filename" = "test-classify.sh" ] && continue

  echo "--- $filename ---"
  content=$(cat "$file")

  # Escape content for JSON
  json_content=$(printf '%s' "$content" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))")

  # Step 1: Insert inbox item
  item_id=$(curl -s -X POST "$SUPABASE_URL/rest/v1/inbox_items" \
    -H "apikey: $SERVICE_KEY" \
    -H "Authorization: Bearer $SERVICE_KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    -d "{\"artisan_id\": \"$ARTISAN_ID\", \"source\": \"manual\", \"file_type\": \"text\", \"raw_text\": $json_content, \"status\": \"new\"}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])" 2>/dev/null)

  if [ -z "$item_id" ]; then
    echo "  ERRORE: impossibile creare inbox item"
    echo ""
    continue
  fi

  echo "  Item ID: $item_id"

  # Step 2: Classify
  result=$(curl -s -X POST "$SUPABASE_URL/functions/v1/classify-inbox-item" \
    -H "Authorization: Bearer $ANON_KEY" \
    -H "apikey: $ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"inboxItemId\": \"$item_id\"}")

  classification=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('classification','?'))" 2>/dev/null)
  confidence=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('confidence','?'))" 2>/dev/null)
  summary=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('summary','?'))" 2>/dev/null)

  echo "  Classificazione: $classification"
  echo "  Confidenza: $confidence"
  echo "  Riepilogo: $summary"
  echo ""
done

echo "========================================"
echo "  TEST COMPLETATO"
echo "========================================"
