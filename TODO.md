# Refactor TODO

## Backlog

- [x] 1. `apps/web/src/index.tsx` 엔트리 과대화 분리 (API 라우트/페이지 라우팅/OG/DB 매핑 책임 분리)
- [x] 2. GIF 매핑/변환 중복 제거 (`tags` 파싱, author 매핑, view model 생성 공통화)
- [x] 3. 에러 응답 패턴 표준화 (`try/catch + c.json({ error, message })` 공통 처리)
- [ ] 4. 좋아요 처리 로직 이원화 해소 (`client.tsx` 전역 위임 vs `DetailActions` 아일랜드)
- [ ] 5. 업로드 폼 분해 (`UploadForm.tsx` 책임 분리, `UploadZone` 재사용 정리)
- [ ] 6. `getGifUrl` 중복 헬퍼 통합 (pages/islands 공통 유틸로 이동)
- [ ] 7. 인덱서 쓰기 경로 단일화 (`batcher.ts` raw SQL vs `db/index.ts` Drizzle 경로 정리)
- [ ] 8. 인덱서 환경설정 중복/불일치 정리 (`env.ts`/`index.ts` 검증 중복, `LOCAL_DB_PATH` 반영)

## Current focus

- [x] 1번 리팩터링 완료
- [x] 2번 리팩터링 완료
- [x] 3번 리팩터링 완료
