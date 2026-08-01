# youthpolicy-chatbot-api

[청년ON](https://github.com/yoon-kyoung/youthpolicy_contest) AI 챗봇의 백엔드. Vercel Serverless Functions + OpenRouter 무료 모델로 동작해서 별도 결제 없이 운영할 수 있다.

## 엔드포인트

- `GET /api/config` — 사용 가능한 모델 목록(`models`), 기본 모델(`defaultModel`), 키 설정 여부(`hasKey`). `models`의 첫 번째는 국산 모델(Upstage Solar Pro 3)이고, 이 OpenRouter 계정에 무료 크레딧이 연결돼 있어 `defaultModel`로도 사용한다. Nemotron 3 Nano(`:free`)는 대체용으로 남겨둔다.
- `POST /api/chat` — `{ messages: [{role, content}], model? }` 를 받아 답변을 스트리밍으로 반환. 응답 헤더 `X-Policy-Ids`에 추천 정책 id 배열(JSON)을 담아준다.
- `GET /api/usage` — 사용량 대시보드는 미구현(항상 503). 구글시트 연동 없이 단순하게 운영하기 위한 의도적인 생략.
- `POST /api/moderate` — `{ title, background, content, expectedEffect, existingProposals: [{id, title}] }` 를 받아 정책제안 글의 욕설/부적절한 표현 여부와, 기존 제안 목록 중 유사한 항목을 JSON으로 반환. `{ profanity, profanityReason, similar: [{id, title, reason}] }`

## 동작 방식

1. `lib/policies.js`가 프론트엔드([youthpolicy_contest](https://github.com/yoon-kyoung/youthpolicy_contest))가 서빙 중인 `policies.json`을 그대로 읽어와 나이·지역·분야로 후보 정책을 추린다.
2. 무료 모델은 함수콜(tool calling) 신뢰도가 낮아서, `lib/extract.js`가 사용자 메시지에서 나이·지역·관심분야를 직접 추출한다.
3. 조건이 파악되면 후보 정책을 시스템 프롬프트에 요약해 넣고, OpenRouter로 답변을 생성해 스트리밍으로 돌려준다.

## 환경 변수

- `OPENROUTER_API_KEY` (필수) — https://openrouter.ai/keys 에서 발급. 이 키가 연결된 계정에 Solar Pro 3용 무료 크레딧이 잡혀 있어 기본 모델로 과금 없이 쓸 수 있다.
- `DEFAULT_MODEL` (선택) — 기본값 `upstage/solar-pro-3`. 크레딧이 소진되면 `nvidia/nemotron-3-nano-30b-a3b:free` 등 다른 무료 모델로 바꿔줄 것.
- `POLICIES_URL` (선택) — 정책 데이터 소스. 기본값은 배포된 프론트엔드의 `policies.json`.

## 배포

```
vercel --prod
```

Vercel 프로젝트 설정의 Environment Variables에서 `OPENROUTER_API_KEY`를 등록해야 한다.
