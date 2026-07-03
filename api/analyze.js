// api/analyze.js
import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { title, item, mode } = req.body;

  // ⚠️ 보안: API 키는 반드시 Vercel 환경변수로만 관리하세요. (코드에 하드코딩 금지)
  const RAW_KEY = process.env.GEMINI_API_KEY || "";
  const apiKey = RAW_KEY.trim().replace(/['"]/g, "");
  if (!apiKey) {
    return res.status(500).json({ success: false, error: 'GEMINI_API_KEY 환경변수가 설정되지 않았습니다.' });
  }

  try {
    const ai = new GoogleGenerativeAI(apiKey);

    // 분석 품질 핵심 1: 모델 업그레이드
    // - "gemini-2.5-flash": 속도/품질 균형 (권장 기본값)
    // - "gemini-2.5-pro": 최고 품질, 다만 응답이 느림 (30초~1분)
    const MODEL_NAME = "gemini-2.5-flash";

    // 분석 품질 핵심 2: 전문가 페르소나를 system instruction으로 고정
    const model = ai.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction:
        "당신은 한국 드라마 제작사의 수석 IP 기획 프로듀서이자 콘텐츠 분석 전문가입니다. " +
        "웹툰·웹소설·소설·영화·게임 원작의 드라마화 적합성을 평가하는 심층 리포트를 작성합니다. " +
        "원작의 실제 줄거리, 캐릭터, 팬덤 반응, 커뮤니티 평가에 근거해 구체적이고 밀도 높게 분석하며, " +
        "칭찬 일변도가 아니라 약점과 제작·시장·법적 리스크를 균형 있게 반영합니다. " +
        "원작 정보가 불확실하면 추측으로 지어내지 말고, notes에 '정보 제한적, 추가 리서치 권장'을 명시하고 recommendation을 '리서치 필요'로 설정합니다."
    });

    // =============================================================
    // Case 1: 상세화면 하단 — 드라마화 연출/각색 기획 리포트 생성 (HTML 리턴)
    // =============================================================
    if (mode === 'report') {
      if (!item) return res.status(400).json({ error: 'IP 데이터가 누락되었습니다.' });

      const prompt = `아래 제공된 원작 IP 후보의 대시보드 정형화 데이터를 정밀 분석하여, '드라마화 연출 및 각색 방향 기획 리포트'를 한국어로 상세히 작성해 주세요.

리포트에 반드시 포함할 항목:
1. 전체 각색 전략 (원작 문법 → 드라마 문법 전환 핵심)
2. 회차 구성 제안 (총 편수, 기승전결 배치, 엔딩 훅 설계)
3. 주요 캐릭터별 연출 포인트 및 캐스팅 이미지 구체화
4. 톤앤매너 / 미술·촬영 연출 방향
5. 리스크 대응 전략 (원작 팬덤 반발, 제작비, 규제 등)
6. 편성/플랫폼 전략 제안

결과는 HTML 마크업(<h3>, <p>, <ul>, <li>, <strong> 등) 형태로만 감싸서 출력해 주세요. 별도의 마크다운(\`\`\`) 기호나 설명 조각은 절대 붙이지 마세요.

[원작 정보]
${JSON.stringify(item, null, 2)}`;

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 8192 }
      });
      const responseText = result.response.text() || "<p>리포트를 생성할 수 없습니다.</p>";

      return res.status(200).json({ result: responseText });
    }

    // =============================================================
    // Case 2: 대시보드 메인 — 원작 타이틀 기반 데이터 자동 추출 생성 (JSON 리턴)
    // =============================================================
    if (!title) return res.status(400).json({ error: '원작 제목이 입력되지 않았습니다.' });

    // 분석 품질 핵심 3: 축약 스키마 대신 정식 분석 가이드라인 + 완전한 스키마를 프롬프트에 이식
    const promptJson = `다음 원작 IP를 한국 드라마로 제작할 가능성 관점에서 심층 분석해줘.
원작의 실제 대중적 평가, 줄거리, 캐릭터 설정, 팬덤/커뮤니티 반응을 근거로 분석하고,
반드시 순수 JSON 데이터 1개만 출력해. JSON 밖에는 어떤 설명도 쓰지 마.

원작 제목: ${title}

주요 분석 가이드라인:
1. 주인공 4인(핵심 주연급)을 선정하여 심층 분석해줘. mainCharacters 배열에 반드시 4명을 포함해.
2. 각 캐릭터의 'traits'란에는 원작에서 보여준 대표적인 대사 스타일, 시그니처 행동 패턴, 혹은 작중 타 인물들이나 커뮤니티의 평가를 녹여내서 구체적으로 작성해줘. (최소 2~3문장)
3. 'appealPoints'에는 독자/시청자들이 열광하는 결정적 입덕 매력 요소를 기술해줘.
4. 'improvements'에는 원작 매체의 문법을 드라마 편수로 바꿀 때 반드시 보완해야 하는 단점 및 각색 방향을 짚어줘.
5. 점수 체계는 10.0점 만점이며, 소수점 첫째 자리(예: 8.5)까지 세부적으로 평가해줘. 항목별로 점수 차이를 두고 냉정하게 평가해.
6. strengths는 반드시 서로 다른 관점(예: 스토리 구조 / 시장·팬덤 / 제작·연출)의 강점 3가지를 배열로 작성해줘.
7. risks는 반드시 서로 다른 리스크 3가지를 배열로 작성해줘. 권리 관계, 실존 인물 묘사, 현지 규제 등 법적·제작 리스크가 있다면 반드시 명시해.
8. comparables는 반드시 유사 성공작 3가지를 배열로 작성해줘.
9. targetAudience는 연령대/성별/취향 등 3가지 측면을 포함해서 작성하되, 각 측면을 ' / '로 구분해줘. 예: "30-40대 직장인 남성 / 복수극 선호 여성층 / 재벌 드라마 팬덤"
10. castingDirection은 주연/조연/연출 방향 3가지를 포함해서 작성하되, 각 항목을 ' / '로 구분해줘. 예: "주연: 냉철한 30대 남자 배우 / 여주: 강단 있는 커리어우먼 이미지 / 연출: 장르와 감성 균형 잡는 감독"
11. premise는 세계관/설정/갈등구조 3가지 특징을 포함해서 작성하되, 각 항목을 ① ② ③ 으로 구분해줘.
12. scoreRationales는 scores의 7개 항목과 같은 key를 반드시 포함해줘.
13. scoreRationales의 각 항목은 왜 그 점수를 줬는지 1~2문장으로 설명해줘. 단순 칭찬이 아니라 원작의 장점, 약점, 제작/시장 리스크를 같이 반영해줘.
14. scoreRationales의 key는 반드시 dramaFit, marketPotential, productionFeasibility, originality, scalability, globalPotential, characterAppeal 순서로 작성해줘.
15. 원작 정보가 불확실하거나 확인이 어려우면 notes에 "정보 제한적, 추가 리서치 권장"을 명시하고 recommendation을 "리서치 필요"로 설정해.

점수 항목 정의:
- dramaFit: 한국 드라마 문법, 회차별 사건 구성, 감정선 지속 가능성
- marketPotential: 대중성, 원작 팬덤, 화제성, 편성/플랫폼 매력
- productionFeasibility: 제작비, CG/액션/세트 난도, 캐스팅 부담
- originality: 설정과 장르 변주의 신선도, 기존 작품과의 차별성
- scalability: 시즌제, 스핀오프, 부가 IP 확장 가능성
- globalPotential: 해외 시청자 이해도, 보편 정서, 글로벌 플랫폼 적합성
- characterAppeal: 주연급 인물의 매력, 관계성, 팬덤 형성 가능성

아래 명시된 스키마 JSON 포맷을 완벽하게 준수해줘:

{
  "title": "${title}",
  "originalType": "웹툰 | 웹소설 | 소설 | 영화 | 게임 | 기타 중 택1",
  "genre": ["장르1", "장르2", "장르3"],
  "logline": "한 줄 소개",
  "premise": "① 세계관 특징 ② 설정 특징 ③ 갈등구조 특징",
  "mainCharacters": [
    { "name": "주인공1 이름", "role": "남주1 등", "traits": "대사 스타일/시그니처 행동/커뮤니티 평가", "appealPoints": "입덕 포인트", "improvements": "드라마화 각색 보완점" },
    { "name": "주인공2 이름", "role": "여주1 등", "traits": "대사 스타일/시그니처 행동/커뮤니티 평가", "appealPoints": "입덕 포인트", "improvements": "드라마화 각색 보완점" },
    { "name": "주인공3 이름", "role": "서브남주 등", "traits": "대사 스타일/시그니처 행동/커뮤니티 평가", "appealPoints": "입덕 포인트", "improvements": "드라마화 각색 보완점" },
    { "name": "주인공4 이름", "role": "빌런/조력자 등", "traits": "대사 스타일/시그니처 행동/커뮤니티 평가", "appealPoints": "입덕 포인트", "improvements": "드라마화 각색 보완점" }
  ],
  "strengths": ["강점1 — 서로 다른 관점", "강점2 — 서로 다른 관점", "강점3 — 서로 다른 관점"],
  "risks": ["리스크1", "리스크2", "리스크3"],
  "targetAudience": "연령대 측면 / 성별 측면 / 취향 측면",
  "productionDifficulty": "낮음 | 보통 | 높음 중 택1",
  "castingDirection": "주연 방향 / 조연 방향 / 연출 방향",
  "comparables": ["유사 성공작1", "유사 성공작2", "유사 성공작3"],
  "recommendation": "추천 | 보류 | 리서치 필요 중 택1",
  "scores": {
    "dramaFit": 0.0,
    "marketPotential": 0.0,
    "productionFeasibility": 0.0,
    "originality": 0.0,
    "scalability": 0.0,
    "globalPotential": 0.0,
    "characterAppeal": 0.0
  },
  "scoreRationales": {
    "dramaFit": "장단점과 리스크를 반영한 근거 1~2문장",
    "marketPotential": "근거 1~2문장",
    "productionFeasibility": "근거 1~2문장",
    "originality": "근거 1~2문장",
    "scalability": "근거 1~2문장",
    "globalPotential": "근거 1~2문장",
    "characterAppeal": "근거 1~2문장"
  },
  "notes": "검토 메모 (정보 제한 시 '정보 제한적, 추가 리서치 권장' 명시)"
}`;

    const resultJson = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: promptJson }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7,
        maxOutputTokens: 8192
      }
    });

    let responseText = resultJson.response.text().trim();
    if (responseText.startsWith("```")) {
      responseText = responseText.replace(/^```json/, "").replace(/^```/, "").replace(/```$/, "").trim();
    }

    const parsedPayload = JSON.parse(responseText);
    return res.status(200).json({ success: true, payload: parsedPayload });

  } catch (error) {
    console.error("백엔드 런타임 오류:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
