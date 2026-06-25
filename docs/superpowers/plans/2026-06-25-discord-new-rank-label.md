# Discord 신규 기록 순위 표시 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 전체 도전장 로그에서 신규 기록의 이전 순위를 숫자 대신 `신규`로 표시한다.

**Architecture:** 기존 랭킹 이벤트 데이터는 그대로 유지하고 Discord 메시지 포맷 단계에서 `previousDxScore === null` 여부만 판별한다. 기존 기록의 숫자 순위 표시와 개인 채널 메시지는 변경하지 않는다.

**Tech Stack:** TypeScript, Vitest

---

### Task 1: 신규 기록 메시지 형식

**Files:**
- Modify: `src/lib/discord/messages.test.ts`
- Modify: `src/lib/discord/messages.ts`

- [ ] **Step 1: Write the failing test**

`buildChannelRankUpMessages`에 `previousDxScore: null`, `previousRank: 16`,
`nextRank: 5` 이벤트를 전달하고 다음 내용을 검증한다.

```ts
expect(message).toContain("순위: 신규 -> #5");
expect(message).not.toContain("순위: #16 -> #5");
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/lib/discord/messages.test.ts
```

Expected: 기존 구현이 `순위: #16 -> #5`를 출력하므로 FAIL.

- [ ] **Step 3: Write minimal implementation**

`ChannelRankUpEvent`가 `previousDxScore`를 포함하도록 하고 전체 채널 메시지의
이전 순위 라벨을 다음 규칙으로 계산한다.

```ts
const previousRank =
  event.previousDxScore === null
    ? "신규"
    : event.previousRank === null
      ? "-"
      : `#${event.previousRank}`;
```

`src/lib/ingest/service.ts`에서 이미 전달 가능한 `previousDxScore`도 채널 이벤트
매핑에 포함한다.

- [ ] **Step 4: Run focused tests**

Run:

```bash
npm test -- src/lib/discord/messages.test.ts src/lib/ingest/bulk-ranking.test.ts
```

Expected: 모든 테스트 PASS.

- [ ] **Step 5: Run full verification**

Run:

```bash
npm test
npm run build
```

Expected: 전체 테스트와 Next.js 프로덕션 빌드 PASS.
