import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { title = '', item = null, mode = '' } = req.body || {};
  
  // Vercel 환경변수에서 API 키를 안전하게 불러옵니다.
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(401).json({ success: false, error: "서버 환경변수(GEMINI_API_KEY)가 설정되지 않았습니다." });
  }

  try {
    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });

    if (mode === 'report') {
      if (!item) return res.status(400).json({ error: '데이터 누락' });
      const prompt = `당신은 프로 드라마 PD입니다. 아래 데이터를 분석해 드라마화 연출 및 각색 방향 기획 리포트를 HTML로만 작성해 주세요. (별도의 설명이나 마크다운 금지)\n[데이터]: ${JSON.stringify(item)}`;
      const result = await model.generateContent(prompt);
      return res.status(200).json({ result: result.response.text(), rateLimit: { remaining: "14", reset: "60s" } });
    }

    const promptJson = `작품 [${title}]에 대한 실제 데이터를 기반으로 한국 드라마 기획 JSON을 작성해. 가짜 정보 금지. 
    반드시 다음 스키마 구조를 엄격히 준수해: 
    {"title": "${title}", "originalType": "...", "genre": [], "logline": "...", "premise": "① ② ③", "mainCharacters": [{"name": "...", "role": "...", "traits": "...", "appealPoints": "...", "improvements": "..."}], "strengths": [], "risks": [], "targetAudience": "...", "productionDifficulty": "...", "castingDirection": "...", "comparables": [], "recommendation": "...", "scores": {"dramaFit": 8, "marketPotential": 8, "productionFeasibility": 7, "originality": 8, "scalability": 8, "globalPotential": 7, "characterAppeal": 8}, "scoreRationales": {"dramaFit": "...", "marketPotential": "...", "productionFeasibility": "...", "originality": "...", "scalability": "...", "globalPotential": "...", "characterAppeal": "..."}, "notes": "..."}`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: promptJson }] }],
      generationConfig: { responseMimeType: "application/json" }
    });

    return res.status(200).json({ 
      success: true, 
      payload: JSON.parse(result.response.text()),
      rateLimit: { remaining: "14", reset: "60s" }
    });
  } catch (error) {
    console.error("API 분석 오류:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
