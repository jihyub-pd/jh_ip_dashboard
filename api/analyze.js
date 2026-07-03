// api/analyze.js
export default async function handler(req, res) {
  // CORS 설정 및 POST 요청 제한
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { ipData } = req.body;
  if (!ipData) {
    return res.status(400).json({ error: 'IP 데이터가 누락되었습니다.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Vercel 환경변수에 GEMINI_API_KEY가 설정되지 않았습니다.' });
  }

  try {
    // Gemini 1.5 Flash 혹은 최신 모델 API 호출
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `당신은 최고의 보안 및 네트워크 분석가입니다. 제공된 IP 대시보드 데이터를 기반으로 보안 위험성, 네트워크 특징 요약, 그리고 향후 조치 제안을 친절하고 전문적인 한국어로 분석해 주세요. 
              결과는 HTML 마크업(예: <h3>, <p>, <ul>, <li> 등)을 적절히 활용하여 UI에 깔끔하게 출력될 수 있도록 작성해 주세요. markdown 기호(###, **)는 제외하고 순수 HTML 태그로만 감싸주세요.

              [분석할 IP 데이터]
              ${JSON.stringify(ipData, null, 2)}`
            }]
          }]
        })
      }
    );

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'Gemini API 호출 중 오류가 발생했습니다.');
    }

    const analysisText = data.candidates[0].content.parts[0].text;
    return res.status(200).json({ analysis: analysisText });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message || '서버 내부 오류가 발생했습니다.' });
  }
}
