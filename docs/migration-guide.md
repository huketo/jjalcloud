# D1 → PostgreSQL Migration Guide

jjalcloud v1 (Cloudflare D1/SQLite) 에서 v2 (PostgreSQL) 로 데이터를 마이그레이션하는 가이드.

## Overview

| v1 (D1/SQLite) | v2 (PostgreSQL) | 변환 |
|---|---|---|
| `INTEGER` timestamps (Unix epoch) | `TIMESTAMPTZ` | `epoch * 1000` → Date |
| `gifs.tags` (JSON string column) | `tags` 테이블 (정규화) | JSON parse → INSERT rows |
| `gifs`에 `rkey` 없음 | `gifs.rkey` 컬럼 | URI에서 마지막 segment 추출 |
| `file` (JSON text) | `file` (JSONB) | text → jsonb cast |
| `likes.id` AUTOINCREMENT | `likes.id` SERIAL | 자동 (ID 보존하지 않음) |

## Prerequisites

- v2 PostgreSQL이 실행 중이고 마이그레이션이 적용된 상태
- `wrangler` CLI 설치 (D1 export용)
- v1의 Cloudflare 계정 접근 권한

## Step 1: Export D1 Data

```bash
npx wrangler d1 export jjalcloud_db --remote --output=d1-export.sql
```

이 명령은 D1 데이터베이스의 전체 SQL dump를 생성합니다. `INSERT INTO` 문이 포함된 `.sql` 파일이 만들어집니다.

## Step 2: Dry Run

실제 데이터를 쓰기 전에 dry run으로 파싱 결과를 확인합니다.

```bash
DATABASE_URL=<postgresql-url> bun run scripts/migrate-d1.ts --dry-run
```

출력 예시:
```
Reading d1-export.sql...
Read 12345 bytes.
Found 10 users.
[dry-run] user: did:plc:abc123 (alice.bsky.social)
...
Found 50 gifs.
[dry-run] gif: at://did:plc:abc123/com.jjalcloud.feed.gif/3jxk5 (3 tags)
...
Found 120 likes.
[dry-run] like: did:plc:abc123 → at://did:plc:xyz/com.jjalcloud.feed.gif/3jxk5
...

[dry-run] No data was written.
```

## Step 3: Run Migration

```bash
DATABASE_URL=<postgresql-url> bun run scripts/migrate-d1.ts
```

출력 예시:
```
Reading d1-export.sql...
Read 12345 bytes.
Found 10 users.
Migrated 10 users.
Found 50 gifs.
Migrated 50 gifs, 150 tags.
Found 120 likes.
Migrated 120 likes.

=== Migration Complete ===
Users: 10
GIFs:  50
Tags:  150
Likes: 120
```

## Step 4: Verify

마이그레이션 후 데이터 정합성을 확인합니다.

```bash
# v1 레코드 수 확인
npx wrangler d1 execute jjalcloud_db --remote --command "SELECT COUNT(*) FROM users"
npx wrangler d1 execute jjalcloud_db --remote --command "SELECT COUNT(*) FROM gifs"
npx wrangler d1 execute jjalcloud_db --remote --command "SELECT COUNT(*) FROM likes"

# v2 레코드 수 확인
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM gifs"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM tags"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM likes"
```

## Step 5: Backfill via Jetstream

마이그레이션은 D1 export 시점의 스냅샷입니다. Export 이후 생성된 레코드는 Jetstream indexer가 자동으로 인덱싱합니다. v2 서버를 시작하면 Jetstream이 연결되어 실시간 이벤트를 처리합니다.

누락된 레코드가 있을 수 있으므로, 마이그레이션 후 v2 서버를 시작하고 일정 시간 Jetstream이 동작하도록 합니다.

## Troubleshooting

### "ON CONFLICT" 에러

이미 마이그레이션된 데이터가 있으면 `ON CONFLICT DO NOTHING`으로 중복이 무시됩니다. 완전히 다시 하려면:

```sql
TRUNCATE share_events, likes, tags, gifs, categories, oauth_states, oauth_sessions, users CASCADE;
```

### Tags 파싱 실패

v1의 tags는 JSON 배열(`["cat","funny"]`) 또는 comma-separated(`cat,funny`) 형식일 수 있습니다. 스크립트는 두 형식 모두 처리합니다.

### Timestamp 범위 오류

D1의 timestamp가 밀리초 단위인 경우 (1000배 큰 값), 스크립트의 `epochToTimestamp` 함수를 수정하세요:

```typescript
// 밀리초 단위인 경우
function epochToTimestamp(epoch: number): Date {
  return epoch > 1e12 ? new Date(epoch) : new Date(epoch * 1000);
}
```

## Custom Export Path

기본 파일은 `d1-export.sql`이지만 `--file` 옵션으로 변경할 수 있습니다:

```bash
DATABASE_URL=<url> bun run scripts/migrate-d1.ts --file ./backups/export-2026-03-24.sql
```
