# 메모아 🐱

토플 단어·문장을 간격 반복(FSRS)으로 외우는 웹 앱. 고양이 '모아'와 함께 단어를 모아모아.

- **Svelte 5 + Vite** 정적 SPA (서버 런타임 없음)
- **Supabase**: 로그인, Postgres(RLS), Edge Function(AI)
- **ts-fsrs** (FSRS-7) 복습 스케줄링
- **Claude API**: 단어 → 뜻/동의어/반의어/예문 자동 생성, 사진에서 단어 추출

## 문제 유형

| 유형 | 방식 |
|---|---|
| 🍙 뜻 맞히기 / 📖 영영 뜻 | 카드 뒤집기 |
| ✍️ 단어 떠올리기 | 뜻 보고 입력 |
| 🔁 동의어 (토플형) | 예문 속 단어 "closest in meaning to" 4지선다 |
| 🙃 반의어 | 4지선다 (동의어가 함정 보기로 섞임) |
| 🧩 예문 빈칸 | 활용형까지 입력 |
| 🎧 듣고 쓰기 | 브라우저 TTS |
| 💬 문장 해석 / 📝 문장 영작 | 카드 뒤집기 |

- 같은 단어의 다른 유형은 같은 날 안 나옴
- '뜻 맞히기'를 한 번 졸업해야 나머지 유형이 열림
- 자동 채점은 *추천*만 하고 최종 평가는 직접 (Enter = 추천대로)

단축키: `Space` 정답 보기 · `1~4` 보기 선택/평가 · `Enter` 추천 평가 · `Ctrl+Z` 되돌리기

## 개발

```bash
npm install
cp .env.example .env.local   # Supabase URL / anon key
npm run dev
npm test        # 핵심 로직 테스트
npm run check   # 타입 검사
```

## Supabase 세팅 (최초 1회)

```bash
supabase login
supabase link --project-ref cslrrflgovmyvfartanc
supabase db push                                   # 스키마/RLS 적용
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...  # 키는 여기에만!
supabase secrets set ALLOWED_ORIGINS=http://localhost:5173,https://<배포주소>
supabase functions deploy enrich
```

선택 secrets:
- `CLAUDE_MODEL` (기본 `claude-opus-5-5`, 저렴하게 쓰려면 `claude-haiku-5-5`)
- `AI_DAILY_LIMIT` (기본 40) / `AI_ADMIN_DAILY_LIMIT` (기본 300): 하루 AI 처리 단어 수

대시보드 설정:
- Authentication → Sign In / Providers → Email: 메일 인증을 끄면 가입 후 바로 로그인 (기본 메일 발송은 시간당 횟수 제한이 있음)
- Authentication → URL Configuration: Site URL을 배포 주소로

## 가입 / 초대

- **첫 가입자 = 관리자** (초대 코드 없이 가입)
- 이후 가입은 관리자가 `내 정보 → 친구 초대`에서 만든 코드 필요 (14일, 1회용)

## 보안 메모

- 모든 테이블 RLS: 본인 행만 접근. `is_admin`은 클라이언트에서 수정 불가
- AI 키는 Edge Function secrets에만 존재. 함수는 JWT 확인 + 사용자별 하루 한도
- AI 결과는 `word_cache`에 공용 캐시 (같은 단어는 재호출 없음, 사진 결과는 캐시 안 함)
- 카드 내용은 전부 텍스트로 렌더링 (`{@html}` 미사용) + CSP
