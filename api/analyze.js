// api/analyze.js
// ✨ v2: Google Search 그라운딩 적용 — Gemini가 실제 웹 검색으로 원작 정보를 조사한 뒤 분석
// ⚠️ 신형 SDK(@google/genai) 필요 — package.json도 함께 교체하세요.
import { GoogleGenAI } from '@google/genai';

const MODEL_NAME = "gemini-2.5-flash"; // 품질 우선이면 "gemini-2.5-pro" (단, 응답 느려짐)

const SYSTEM_PERSONA =
  "당신은 한국 드라마 제작사의 수석 IP 기획 프로듀서이자 콘텐츠 분석 전문가입니다. " +
  "웹툰·웹소설·소설·영화·게임 원작의 드라마화 적합성을 평가하는 심층 리포트를 작성합니다. " +
  "반드시 제공된 리서치 자료와 검색으로 확인된 사실에만 근거해 분석하며, " +
  "확인되지 않은 등장인물 이름, 설정, 줄거리를 절대 지어내지 않습니다. " +
  "칭찬 일변도가 아니라 약점과 제작·시장·법적 리스크를 균형 있게 반영합니다.";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { title, item, mode } = req.body;

  // ⚠️ 보안: API 키는 반드시 Vercel 환경변수로만 관리 (코드 하드코딩 금지)
  const apiKey = (process.env.GEMINI_API_KEY || "").trim().replace(/['"]/g, "");
  if (!apiKey) {
    return res.status(500).json({ success: false, error: 'GEMINI_API_KEY 환경변수가 설정되지 않았습니다.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

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

      const result = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_PERSONA,
          temperature: 0.7,
          maxOutputTokens: 8192
        }
      });

      const responseText = result.text || "<p>리포트를 생성할 수 없습니다.</p>";
      return res.status(200).json({ result: responseText });
    }

    // =============================================================
    // Case 2: 대시보드 메인 — 2단계 파이프라인 (검색 리서치 → JSON 구조화)
    // =============================================================
    if (!title) return res.status(400).json({ error: '원작 제목이 입력되지 않았습니다.' });

    // -------------------------------------------------------------
    // [1단계] Google Search 그라운딩으로 원작 사실 정보 리서치
    //   ※ 그라운딩과 JSON 강제 출력은 동시 사용이 불가하므로 단계를 분리
    // -------------------------------------------------------------
    const researchPrompt = `원작 작품 [${title}]에 대해 웹 검색을 수행하여 아래 항목의 "사실 정보"를 한국어로 정리해줘.

조사 항목:
1. 정확한 작품 유형(웹툰/웹소설/소설/영화/게임)과 연재 플랫폼, 작가, 연재 시기
2. 실제 줄거리와 세계관/설정 (구체적으로)
3. 주요 등장인물 4인 이상의 "정확한 이름", 역할, 성격, 대표적인 대사나 행동 특징
4. 독자/시청자 평가, 커뮤니티 반응, 팬덤 규모, 흥행 성적(조회수·평점·판매량 등)
5. 이미 드라마화/영상화가 진행되었거나 판권 관련 소식이 있는지
6. 유사한 성공 작품

중요 규칙:
- 검색으로 확인된 사실만 정리하고, 확인되지 않는 내용은 "확인 불가"라고 명시해.
- 등장인물 이름은 절대 추측하지 말고 검색 결과에서 확인된 이름만 써.
- 검색 결과가 거의 없거나 동명의 다른 작품과 혼동될 여지가 있으면 그 사실을 반드시 첫 줄에 명시해.`;

    const researchResult = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: researchPrompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.2 // 리서치 단계는 사실성 우선 → 낮은 온도
      }
    });

    const researchText = researchResult.text || "";
    if (!researchText.trim()) {
      throw new Error("원작 리서치 단계에서 응답을 받지 못했습니다.");
    }

    // -------------------------------------------------------------
    // [2단계] 리서치 결과를 근거로 분석 JSON 구조화
    // -------------------------------------------------------------
    const promptJson = `다음 원작 IP를 한국 드라마로 제작할 가능성 관점에서 심층 분석해줘.
아래 [리서치 자료]는 웹 검색으로 확인된 사실 정보야. 반드시 이 자료에 근거해서 분석하고,
자료에 없는 등장인물 이름이나 설정을 절대 지어내지 마.
반드시 순수 JSON 데이터 1개만 출력해. JSON 밖에는 어떤 설명도 쓰지 마.

원작 제목: ${title}

[리서치 자료]
${researchText}

주요 분석 가이드라인:
1. 주인공 4인(핵심 주연급)을 선정하여 심층 분석해줘. mainCharacters 배열에 4명을 포함하되, 리서치 자료에서 확인된 인물이 4명 미만이면 확인된 인물만 포함해.
2. 각 캐릭터의 'traits'란에는 원작에서 보여준 대표적인 대사 스타일, 시그니처 행동 패턴, 혹은 작중 타 인물들이나 커뮤니티의 평가를 녹여내서 구체적으로 작성해줘. (최소 2~3문장)
3. 'appealPoints'에는 독자/시청자들이 열광하는 결정적 입덕 매력 요소를 기술해줘.
4. 'improvements'에는 원작 매체의 문법을 드라마 편수로 바꿀 때 반드시 보완해야 하는 단점 및 각색 방향을 짚어줘.
5. 점수 체계는 10.0점 만점이며, 소수점 첫째 자리(예: 8.5)까지 세부적으로 평가해줘. 항목별로 점수 차이를 두고 냉정하게 평가해.
6. strengths는 반드시 서로 다른 관점(예: 스토리 구조 / 시장·팬덤 / 제작·연출)의 강점 3가지를 배열로 작성해줘.
7. risks는 반드시 서로 다른 리스크 3가지를 배열로 작성해줘. 권리 관계, 실존 인물 묘사, 현지 규제 등 법적·제작 리스크가 있다면 반드시 명시해.
8. comparables는 반드시 유사 성공작 3가지를 배열로 작성해줘.
9. targetAudience는 연령대/성별/취향 등 3가지 측면을 포함해서 작성하되, 각 측면을 ' / '로 구분해줘.
10. castingDirection은 주연/조연/연출 방향 3가지를 포함해서 작성하되, 각 항목을 ' / '로 구분해줘.
11. premise는 세계관/설정/갈등구조 3가지 특징을 포함해서 작성하되, 각 항목을 ① ② ③ 으로 구분해줘.
12. scoreRationales는 scores의 7개 항목과 같은 key를 반드시 포함해줘.
13. scoreRationales의 각 항목은 왜 그 점수를 줬는지 1~2문장으로 설명해줘. 단순 칭찬이 아니라 원작의 장점, 약점, 제작/시장 리스크를 같이 반영해줘.
14. scoreRationales의 key는 반드시 dramaFit, marketPotential, productionFeasibility, originality, scalability, globalPotential, characterAppeal 순서로 작성해줘.
15. 리서치 자료에 "확인 불가" 항목이 많거나 정보가 부족하면 notes에 "정보 제한적, 추가 리서치 권장"을 명시하고 recommendation을 "리서치 필요"로 설정해. 동명의 다른 작품과 혼동 여지가 있다면 notes에 그 사실도 명시해.

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
    { "name": "확인된 실제 인물명", "role": "남주1 등", "traits": "대사 스타일/시그니처 행동/커뮤니티 평가", "appealPoints": "입덕 포인트", "improvements": "드라마화 각색 보완점" }
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

    const resultJson = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: promptJson,
      config: {
        systemInstruction: SYSTEM_PERSONA,
        responseMimeType: "application/json",
        temperature: 0.6,
        maxOutputTokens: 8192
      }
    });

    let responseText = (resultJson.text || "").trim();
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
