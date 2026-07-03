// api/analyze.js
const fetch = require('node-fetch'); // Vercel 기본 내장 또는 폴백용

module.exports = async function handler(req, res) {
  // CORS 및 메서드 제한 필터링
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 데이터 구조분해 안전 할당
  const { title = '', item = null, mode = '' } = req.body || {};

  // Google AI Studio에서 발급받으신 정식 토큰 직결
  const FIXED_TOKEN = "AQ.Ab8RN6J1WNkpJNND-zgVyYIPY8ELvCMa-ekYKX_LWPi2acybSQ";
  const token = FIXED_TOKEN.trim();

  try {
    let targetUrl = '';
    let bodyPayload = {};

    // =============================================================
    // Case 1: 상세화면 하단 — 드라마화 연출/각색 기획 리포트 생성 (HTML 리턴)
    // =============================================================
    if (mode === 'report') {
      if (!item) {
        return res.status(400).json({ error: 'IP 데이터가 누락되었습니다.' });
      }

      targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`;
      bodyPayload = {
        contents: [{
          parts: [{
            text: `당신은 프로 드라마 제작 프로듀서(PD)이자 최고 수준의 콘텐츠 기획 분석가입니다. 아래 제공된 원작 IP 후보의 대시보드 정형화 데이터를 정밀 분석하여, '드라마화 연출 및 각색 방향 기획 리포트'를 한국어로 상세히 작성해 주세요. 결과는 HTML 마크업(<h3>, <p>, <ul>, <li> 등) 형태로만 감싸서 출력해 주세요. 별도의 마크다운(\`\`\`) 기호나 설명 조각은 절대 붙이지 마세요.\n\n[원작 정보]\n${JSON.stringify(item, null, 2)}`
          }]
        }]
      };
    } else {
      // =============================================================
      // Case 2: 대시보드 메인 — 원작 타이틀 기반 데이터 자동 추출 생성 (JSON 리턴)
      // =============================================================
      const trimmedTitle = title.trim();
      if (!trimmedTitle) {
        return res.status(400).json({ error: '원작 제목이 입력되지 않았습니다.' });
      }

      targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`;
      
      const jsonSchemaGuide = {
        title: trimmedTitle,
        originalType: "웹툰 | 웹소설 | 소설 | 영화 | 기타 중 택1",
        genre: ["장르1", "장르2"],
        logline: "원작 스토리 기반 한 줄 소개 요약",
        premise: "세계관/설정/갈등구조 3가지 특징을 포함하여 ① ② ③ 형식으로 상세히 기술",
        mainCharacters: [
          { name: "진짜 주인공1 이름", role: "남주1 등", traits: "실제 원작에 기반한 대사 스타일/행동/주변 평가 특징", appealPoints: "독자들이 열광하는 진짜 입덕 포인트", improvements: "드라마 편수로 바꿀 때 보완해야 할 각색점" },
          { name: "진짜 주인공2 이름", role: "여주1 등", traits: "실제 원작에 기반한 대사 스타일/행동/주변 평가 특징", appealPoints: "독자들이 열광하는 진짜 입덕 포인트", improvements: "드라마 편수로 바꿀 때 보완해야 할 각색점" },
          { name: "진짜 조연1 이름", role: "역할", traits: "실제 원작에 기반한 대사 스타일/행동/주변 평가 특징", appealPoints: "독자들이 열광하는 진짜 입덕 포인트", improvements: "드라마 편수로 바꿀 때 보완해야 할 각색점" },
          { name: "진짜 조연2 이름", role: "역할", traits: "실제 원작에 기반한 대사 스타일/행동/주변 평가 특징", appealPoints: "독자들이 열광하는 진짜 입덕 포인트", improvements: "드라마 편수로 바꿀 때 보완해야 할 각색점" }
        ],
        strengths: ["서로 다른 관점의 강점1", "서로 다른 관점의 강점2", "서로 다른 관점의 강점3"],
        risks: ["서로 다른 관점의 리스크1", "서로 다른 관점의 리스크2", "서로 다른 관점의 리스크3"],
        targetAudience: "연령대 / 성별 / 취향 레이어 측면 기술",
        productionDifficulty: "낮음 | 보통 | 높음 중 택1",
        castingDirection: "주연 방향 / 조연 방향 / 연출 핵심",
        comparables: ["실제 존재하는 유사작1", "실제 존재하는 유사작2", "실제 존재하는 유사작3"],
        recommendation: "추천 | 보류 | 리서치 필요 중 택1",
        scores: { dramaFit: 8.0, marketPotential: 8.0, productionFeasibility: 7.0, originality: 8.0, scalability: 8.0, globalPotential: 7.0, characterAppeal: 8.5 },
        scoreRationales: { dramaFit: "이유", marketPotential: "이유", productionFeasibility: "이유", originality: "이유", scalability: "이유", globalPotential: "이유", characterAppeal: "이유" },
        notes: "검토 메모 요약"
      };

      // 🚨 [거짓 정보 원천 배제] 임의의 가짜 인물 생성을 엄격하게 금지하는 페널티 프롬프트 주입
      bodyPayload = {
        contents: [{
          parts: [{
            text: `당신은 최고 수준의 콘텐츠 기획 프로듀서입니다. 원작 작품 [${trimmedTitle}]에 대한 실제 인터넷 정보, 나무위키, 대중적 평가, 공식 줄거리, 등장인물 프로필을 정밀 분석 및 역추적하여 한국 드라마 기획 데이터 세트를 구성해줘.\n\n⚠️ [경고: 팩트 체크 지침]\n주인공 이름(mainCharacters.name) 및 서사는 반드시 실제 원작에 존재하는 '진짜 이름'과 '진짜 설정'이어야 해. 만약 정보가 부족하다면 상상해서 임의의 가짜 캐릭터나 허구의 인물 명칭을 지어내지 말고, 실제 원작의 핵심 인물 정보만 팩트 기반으로 빽빽하게 채워줘. 다른 설명 없이 아래 명시된 스키마 구조를 완벽히 준수하는 순수 JSON 데이터 1개만 출력해줘.\n\n[스키마 구조]\n${JSON.stringify(jsonSchemaGuide, null, 2)}`
          }]
        }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.1 }
      };
    }

    // 🚨 [인증 구조 수정] 주소창 ?key= 방식을 완전히 걷어내고, Bearer 단독 인증으로 전달하여 OAuth2 거부 에러를 영구 차단합니다.
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(bodyPayload)
    });

    // 구글 서버 헤더에서 실시간 레이트리밋 추출 (실패 시 기본 샌드박스 값 매핑)
    const limitRemaining = response.headers.get('x-ratelimit-remaining-requests') || "14";
    const limitReset = response.headers.get('x-ratelimit-reset-requests') || "45s";

    const data = await response.json();
    if (!response.ok || data.error) {
      throw new Error(data.error?.message || `구글 API 서버 거부 (Status: ${response.status})`);
    }

    let responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    if (mode === 'report') {
      return res.status(200).json({ 
        result: responseText,
        rateLimit: { remaining: limitRemaining, reset: limitReset }
      });
    } else {
      if (responseText.includes("{")) {
        responseText = responseText.substring(responseText.indexOf("{"), responseText.lastIndexOf("}") + 1);
      }
      const parsedPayload = JSON.parse(responseText);
      return res.status(200).json({ 
        success: true, 
        payload: parsedPayload,
        rateLimit: { remaining: limitRemaining, reset: limitReset }
      });
    }

  } catch (error) {
    console.error("백엔드 엔진 최종 에러 로그:", error);
    return res.status(500).json({ success: false, error: error.message || "서버 내부 처리 중 예외 발생" });
  }
};
