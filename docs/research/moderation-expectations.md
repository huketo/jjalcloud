# AppView 가 라벨·테이크다운·계정 상태에 대해 지켜야 하는 것

## Verdict

프로토콜이 AppView 에게 **강제하는 것은 계정 호스팅 상태 하나뿐이다** — `active=false` 인 계정의 콘텐츠를
어떤 형태로도(레코드·뷰·blob·썸네일) 재배포하지 않는 것. 나머지(라벨, `!no-unauthenticated`, 블록, 뮤트,
신고)는 전부 애플리케이션 계층의 관례이고, **강제 메커니즘이 존재하지 않는다.** `deactivated` 는 명시적으로
가역이며(PDS 가 같은 컬럼을 `NULL` 로 되돌린다) tap 은 재활성화 시 레코드를 재전송하지 않으므로,
**삭제가 아니라 숨김이 유일하게 안전한 구현이다.**

| | 항목 | 근거 |
|---|---|---|
| **의무 (obligatory)** | `#account` 이벤트로 들어오는 `active=false` 를 인덱스에 반영하고, 그 DID 의 GIF·좋아요·프로필을 모든 읽기 경로에서 제외 | [specs/account](https://atproto.com/specs/account): "If an account is not active, the service should not redistribute content for that account (repositories, individual records, blobs, etc)" · "All services are expected to respect certain protocol-level account actions" |
| | `takendown` / `suspended` / `deactivated` 는 **숨김**, `deleted` 만 삭제 후보 | `packages/pds/src/account-manager/helpers/account.ts:313-338` (가역) · `packages/bsky/src/data-plane/server/subscription.ts:123-128` |
| | `deleted` 조차 즉시 하드 삭제하지 않는다 — 공식 AppView 는 DID 문서를 재해석해 리포가 실제로 사라졌는지 확인한 뒤에만 지운다 | `packages/bsky/src/data-plane/server/indexing/index.ts:285-311` |
| | 레코드 삭제(`delete` op)는 즉시 공개 접근을 끊는다 | [specs/account](https://atproto.com/specs/account) "Content Deletion" |
| **관례 (conventional)** | `!no-unauthenticated` — 로그아웃 뷰어에게 해당 계정의 프로필·콘텐츠를 숨김 | [guides/labels](https://atproto.com/guides/labels) · `packages/bsky/src/views/index.ts:198-203` |
| | 외부 라벨러 1곳(Bluesky moderation, `did:plc:ar7c4by46qjdydhdevvrndac`) 구독 후 계정 단위 `!takedown` 존중 | 아래 §4 의 실제 호출 결과 |
| | 자체 신고 창구(`com.atproto.moderation.createReport` 또는 사내 폼) | `lexicons/com/atproto/moderation/createReport.json` |
| | 이미 발행된 렉시콘에 **선택적** self-label 필드 추가 | 아래 §3 의 실측 |
| **선택 (optional)** | `app.bsky.graph.block` / `app.bsky.graph.*` 뮤트 존중 | 아래 §5 — 레퍼런스 AppView 2곳 모두 0줄 |
| | `subscribeLabels` WebSocket 소비 · 라벨 서명 검증 · `atproto-accept-labelers` 헤더 파싱 | [specs/label](https://atproto.com/specs/label) — "labels are not *required* to be publicly enumerable", 서명 검증은 서비스 재량 |
| | 자체 라벨러(Ozone) 운영 | [guides/moderation](https://atproto.com/guides/moderation) |

---

## 1. 계정 상태 — 정의와 AppView 가 각각에서 해야 하는 것

### 1.1 명세상의 정의

`com.atproto.sync.subscribeRepos#account` 의 `status` 는 `knownValues` 6개다
(`lexicons/com/atproto/sync/subscribeRepos.json:154-176`):

```json
"knownValues": [
  "takendown", "suspended", "deleted", "deactivated", "desynchronized", "throttled"
]
```

[Account Hosting 명세](https://atproto.com/specs/account)의 정의를 그대로 옮기면:

| status | `active` | 명세 원문 | 함의 |
|---|---|---|---|
| `deleted` | false | "user or host has deleted the account, and content should be removed from the network. Implied permanent or long-term, **though may be reverted** (deleted accounts may reactivate on the same or another host)." | 영구 의도. 하지만 되돌 수 있다 |
| `deactivated` | false | "user has temporarily paused their overall account. Content should not be displayed or redistributed, **but does not need to be deleted from infrastructure. Implied time-limited.** Also the initial state for an account after migrating to another PDS instance." | **가역. 삭제 금지** |
| `takendown` | false | "host or service has takendown the account. Implied permanent or long-term, though may be reverted." | 숨김 |
| `suspended` | false | "host or service has temporarily paused the account. Implied time-limited." | 숨김 |
| `desynchronized` | **may be true** | "host or service has detected a problem synchronizing the account's repository, and may be missing content" | 가시성 판단 대상 아님 |
| `throttled` | **may be true** | "host or service has paused processing of new content because a resource rate-limit has been exceeded" | 가시성 판단 대상 아님 |

명세는 판단 기준을 못박는다:

> Services should use the `active` flag to control overall account visibility (observable behavior)
> with the `status` string acting as clarification which might determine more specific infrastructure
> behaviors (such as data deletion).

즉 **가릴지 말지는 `active` 불리언 하나로 결정하고, `status` 는 "지울까 말까" 에만 쓴다.**
`status` 를 화이트리스트로 훑는 구현은 미래에 추가될 상태에서 조용히 틀린다.

숨겨야 하는 범위도 열거되어 있다: repository exports(CAR), repo records, **transformed records
("views", embeds, etc)**, blobs, **transformed blobs (thumbnails, etc)**. 즉 우리 피드 카드와
(언젠가 생길) 썸네일 캐시까지 포함이다.

### 1.2 `deactivated` 는 가역인가 — **가역이다.** (이 티켓의 결정타)

PDS 구현이 같은 컬럼을 켰다 껐다 할 뿐이다
(`packages/pds/src/account-manager/helpers/account.ts:295-338`):

```ts
export const deactivateAccount = async (db, did, deleteAfter) => {
  ... .set({ deactivatedAt: currentDatetimeString(), deleteAfter }) ...
}

export const activateAccount = async (db, did, flags?) => {
  ... .set({ deactivatedAt: null, deleteAfter: null }) ...
}

export const formatAccountStatus = (account) => {
  if (!account)                 return { active: false, status: AccountStatus.Deleted }
  else if (account.takedownRef) return { active: false, status: AccountStatus.Takendown }
  else if (account.deactivatedAt) return { active: false, status: AccountStatus.Deactivated }
  else                          return { active: true, status: undefined }
}
```

`deactivate` → `activate` 는 한 번의 `UPDATE` 다. 계정 마이그레이션의 정상 경로에서도
새 PDS 계정은 `deactivated` 로 시작한다([specs/account](https://atproto.com/specs/account) PDS Account Migration).
**즉 `deactivated` 는 예외 상황이 아니라 일상 상태다.**

### 1.3 공식 AppView 가 실제로 하는 것

firehose 핸들러 (`packages/bsky/src/data-plane/server/subscription.ts:123-128`):

```ts
} else if (evt.event === 'account') {
  if (evt.active === false && evt.status === 'deleted') {
    await indexingSvc.deleteActor(evt.did)
  } else {
    await indexingSvc.updateActorStatus(evt.did, evt.active, evt.status)
  }
}
```

`updateActorStatus` 는 `actor.upstreamStatus` 컬럼 하나를 쓸 뿐 레코드를 지우지 않는다
(`indexing/index.ts:265-282`). 그리고 알 수 없는 status 는 **던진다** — `active=false` 인데
`takendown|suspended|deactivated` 중 하나가 아니면 `Unrecognized account status` 예외다(:276).
(`desynchronized`/`throttled` 는 `active=true` 로 오므로 첫 분기에서 흡수된다.)

`deleted` 조차 무조건 삭제가 아니다 (`indexing/index.ts:285-311`):

```ts
async deleteActor(did) {
  const actorIsHosted = await this.getActorIsHosted(did)
  if (actorIsHosted === false) { ... 실제 삭제 ... }
}

private async getActorIsHosted(did): Promise<boolean> {
  const doc = await this.idResolver.did.resolve(did, true)
  const pds = doc && getPds(doc)
  if (!pds) return false
  return retryXrpc(async () => {
    const res = await xrpcSafe(pds, com.atproto.sync.getLatestCommit, { params: { did } })
    if (res.success) return true
    if (res.error === 'RepoNotFound') return false
    throw res.reason
  })
}
```

**DID 를 다시 해석해서 리포가 정말 사라졌는지 확인한 뒤에만 지운다.** 이건 계정 마이그레이션 중
구 PDS 가 `deleted` 를 쏘는 상황에서 인덱스를 날려먹지 않기 위한 방어다.

읽기 경로에서의 처리 (`packages/bsky/src/views/index.ts:178-196`):

```ts
actorIsNoHosted(did, state) {
  return this.actorIsDeactivated(did, state) || this.actorIsTakendown(did, state)
}
actorIsDeactivated(did, state) {
  if (state.actors?.get(did)?.upstreamStatus === 'deactivated') return true
  return false
}
actorIsTakendown(did, state) {
  const actor = state.actors?.get(did)
  if (actor?.takedownRef) return true
  if (actor?.upstreamStatus === 'takendown') return true
  if (actor?.upstreamStatus === 'suspended') return true
  if (state.labels?.get(did)?.isTakendown) return true   // ← 라벨러발 !takedown 도 같은 스위치
  return false
}
```

리스트에서는 조용히 빠지고(`views/index.ts:576` — `mapDefined` 로 `undefined` 반환),
프로필 단건 조회는 **명시적 에러**로 구분한다
(`packages/bsky/src/api/app/bsky/actor/getProfile.ts:82-93`):

```ts
if (ctx.views.actorIsTakendown(...))       throw new InvalidRequestError('Account has been suspended', 'AccountTakedown')
else if (ctx.views.actorIsDeactivated(...)) throw new InvalidRequestError('Account is deactivated', 'AccountDeactivated')
```

### 1.4 그래서 우리는

- 인덱스에 `actor.upstream_status`(nullable) 컬럼 하나. `active=true` → `NULL`, 아니면 `status` 문자열.
- 모든 읽기 쿼리에 `upstream_status IS NULL` 조건. GIF, 좋아요 집계, 검색, 프로필.
- **`deleted` 이외에는 절대 DELETE 금지.**
- `deleted` 도 즉시 지우지 말 것 — §6 의 tap 동작 때문에 지우면 되돌릴 방법이 없다.

---

## 2. `!no-unauthenticated`

### 2.1 정확한 의미

프로토콜이 정의한 **글로벌 라벨 값** 8개 중 하나다
(`lexicons/com/atproto/label/defs.json:137-147` 의 `labelValue#knownValues`):
`!hide`, `!warn`, `!no-unauthenticated`, `porn`, `sexual`, `nudity`, `graphic-media`, `bot`.

[guides/labels](https://atproto.com/guides/labels) 정의:

> `!no-unauthenticated` which makes the content inaccessible to logged-out users **in applications
> which respect the label.**

같은 문서가 왜 글로벌인지도 설명한다:

> only label values which are defined globally can be used as self-labels (ie set by a user who is
> not a Labeler) ... some special behaviors, like "non-configurable" and "applies only to logged out
> users," cannot be applied to custom labels.

### 2.2 어디에 선언되는가 — **프로필 레코드의 self-label**

`app.bsky.actor.profile` 의 `labels` 필드(`lexicons/app/bsky/actor/profile.json:42-46`):

```json
"labels": {
  "type": "union",
  "description": "Self-label values, specific to the Bluesky application, on the overall account.",
  "refs": ["com.atproto.label.defs#selfLabels"]
}
```

그리고 공식 SDK 는 프로필 레코드에 붙은 라벨 중 **`!no-unauthenticated` 만 계정 단위로 승격**한다
(`packages/api/src/moderation/subjects/account.ts:38-48`):

```ts
export function filterAccountLabels(labels?: Label[]): Label[] {
  return labels.filter(
    (label) =>
      !label.uri.endsWith('/app.bsky.actor.profile/self') ||
      label.val === '!no-unauthenticated',
  )
}
```

라벨러가 계정(`did:`) 에 직접 붙일 수도 있지만, Bluesky 앱의 "logged-out visibility" 토글이 쓰는
경로는 self-label 이다. 서드파티 구현체도 같은 이해다 — Ditto 의
[MR "Support Bluesky's !no-unauthenticated self-label"](https://gitlab.com/soapbox-pub/ditto/-/merge_requests/596/commits)
이 그 예다.

### 2.3 AppView 가 로그아웃 뷰어에게 숨겨야 하는 것

공식 정의 (`packages/api/definitions/labels.json:57-82`):

```json
{
  "identifier": "!no-unauthenticated",
  "configurable": false,
  "defaultSetting": "hide",
  "flags": ["no-override", "unauthed"],
  "severity": "none",
  "blurs": "content",
  "behaviors": {
    "account": { "profileList":"blur","profileView":"blur","avatar":"blur","banner":"blur",
                 "displayName":"blur","contentList":"blur","contentView":"blur" },
    "profile": { "avatar":"blur","banner":"blur","displayName":"blur" },
    "content": { "contentList":"blur","contentView":"blur" }
  }
}
```

`no-override` = 뷰어가 클릭해서 열 수 없음. `defaultSetting: hide` = 리스트에서 제거.
AppView 쪽 실제 게이트는 딱 한 줄이다 (`packages/bsky/src/views/index.ts:198-203`):

```ts
noUnauthenticatedPost(state: HydrationState, post: PostView): boolean {
  const isNoUnauthenticated = post.author.labels?.some((l) => l.val === '!no-unauthenticated')
  return !state.ctx?.viewer && !!isNoUnauthenticated
}
```

`!state.ctx?.viewer` — **로그인 세션이 없으면** 이다. 스레드에서는 삭제가 아니라
`noUnauthenticated` 전용 뷰로 치환해 부모 체인을 끊지 않는다(`views/index.ts:1497-1503`,
테스트는 `packages/bsky/tests/views/thread-v2.test.ts:1759-1850`).

우리 화면으로 번역하면: **로그아웃 상태에서는 그 DID 의 GIF 카드·프로필·검색 결과를 내보내지 않는다.**
로그인 상태에서는 아무 제약 없음.

### 2.4 무시하면 생태계에서 무엇으로 간주되는가

명세에 **제재 조항은 없다.** 문서가 일관되게 쓰는 표현은 "in applications which respect the label" 이다
— 즉 규범이지 강제가 아니다. 다만 사회적 비용은 문서화되어 있다:

- Bluesky 가 2023-12 공개 웹 인터페이스를 내놓았을 때 반발이 있었고, 그 대응으로 나온 것이 이 옵트아웃이다
  ([alternativeto 정리](https://alternativeto.net/news/2023/12/bluesky-postpones-public-interface-launch-amid-user-backlash-over-privacy-concerns)).
  즉 이 라벨은 **"공개 웹에 내 글을 띄우지 마라"** 라는 사용자 요구에 대한 답으로 태어났다.
- 서드파티가 자발적으로 준수하는 것이 지금의 규범이다 — 예: [ATProto Heatmap 개인정보처리방침](https://atproto-heatmap.netlify.app/privacy)
  ("If you have applied the `!no-unauthenticated` label to your Bluesky profile, our service will not
  collect or display your data").

**우리에게 이게 유독 뾰족한 이유**: `TAP_SIGNAL_COLLECTION` 자동 채택 때문에 jjalcloud 에 가입한 적 없는
사람의 레코드가 우리 공개 웹에 뜬다. 그 사람이 프로필에 `!no-unauthenticated` 를 켜 뒀다면, 우리는
"공개 웹에 뜨기 싫다" 는 명시적 의사표시를 정면으로 어기는 사이트가 된다. 이건 우리 사용자에 대한
문제가 아니라 **우리 사용자가 아닌 사람에 대한** 문제다.

> docs silent: `!no-unauthenticated` 를 무시하는 AppView 에 대한 릴레이 차단·디페더레이션 절차는
> 어디에도 문서화돼 있지 않다. (블록에 대해서는 디페더레이션이 언급된다 — §5)

---

## 3. self-label — 구조, 그리고 이미 발행한 렉시콘에 나중에 붙여도 되는가

### 3.1 구조

`lexicons/com/atproto/label/defs.json:54-75`:

```json
"selfLabels": {
  "type": "object",
  "description": "Metadata tags on an atproto record, published by the author within the record.",
  "required": ["values"],
  "properties": {
    "values": { "type": "array", "items": { "type": "ref", "ref": "#selfLabel" }, "maxLength": 10 }
  }
},
"selfLabel": {
  "type": "object",
  "required": ["val"],
  "properties": { "val": { "type": "string", "maxLength": 128 } }
}
```

레코드 쪽 선언은 항상 `union` 한 개짜리다(`app.bsky.feed.post`, `app.bsky.actor.profile`,
`app.bsky.graph.list`, `app.bsky.feed.generator`, `app.bsky.labeler.service`, `site.standard.document`
전부 동일 패턴):

```json
"labels": { "type": "union", "refs": ["com.atproto.label.defs#selfLabels"] }
```

[specs/label](https://atproto.com/specs/label) "Self-Labels in Records" 가 self-label 의 의미론을 정리한다:
출처는 리포 소유자, 서명은 커밋 서명이 대신하고, **negation/expiration 이 필요 없다 — 레코드를 수정·삭제하면 되기 때문.**
AppView 쪽 변환은 `packages/bsky/src/views/index.ts:849-888` 에서 `src = creatorFromUri(uri)`,
`cts = record.createdAt` 로 `Label` 객체를 합성한다.

### 3.2 호환성을 깨는가 — **깨지 않는다. 선택적으로 추가하는 한.**

명세 ([specs/lexicon](https://atproto.com/specs/lexicon) "Lexicon Evolution"):

> The basic principle is that all old data must still be valid under the updated Lexicon, and new
> data must be valid under the old Lexicon.
> - **Any new fields must be optional**
> - Non-optional fields can not be removed ... Types can not change ... Fields can not be renamed

그리고 같은 문서가 "발행됨" 의 기준을 정한다 — 우리는 이미 넘었다:

> At a minimum, **public adoption and implementation by a third party, even without explicit
> permission, indicates that the Lexicon has been released and should not break compatibility.**

말로만 두지 않고 **실제로 돌려서** 확인했다. `@atproto/lexicon@0.7.11` 로 우리 실제 `com.jjalcloud.feed.gif`
를 v1 로, 거기에 `app.bsky.feed.post` 와 동일한 형태의 선택적 `labels` 필드를 더한 것을 v2 로 두고 교차 검증:

```
$ node /tmp/moderation-lexcompat/compat.mjs
PASS  v1 record vs v1 lexicon  (baseline)
PASS  v1 record vs v2 lexicon  [already-published records still validate]
PASS  v2 record vs v1 lexicon  [old reader sees new field]
PASS  v2 record vs v2 lexicon
PASS  v2 record, non-global label value, vs v2 lexicon
FAIL  v1 record vs v2 lexicon with labels REQUIRED  [the breaking way]
      -> ValidationError: Record must have the property "labels"
```

(스크립트: `Lexicons.assertValidRecord('com.jjalcloud.feed.gif', record)` 를 6가지 조합으로 호출.
`file` 은 실제 `BlobRef` 인스턴스로 만들어야 통과한다 — JSON 리터럴은 `Record/file should be a blob ref` 로 떨어진다.)

**결론**: `required` 에 넣지만 않으면 이미 PDS 에 쌓인 `com.jjalcloud.feed.gif` 레코드는 전부 그대로 유효하고,
새 필드를 모르는 구버전 리더도 새 레코드를 통과시킨다. `com.jjalcloud.feed.gif` 에 붙일 수 있다.

두 가지 단서:

1. **검증기는 `val` 값을 검사하지 않는다** — 위 5번째 케이스에서 `jjalcloud-spicy` 같은 임의 문자열도
   통과했다. 하지만 [guides/labels](https://atproto.com/guides/labels) 는 self-label 로 쓸 수 있는 값을
   글로벌 라벨 값으로 제한한다. 실용적 선택지는 `porn` / `sexual` / `nudity` / `graphic-media` 4개.
   (GIF 서비스에는 `graphic-media` 와 `porn` 이 현실적으로 유효하다.)
2. 렉시콘을 `com.atproto.lexicon.schema` 레코드로 발행할 계획이 있다면([specs/lexicon](https://atproto.com/specs/lexicon)
   "Lexicon Publication and Resolution"), 그 레코드도 같이 갱신해야 한다. 지금 우리는 발행하지 않고 있다.
   → docs silent: 발행하지 않은 렉시콘의 개정 통지 방법에 대한 규정은 없다.

---

## 4. 외부 라벨러 — 실제 메커니즘, 최소 비용, 안 하면 생기는 일

### 4.1 메커니즘

라벨러는 DID 문서에 `#atproto_labeler` 서비스 엔드포인트와 `#atproto_label` 서명 키를 갖는다
([specs/label](https://atproto.com/specs/label) "Labeler Service Identity"). 배포 창구는 두 개:

- `com.atproto.label.queryLabels` — HTTP GET. `uriPatterns`(prefix `*` 지원), `sources`, `limit`(max 250), `cursor`.
- `com.atproto.label.subscribeLabels` — WebSocket. `seq` 백필, `cursor=0` 부터 전체 이력 가능.

클라이언트가 어느 라벨러를 원하는지는 `atproto-accept-labelers` 요청 헤더로 전달되고 AppView 는
`atproto-content-labelers` 로 응답한다. 공식 AppView 의 파싱은 딱 이 정도다
(`packages/bsky/src/context.ts:136-146`):

```ts
reqLabelers(req) {
  const val = req.header('atproto-accept-labelers')
  let parsed
  try { parsed = parseLabelerHeader(val) } catch (err) { parsed = null; log.info(...) }
  if (!parsed) return defaultLabelerHeader(this.cfg.labelsFromIssuerDids)
  return parsed
}
```

헤더의 유일한 파라미터는 `redact` 이고, 이게 켜지면 `!takedown` / `!suspend` 라벨이 붙은 대상은
라벨링이 아니라 **응답에서 완전히 제거**된다. 공식 구현의 목록은 `packages/bsky/src/hydration/label.ts:211`:

```ts
const TAKEDOWN_LABELS = ['!takedown', '!suspend']
```

그리고 이 플래그는 §1.3 의 `actorIsTakendown` 과 **같은 스위치**로 합류한다
(`views/index.ts:194` — `if (state.labels?.get(did)?.isTakendown) return true`).

### 4.2 최소 구현 비용 — HTTP GET 한 번 (실측)

```
$ curl -s https://plc.directory/did:plc:ar7c4by46qjdydhdevvrndac | jq -c '{service}'
{"service":[{"id":"#atproto_pds","type":"AtprotoPersonalDataServer","serviceEndpoint":"https://inkcap.us-east.host.bsky.network"},
            {"id":"#atproto_labeler","type":"AtprotoLabeler","serviceEndpoint":"https://mod.bsky.app"}]}

$ curl -s -o /dev/null -w "HTTP %{http_code} in %{time_total}s\n" \
    "https://mod.bsky.app/xrpc/com.atproto.label.queryLabels?uriPatterns=did:plc:ar7c4by46qjdydhdevvrndac&limit=3"
HTTP 200 in 0.634649s
```

인증 없이 200 이고, 실제 라벨이 서명까지 붙어서 나온다:

```
$ curl -s "https://mod.bsky.app/xrpc/com.atproto.label.queryLabels?uriPatterns=*&limit=250" \
  | jq -r '[.labels[]|select(.uri|startswith("did:"))] | "account-level labels in this page: \(length)",
           (.[0:5][] | "\(.uri) \(.val)")'
account-level labels in this page: 13
did:plc:kiv77uebdfmku3osuguz44p6 needs-review
did:plc:alrt7x55d5rvkdtga2uoeb7l !takedown
did:plc:k3sq5bkjdqx5rov46yikyvan !takedown
did:plc:gvgpj7d65m2fhomwnkebrfcs !takedown
did:plc:daq4rhqmlwul3ihytito435b !takedown
```

**따라서 최소 구현은 "라벨러 1개, `queryLabels` 로 DID 목록 조회, `!takedown` 인 DID 숨김" 이다.**
WebSocket 소비도, 서명 검증도, 헤더 파싱도, 라벨 테이블도 필요 없다.
서명 검증에 대해 명세는 "Signatures **should** be validated when labels are transferred between
services" 라고 쓰지만, 같은 문서가 "It is acceptable for labeler services ... to not implement these
endpoints at all" 이라고 인정할 만큼 느슨하다.

### 4.3 라벨을 하나도 안 붙이면 실제로 무슨 일이 생기는가

**중요한 사실 하나**: 위 페이지의 라벨들은 전부 `app.bsky.feed.post` URI 아니면 `did:` 다.
Bluesky 의 moderation 서비스는 **우리 `com.jjalcloud.feed.gif` 레코드에 라벨을 붙이지 않는다.**
따라서 외부 라벨러 구독이 우리에게 주는 것은 **콘텐츠 단위 라벨이 아니라 계정 단위 신호**뿐이다
— 스팸/CSAM 으로 네트워크 차원에서 `!takedown` 된 DID 를 우리도 같이 가리는 것. [INFERENCE]
(라벨은 사람이 신고를 검토해서 붙는 것이고, 아무도 jjalcloud 의 GIF 를 Bluesky 모더레이션에 신고하지 않는다.)

문서화된 결과는 다음뿐이다:

- 명세는 벌칙을 규정하지 않는다. `!takedown` 라벨을 무시하는 AppView 에 대한 제재 절차는 **docs silent.**
- 유일하게 문서화된 강제 수단은 디페더레이션이고, 그것도 블록 문맥에서 언급된다:
  "Both ActivityPub and AT Protocol can use de-federation as an enforcement mechanism to disconnect
  from servers that don't respect blocks." ([Bluesky, block implementation](https://bsky.network/blog/block-implementation/))
- 실제 사례로 인용할 만한 "라벨 미적용 AppView 가 겪은 문제" 기록은 찾지 못했다. **docs silent.**

실질적 위험은 프로토콜이 아니라 우리 쪽에 있다: 자동 채택 모델이라 우리가 모르는 사람의 GIF 가 우리
도메인에 뜬다. 라벨을 안 붙이면 그 필터가 0개가 되고, **최초 대응 수단이 "운영자가 손으로 지우기" 하나뿐**이 된다.
그래서 §7 의 두 레퍼런스가 모두 외부 라벨러 대신 **자체 숨김 스위치**를 먼저 만들었다.

---

## 5. 블록/뮤트 — 우리 NSID 공간의 AppView 가 `app.bsky.graph.block` 을 존중해야 하는가

### 5.1 실제 답: **의무 아님, 관례도 아님.**

세 갈래 근거가 같은 방향을 가리킨다.

**(a) 블록은 명시적으로 `app.bsky` 애플리케이션 계층이다.**
[Bluesky, "How blocks work"](https://bsky.network/blog/block-implementation/):

> Blocks in Bluesky are implemented as part of the `app.bsky.*` application protocol, which builds on
> top of the underlying AT Protocol (atproto).

같은 글이 강제 주체도 `app.bsky` 생태계로 한정한다: "The expectation is that virtually all accounts
will be using clients and servers that respect blocking behavior." — 여기서 "accounts" 는 Bluesky 앱
사용자다. 렉시콘 자체의 설명도 앱 특정적이다(`lexicons/app/bsky/graph/block.json`):
"NOTE: blocks are public **in Bluesky**".

**(b) 프로토콜은 렉시콘 재사용을 "기대" 하되 "요구" 하지 않는다.**
[specs/atp](https://atproto.com/specs/atp):

> It is expected that competing developers will reuse Lexicon schemas and public data records across
> organizational boundaries. ... They can extend with new data types by publishing Lexicon schemas
> **under their own namespace.**

그리고 [specs/lexicon](https://atproto.com/specs/lexicon) "Authority and Control" 은 렉시콘의 권위가
NSID 소유자에게 있다고 못박는다. 즉 `app.bsky.graph.block` 의 **의미론을 정의할 권한은 Bluesky 에 있고,
그 의미론을 우리 앱에 적용할 의무는 우리에게 없다.**

**(c) 실제 레퍼런스 AppView 들이 하지 않는다.** (grep 결과, 0건)

```
$ cd /tmp/moderation-tangled && grep -rn "app.bsky.graph.block\|no-unauthenticated\|queryLabels\|subscribeLabels\|atproto-accept-labelers" --include=*.go --include=*.json --include=*.ts .
(no output)

$ cd /tmp/moderation-frontpage && grep -rn "app.bsky.graph.block\|graph.block\|blocked" --include=*.ts --include=*.tsx .
(no output)
$ cd /tmp/moderation-frontpage && grep -rn "labeler\|queryLabels\|subscribeLabels\|com.atproto.label" --include=*.ts --include=*.tsx .
(no output)
```

tangled 는 자체 `tangled.sh` 그래프(`GraphFollowNSID`, `GraphVouchNSID`)를 갖고,
frontpage 는 팔로우 그래프 자체가 없다. **자체 NSID 공간을 쓰는 AppView 가 자체 그래프를 갖는 것이 실제 관례다.**
우리는 이미 `com.jjalcloud.graph.follow` 를 발행해 놨다.

### 5.2 뮤트는 애초에 레코드가 아니다

`app.bsky.graph` 에 `mute.json` 레코드는 없다. `muteActor` / `muteActorList` / `muteThread` 는
**procedure** 이고 상태는 AppView 내부에 산다(`packages/bsky/src/data-plane/server/routes/mutes.ts`).
즉 뮤트는 리포에 안 실리고 firehose 로 흐르지 않으므로, **다른 AppView 가 존중하고 싶어도 볼 수 없다.**
블로그도 같은 구분을 한다: "'Mute' behavior can be implemented entirely in a client app because it
only impacts the view of the local account holder. Blocks require coordination."

### 5.3 그래서 우리는

`app.bsky.graph.block` 을 존중하는 것은 **선택**이다. 다만 두 가지를 구분해 둘 가치가 있다:

- **우리 UI 안에서의 상호작용 차단** (A 가 B 를 차단 → B 의 GIF 를 A 에게 안 보임) — 이건 우리 그래프의
  문제이고, 존중 여부와 무관하게 우리가 만들지 말지 정하는 기능이다.
- **`app.bsky.graph.block` 을 읽어서 그 관계를 우리 UI 에 적용** — 값싸긴 하다(레코드 하나 인덱싱).
  하지만 사용자는 "Bluesky 에서 차단한 사람이 jjalcloud 에서도 차단된다" 를 기대하지 않을 수 있고,
  반대로 `com.jjalcloud.graph.follow` 를 쓰면서 블록만 Bluesky 것을 빌리면 그래프가 두 권위로 쪼개진다.

> 사람에게 넘기는 질문: 이건 프로토콜 질문이 아니라 제품 질문이다. **§"What this decides" 참조.**

---

## 6. 테이크다운 전파 — firehose 에 무엇이 흐르고 tap 이 무엇을 주는가

### 6.1 PDS 가 **레코드**를 내리면 — firehose 에 아무것도 흐르지 않는다

`com.atproto.admin.updateSubjectStatus` 의 레코드 분기
(`packages/pds/src/api/com/atproto/admin/updateSubjectStatus.ts:23-27`)는
`store.record.updateRecordTakedownStatus(uri, takedown)` 을 부르고, 그 구현은
(`packages/pds/src/actor-store/record/transactor.ts:98-110`) 로컬 `record` 테이블의 `takedownRef`
컬럼 하나를 UPDATE 할 뿐이다. **시퀀서 호출이 없다.** PDS 시퀀서가 만들 수 있는 이벤트는
`formatSeqCommit` / `formatSeqSyncEvt` / `formatSeqIdentityEvt` / `formatSeqAccountEvt` 네 개뿐이고
(`packages/pds/src/sequencer/events.ts:17,47,82,98`), 레코드 테이크다운은 그중 어느 것도 만들지 않는다.

결과: 레코드는 `com.atproto.repo.getRecord` 에서 사라지지만
(`packages/pds/src/api/com/atproto/repo/getRecord.ts:18` — `if (!record || record.takedownRef !== null)`),
**리포 MST 에는 그대로 남고 firehose 에는 침묵이 흐른다.**
→ **우리 인덱스는 PDS 레코드 테이크다운을 원리적으로 알 수 없다.** 이건 우리 구현의 결함이 아니라 프로토콜의 현재 모양이다.
(실제로 콘텐츠를 네트워크에서 지우려면 계정 소유자가 `deleteRecord` 하거나, 서비스가 계정 단위로 내리거나,
라벨러가 `!takedown` 라벨을 붙여야 한다.)

### 6.2 PDS 가 **계정**을 내리면 — `#account` 이벤트

`active=false` + `status` 로 흐른다(§1.1). 명세는 이게 hop-by-hop 이라고 명시한다:
"a Relay takedown would emit a takedown with active=false, even if the PDS is still active"
(`lexicons/com/atproto/sync/subscribeRepos.json:154-160`).

### 6.3 tap 이 그것을 무엇으로 전달하는가 — **`identity` 이벤트 하나. 레코드 delete 는 없다.**

`cmd/tap/firehose.go:294-357` (`ProcessAccount`):

```go
var updateTo models.AccountStatus
if evt.Active {
    updateTo = models.AccountStatusActive
} else if evt.Status != nil && (*evt.Status == "deactivated" || ... == "takendown" || ... == "suspended" || ... == "deleted") {
    updateTo = models.AccountStatus(*evt.Status)
} else {
    // no-op for other events such as throttled or desynchronized
    firehoseEventsSkipped.Inc(); return nil
}
if curr.Status == updateTo { firehoseEventsSkipped.Inc(); return nil }   // 중복 제거

identityEvt := &IdentityEvt{ Did: curr.Did, Handle: curr.Handle, IsActive: evt.Active, Status: updateTo }

if updateTo == models.AccountStatusDeleted {
    fp.events.AddIdentityEvent(ctx, identityEvt, func(tx *gorm.DB) error { return deleteRepo(tx, evt.Did) })
} else {
    fp.events.AddIdentityEvent(ctx, identityEvt, func(tx *gorm.DB) error {
        return tx.Model(&models.Repo{}).Where("did = ?", evt.Did).Update("status", updateTo).Error })
}
```

즉 tap 은 `#account` 를 **`account` 가 아니라 `identity` 타입으로** 내보낸다.
`@atproto/tap` 클라이언트 타입이 그대로 확인해 준다 (`packages/tap/src/types.ts:15-26, 57-66`):

```ts
export const identityEventDataSchema = l.object({
  did: l.string({ format: 'did' }),
  handle: l.string({ format: 'handle' }),
  is_active: l.boolean(),
  status: l.enum(['active', 'takendown', 'suspended', 'deactivated', 'deleted']),
})

export type RepoStatus = 'active' | 'takendown' | 'suspended' | 'deactivated' | 'deleted'
```

여기서 나오는 결론 다섯 개 — **전부 우리 어댑터 설계에 직접 꽂힌다**:

1. **이벤트 유니온에 `identity` 가 필요하다.** `record` 만으로는 표현 불가.
   `@atproto/tap` 의 권장 형태도 `indexer.identity(async (evt) => ...)` 다 (`packages/tap/README.md:23,101,145`).
2. **`identity` 는 두 가지를 겸한다** — 핸들 변경(`cmd/tap/repo_manager.go:47-80`, 핸들이 실제로 달라진 경우에만)
   과 계정 상태 변경. 어느 쪽인지는 이벤트만 보고 알 수 없고 **우리가 저장된 값과 diff 해야 한다.**
3. **레코드 삭제 이벤트는 오지 않는다.** `deleted` 라도 tap 은 자기 DB 만 청소한다
   (`cmd/tap/db_helpers.go:8-16` — `RepoRecord`/`ResyncBuffer`/`Repo` 삭제). 우리 인덱스 팬아웃은 우리 몫이다.
4. **tap 은 배달을 상태로 막지 않는다.** `Status`(계정)와 `State`(동기화)는 다른 컬럼이고
   (`cmd/tap/models/models.go:28-29`), 커밋 처리 게이트는 `State` 만 본다(`firehose.go:97`).
   → 계정 상태 반영은 **100% AppView 책임**이다.
5. **`throttled` / `desynchronized` 는 통째로 버려진다** (위 `else` 분기). 우리가 못 받는 게 정상이다.

### 6.4 우리 Index 가 이걸 놓치면 무슨 일이 생기는가

- **탈퇴/비활성화한 사람의 GIF 가 영구히 우리 사이트에 남는다.** PDS 에서는 사라졌는데 우리만 계속 서빙한다.
  명세가 금지하는 정확히 그 상태다("services should not redistribute content ... transformed records
  ('views', embeds, etc)"). 자동 채택 모델이라 **jjalcloud 계정조차 없는 사람이 우리에게 삭제를 요청할 방법이 없다.**
- **테이크다운된 계정의 콘텐츠가 걸러지지 않는다.** 네트워크가 스팸/CSAM 판정을 내려 계정을 내려도 우리는 계속 노출한다.
- **좋아요/집계가 유령 계정으로 부풀려진다.** 좋아요 수, 검색 결과, 태그 카운트에 사라진 계정이 남는다.
- **핸들 변경을 놓친다.** `identity` 를 안 받으면 캐시된 핸들이 영구히 낡는다.
  (지금 인덱서는 이걸 전부 놓친다 — `apps/indexer/src/jetstream.ts:231-233`, `// Only forward commit events to handler`.)

### 6.5 그리고 이것이 "삭제 vs 숨김" 을 기계적으로 결정한다

`deactivated` → `active` 로 되돌아왔을 때 **tap 은 레코드를 재전송하지 않는다.**
`ProcessAccount` 는 `Repo.status` 컬럼만 갱신할 뿐이고, 재동기화(`RepoStateDesynchronized`) 를 트리거하지 않는다.
따라서 우리가 `deactivated` 에서 행을 지워 버렸다면 **되돌릴 경로가 없다** — 그 사람이 새 GIF 를 올리기 전까지는.

`deleted` 는 그나마 낫다: tap 이 리포 자체를 잊었으므로, 그 DID 가 우리 signal collection 에 다시 쓰면
`EnsureRepo` 로 재채택되고(`cmd/tap/firehose.go:85-91`) 리싱크 워커가 전체 백필을 다시 태운다.
그래도 **"새 레코드를 하나 쓸 때까지" 는 아무것도 돌아오지 않는다.**

→ **`deactivated`/`suspended`/`takendown` 은 반드시 숨김. `deleted` 만 삭제해도 되지만, 그것조차
공식 AppView 는 리포 부재를 확인한 뒤에 한다(§1.3).**

---

## 7. 레퍼런스 구현이 실제로 어디까지 하는가

| | bsky (공식) | tangled | frontpage | jjalcloud (현재) |
|---|---|---|---|---|
| `#account` 소비 | ✅ `upstreamStatus` 컬럼 + 뷰 게이트 | ⚠️ `case EventKindAccount:` 안에 `// TODO: sync account state to db`; `deactivated` 일 때 identity 캐시만 무효화 (`appview/ingester.go:67-75`) | ❌ Jetstream `Commit` 만 처리 (`apps/drainpipe/src/main.rs:98`) | ❌ `// Only forward commit events to handler` (`apps/indexer/src/jetstream.ts:231-233`) |
| `#identity` 소비 | ✅ | ✅ 캐시 무효화 (`ingester.go:76-77`) | ❌ | ❌ |
| 외부 라벨러 | ✅ `atproto-accept-labelers` + `redact` | ❌ 0건 | ❌ 0건 | ❌ |
| `!no-unauthenticated` | ✅ `views/index.ts:198` | ❌ 0건 | ❌ 0건 | ❌ |
| `app.bsky.graph.block` | ✅ (자기 렉시콘이므로) | ❌ 자체 그래프 | ❌ 그래프 없음 | ❌ |
| 자체 모더레이션 | Ozone (별 서비스) | 슬러 필터(서브도메인 이름 한정, `appview/state/userutil/moderation.go`) | ✅ 신고 테이블 + `moderation_events` + 레코드별 `status: live/deleted/moderator_hidden/pending` + `labelled_profiles.is_hidden` + `/moderation` 관리 페이지 (`apps/frontpage/lib/schema.ts:55-57,276-310`) | ❌ 전무 |
| 신고 창구 | `com.atproto.moderation.createReport` | — | ✅ 자체 `reports` 테이블 (`schema.ts:311-325`) | ❌ |

**읽어낼 것 두 가지.**

1. **소규모 AppView 는 외부 라벨러를 쓰지 않는다. 자체 숨김 스위치를 먼저 만든다.**
   frontpage 의 선택은 `moderator_hidden` 이라는 레코드 상태값 하나 + 신고 테이블 + 관리 페이지다.
   외부 라벨 인프라 없이도 "이거 내려주세요 → 내림" 이 성립한다.
2. **tangled 는 우리와 같은 아키텍처(tap + 자체 NSID)인데도 계정 상태를 아직 반영하지 않는다.**
   `// TODO: sync account state to db` 가 그대로 남아 있다. tangled 도 tap 클라이언트를 자체 구현했고
   (`tapc/types.go:47-62`, `RepoStatus` 5값 그대로), `spindle/tap_drain.go:142-143` 에서
   `RepoIdentity`/`RepoAccount` 콜백을 seq 캡처용으로만 쓴다.
   → **"다들 안 하니까 괜찮다" 가 아니라 "이건 아직 아무도 안 푼 숙제이고, 우리가 자동 채택 때문에 더 노출돼 있다" 로 읽어야 한다.**

---

## What this decides / does not decide

### 결정되는 것

- **[#17 모더레이션 최소 표면](https://github.com/huketo/jjalcloud/issues/17)** — 최소 표면의 하한선이 확정된다.
  "라벨/블록/라벨러 중 무엇을 먼저" 가 아니라 **계정 상태 반영이 유일한 의무이고 나머지는 전부 선택**이다.
  #17 은 이제 "무엇을 미룰지" 가 아니라 "숨김 스위치를 어디에 두고, 누가 그걸 누르는가" 를 정하면 된다.
- **[#2 인제스트 seam / tap 어댑터](https://github.com/huketo/jjalcloud/issues/2) (ADR-0005)** — Ingest event 유니온이
  `record` 만으로는 부족하다는 것이 소스로 확정됐다. `identity { did, handle, isActive, status }` 변형이 필요하고,
  그 핸들러는 (a) 핸들 변경과 (b) 계정 상태 변경을 **저장값과의 diff 로 구분**해야 한다.
  `apply(event, tx)` 하나라는 인터페이스는 유지된다 — 상태 반영도 한 트랜잭션 안의 UPDATE 다.
- **스키마** — `actor`(혹은 `users`) 에 `upstream_status` nullable 컬럼 1개. 모든 읽기 경로에 `IS NULL` 조건.
  이건 [#3 피드 커서](https://github.com/huketo/jjalcloud/issues/3) 의 `seq` 쿼리에도 조건이 하나 붙는다는 뜻이다.
- **컷오버 백필** — 백필로 `gifs`/`likes` 를 재구축할 때 계정 상태를 함께 받지 못한다.
  tap 의 `EnsureRepo` 는 `Status: AccountStatusActive` 를 하드코딩하고 채택 시점에 identity 이벤트를 내지 않는다
  (`cmd/tap/repo_manager.go:90-100`). → 백필된 리포는 전부 `active` 로 시작한다. [INFERENCE] 이미 takendown 인
  계정은 PDS 가 `getRepo` 를 거부하므로 백필이 실패하고 리포가 error/desync 로 빠질 가능성이 높다.
- **렉시콘** — `com.jjalcloud.feed.gif` 에 선택적 `labels` 필드를 나중에 붙여도 호환성이 깨지지 않는다(§3 실측).
  이건 "지금 붙일지" 와 무관하게 **미루는 것이 안전하다는 사실**을 확정한다.
- **알려진 결함 목록에서 하나 승격** — "`identity`/`account` 이벤트 드롭" 은 편의 기능 누락이 아니라
  **명세 위반**이다(`apps/indexer/src/jetstream.ts:231-233`).

### 결정되지 않는 것 / 사람에게 넘기는 질문

1. **`!no-unauthenticated` 를 지킬 것인가.** 비용은 로그아웃 SSR 경로에 필터 하나 + 프로필 레코드의
   self-label 을 읽는 것(우리는 어차피 프로필 하이드레이션을 고쳐야 한다 — 지금 `public.api.bsky.app` 하드코딩).
   지키지 않는 것에 대한 프로토콜 제재는 없다. **하지만 자동 채택 때문에 "가입한 적 없는 사람의 명시적 옵트아웃을
   무시하는 사이트" 가 된다.** 이건 기술 판단이 아니라 이 프로젝트가 어떤 사이트이고 싶은지의 판단이다.
2. **`app.bsky.graph.block` 을 읽을 것인가.** 프로토콜상 의무 아님, 관례도 아님(§5). 읽으면 그래프 권위가
   `com.jjalcloud.graph.follow` 와 `app.bsky.graph.block` 두 곳으로 갈린다. 이건
   ["팔로우 그래프의 운명"](https://github.com/huketo/jjalcloud/issues/1) 미결 항목과 같은 질문의 다른 얼굴이다.
   → **두 질문을 따로 답하면 일관성이 깨진다. 같이 답해야 한다.**
3. **신고 창구를 `com.atproto.moderation.createReport` 로 낼 것인가, 사내 폼으로 할 것인가.**
   전자는 프로토콜 표준이고 우리가 AppView 로서 낼 수 있는 `com.atproto.*` 엔드포인트다.
   후자는 frontpage 의 선택이다. 이건 [AppView XRPC 표면](https://github.com/huketo/jjalcloud/issues/1) 질문에 붙는다.
4. **누가 숨김 버튼을 누르는가.** 1인 운영이라면 관리자 계정 하나 + 관리 페이지면 끝난다.
   이건 프로토콜이 답하지 않는다.

### 안 하는 것을 변호할 가치가 없을 만큼 싼 항목

이 세 개는 **"미룬다" 는 결정을 방어하는 데 드는 시간이 그냥 구현하는 시간보다 길다.**

- **계정 상태 반영** — `identity` 이벤트 핸들러 하나 + nullable 컬럼 하나 + 읽기 쿼리에 조건 하나.
  이건 어차피 tap 어댑터를 쓰면서 반드시 지나가는 코드 경로이고(#2 가 이미 열려 있다),
  유일하게 프로토콜이 요구하는 항목이다.
- **자체 숨김 스위치** — GIF 행에 `hidden_at`(또는 `status`) 하나. 라벨러도, 신고 워크플로도, 관리 UI 도 없이
  DB 한 줄 UPDATE 로 시작할 수 있다. 이게 없으면 문제가 생겼을 때 **선택지가 배포뿐**이다.
  frontpage 가 이걸 컬럼 하나로 해결했다(`status: "moderator_hidden"`).
- **외부 라벨러 1곳의 계정 단위 `!takedown`** — HTTP GET 한 번(§4.2 실측 0.63초, 인증 없음).
  구독도 서명 검증도 필요 없다. 얻는 것은 "네트워크가 스팸/CSAM 으로 내린 계정" 필터이고,
  우리가 모르는 사람의 콘텐츠를 자동으로 받는 구조에서 이건 값이 크다.

반대로 **`subscribeLabels` WebSocket 소비, 라벨 서명 검증, `atproto-accept-labelers` 헤더 파싱,
자체 라벨러(Ozone) 운영, 뮤트** 는 지금 스코프에서 명확히 비싸고, 미루는 결정을 방어할 가치가 있다.

---

## 조사한 소스 (재현용)

| 소스 | 고정 커밋 / 방법 |
|---|---|
| `bluesky-social/atproto` | `ea95a97c620ba062b6c2ad531a202ece61316e89` (2026-08-26) |
| `bluesky-social/indigo` (`cmd/tap`) | `4b983a7e86c859af7b44f5f9fc8eda5d0e62b3ce` (2026-08-19) |
| `likeandscribe/frontpage` | `f23106d0848c90fb7fa741cfebf1f8680f09b874` (2026-07-25) |
| `tangled.org/core` | `838c81a58e1b362c28c59d4db221fe47da8424cf` (2026-08-26) |
| 명세 | atproto.com `/specs/account`, `/specs/sync`, `/specs/label`, `/specs/lexicon`, `/specs/atp`, `/guides/labels`, `/guides/subscriptions`, `/guides/moderation` |
| 라이브 호출 | `plc.directory`, `mod.bsky.app/xrpc/com.atproto.label.queryLabels` (2026-08-26, 인증 없음) |
| 렉시콘 호환성 실험 | `@atproto/lexicon@0.7.11`, `Lexicons.assertValidRecord` 6조합 (§3.2) |

레포 파일 경로는 위 커밋 기준이다. 인용부호 안의 영문은 원문 그대로이며, 표시 없는 판단은 소스에서 직접 읽은 것,
`[INFERENCE]` 표시는 소스가 침묵하는 곳에서의 추론, `docs silent` 는 명세·문서가 답하지 않는 지점이다.
