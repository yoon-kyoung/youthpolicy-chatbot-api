const FREE_MODEL = process.env.DEFAULT_MODEL || 'nvidia/nemotron-3-nano-30b-a3b:free'

// Solar Pro 3(Upstage)는 OpenRouter에 등록된 유일한 국산 모델이라 맨 앞에 두되,
// 유료 모델이라 기본 선택값(defaultModel)은 여전히 무료 모델로 유지한다.
const MODELS = [
  { id: 'upstage/solar-pro-3', label: 'Solar Pro 3 (Upstage · 국산, 유료)' },
  { id: FREE_MODEL, label: 'Nemotron 3 Nano · 무료 (기본)' },
]

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.status(200).json({
    models: MODELS,
    defaultModel: FREE_MODEL,
    hasKey: !!process.env.OPENROUTER_API_KEY,
    hasSheet: false,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local',
  })
}
