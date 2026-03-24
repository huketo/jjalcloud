#!/bin/bash
set -e

# Create dev database (test database is created by POSTGRES_DB env var)
psql -U jjalcloud -d postgres -c "CREATE DATABASE jjalcloud;" 2>/dev/null || true

# Apply Drizzle migrations to both databases
for db in jjalcloud jjalcloud_test; do
  echo "Applying migrations to $db..."
  for f in /migrations/*.sql; do
    echo "  $f"
    psql -U jjalcloud -d "$db" -f "$f"
  done
done

echo "Database initialized."
