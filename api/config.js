const MODELS = [
  { id: process.env.DEFAULT_MODEL || 'nvidia/nemotron-3-nano-30b-a3b:free', label: 'Nemotron 3 Nano · 무료 (기본)' },
]

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.status(200).json({
    models: MODELS,
    defaultModel: MODELS[0].id,
    hasKey: !!process.env.OPENROUTER_API_KEY,
    hasSheet: false,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local',
  })
}
