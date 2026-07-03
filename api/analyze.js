// api/analyze.js
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fetch = require("node-fetch");

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { title = '', item = null, mode = '' } = req.body || {};
  // Vercel 환경변수 우선 적용, 없을 경우 하드코딩된 토큰 사용
  const TOKEN = (process.env.GEMINI_API_KEY || "AQ.Ab8RN6J1WNkpJNND-zgVyYIPY8ELvCMa-ekYKX_LWPi2acybSQ").trim();

  try {
    const ai = new GoogleGenerativeAI(TOKEN);
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });

    // 1. 상세 리포트 생성 모드
    if (mode === 'report') {
      if (!item) return res.status(400).json({ error: '데이터 누락' });
      const prompt = `프로 드라마 PD로서 아래 데이터를 분석해 드라마화 기획 리포트를 HTML로만 작성해.\n[데이터]: ${JSON.stringify(item)}`;
      const result = await model.generateContent(prompt);
      return res.status(200).json({ 
        result: result.response.text(), 
        rateLimit: { remaining: "14", reset: "60s" } 
      });
    }

    // 2. 메인 대시보드 JSON 자동 생성 모드
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return res.status(400).json({ error: '제목 없음' });

    // 🚨 거짓 정보 방지: 실제 원작 팩트 데이터만을 요구하도록 프롬프트 강화
    const prompt = `작품 [${trimmedTitle}]의 실제 인터넷 공개 정보, 줄거리, 캐릭터 설정을 기반으로 한국 드라마 기획 JSON을 작성해. 
    가짜 정보 금지. 반드시 아래 스키마를 준수해.
    스키마: {"title": "${trimmedTitle}", "originalType": "웹툰", "genre": [], "logline": "...", "premise": "① ② ③", "mainCharacters": [{"name": "실제이름", "role": "역할", "traits": "특징", "appealPoints": "매력", "improvements": "각색점"}], "strengths": [], "risks": [], "targetAudience": "3측면 / 구분", "productionDifficulty": "...", "castingDirection": "주연/조연/연출 방향", "comparables": [], "recommendation": "...", "scores": {"dramaFit": 0, "marketPotential": 0, "productionFeasibility": 0, "originality": 0, "scalability": 0, "globalPotential": 0, "characterAppeal": 0}, "scoreRationales": {"dramaFit": "...", "marketPotential": "...", "productionFeasibility": "...", "originality": "...", "scalability": "...", "globalPotential": "...", "characterAppeal": "..."}, "notes": "..."}`;
    
    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
    
    return res.status(200).json({ 
      success: true, 
      payload: JSON.parse(text),
      rateLimit: { remaining: "14", reset: "60s" }
    });

  } catch (err) {
    console.error("백엔드 실행 오류:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
