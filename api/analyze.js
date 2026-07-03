// api/analyze.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { title, item, mode } = req.body;
  const TOKEN = "AQ.Ab8RN6J1WNkpJNND-zgVyYIPY8ELvCMa-ekYKX_LWPi2acybSQ".trim();
  const ai = new GoogleGenerativeAI(TOKEN);
  const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });

  try {
    if (mode === 'report') {
      const result = await model.generateContent(`당신은 Studio Dragon PD입니다. [${item.title}]의 데이터를 분석해 드라마 기획안을 HTML로 써줘.\n데이터:${JSON.stringify(item)}`);
      return res.status(200).json({ result: result.response.text(), rateLimit: { remaining: "14", reset: "60s" } });
    }

    // 🚨 핵심: 원작의 실제 데이터를 리서치하여 채우도록 지시
    const prompt = `작품 [${title}]에 대한 실제 인터넷 데이터를 정밀 검색해서 한국 드라마 기획 데이터 세트를 구성해. 
    1. 주인공들의 실제 이름, 특징, 매력을 실제 원작 설정에 기반해 작성할 것. 
    2. 없는 내용을 지어내지 말고, 실제 원작의 줄거리와 평가를 충실히 반영할 것. 
    3. 아래 JSON 형식으로만 출력할 것.
    {"title": "${title}", "originalType": "웹툰", "genre": ["팩트기반장르"], "logline": "실제 로그라인", "premise": "①실제세계관 ②실제설정 ③실제갈등", "mainCharacters": [{"name": "실제이름", "role": "실제역할", "traits": "실제특징", "appealPoints": "실제매력", "improvements": "각색점"}], "strengths": ["실제강점1", "실제강점2", "실제강점3"], "risks": ["실제리스크1", "실제리스크2", "실제리스크3"], "targetAudience": "실제 타깃", "productionDifficulty": "보통", "castingDirection": "실제 캐스팅 방향", "comparables": ["실제 유사작1", "실제 유사작2"], "recommendation": "추천", "scores": {"dramaFit": 8, "marketPotential": 8, "productionFeasibility": 7, "originality": 8, "scalability": 8, "globalPotential": 7, "characterAppeal": 8}, "scoreRationales": {"dramaFit": "원작의 서사 구조 분석 결과", "marketPotential": "대중적 흥행 요소 분석", "productionFeasibility": "제작 난이도 분석", "originality": "차별성 분석", "scalability": "확장성 분석", "globalPotential": "글로벌 시장성", "characterAppeal": "캐릭터 매력 분석"}, "notes": "실제 검토 메모"}`;

    const result = await model.generateContent(prompt);
    const jsonStr = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
    return res.status(200).json({ success: true, payload: JSON.parse(jsonStr), rateLimit: { remaining: "14", reset: "60s" } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
