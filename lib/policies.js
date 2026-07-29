// 프론트엔드(GitHub Pages)가 이미 서빙 중인 policies.json을 그대로 읽어 쓴다.
// 별도 DB/동기화 없이 항상 같은 데이터로 맞춰진다.
const POLICIES_URL =
  process.env.POLICIES_URL ||
  'https://yoon-kyoung.github.io/youthpolicy_contest/policies.json'

export const SIDO_LIST = [
  '서울', '경기', '인천', '부산', '대구', '대전', '광주', '울산', '세종',
  '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
]

export const FIELD_OPTIONS = [
  { key: '일자리', match: ['일자리'] },
  { key: '주거', match: ['주거'] },
  { key: '교육', match: ['교육', '직업훈련'] },
  { key: '복지·금융·문화', match: ['금융', '복지', '문화'] },
  { key: '참여·권리', match: ['참여', '기반', '권리'] },
]
export const FIELD_KEYS = FIELD_OPTIONS.map((f) => f.key)

export function matchesField(policyCategory = '', fieldKey) {
  const field = FIELD_OPTIONS.find((f) => f.key === fieldKey)
  if (!field) return false
  return field.match.some((m) => policyCategory.includes(m))
}

function periodEndYmd(period) {
  if (!period) return null
  const ds = String(period).match(/\d{8}/g)
  if (!ds || !ds.length) return null
  return Math.max(...ds.map(Number))
}
function todayYmdKST() {
  const n = new Date(Date.now() + 9 * 3600 * 1000)
  return n.getUTCFullYear() * 10000 + (n.getUTCMonth() + 1) * 100 + n.getUTCDate()
}
function isExpired(period, today) {
  const e = periodEndYmd(period)
  return e != null && e < today
}

let cache = null
let inflight = null
export function loadPolicies() {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = fetch(POLICIES_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`policies.json HTTP ${r.status}`)
        return r.json()
      })
      .then((data) => {
        cache = data
        setTimeout(() => { cache = null }, 10 * 60 * 1000).unref?.()
        return data
      })
      .catch((err) => {
        inflight = null
        throw err
      })
  }
  return inflight
}

// 나이·지역·분야로 후보 필터링 (넓은 후보군 → 모델이 최종 선별)
export async function recommendPolicies({ age, region, fields = [] }, limit = 15) {
  const POLICIES = await loadPolicies()
  const today = todayYmdKST()
  return POLICIES
    .map((p) => {
      if (isExpired(p.period, today)) return null
      const ageOk =
        (p.minAge == null || age == null || age >= p.minAge) &&
        (p.maxAge == null || age == null || age <= p.maxAge)
      const regionSpecific = !p.nationwide && region && p.regions?.includes(region)
      const regionOk = p.nationwide || !region || regionSpecific
      if (!ageOk || !regionOk) return null

      const fieldOk = fields.length === 0 || fields.some((f) => matchesField(p.category, f))
      if (!fieldOk) return null

      let score = 0
      if (regionSpecific) score += 2
      return { ...p, score }
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}
