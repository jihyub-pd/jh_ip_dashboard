// api/analyze.js (API Key 유효성 강제 검증 및 안정화 버전)
export default async function handler(req, res) {
  // CORS 및 메서드 방어
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { title, item, mode } = req.body;

  // -------------------------------------------------------------
  // 🛠️ [중요] 여기에 본인의 실제 Gemini API Key를 정확히 입력해 주세요.
  // -------------------------------------------------------------
  const RAW_KEY = process.env.GEMINI_API_KEY || "여기에_AIzaSy로_시작하는_실제_키를_넣으세요";
  
  // 앞뒤 공백이나 따옴표가 같이 복사되는 현상 방지(Trim)
  const apiKey = RAW_KEY.trim().replace(/['"]/g, "");

  // API Key 기본 검증
  if (!apiKey || apiKey.includes("여기에_AIzaSy") || apiKey.length < 10) {
    return res.status(400).json({ 
      success: false, 
      error: '서버 소스코드(api/analyze.js) 내부에 유효한 구글 Gemini API Key가 입력되지 않았습니다. 문자열을 다시 확인해 주세요.' 
    });
  }

  try {
    // -------------------------------------------------------------
    // Case 1: 드라마화 연출/각색 기획 리포트 생성 (상세화면 하단)
    // -------------------------------------------------------------
    if (mode === 'report') {
      if (!item) return res.status(400).json({ error: 'IP 데이터가 누락되었습니다.' });

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `당신은 프로 드라마 제작 프로듀서(PD)이자 최고 수준의 콘텐츠 기획 분석가입니다. 아래 제공된 원작 IP 후보의 대시보드 정형화 데이터를 정밀 분석하여, '드라마화 연출 및 각색 방향 기획 리포트'를 한국어로 상세히 작성해 주세요. 결과는 HTML 마크업(<h3>, <p>, <ul>, <li> 등) 형태로만 감싸서 출력해 주세요. 별도의 마크다운(\`\`\`) 기호는 쓰지 마세요.\n\n[원작 정보]\n${JSON.stringify(item, null, 2)}`
              }]
            }]
          })
        }
      );

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error?.message || `Gemini API 서버 거절 (Status: ${response.status})`);
      }

      const analysisText = data.candidates?.[0]?.content?.parts?.[0]?.text || "<p>리포트를 생성할 수 없습니다.</p>";
      return res.status(200).json({ result: analysisText });
    }

    // -------------------------------------------------------------
    // Case 2: 원작 타이틀 기반 대시보드 기획 데이터 자동 생성 (메인화면)
    // -------------------------------------------------------------
    if (!title) return res.status(400).json({ error: '원작 제목이 입력되지 않았습니다.' });

    const jsonSchemaGuide = {
      title: title,
      originalType: "웹툰 | 웹소설 | 소설 | 영화 | 기타 중 택1",
      genre: ["장르1", "장르2"],
      logline: "원작 스토리 기반 한 줄 소개 요약",
      premise: "세계관/설정/갈등구조 3가지 특징을 ① ② ③ 형식으로 기술",
      mainCharacters: [
        { name: "주인공1", role: "남주1 등", traits: "대사/행동 특징", appealPoints: "입덕 포인트", improvements: "각색 보완점" },
        { name: "주인공2", role: "여주1 등", traits: "대사/행동 특징", appealPoints: "입덕 포인트", improvements: "각색 보완점" }
      ],
      strengths: ["강점1", "강점2", "강점3"],
      risks: ["리스크1", "리스크2", "리스크3"],
      targetAudience: "연령대 / 성별 / 취향 레이어",
      productionDifficulty: "낮음 | 보통 | 높음 중 택1",
      castingDirection: "주연 방향 / 조연 방향 / 연출 핵심",
      comparables: ["유사작1", "유사작2"],
      recommendation: "추천 | 보류 | 리서치 필요 중 택1",
      scores: { dramaFit: 8.0, marketPotential: 8.0, productionFeasibility: 7.0, originality: 7.5, scalability: 8.0, globalPotential: 7.0, characterAppeal: 8.5 },
      scoreRationales: { dramaFit: "이유", marketPotential: "이유", productionFeasibility: "이유", originality: "이유", scalability: "이유", globalPotential: "이유", characterAppeal: "이유" },
      notes: "검토 메모 요약"
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `원작 작품 [${title}]에 대한 실제 대중적 평가, 줄거리, 캐릭터 설정을 역추적하여 한국 드라마 기획 데이터 세트를 구성해줘. 반드시 다른 설명 없이, 아래 스키마 구조를 준수하는 완벽한 정형화 순수 JSON 데이터 1개만 리턴해줘. markdown 랩핑 기호(\`\`\`json)도 제외해줘.\n\n[규격]\n${JSON.stringify(jsonSchemaGuide, null, 2)}`
            }]
          }]
        })
      }
    );

    const data = await response.json();
    
    if (!response.ok || data.error) {
      throw new Error(data.error?.message || `Gemini API 인증/통신 실패 (Status: ${response.status}). Key 문자열이 정확한지 확인해 주세요.`);
    }

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error("Gemini API 응답 결과(candidates)가 비어있습니다. API 사용량 제한 또는 키 권한을 확인하세요.");
    }

    const part = data.candidates[0]?.content?.parts?.[0];
    if (!part || !part.text) throw new Error("Gemini 응답 텍스트 파트가 유실되었습니다.");

    let responseText = part.text.trim();
    
    // 마크다운 잔여 찌꺼기 완벽 정제
    if (responseText.startsWith("```")) {
      responseText = responseText.replace(/^```json/, "").replace(/^```/, "").replace(/```$/, "").trim();
    }

    const parsedPayload = JSON.parse(responseText);
    return res.status(200).json({ success: true, payload: parsedPayload });

  } catch (error) {
    console.error("백엔드 엔진 에러 로그:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
