// api/analyze.js
// ✨ v5: 빈 응답(finishReason: STOP) 안정화 버전
//   - 3단계 파이프라인: ①작품 개요 검색 → ②인물 심층 검색 → ③분석 JSON 구조화
//   - 빈 응답 발생 시 자동 재시도 (최대 3회)
//   - 검색 리서치 단계는 thinking 비활성화 → 빈 응답 현상 차단 + 속도 개선
//   - 에러 메시지에 실패 단계 표시
//   - SDK 의존성 제로 (REST 직접 호출)

const RESEARCH_MODEL = "gemini-2.5-flash"; // 검색 리서치 단계
const ANALYSIS_MODEL = "gemini-2.5-flash"; // 최종 분석 단계 (유료 결제 시 "gemini-2.5-pro" 권장)
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const SYSTEM_PERSONA =
  "당신은 한국 드라마 제작사의 수석 IP 기획 프로듀서이자 콘텐츠 분석 전문가입니다. " +
  "웹툰·웹소설·소설·영화·게임 원작의 드라마화 적합성을 평가하는 심층 분석을 수행합니다. " +
  "반드시 제공된 리서치 자료와 검색으로 확인된 사실에만 근거해 분석하며, " +
  "확인되지 않은 등장인물 이름, 설정, 줄거리를 절대 지어내지 않습니다. " +
  "칭찬 일변도가 아니라 약점과 제작·시장·법적 리스크를 균형 있게 반영하고, " +
  "점수는 항목 간 차이를 두어 냉정하게 평가합니다.";

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Gemini REST 호출 공통 함수 — 빈 응답 시 자동 재시도 (최대 3회)
async function callGemini(apiKey, { model, prompt, label = "", useSearch = false, jsonMode = false, temperature = 0.7, thinkingBudget = null }) {
  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PERSONA }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature,
      maxOutputTokens: 16384
    }
  };

  // thinkingBudget: 0이면 thinking 비활성화 (빈 응답 현상 차단 + 속도 향상)
  if (thinkingBudget !== null) {
    body.generationConfig.thinkingConfig = { thinkingBudget };
  }
  if (useSearch) {
    body.tools = [{ google_search: {} }];
  }
  if (jsonMode) {
    body.generationConfig.responseMimeType = "application/json";
  }

  const MAX_ATTEMPTS = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await fetch(`${API_BASE}/${model}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify(body)
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const googleMsg = data?.error?.message || `HTTP ${response.status}`;
      // 429(할당량)나 503(과부하)은 잠시 대기 후 재시도, 그 외는 즉시 실패
      if ((response.status === 429 || response.status === 503) && attempt < MAX_ATTEMPTS) {
        lastError = new Error(`[${label}] Gemini API 오류 (${model}): ${googleMsg}`);
        await sleep(3000 * attempt);
        continue;
      }
      throw new Error(`[${label}] Gemini API 오류 (${model}): ${googleMsg}`);
    }

    // thought(내부 사고) 파트는 제외하고 실제 텍스트 파트만 수집
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text = parts.filter(p => !p.thought).map(p => p.text || "").join("").trim();

    if (text) return text;

    // 빈 응답 → 재시도
    const finishReason = data?.candidates?.[0]?.finishReason || "UNKNOWN";
    lastError = new Error(`[${label}] Gemini 응답이 비어 있습니다. (${model}, finishReason: ${finishReason}, 시도 ${attempt}/${MAX_ATTEMPTS})`);
    if (attempt < MAX_ATTEMPTS) await sleep(1500 * attempt);
  }

  throw lastError;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { title } = req.body;

  // ⚠️ 보안: API 키는 반드시 Vercel 환경변수로만 관리 (코드 하드코딩 금지)
  const apiKey = (process.env.GEMINI_API_KEY || "").trim().replace(/['"]/g, "");
  if (!apiKey) {
    return res.status(500).json({ success: false, error: 'GEMINI_API_KEY 환경변수가 설정되지 않았습니다.' });
  }

  if (!title) return res.status(400).json({ error: '원작 제목이 입력되지 않았습니다.' });

  try {
    // =============================================================
    // [1단계] 작품 개요 리서치 — Google Search 그라운딩
    // =============================================================
    const overviewPrompt = `원작 작품 [${title}]에 대해 웹 검색을 수행하여 아래 항목의 "사실 정보"를 한국어로 정리해줘.

조사 항목:
1. 정확한 작품 유형(웹툰/웹소설/소설/영화/게임)과 연재/공개 플랫폼, 작가, 연재 시기, 완결 여부
2. 실제 줄거리 전개와 세계관/설정 (초반-중반-결말 구조까지 구체적으로)
3. 장르 및 핵심 소재
4. 독자/시청자 평가, 흥행 성적 (조회수, 평점, 판매량, 랭킹 등 구체적 수치 위주)
5. 이미 드라마화/영상화가 진행되었거나 판권 계약 소식이 있는지 (있다면 제작사, 방영 시기)
6. 원작자 관련 이슈나 논란, 권리 관계상 특이사항
7. 유사한 성공 작품과 그 성과

중요 규칙:
- 검색으로 확인된 사실만 정리하고, 확인되지 않는 내용은 "확인 불가"라고 명시해.
- 검색 결과가 거의 없거나 동명의 다른 작품이 여러 개 존재하면, 그 사실을 반드시 첫 줄에 명시하고 각 작품을 구분해서 정리해.
- 추측이나 일반론으로 빈칸을 채우지 마.`;

    const overviewText = await callGemini(apiKey, {
      model: RESEARCH_MODEL,
      prompt: overviewPrompt,
      label: "1단계 작품 리서치",
      useSearch: true,
      temperature: 0.2,
      thinkingBudget: 0 // 검색 단계는 thinking 불필요 → 빈 응답 차단 + 속도 향상
    });

    // =============================================================
    // [2단계] 등장인물 전용 심층 리서치 — Google Search 그라운딩
    //   ※ 인물 정보가 가장 자주 틀리는 영역이라 별도 검색으로 분리
    // =============================================================
    const characterPrompt = `원작 작품 [${title}]의 "등장인물"에 대해 웹 검색을 수행하여 아래 항목을 한국어로 정리해줘.

작품 특정을 위한 참고 정보 (1차 조사 결과):
${overviewText.slice(0, 1500)}

조사 항목 (주연급 인물 4인 이상, 각 인물별로):
1. 정확한 이름 (한글 표기 원칙, 검색으로 확인된 이름만)
2. 작중 역할과 위치 (남주/여주/서브/빌런 등)
3. 성격과 행동 패턴, 대표적인 대사 스타일이나 명대사
4. 다른 등장인물들이 그 인물을 어떻게 평가하는지
5. 독자/시청자 커뮤니티에서의 인기와 반응 (입덕 포인트, 밈, 논쟁 등)
6. 인물 간 관계성 (러브라인, 대립 구도, 서사적 연결)

중요 규칙:
- 인물 이름은 절대 추측하거나 창작하지 말고, 검색 결과에서 확인된 이름만 써.
- 확인된 주연급 인물이 4명 미만이면 확인된 인물만 정리하고 그 사실을 명시해.
- 인물 정보를 찾을 수 없으면 "인물 정보 확인 불가"라고 명확히 밝혀.`;

    const characterText = await callGemini(apiKey, {
      model: RESEARCH_MODEL,
      prompt: characterPrompt,
      label: "2단계 인물 리서치",
      useSearch: true,
      temperature: 0.2,
      thinkingBudget: 0
    });

    // =============================================================
    // [3단계] 심층 분석 JSON 구조화 — 최상위 모델(pro)
    //   ※ 그라운딩과 JSON 강제 출력은 동시 사용 불가 → 단계 분리
    // =============================================================
    const promptJson = `다음 원작 IP를 한국 드라마로 제작할 가능성 관점에서 심층 분석해줘.
아래 [작품 리서치]와 [인물 리서치]는 웹 검색으로 확인된 사실 정보야. 반드시 이 자료에 근거해서 분석하고,
자료에 없는 등장인물 이름이나 설정을 절대 지어내지 마.
반드시 순수 JSON 데이터 1개만 출력해. JSON 밖에는 어떤 설명도 쓰지 마.

원작 제목: ${title}

[작품 리서치]
${overviewText}

[인물 리서치]
${characterText}

주요 분석 가이드라인:
1. 주인공 4인(핵심 주연급)을 선정하여 심층 분석해줘. mainCharacters 배열에 4명을 포함하되, 인물 리서치에서 확인된 인물이 4명 미만이면 확인된 인물만 포함해.
2. 각 캐릭터의 'traits'란에는 원작에서 보여준 대표적인 대사 스타일, 시그니처 행동 패턴, 혹은 작중 타 인물들이나 커뮤니티의 평가를 녹여내서 구체적으로 작성해줘. (최소 2~3문장)
3. 'appealPoints'에는 독자/시청자들이 열광하는 결정적 입덕 매력 요소를 기술해줘.
4. 'improvements'에는 원작 매체의 문법을 드라마 편수로 바꿀 때 반드시 보완해야 하는 단점 및 각색 방향을 짚어줘.
5. 점수 체계는 10.0점 만점이며, 소수점 첫째 자리(예: 8.5)까지 세부적으로 평가해줘. 항목별로 점수 차이를 두고 냉정하게 평가해. 리서치에서 확인된 흥행 수치와 팬덤 규모를 marketPotential에 반영해.
6. strengths는 반드시 서로 다른 관점(예: 스토리 구조 / 시장·팬덤 / 제작·연출)의 강점 3가지를 배열로 작성해줘.
7. risks는 반드시 서로 다른 리스크 3가지를 배열로 작성해줘. 리서치에서 확인된 권리 관계, 기존 영상화 이력, 원작자 이슈, 실존 인물 묘사, 현지 규제 등 법적·제작 리스크가 있다면 반드시 명시해.
8. comparables는 반드시 유사 성공작 3가지를 배열로 작성해줘.
9. targetAudience는 연령대/성별/취향 등 3가지 측면을 포함해서 작성하되, 각 측면을 ' / '로 구분해줘. 예: "30-40대 직장인 남성 / 복수극 선호 여성층 / 재벌 드라마 팬덤"
10. castingDirection은 주연/조연/연출 방향 3가지를 포함해서 작성하되, 각 항목을 ' / '로 구분해줘. 예: "주연: 냉철한 30대 남자 배우 / 여주: 강단 있는 커리어우먼 이미지 / 연출: 장르와 감성 균형 잡는 감독"
11. premise는 세계관/설정/갈등구조 3가지 특징을 포함해서 작성하되, 각 항목을 ① ② ③ 으로 구분해줘.
12. scoreRationales는 scores의 7개 항목과 같은 key를 반드시 포함해줘.
13. scoreRationales의 각 항목은 왜 그 점수를 줬는지 1~2문장으로 설명해줘. 단순 칭찬이 아니라 원작의 장점, 약점, 제작/시장 리스크를 같이 반영해줘.
14. scoreRationales의 key는 반드시 dramaFit, marketPotential, productionFeasibility, originality, scalability, globalPotential, characterAppeal 순서로 작성해줘.
15. 리서치 자료에 "확인 불가" 항목이 많거나 정보가 부족하면 notes에 "정보 제한적, 추가 리서치 권장"을 명시하고 recommendation을 "리서치 필요"로 설정해. 동명의 다른 작품과 혼동 여지가 있다면 notes에 그 사실도 명시해. 이미 영상화가 진행된 작품이면 notes에 그 이력을 명시해.

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

    let responseText = await callGemini(apiKey, {
      model: ANALYSIS_MODEL,
      prompt: promptJson,
      label: "3단계 분석 구조화",
      jsonMode: true,
      temperature: 0.5,
      thinkingBudget: 2048 // 분석 단계는 적당한 thinking 허용 (품질 유지)
    });

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
