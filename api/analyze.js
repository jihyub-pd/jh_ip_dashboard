// api/analyze.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { title, mode, item } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: '서버 환경변수에 GEMINI_API_KEY가 설정되지 않았습니다.' });
  }

  try {
    // 1. 기존의 하단 기획 리포트 단순 텍스트 생성 모드 처리
    if (mode === 'report') {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `당신은 프로 드라마 제작 프로듀서(PD)이자 최고 수준의 콘텐츠 기획 분석가입니다. 아래 제공된 원작 IP 후보의 대시보드 정형화 데이터를 정밀 분석하여, 편성실 및 투자사를 설득하기 위한 '드라마화 연출 및 각색 방향 기획 리포트'를 한국어로 상세히 작성해 주세요. 결과는 HTML 마크업(<h3>, <p>, <ul>, <li> 등) 형태로만 감싸서 출력해 주세요. Markdown(###, **) 기호는 쓰지 마세요.

                [원작 정보]
                ${JSON.stringify(item, null, 2)}`
              }]
            }]
          })
        }
      );
      const data = await response.json();
      return res.status(200).json({ result: data.candidates[0].content.parts[0].text });
    }

    // 2. 제목만 넣었을 때 전체 대시보드 데이터 객체(JSON)를 자동 모델링하는 신규 모드
    if (!title) {
      return res.status(400).json({ error: '원작 제목이 입력되지 않았습니다.' });
    }

    const jsonSchemaGuide = {
      title: title,
      originalType: "웹툰 | 웹소설 | 소설 | 영화 | 기타 중 택1",
      genre: ["장르1", "장르2"],
      logline: "한 줄 소개 요약",
      premise: "세계관/설정/갈등구조 3가지 특징을 ① ② ③ 형식으로 기술",
      mainCharacters: [
        { name: "인물명", role: "남주1 등", traits: "시그니처 대사/행동", appealPoints: "입덕 포인트", improvements: "드라마화 각색 보완점" }
      ],
      strengths: ["강점1", "강점2", "강점3"],
      risks: ["리스크1", "리스크2", "리스크3"],
      targetAudience: "연령대 / 성별 / 취향 레이어 순으로 기술하고 ' / ' 문자로 구분 필수",
      productionDifficulty: "낮음 | 보통 | 높음 중 택1",
      castingDirection: "주연 방향 / 조연 방향 / 연출 핵심 텐션 순으로 기술하고 ' / ' 문자로 구분 필수",
      comparables: ["유사작1", "유사작2", "유사작3"],
      recommendation: "추천 | 보류 | 리서치 필요 중 택1",
      scores: { dramaFit: 7.0, marketPotential: 7.0, productionFeasibility: 7.0, originality: 7.0, scalability: 7.0, globalPotential: 7.0, characterAppeal: 7.0 },
      scoreRationales: { dramaFit: "이유", marketPotential: "이유", productionFeasibility: "이유", originality: "이유", scalability: "이유", globalPotential: "이유", characterAppeal: "이유" },
      notes: "메모 요약"
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `원작 작품 [${title}]에 대한 실제 대중적 평가, 줄거리, 캐릭터 설정을 역추적하여 한국 드라마 기획 데이터 세트를 구성해줘.
              반드시 다른 미사여구나 설명 없이, 아래 정의된 스키마 구조를 엄격히 준수하는 완벽한 정형화 순수 JSON 데이터 1개만 리턴해줘. markdown 랩핑 (\`\`\`json) 기호도 제외해줘.

              [JSON 포맷 규격 가이드라인]
              ${JSON.stringify(jsonSchemaGuide, null, 2)}
              
              평균 점수는 5.5~7.8점 대에 냉정하게 분포하도록 세팅하고, scoreRationales의 키값들은 dramaFit, marketPotential, productionFeasibility, originality, scalability, globalPotential, characterAppeal를 무조건 포함해야 해.`
            }]
          }]
        })
      }
    );

    const data = await response.json();
    let rawText = data.candidates[0].content.parts[0].text.trim();
    
    // 혹시 모를 마크다운 껍데기 제거 예외처리
    if (rawText.startsWith("```")) {
      rawText = rawText.replace(/```json|```/g, "").trim();
    }

    const parsedJson = JSON.parse(rawText);
    return res.status(200).json({ success: true, payload: parsedJson });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Gemini 모델링 데이터 생성 패킷 실패: ' + error.message });
  }
}
