// 사용량 대시보드는 이번 배포에서 지원하지 않음(구글시트 연동 없음).
// 프론트엔드는 503을 "ADMIN_PASSWORD 미설정"으로 이미 안내해준다.
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.status(503).json({ error: 'usage tracking not configured' })
}
