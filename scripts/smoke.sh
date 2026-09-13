# End-to-end smoke of the whole product loop against a running API:
# staff sign-in → QR scan → menu → order (with an idempotency retry) → work the
# pass → review → stats → analytics → audit log → the two refusals that matter.
#
#   npm run dev            # or docker compose up
#   npm run db:seed
#   bash scripts/smoke.sh
#
# Needs curl and jq. Re-running is safe: it uses a fresh session each time, but
# bump the idempotency key below if you want a genuinely new order.
set -o pipefail
API=http://localhost:3100/api/v1
say() { printf "\n== %s\n" "$1"; }

say "staff sign-in"
TOKEN=$(curl -sf -X POST $API/auth/staff/sign-in -H 'content-type: application/json' \
  -d '{"email":"owner@lets-dine.test","pin":"4821"}' | jq -r '.data.accessToken')
echo "token: ${TOKEN:0:24}…"

say "tables (tables:view)"
TABLE=$(curl -sf "$API/restaurant/tables?limit=1" -H "authorization: Bearer $TOKEN")
echo "$TABLE" | jq -c '{count: .data.count, first: .data.rows[0].name}'
QR=$(echo "$TABLE" | jq -r '.data.rows[0].qrToken')

say "diner scans the QR"
SESSION=$(curl -sf -X POST $API/public/sessions -H 'content-type: application/json' \
  -d "{\"restaurantSlug\":\"newa-kitchen\",\"tableToken\":\"$QR\"}")
SESSION_TOKEN=$(echo "$SESSION" | jq -r '.data.session.anonymousSessionToken')
echo "$SESSION" | jq -c '{table: .data.table.name, restaurant: .data.restaurant.name}'

say "public menu"
MENU=$(curl -sf $API/public/restaurants/newa-kitchen/menu)
echo "$MENU" | jq -c '{categories: (.data.categories|length), dishes: (.data.dishes|length), rating: .data.restaurant.avgRating}'
DISH=$(echo "$MENU" | jq -r '.data.dishes[0].id')

say "place the order twice with one idempotency key"
ORDER=$(curl -sf -X POST $API/orders -H 'content-type: application/json' -H "x-session-token: $SESSION_TOKEN" \
  -H 'idempotency-key: smoke-key-2' -d "{\"lines\":[{\"dishId\":\"$DISH\",\"quantity\":2,\"note\":\"extra spicy\"}]}")
ORDER_ID=$(echo "$ORDER" | jq -r '.data.id')
RETRY=$(curl -sf -X POST $API/orders -H 'content-type: application/json' -H "x-session-token: $SESSION_TOKEN" \
  -H 'idempotency-key: smoke-key-2' -d "{\"lines\":[{\"dishId\":\"$DISH\",\"quantity\":5}]}")
echo "$ORDER" | jq -c '{reference: .data.reference, subtotal: .data.subtotal, serviceCharge: .data.serviceCharge, tax: .data.tax, total: .data.total}'
[ "$ORDER_ID" = "$(echo "$RETRY" | jq -r '.data.id')" ] && echo "idempotency: retry returned the same order" || { echo "idempotency FAILED"; exit 1; }

say "client-sent totals are ignored, invalid transition refused"
curl -s -X PATCH $API/restaurant/orders/$ORDER_ID/status -H 'content-type: application/json' \
  -H "authorization: Bearer $TOKEN" -d '{"status":"READY"}' | jq -c '{status: .statusCode, key: .error.key}'

say "work the pass to COMPLETED"
for NEXT in ACCEPTED PREPARING READY COMPLETED; do
  curl -sf -X PATCH $API/restaurant/orders/$ORDER_ID/status -H 'content-type: application/json' \
    -H "authorization: Bearer $TOKEN" -d "{\"status\":\"$NEXT\"}" | jq -c '{status: .data.status}'
done

say "review a dish that was actually ordered"
curl -sf -X POST $API/reviews -H 'content-type: application/json' -H "x-session-token: $SESSION_TOKEN" \
  -d "{\"orderId\":\"$ORDER_ID\",\"dishId\":\"$DISH\",\"overall\":5,\"taste\":5,\"portion\":4,\"value\":4,\"wouldOrderAgain\":true,\"comment\":\"Best sekuwa in town\",\"tags\":[\"Juicy\",\"Good value\"]}" \
  | jq -c '{overall: .data.overall, tags: .data.tags, verified: .data.verified}'

say "second review of the same dish on the same order"
curl -s -X POST $API/reviews -H 'content-type: application/json' -H "x-session-token: $SESSION_TOKEN" \
  -d "{\"orderId\":\"$ORDER_ID\",\"dishId\":\"$DISH\",\"overall\":1,\"taste\":1,\"portion\":1,\"value\":1,\"wouldOrderAgain\":false}" \
  | jq -c '{status: .statusCode, key: .error.key}'

say "stats have moved"
curl -sf $API/public/dishes/$DISH | jq -c '{name: .data.name, stats: {rating: .data.stats.avgRating, count: .data.stats.ratingCount, orders30d: .data.stats.orders30d, tags: .data.stats.topTags}, badges: .data.badges}'

say "analytics"
curl -sf "$API/restaurant/analytics" -H "authorization: Bearer $TOKEN" \
  | jq -c '{orders: .data.orders, topDish: .data.dishes[0], feedback: .data.feedback.avgRating}'

say "audit log"
curl -sf "$API/restaurant/audit-logs?limit=3" -H "authorization: Bearer $TOKEN" \
  | jq -c '{count: .data.count, recent: [.data.rows[] | {action, subject, detail}]}'

say "a STAFF token may not change a price (§50)"
STAFF_TOKEN=$(curl -sf -X POST $API/auth/staff/sign-in -H 'content-type: application/json' \
  -d '{"email":"staff@lets-dine.test","pin":"4821"}' | jq -r '.data.accessToken')
curl -s -X PATCH $API/restaurant/dishes/$DISH -H 'content-type: application/json' \
  -H "authorization: Bearer $STAFF_TOKEN" -d '{"price":99000}' | jq -c '{status: .statusCode, key: .error.key}'

say "no session token, no ordering"
curl -s -X POST $API/orders -H 'content-type: application/json' -d '{"lines":[]}' | jq -c '{status: .statusCode, key: .error.key}'
