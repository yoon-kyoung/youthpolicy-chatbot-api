# youthpolicy-chatbot-api

[청년ON](https://github.com/yoon-kyoung/youthpolicy_contest) AI 챗봇의 백엔드. Vercel Serverless Functions + Upstage Solar API(직접 호출, OpenRouter 미경유)로 동작한다.

## 엔드포인트

- `GET /api/config` — 사용 가능한 모델 목록(`models`), 기본 모델(`defaultModel`), 키 설정 여부(`hasKey`). 기본/유일 모델은 Upstage Solar Pro 3(`solar-pro3`).
- `POST /api/chat` — `{ messages: [{role, content}], model? }` 를 받아 답변을 스트리밍으로 반환. 응답 헤더 `X-Policy-Ids`에 추천 정책 id 배열(JSON)을 담아준다.
- `GET /api/usage` — 사용량 대시보드는 미구현(항상 503). 구글시트 연동 없이 단순하게 운영하기 위한 의도적인 생략.
- `POST /api/moderate` — `{ title, background, content, expectedEffect, existingProposals: [{id, title}] }` 를 받아 정책제안 글의 욕설/부적절한 표현 여부와, 기존 제안 목록 중 유사한 항목을 JSON으로 반환. `{ profanity, profanityReason, similar: [{id, title, reason}] }`. `/api/chat`·`/api/config`와 동일하게 Upstage Solar API를 직접 호출한다(과거엔 OpenRouter의 무료 Nemotron 모델을 썼으나, 해당 모델 id가 카탈로그에서 내려가면서 기능이 계속 실패해 Solar로 교체).

## 동작 방식

1. `lib/policies.js`가 프론트엔드([youthpolicy_contest](https://github.com/yoon-kyoung/youthpolicy_contest))가 서빙 중인 `policies.json`을 그대로 읽어와 나이·지역·분야로 후보 정책을 추린다.
2. `lib/extract.js`가 Upstage Solar API로 사용자 메시지에서 나이·지역·관심분야를 직접 추출하고, 실패하면 규칙 기반 추출로 폴백한다.
3. 조건이 파악되면 후보 정책을 시스템 프롬프트에 요약해 넣고, Upstage Solar API(`https://api.upstage.ai/v1/chat/completions`)로 답변을 생성해 스트리밍으로 돌려준다.

## 환경 변수

- `UPSTAGE_API_KEY` (필수, `/api/chat`·`/api/config`·`/api/moderate`용) — https://console.upstage.ai/api-keys 에서 발급.
- `OPENROUTER_API_KEY` (필수, `/api/compare`용) — https://openrouter.ai/keys 에서 발급. 정책 비교 기능은 여전히 OpenRouter/Nemotron을 사용한다.
- `DEFAULT_MODEL` (선택) — `/api/chat`·`/api/config`·`/api/moderate`가 공통으로 쓰는 기본 모델. 기본값 `solar-pro3`.
- `POLICIES_URL` (선택) — 정책 데이터 소스. 기본값은 배포된 프론트엔드의 `policies.json`.

## 배포

```
vercel --prod
```

Vercel 프로젝트 설정의 Environment Variables에서 `UPSTAGE_API_KEY`를 등록해야 한다(`OPENROUTER_API_KEY`는 `/api/compare`를 위해 계속 유지).
