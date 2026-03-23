#!/bin/bash
set -e

GARAGE_ADMIN="http://localhost:3903"
ADMIN_TOKEN="jjalcloud-admin-token"
AUTH_HEADER="Authorization: Bearer $ADMIN_TOKEN"
ENV_FILE=".env.test"

echo "Waiting for Garage admin API..."
until curl -sf "$GARAGE_ADMIN/health" >/dev/null 2>&1; do
	sleep 1
done
echo "Garage is ready."

# Get node ID
NODE_ID=$(curl -sf -H "$AUTH_HEADER" "$GARAGE_ADMIN/v1/status" | grep -o '"node":"[^"]*"' | cut -d'"' -f4)
echo "Node ID: $NODE_ID"

# Apply layout
curl -sf -X POST \
	-H "$AUTH_HEADER" \
	-H "Content-Type: application/json" \
	-d "{\"$NODE_ID\":{\"zone\":\"dc1\",\"capacity\":1073741824,\"tags\":[]}}" \
	"$GARAGE_ADMIN/v1/layout" >/dev/null

# Get layout version and apply
LAYOUT_VERSION=$(curl -sf -H "$AUTH_HEADER" "$GARAGE_ADMIN/v1/layout" | grep -o '"version":[0-9]*' | cut -d: -f2)
NEXT_VERSION=$((LAYOUT_VERSION + 1))
curl -sf -X POST \
	-H "$AUTH_HEADER" \
	-H "Content-Type: application/json" \
	-d "{\"version\":$NEXT_VERSION}" \
	"$GARAGE_ADMIN/v1/layout/apply" >/dev/null
echo "Layout applied."

# Create API key
KEY_JSON=$(curl -sf -X POST \
	-H "$AUTH_HEADER" \
	-H "Content-Type: application/json" \
	-d '{"name":"jjalcloud"}' \
	"$GARAGE_ADMIN/v1/key")

ACCESS_KEY=$(echo "$KEY_JSON" | grep -o '"accessKeyId":"[^"]*"' | cut -d'"' -f4)
SECRET_KEY=$(echo "$KEY_JSON" | grep -o '"secretAccessKey":"[^"]*"' | cut -d'"' -f4)
echo "API key created."

# Create bucket
curl -sf -X POST \
	-H "$AUTH_HEADER" \
	-H "Content-Type: application/json" \
	-d '{"globalAlias":"jjalcloud-gifs"}' \
	"$GARAGE_ADMIN/v1/bucket" >/dev/null

# Grant key access to bucket
BUCKET_ID=$(curl -sf -H "$AUTH_HEADER" "$GARAGE_ADMIN/v1/bucket?globalAlias=jjalcloud-gifs" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
curl -sf -X POST \
	-H "$AUTH_HEADER" \
	-H "Content-Type: application/json" \
	-d "{\"bucketId\":\"$BUCKET_ID\",\"accessKeyId\":\"$ACCESS_KEY\",\"permissions\":{\"read\":true,\"write\":true,\"owner\":true}}" \
	"$GARAGE_ADMIN/v1/bucket/allow" >/dev/null
echo "Bucket 'jjalcloud-gifs' created."

# Write credentials to .env.test
cat >"$ENV_FILE" <<EOF
DATABASE_URL=postgres://jjalcloud:jjalcloud@localhost:5432/jjalcloud_test
R2_ENDPOINT=http://localhost:3900
R2_ACCESS_KEY_ID=$ACCESS_KEY
R2_SECRET_ACCESS_KEY=$SECRET_KEY
R2_BUCKET=jjalcloud-gifs
R2_PUBLIC_URL=http://localhost:3900/jjalcloud-gifs
OAUTH_CLIENT_ID=http://localhost:3000
OAUTH_REDIRECT_URI=http://localhost:3000/oauth/callback
OAUTH_PRIVATE_KEY={}
PUBLIC_URL=http://localhost:3000
JETSTREAM_URLS=wss://jetstream1.us-east.bsky.network/subscribe,wss://jetstream2.us-east.bsky.network/subscribe
PDS_URL=http://localhost:2583
EOF

echo ""
echo "=== Garage initialized ==="
echo "Credentials written to $ENV_FILE"
echo "S3_ENDPOINT=http://localhost:3900"
echo "S3_ACCESS_KEY_ID=$ACCESS_KEY"
echo "S3_SECRET_ACCESS_KEY=$SECRET_KEY"
