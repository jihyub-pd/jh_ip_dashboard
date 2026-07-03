// api/analyze.js
// Vercel 런타임 환경에서 모듈 충돌을 피하기 위해 노드 기반 fetch 사용
const fetch = require('node-fetch');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { title = '', item = null, mode = '' } = req.body || {};
  const FIXED_TOKEN = "AQ.Ab8RN6J1WNkpJNND-zgVyYIPY8ELvCMa-ekYKX_LWPi2acybSQ";

  try {
    const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`;
    let bodyPayload = {};

    if (mode === 'report') {
      if (!item) return res.status(400).json({ error: 'IP 데이터가 누락되었습니다.' });
      bodyPayload = {
        contents: [{
          parts: [{
            text: `당신은 프로 드라마 제작 프로듀서(PD)이자 최고 수준의 콘텐츠 기획 분석가입니다. 아래 제공된 원작 IP 후보의 데이터를 정밀 분석하여 '드라마화 연출 및 각색 방향 기획 리포트'를 HTML 마크업(<h3>, <p>, <ul>, <li> 등) 형태로만 작성해 주세요. 별도의 마크다운 기호나 설명 조각은 절대 붙이지 마세요.\n\n[원작 정보]\n${JSON.stringify(item, null, 2)}`
          }]
        }]
      };
    } else {
      const trimmedTitle = title.trim();
      if (!trimmedTitle) return res.status(400).json({ error: '원작 제목이 입력되지 않았습니다.' });

      // 🚨 [거짓 정보 차단 가이드] 팩트 기반 데이터만 추출하도록 페널티 프롬프트 강화
      bodyPayload = {
        contents: [{
          parts: [{
            text: `원작 작품 [${trimmedTitle}]에 대한 실제 인터넷에 공개된 대중적 평가, 줄거리, 실제 캐릭터 설정을 정밀 역추적하여 한국 드라마 기획 데이터 세트를 구성해줘. 원작에 존재하지 않는 허구의 주인공 이름이나 지어낸 가짜 스토리를 포함해서는 절대 안 되며, 반드시 원작의 팩트 데이터만을 기반으로 가공해야 해. 다른 설명 없이 JSON만 중괄호 { 로 시작해서 } 로 끝나게 출력해줘.\n\n[스키마 구조]\n{"title": "${trimmedTitle}", "originalType": "...", "genre": [], "logline": "...", "premise": "① ② ③", "mainCharacters": [{"name": "실제 이름", "role": "역할", "traits": "특징", "appealPoints": "매력", "improvements": "각색점"}], "strengths": [], "risks": [], "targetAudience": "3측면 / 구분", "productionDifficulty": "...", "castingDirection": "주연/조연/연출 방향", "comparables": [], "recommendation": "...", "scores": {}, "scoreRationales": {}}`
          }]
        }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.1 }
      };
    }

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FIXED_TOKEN.trim()}`
      },
      body: JSON.stringify(bodyPayload)
    });

    // 구글 API 헤더에서 실시간 할당량 추출
    const remaining = response.headers.get('x-ratelimit-remaining-requests') || "14";
    const reset = response.headers.get('x-ratelimit-reset-requests') || "60s";

    const data = await response.json();
    
    if (!response.ok) throw new Error(data.error?.message || "Gemini API 호출 실패");

    const text = data.candidates[0].content.parts[0].text;
    const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();

    return res.status(200).json({ 
      success: true, 
      payload: mode === 'report' ? { result: text } : JSON.parse(cleanText),
      result: mode === 'report' ? text : undefined,
      rateLimit: { remaining, reset }
    });

  } catch (err) {
    console.error("백엔드 에러:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
