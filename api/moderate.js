const OPENAI_URL = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'nvidia/nemotron-3-nano-30b-a3b:free'
const AI_TIMEOUT_MS = 20000

// 무료 모델은 한국어 욕설 판별 신뢰도가 낮아, 명백한 욕설은 키워드로 먼저 걸러내고
// AI는 애매한 표현(혐오·비하·도배성 텍스트) 점수화와 유사 정책 판단에만 사용한다.
const PROFANITY_PATTERNS = [
  /씨\s*[0-9]*\s*발/, /시\s*[0-9]*\s*발/, /병\s*신/, /개\s*새\s*끼/, /새\s*끼/,
  /좆/, /좇/, /지\s*랄/, /미친\s*(놈|년|새끼)/, /걸레/, /창\s*녀/,
  /닥\s*쳐/, /뒤\s*[져질]/, /꺼\s*져/, /좇\s*까/, /엠병/, /뻐큐/,
  /\bfuck\b/i, /\bshit\b/i, /\bbitch\b/i,
]
function hasProfanity(text) {
  return PROFANITY_PATTERNS.some((re) => re.test(text))
}

const SYSTEM_PROMPT = `당신은 "청년ON" 정책제안 게시판의 검수 AI입니다. 사용자가 작성한 정책 제안 글을 검토합니다.
반드시 아래 JSON 형식으로만 답하세요. 다른 설명, 인사말, 코드블록 표시는 절대 추가하지 마세요.

{"profanityScore": number, "profanityReason": string, "similar": [{"id": "string", "title": "string", "reason": "string"}]}

규칙:
- profanityScore: 0~100 사이의 정수. 욕설·비속어·혐오 표현·명백한 도배 또는 정책 제안과 무관한 장난성 텍스트일 가능성이 높을수록 100에 가깝게, 정상적인 제안이면 0에 가깝게 매긴다.
- profanityReason: profanityScore가 50 이상일 때만 어떤 부분이 문제인지 한국어로 한 문장으로 설명. 50 미만이면 빈 문자열("").
- similar: [기존 제안 목록] 중 이번 제안과 주제·요구사항이 실질적으로 겹치는 항목만 최대 3개 골라 id와 title을 목록에 있는 그대로 옮기고, reason에 왜 비슷한지 한 문장으로 설명. 겹치는 항목이 없으면 빈 배열([]).`

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
        'X-Title': 'Youth Policy Proposal Moderation',
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

  const { title = '', background = '', content = '', expectedEffect = '', existingProposals = [] } = req.body || {}

  const combinedText = `${title} ${background} ${content} ${expectedEffect}`
  if (hasProfanity(combinedText)) {
    res.status(200).json({
      profanity: true,
      profanityScore: 100,
      profanityReason: '욕설 또는 비속어가 포함되어 있어요.',
      similar: [],
      aiAvailable: true,
    })
    return
  }

  const proposalText = `제목: ${title}\n배경: ${background}\n제안내용: ${content}\n기대효과: ${expectedEffect}`
  const existingList = (Array.isArray(existingProposals) ? existingProposals : [])
    .slice(0, 60)
    .map((p) => `- id:${p.id} title:${p.title}`)
    .join('\n')
  const userPrompt = `[검토할 제안]\n${proposalText}\n\n[기존 제안 목록]\n${existingList || '(없음)'}`

  const result = await callAi(apiKey, userPrompt)
  const aiAvailable = !!result
  const score = (result && typeof result.profanityScore === 'number')
    ? Math.max(0, Math.min(100, Math.round(result.profanityScore)))
    : 0
  const profanity = score >= 70
  const similar = (result && Array.isArray(result.similar)) ? result.similar.slice(0, 3) : []

  res.status(200).json({
    profanity,
    profanityScore: score,
    profanityReason: profanity ? (result?.profanityReason || '부적절한 표현이 감지됐어요.') : '',
    similar,
    aiAvailable,
  })
}
