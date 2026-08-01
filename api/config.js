const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'upstage/solar-pro-3'
const FALLBACK_MODEL = 'nvidia/nemotron-3-nano-30b-a3b:free'

// Solar Pro 3(Upstage)는 이 OpenRouter 계정에 무료 크레딧이 연결돼 있어 기본 모델로 둔다.
const MODELS = [
  { id: DEFAULT_MODEL, label: 'Solar Pro 3 (Upstage · 국산, 무료 · 기본)' },
  { id: FALLBACK_MODEL, label: 'Nemotron 3 Nano · 무료' },
]

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.status(200).json({
    models: MODELS,
    defaultModel: DEFAULT_MODEL,
    hasKey: !!process.env.OPENROUTER_API_KEY,
    hasSheet: false,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local',
  })
}
