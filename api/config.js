const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'solar-pro3'

// Upstage Solar API를 직접 호출한다(OpenRouter 미경유).
const MODELS = [
  { id: DEFAULT_MODEL, label: 'Solar Pro 3 (Upstage · 국산 · 기본)' },
]

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.status(200).json({
    models: MODELS,
    defaultModel: DEFAULT_MODEL,
    hasKey: !!process.env.UPSTAGE_API_KEY,
    hasSheet: false,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local',
  })
}
