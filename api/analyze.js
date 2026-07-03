// api/analyze.js
import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { title, item, mode } = req.body;

  // 확인해주신 구글 AI Studio의 정식 키를 그대로 물고 들어갑니다.
  const RAW_KEY = process.env.GEMINI_API_KEY || "AQ.Ab8RN6J1WNkpJNND-zgVyYIPY8ELvCMa-ekYKX_LWPi2acybSQ";
  const apiKey = RAW_KEY.trim().replace(/['"]/g, "");

  try {
    // 🚨 [최종 교정 지점] 최신 SDK 라이브러리의 정식 생성자 메인 모듈인 GoogleGenerativeAI 클래스를 호출합니다.
    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });

    // =============================================================
    // Case 1: 상세화면 하단 — 드라마화 연출/각색 기획 리포트 생성 (HTML 리턴)
    // =============================================================
    if (mode === 'report') {
      if (!item) return res.status(400).json({ error: 'IP 데이터가 누락되었습니다.' });

      const prompt = `당신은 프로 드라마 제작 프로듀서(PD)이자 최고 수준의 콘텐츠 기획 분석가입니다. 아래 제공된 원작 IP 후보의 대시보드 정형화 데이터를 정밀 분석하여, '드라마화 연출 및 각색 방향 기획 리포트'를 한국어로 상세히 작성해 주세요. 결과는 HTML 마크업(<h3>, <p>, <ul>, <li> 등) 형태로만 감싸서 출력해 주세요. 별도의 마크다운(\`\`\`) 기호나 설명 조각은 절대 붙이지 마세요.\n\n[원작 정보]\n${JSON.stringify(item, null, 2)}`;
      
      const result = await model.generateContent(prompt);
      const responseText = result.response.text() || "<p>리포트를 생성할 수 없습니다.</p>";
      
      return res.status(200).json({ result: responseText });
    }

    // =============================================================
    // Case 2: 대시보드 메인 — 원작 타이틀 기반 데이터 자동 추출 생성 (JSON 리턴)
    // =============================================================
    if (!title) return res.status(400).json({ error: '원작 제목이 입력되지 않았습니다.' });

    const jsonSchemaGuide = {
      title: title,
      originalType: "웹툰 | 웹소설 | 소설 | 영화 | 기타 중 택1",
      genre: ["장르1", "장르2"],
      logline: "원작 스토리 기반 한 줄 소개 요약",
      premise: "세계관/설정/갈등구조 3가지 특징을 ① ② ③ 형식으로 기술",
      mainCharacters: [
        { name: "주인공1", role: "남주1 등", traits: "시그니처 대사/행동 특징", appealPoints: "입덕 포인트", improvements: "각색 보완점" },
        { name: "주인공2", role: "여주1 등", traits: "대사/행동 특징", appealPoints: "입덕 포인트", improvements: "각색 보완점" }
      ],
      strengths: ["강점1", "강점2", "강점3"],
      risks: ["리스크1", "리스크2", "리스크3"],
      targetAudience: "연령대 / 성별 / 취향 레이어",
      productionDifficulty: "낮음 | 보통 | 높음 중 택1",
      castingDirection: "주연 방향 / 조연 방향 / 연출 핵심",
      comparables: ["유사작1", "유사작2"],
      recommendation: "추천 | 보류 | 리서치 필요 중 택1",
      scores: { dramaFit: 7.5, marketPotential: 8.0, productionFeasibility: 6.5, originality: 7.5, scalability: 8.0, globalPotential: 7.0, characterAppeal: 8.5 },
      scoreRationales: { dramaFit: "이유", marketPotential: "이유", productionFeasibility: "이유", originality: "이유", scalability: "이유", globalPotential: "이유", characterAppeal: "이유" },
      notes: "검토 메모 요약"
    };

    const promptJson = `원작 작품 [${title}]에 대한 실제 대중적 평가, 줄거리, 캐릭터 설정을 인터넷 정보 기반으로 정밀 역추적하여 한국 드라마 기획 데이터 세트를 구성해줘. 반드시 다른 설명 없이, 아래 명시된 스키마 구조를 완벽히 준수하는 순수 JSON 데이터 1개만 리턴해줘. 앞뒤에 \`\`\`json 이나 \`\`\` 같은 마크다운 랩핑 문자는 절대 쓰지 말고 중괄호 { 로 시작해서 } 로 끝나게 출력해줘.\n\n[스키마 구조]\n${JSON.stringify(jsonSchemaGuide, null, 2)}`;

    const resultJson = await model.generateContent({
      contents: [{ parts: [{ text: promptJson }] }],
      generationConfig: { responseMimeType: "application/json" }
    });

    let responseText = resultJson.response.text().trim();
    if (responseText.startsWith("```")) {
      responseText = responseText.replace(/^```json/, "").replace(/^```/, "").replace(/```$/, "").trim();
    }

    const parsedPayload = JSON.parse(responseText);
    return res.status(200).json({ success: true, payload: parsedPayload });

  } catch (error) {
    console.error("공식 SDK 백엔드 최종 런타임 오류:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
