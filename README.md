# youthpolicy-chatbot-api

[청년ON](https://github.com/yoon-kyoung/youthpolicy_contest) AI 챗봇의 백엔드. Vercel Serverless Functions + OpenRouter 무료 모델로 동작해서 별도 결제 없이 운영할 수 있다.

## 엔드포인트

- `GET /api/config` — 사용 가능한 모델 목록, 기본 모델, 키 설정 여부(`hasKey`)
- `POST /api/chat` — `{ messages: [{role, content}], model? }` 를 받아 답변을 스트리밍으로 반환. 응답 헤더 `X-Policy-Ids`에 추천 정책 id 배열(JSON)을 담아준다.
- `GET /api/usage` — 사용량 대시보드는 미구현(항상 503). 구글시트 연동 없이 단순하게 운영하기 위한 의도적인 생략.

## 동작 방식

1. `lib/policies.js`가 프론트엔드([youthpolicy_contest](https://github.com/yoon-kyoung/youthpolicy_contest))가 서빙 중인 `policies.json`을 그대로 읽어와 나이·지역·분야로 후보 정책을 추린다.
2. 무료 모델은 함수콜(tool calling) 신뢰도가 낮아서, `lib/extract.js`가 사용자 메시지에서 나이·지역·관심분야를 직접 추출한다.
3. 조건이 파악되면 후보 정책을 시스템 프롬프트에 요약해 넣고, OpenRouter로 답변을 생성해 스트리밍으로 돌려준다.

## 환경 변수

- `OPENROUTER_API_KEY` (필수) — https://openrouter.ai/keys 에서 발급, 카드 등록 불필요
- `DEFAULT_MODEL` (선택) — 기본값 `nvidia/nemotron-3-nano-30b-a3b:free`. 여러 무료 모델을 벤치마크해 속도·한국어 품질이 가장 나은 걸로 골랐다.
- `POLICIES_URL` (선택) — 정책 데이터 소스. 기본값은 배포된 프론트엔드의 `policies.json`.

## 배포

```
vercel --prod
```

Vercel 프로젝트 설정의 Environment Variables에서 `OPENROUTER_API_KEY`를 등록해야 한다.
