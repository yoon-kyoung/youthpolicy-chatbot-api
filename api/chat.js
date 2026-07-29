import { recommendPolicies } from '../lib/policies.js'
import { extractParams } from '../lib/extract.js'

// OpenRouter: OpenAI 호환 API. :free 모델은 카드 등록 없이 무료로 쓸 수 있다.
const OPENAI_URL = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'nvidia/nemotron-3-nano-30b-a3b:free'

const BASE_PROMPT = `당신은 "청년ON"의 AI 챗봇입니다. 대한민국 청년정책(취업·주거·금융·교육·복지·참여 등)을 안내합니다.
- 반드시 한국어로만 답변하세요. 영어·태국어·아랍어 등 다른 언어 단어를 절대 섞지 마세요.
- 실제 정책 데이터에 없는 내용을 지어내지 마세요.
- 간결하게 답하세요.
- 답변 끝에 후속 질문을 제안할 땐 반드시 아래 형식을 쓰세요(없으면 생략 가능):
💬 이어서 물어보세요
· 질문1
· 질문2`

function compactPolicy(p) {
  return {
    name: p.name,
    category: p.category,
    summary: (p.summary || '').slice(0, 80),
    region: p.nationwide ? '전국' : (p.regions || []).join('/'),
  }
}

async function* streamOpenRouter(apiKey, body) {
  const r = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://yoon-kyoung.github.io/youthpolicy_contest/',
      'X-Title': 'Youth Policy Chatbot',
    },
    body: JSON.stringify({ ...body, stream: true }),
  })
  if (!r.ok || !r.body) {
    const data = await r.json().catch(() => ({}))
    throw Object.assign(new Error(data?.error?.message || `OpenRouter ${r.status}`), { status: r.status })
  }

  const reader = r.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const payload = trimmed.slice(5).trim()
      if (payload === '[DONE]') return
      try {
        const json = JSON.parse(payload)
        const delta = json.choices?.[0]?.delta?.content
        if (delta) yield delta
      } catch { /* skip malformed chunk */ }
    }
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) { res.status(503).json({ error: 'no-key' }); return }

  const { messages = [], model } = req.body || {}
  const useModel = model || DEFAULT_MODEL

  const allUserText = messages.filter((m) => m.role === 'user').map((m) => m.content).join(' ')
  const params = extractParams(allUserText)
  const hasEnoughInfo = params.age != null || params.region != null || params.fields.length > 0

  let systemPrompt = BASE_PROMPT
  let policyIds = []

  try {
    if (hasEnoughInfo) {
      const candidates = await recommendPolicies(params)
      policyIds = candidates.slice(0, 6).map((p) => p.id)
      systemPrompt += `\n\n파악된 조건 — 나이: ${params.age ?? '미상'}, 지역: ${params.region ?? '미상'}, 관심분야: ${params.fields.join(',') || '미상'}
아래는 조건에 맞는 후보 정책 목록(JSON)입니다. 이 중 실제로 적합한 것만 최대 5개 골라 이름과 핵심 내용을 자연스러운 한국어로 요약해 추천하세요. 후보가 비어있으면 조건에 맞는 정책이 없다고 솔직히 답하세요.
${JSON.stringify(candidates.slice(0, 8).map(compactPolicy))}`
    } else {
      systemPrompt += `\n\n아직 나이·지역·관심분야를 모릅니다. 정책 추천 요청이면 먼저 되물어보세요. 인사/잡담 등 정책과 무관한 질문에는 바로 답하세요.`
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('X-Policy-Ids', JSON.stringify(policyIds))

    let wrote = false
    for await (const delta of streamOpenRouter(apiKey, {
      model: useModel,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      temperature: 0.3,
    })) {
      wrote = true
      res.write(delta)
    }
    if (!wrote) res.write('결과를 가져오지 못했어요.')
    res.end()
  } catch (e) {
    if (res.headersSent) { res.end() } else { res.status(500).json({ error: String(e?.message || e) }) }
  }
}
