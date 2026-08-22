const OPENAI_URL = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'nvidia/nemotron-3-nano-30b-a3b:free'
const AI_TIMEOUT_MS = 20000

const SYSTEM_PROMPT = `당신은 "청년ON"의 정책 비교 도우미입니다. 사용자가 나란히 비교 중인 2~3개의 청년정책 정보를 받아 실질적인 차이점을 짚어줍니다.
반드시 아래 JSON 형식으로만 답하세요. 다른 설명, 인사말, 코드블록 표시는 절대 추가하지 마세요.

{"points": [{"aspect": "string", "detail": "string"}], "recommendation": "string"}

절대 규칙 (매우 중요):
- [비교할 정책들]에 실제로 적힌 값만 사용한다. 거기 없는 숫자·기간·조건·교육시간 등을 절대로 지어내지 않는다. 확실하지 않으면 "정보 없음"이라고 쓴다.
- "정책 1", "정책 2"처럼 번호로 부르지 말고, 반드시 각 정책의 실제 title(제목)을 그대로 인용해서 부른다.

내용 규칙:
- points: 실제로 값이 다른 항목만 골라 3~5개. aspect는 "지원대상","지원금액","신청기간","지역 제한" 등 2~4자 내외의 짧은 키워드. detail은 정책 제목을 직접 인용하며 무엇이 어떻게 다른지 한국어 한 문장으로, 주어진 값을 그대로 옮겨 설명한다(막연한 말 금지).
- 모든 정책의 값이 동일한 항목은 points에 넣지 않는다.
- recommendation: "이런 상황이면 어떤 정책이 유리한지"를 조건별로 한두 문장으로 제안. 정책 제목을 그대로 인용한다.
- 비교에 필요한 정보가 부족한 정책이 있으면 지어내지 말고 detail에 "정보 없음"이라고 명시한다.`

function extractJson(raw) {
  const match = raw.match(/\{[\s\S]*\}/)
  try { return JSON.parse(match ? match[0] : raw) } catch { return null }
}

async function callAi(apiKey, userPrompt) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)
  try {
    const r = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://yoon-kyoung.github.io/youthpolicy_contest/',
        'X-Title': 'Youth Policy Comparison',
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0,
      }),
      signal: controller.signal,
    })
    if (!r.ok) return null
    const data = await r.json()
    const raw = data.choices?.[0]?.message?.content || ''
    return extractJson(raw)
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) { res.status(503).json({ error: 'no-key' }); return }

  const { policies = [] } = req.body || {}
  const list = Array.isArray(policies) ? policies.slice(0, 3) : []
  if (list.length < 2) { res.status(400).json({ error: 'need at least 2 policies' }); return }

  const policyText = list.map((p) => (
    `■ 제목: ${p.title || '(제목 없음)'}\n` +
    `- 카테고리: ${p.category || '-'}\n` +
    `- 지역: ${p.region || '-'}\n` +
    `- 기관: ${p.org || '-'}\n` +
    `- 지원대상: ${p.target || '-'}\n` +
    `- 지원금액: ${p.amount ? `${p.amount}만원` : '-'}\n` +
    `- 마감: ${p.deadline || '-'}\n` +
    `- 지원 내용: ${(p.support || '-').slice(0, 500)}`
  )).join('\n\n')
  const userPrompt = `[비교할 정책들]\n${policyText}`

  const result = await callAi(apiKey, userPrompt)
  const aiAvailable = !!result

  if (!aiAvailable) {
    res.status(200).json({
      points: [],
      recommendation: '',
      aiAvailable: false,
      retryable: true,
    })
    return
  }

  const points = Array.isArray(result.points)
    ? result.points
        .filter((p) => p && typeof p.aspect === 'string' && typeof p.detail === 'string')
        .slice(0, 5)
    : []
  const recommendation = typeof result.recommendation === 'string' ? result.recommendation : ''

  res.status(200).json({ points, recommendation, aiAvailable: true })
}
