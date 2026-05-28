# maimai Challenge

maimaiDX International 공식 홈페이지 기록을 고정 북마클릿으로 수집해 Supabase에 저장하고, 곡/난이도별 DX score 랭킹을 보여주는 Next.js 앱입니다.

## 주요 기능

- Discord OAuth 로그인
- 모든 사용자가 같은 고정 북마클릿 사용
- `/ingest/relay` 팝업을 통한 로그인 세션 기반 업로드
- `diff=0..4`를 `BASIC`, `ADVANCED`, `EXPERT`, `MASTER`, `Re:MASTER`로 저장/표시
- 곡 리스트 페이지네이션, 난이도 필터, 최근 변동순 정렬
- 곡별 DX score 랭킹 테이블
- 랭킹 하락 사용자 개인 Discord 채널 알림, 서버 채널 변동 로그
- Discord 명령어로 최근 역전 기록 중 랜덤 갱신 목표 3개 추천

## 설정

1. Supabase 프로젝트에서 Discord OAuth provider를 활성화합니다.
2. `supabase/migrations/001_initial_schema.sql`을 Supabase SQL editor 또는 CLI로 적용합니다.
3. `.env.example`을 참고해 Vercel 또는 로컬 `.env.local`에 값을 설정합니다.
4. Discord Developer Portal에서 Bot을 만들고 서버에 초대한 뒤 `DISCORD_BOT_TOKEN`, `DISCORD_LOG_CHANNEL_ID`, `DISCORD_GUILD_ID`, `DISCORD_PUBLIC_KEY`를 설정합니다. 로그 채널에서는 봇에게 `View Channel`과 `Send Messages` 권한이 필요합니다. 개인 채널 자동 생성을 쓰려면 봇에게 `Manage Channels` 권한이 필요합니다. 개인 채널을 특정 카테고리 아래에 만들고 싶다면 `DISCORD_PERSONAL_CHANNEL_CATEGORY_ID`를 설정합니다. Discord 응답이 `403 / 50001 Missing Access`이면 채널 ID가 잘못되었거나 봇이 해당 채널을 볼 수 없는 상태입니다.
5. Discord Interactions Endpoint URL은 `https://<배포도메인>/api/discord/interactions`로 설정합니다. `/goals` 또는 `/목표` 명령어를 등록하면 최근 역전 기록 중 랜덤 3개 갱신 목표를 응답합니다.

## 개발

```bash
npm install
npm run dev
```

## 검증

```bash
npm run test
npm run lint
npm run build
```

## 북마클릿 흐름

대시보드에서 `maimai 갱신` 링크를 북마크바로 드래그합니다. maimaiDX International 공식 홈페이지에서 실행하면 북마클릿이 `playerData`와 5개 난이도 점수 페이지 HTML을 수집한 뒤, 우리 서비스의 릴레이 팝업으로 전달합니다. 릴레이 팝업은 Discord 로그인 세션으로 `/api/ingest/maimai`에 업로드합니다.
