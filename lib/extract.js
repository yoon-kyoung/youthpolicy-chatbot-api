import { SIDO_LIST } from './policies.js'

// 무료 모델은 함수콜(tool_calls) 신뢰도가 낮아, 텍스트에서 직접 나이·지역·분야를 뽑는다.
const FIELD_KEYWORDS = {
  '일자리': ['취업', '채용', '일자리', '창업', '인턴', '구직', '이직'],
  '주거': ['주거', '전세', '월세', '임대', '주택', '보증금'],
  '교육': ['교육', '학자금', '장학금', '훈련', '자격증', '학원', '부트캠프'],
  '복지·금융·문화': ['금융', '복지', '대출', '저축', '문화', '자산'],
  '참여·권리': ['참여', '권리', '정책제안', '동아리', '모임'],
}

export function extractParams(text = '') {
  const ageMatch = text.match(/(\d{1,2})\s*(살|세)\b/)
  const age = ageMatch ? Number(ageMatch[1]) : null

  const region = SIDO_LIST.find((s) => text.includes(s)) || null

  const fields = Object.entries(FIELD_KEYWORDS)
    .filter(([, keywords]) => keywords.some((k) => text.includes(k)))
    .map(([key]) => key)

  return { age, region, fields }
}
