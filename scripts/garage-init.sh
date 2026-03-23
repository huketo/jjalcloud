#!/bin/bash
set -e

GARAGE_ADMIN="http://localhost:3902"
ENV_FILE=".env.test"

echo "Waiting for Garage admin API..."
until wget -q --spider "$GARAGE_ADMIN/health" 2>/dev/null; do
	sleep 1
done
echo "Garage is ready."

# Get node ID
NODE_ID=$(wget -qO- "$GARAGE_ADMIN/v1/status" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Node ID: $NODE_ID"

# Apply layout
wget -qO- --post-data="{\"$NODE_ID\":{\"zone\":\"dc1\",\"capacity\":1073741824,\"tags\":[]}}" \
	--header="Content-Type: application/json" \
	"$GARAGE_ADMIN/v1/layout" >/dev/null

# Get layout version and apply
LAYOUT_VERSION=$(wget -qO- "$GARAGE_ADMIN/v1/layout" | grep -o '"version":[0-9]*' | cut -d: -f2)
NEXT_VERSION=$((LAYOUT_VERSION + 1))
wget -qO- --post-data="{\"version\":$NEXT_VERSION}" \
	--header="Content-Type: application/json" \
	"$GARAGE_ADMIN/v1/layout/apply" >/dev/null
echo "Layout applied."

# Create API key
KEY_JSON=$(wget -qO- --post-data='{"name":"jjalcloud"}' \
	--header="Content-Type: application/json" \
	"$GARAGE_ADMIN/v1/key")

ACCESS_KEY=$(echo "$KEY_JSON" | grep -o '"accessKeyId":"[^"]*"' | cut -d'"' -f4)
SECRET_KEY=$(echo "$KEY_JSON" | grep -o '"secretAccessKey":"[^"]*"' | cut -d'"' -f4)
echo "API key created."

# Create bucket
wget -qO- --post-data='{"globalAlias":"jjalcloud-gifs"}' \
	--header="Content-Type: application/json" \
	"$GARAGE_ADMIN/v1/bucket" >/dev/null

# Grant key access to bucket
BUCKET_ID=$(wget -qO- "$GARAGE_ADMIN/v1/bucket?globalAlias=jjalcloud-gifs" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
wget -qO- --post-data="{\"bucketId\":\"$BUCKET_ID\",\"accessKeyId\":\"$ACCESS_KEY\",\"permissions\":{\"read\":true,\"write\":true,\"owner\":true}}" \
	--header="Content-Type: application/json" \
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
