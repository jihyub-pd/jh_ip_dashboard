// api/analyze.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { title = '', item = null, mode = '' } = req.body || {};
  const TOKEN = (process.env.GEMINI_API_KEY || "AQ.Ab8RN6J1WNkpJNND-zgVyYIPY8ELvCMa-ekYKX_LWPi2acybSQ").trim();

  try {
    const isReport = mode === 'report';
    const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`;
    
    let textPrompt = isReport 
      ? `분석 데이터:${JSON.stringify(item)} 분석해.` 
      : `작품 [${title}]의 실제 정보를 바탕으로 한국 드라마 기획 JSON을 작성해. 가짜 정보 금지. 스키마: {"title": "${title}", "originalType": "웹툰", "genre": [], "logline": "...", "premise": "① ② ③", "mainCharacters": [{"name": "이름", "role": "역할", "traits": "특징", "appealPoints": "매력", "improvements": "각색점"}], "strengths": [], "risks": [], "targetAudience": "3측면 / 구분", "productionDifficulty": "...", "castingDirection": "주연/조연/연출 방향", "comparables": [], "recommendation": "...", "scores": {"dramaFit": 8, "marketPotential": 8, "productionFeasibility": 7, "originality": 8, "scalability": 8, "globalPotential": 7, "characterAppeal": 8}, "scoreRationales": {"dramaFit": "...", "marketPotential": "...", "productionFeasibility": "...", "originality": "...", "scalability": "...", "globalPotential": "...", "characterAppeal": "..."}, "notes": "..."}`;

    const response = await fetch(`${targetUrl}?key=${TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: textPrompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Gemini API 오류");

    const text = data.candidates[0].content.parts[0].text;
    const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();

    return res.status(200).json({ 
      success: true, 
      payload: isReport ? { result: text } : JSON.parse(cleanText),
      rateLimit: { remaining: "14", reset: "60s" }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
