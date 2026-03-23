#!/bin/bash
set -e

# Apply Drizzle migrations (runs only on first container init when pgdata is empty)
for f in /migrations/*.sql; do
  echo "Applying migration: $f"
  psql -U jjalcloud -d jjalcloud_test -f "$f"
done

echo "Database initialized."
