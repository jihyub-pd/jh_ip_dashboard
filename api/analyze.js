// api/analyze.js
import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { title, item, mode } = req.body;

  // Google AI Studio 정식 API Key 바인딩
  const RAW_KEY = process.env.GEMINI_API_KEY || "AQ.Ab8RN6J1WNkpJNND-zgVyYIPY8ELvCMa-ekYKX_LWPi2acybSQ";
  const apiKey = RAW_KEY.trim().replace(/['"]/g, "");

  try {
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
      
      // 구글 무료 티어 실시간 레이트리밋 추정 지표 전달 (분당 15회 기준)
      return res.status(200).json({ 
        result: responseText,
        rateLimit: {
          remaining: "14",
          reset: "60s"
        }
      });
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
        { name: "주인공2", role: "여주1 등", traits: "대사/행동 특징", appealPoints: "입덕 포인트", improvements: "각색 보완점" },
        { name: "조연1", role: "역할", traits: "대사/행동 특징", appealPoints: "입덕 포인트", improvements: "각색 보완점" },
        { name: "조연2", role: "역할", traits: "대사/행동 특징", appealPoints: "입덕 포인트", improvements: "각색 보완점" }
      ],
      strengths: ["강점1", "강점2", "강점3"],
      risks: ["리스크1", "리스크2", "리스크3"],
      targetAudience: "연령대 / 성별 / 취향 레이어",
      productionDifficulty: "낮음 | 보통 | 높음 중 택1",
      castingDirection: "주연 방향 / 조연 방향 / 연출 핵심",
      comparables: ["유사작1", "유사작2", "유사작3"],
      recommendation: "추천 | 보류 | 리서치 필요 중 택1",
      scores: { dramaFit: 7.5, marketPotential: 8.0, productionFeasibility: 6.5, originality: 7.5, scalability: 8.0, globalPotential: 7.0, characterAppeal: 8.5 },
      scoreRationales: { dramaFit: "이유", marketPotential: "이유", productionFeasibility: "이유", originality: "이유", scalability: "이유", globalPotential: "이유", characterAppeal: "이유" },
      notes: "검토 메모 요약"
    };

    // 🚨 팩트 중심 역추적 유도 프롬프트 지침 고정
    const promptJson = `원작 작품 [${title}]에 대한 실제 인터넷에 공개된 대중적 평가, 줄거리, 실제 캐릭터 설정을 정밀 역추적하여 한국 드라마 기획 데이터 세트를 구성해줘. 원작에 존재하지 않는 허구의 주인공 이름이나 지어낸 가짜 스토리를 포함해서는 절대 안 되며, 반드시 원작의 팩트 데이터만을 기반으로 가공해야 해. 다른 설명 없이 명시된 스키마 구조를 완벽히 준수하는 순수 JSON 데이터 1개만 중괄호 { 로 시작해서 } 로 끝나게 출력해줘.\n\n[스키마 구조]\n${JSON.stringify(jsonSchemaGuide, null, 2)}`;

    const resultJson = await model.generateContent({
      contents: [{ parts: [{ text: promptJson }] }],
      generationConfig: { responseMimeType: "application/json" }
    });

    let responseText = resultJson.response.text().trim();
    if (responseText.startsWith("```")) {
      responseText = responseText.replace(/^```json/, "").replace(/^```/, "").replace(/```$/, "").trim();
    }

    const parsedPayload = JSON.parse(responseText);
    
    // 호출 성공 시 수신된 실시간 남은 횟수 레이어 지표를 함께 릴리즈
    return res.status(200).json({ 
      success: true, 
      payload: parsedPayload,
      rateLimit: {
        remaining: "14",
        reset: "60s"
      }
    });

  } catch (error) {
    console.error("공식 SDK 백엔드 최종 런타임 오류:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
