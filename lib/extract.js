import { SIDO_LIST, FIELD_KEYS } from './policies.js'

// 규칙 기반 추출. 무료 모델 시절 함수콜 신뢰도가 낮아 만든 폴백이라, 숫자+살/세 형태나
// 사전에 등록된 키워드만 잡는다 — "스물일곱살"처럼 숫자가 없거나 사전에 없는 표현은 놓친다.
// LLM 추출(extractParamsLLM)이 실패했을 때의 안전망으로만 쓴다.
const FIELD_KEYWORDS = {
  '일자리': ['취업', '채용', '일자리', '창업', '인턴', '구직', '이직'],
  '주거': ['주거', '전세', '월세', '임대', '주택', '보증금'],
  '교육': ['교육', '학자금', '장학금', '훈련', '자격증', '학원', '부트캠프'],
  '복지·금융·문화': ['금융', '복지', '대출', '저축', '문화', '자산'],
  '참여·권리': ['참여', '권리', '정책제안', '동아리', '모임'],
}

export function extractParamsRegex(text = '') {
  // \b는 ASCII 단어문자 기준이라 "세"/"살" 뒤에 한글이 오면 거의 매치되지 않는다 — 쓰지 않는다.
  const ageMatch = text.match(/(\d{1,2})\s*(살|세)(?!\d)/)
  const age = ageMatch ? Number(ageMatch[1]) : null

  const region = SIDO_LIST.find((s) => text.includes(s)) || null

  const fields = Object.entries(FIELD_KEYWORDS)
    .filter(([, keywords]) => keywords.some((k) => text.includes(k)))
    .map(([key]) => key)

  return { age, region, fields }
}

const EXTRACT_URL = 'https://openrouter.ai/api/v1/chat/completions'

const EXTRACT_SYSTEM_PROMPT = `사용자가 대화에서 말한 내용 전체에서 나이·거주지역·관심분야를 찾아 JSON으로만 답하세요.
다른 설명 없이 아래 형식의 JSON 객체 하나만 출력하세요.
{"age": 숫자 또는 null, "region": ${JSON.stringify(SIDO_LIST)} 중 하나 또는 null, "fields": ${JSON.stringify(FIELD_KEYS)} 중 해당하는 항목의 배열}
- 나이는 "27세", "27살", "스물일곱살", "만 27세"처럼 숫자든 한글 숫자든 실제 나이(정수)로 변환하세요. 확실하지 않으면 null.
- region은 목록에 있는 시/도명 중 하나만 쓰고, 목록에 없으면 null.
- fields는 목록에 있는 값만 쓰고, 해당하는 게 없으면 빈 배열.`

// Solar Pro 3로 구조화 추출을 맡긴다. 실패하면(키 없음/네트워크 오류/파싱 실패)
// 규칙 기반 결과로 안전하게 폴백해서, 추출 실패가 챗봇 응답 자체를 막지 않게 한다.
export async function extractParamsLLM({ apiKey, model, text = '' }) {
  const fallback = extractParamsRegex(text)
  if (!apiKey || !text.trim()) return fallback

  try {
    const res = await fetch(EXTRACT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 200,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: EXTRACT_SYSTEM_PROMPT },
          { role: 'user', content: text.slice(0, 2000) },
        ],
      }),
    })
    if (!res.ok) throw new Error(`extract HTTP ${res.status}`)
    const json = await res.json()
    const parsed = JSON.parse(json.choices?.[0]?.message?.content || '{}')

    const age = Number.isFinite(parsed.age) ? parsed.age : fallback.age
    const region = SIDO_LIST.includes(parsed.region) ? parsed.region : fallback.region
    const fields = Array.isArray(parsed.fields)
      ? parsed.fields.filter((f) => FIELD_KEYS.includes(f))
      : []

    return { age, region, fields: fields.length ? fields : fallback.fields }
  } catch {
    return fallback
  }
}
