// app.js
// ==========================================
// 1. Supabase 환경 설정
// ==========================================
const SUPABASE_URL = "https://ozhdfewlboheqpcvbqgz.supabase.co";
const SUPABASE_KEY = "sb_publishable_VBrlZgSIDMwO6htQd8fXkQ_HkUxmg3z";

let supabaseClient = null;

function initSupabase() {
  try {
    const lib = window.supabase || window.Supabase;
    if (lib && typeof lib.createClient === "function") {
      supabaseClient = lib.createClient(SUPABASE_URL, SUPABASE_KEY);
      console.log("Supabase 연동 성공");
      return true;
    }
    console.warn("Supabase 라이브러리 없음 — 로컬 스토리지 모드");
  } catch (e) {
    console.error("Supabase 초기화 실패:", e);
  }
  return false;
}

const STORAGE_KEY = "kdrama-ip-dashboard-v1";
const MIGRATION_KEY = `${STORAGE_KEY}-migrated-to-supabase`;

const scoreLabels = {
  dramaFit: "드라마 적합",
  marketPotential: "흥행성",
  productionFeasibility: "제작성",
  originality: "차별성",
  scalability: "확장성",
  globalPotential: "글로벌",
  characterAppeal: "캐릭터 매력도",
};

// 총점(평균) 집계에서 제외하는 참고 항목 — 점수·근거는 표시만 함
const TOTAL_EXCLUDED_KEYS = ["productionFeasibility", "globalPotential"];
const totalScoreKeys = Object.keys(scoreLabels).filter((key) => !TOTAL_EXCLUDED_KEYS.includes(key));

const requiredShape = {
  title: "원작 제목",
  originalType: "웹툰 | 웹소설 | 소설 | 영화 | 게임 | 기타",
  genre: ["장르1", "장르2", "장르3"],
  logline: "한 줄 소개",
  premise: "세계관/설정/갈등구조 3가지 특징을 포함한 핵심 설정",
  mainCharacters: [
    {
      name: "주인공 이름",
      role: "주연 역할 (남주1, 여주1 등)",
      traits: "대사/행동/주변 평가 특징",
      appealPoints: "시청자 입덕 포인트",
      improvements: "드라마화 시 개선/각색 포인트"
    }
  ],
  strengths: ["강점1 — 서로 다른 관점", "강점2 — 서로 다른 관점", "강점3 — 서로 다른 관점"],
  risks: ["리스크1", "리스크2", "리스크3"],
  targetAudience: "연령대/성별/취향 등 3가지 측면을 포함한 타깃층",
  productionDifficulty: "낮음 | 보통 | 높음",
  castingDirection: "주연/조연/연출 방향 3가지를 포함한 캐스팅 방향",
  comparables: ["유사 성공작1", "유사 성공작2", "유사 성공작3"],
  recommendation: "추천 | 보류 | 리서치 필요",
  recommendationReason: "보류·리서치 필요일 때 그 사유 한 줄",
  scores: {
    dramaFit: 0.0,
    marketPotential: 0.0,
    productionFeasibility: 0.0,
    originality: 0.0,
    scalability: 0.0,
    globalPotential: 0.0,
    characterAppeal: 0.0,
  },
  scoreRationales: {
    dramaFit: "드라마 적합 점수를 이렇게 준 이유",
    marketPotential: "흥행성 점수를 이렇게 준 이유",
    productionFeasibility: "제작성 점수를 이렇게 준 이유",
    originality: "차별성 점수를 이렇게 준 이유",
    scalability: "확장성 점수를 이렇게 준 이유",
    globalPotential: "글로벌 점수를 이렇게 준 이유",
    characterAppeal: "캐릭터 매력도 점수를 이렇게 준 이유",
  },
  characterAnalysis: {
    kr: { personality: 0.0, conflict: 0.0, occupation: 0.0 },
    na: { personality: 0.0, conflict: 0.0, occupation: 0.0 },
    reason: "가장 큰 매력 요소 / 가장 큰 약점 / 북미 각색 시 보완점",
    evidence: ["근거가 된 반응 또는 출처"],
    confidence: "높음 | 중간 | 낮음"
  },
  notes: "선택 메모",
};

const sampleIp = {
  title: "회귀한 재벌집 기획자",
  originalType: "웹소설",
  genre: ["복수", "오피스", "가족"],
  logline: "몰락한 콘텐츠 기획자가 과거로 돌아가 재벌가의 IP 전쟁 한복판에서 자신의 죽음을 설계한 사람을 추적한다.",
  premise: "① 엔터테인먼트와 재벌 승계를 결합한 콘텐츠 산업 세계관 ② 주인공은 미래 흥행 데이터를 기억하는 회귀자 설정 ③ 권력과 윤리 사이에서 선택을 강요받는 도덕적 딜레마 구조",
  mainCharacters: [
    {
      name: "진도준 (남주1)",
      role: "회귀한 콘텐츠 기획자",
      traits: "냉철하고 뼈 때리는 대사 구사. '비즈니스는 감정이 아니라 숫자로 하는 겁니다'라며 이성적으로 행동함.",
      appealPoints: "과거 지식을 활용한 빌업 타율과 카타르시스 선사.",
      improvements: "드라마 후반부 만능 해결사 느낌을 줄이고 인간적 고뇌 추가 필요."
    },
    {
      name: "서민영 (여주1)",
      role: "특수부 검사",
      traits: "주변에서 '독종 검사'로 평가받음. 법과 원칙을 무조건 사수하려는 불도저 같은 신념 행동 표출.",
      appealPoints: "거대 권력 앞에서도 기죽지 않는 주체적인 크러시 매력.",
      improvements: "남주의 복수극에 서사가 묻히지 않도록 대립과 공조 텐션 강화 요망."
    }
  ],
  strengths: [
    "한국 드라마에 강한 복수/가족/권력 구도가 선명하다.",
    "콘텐츠 산업 배경이라 시청자 공감대와 확장성이 높다.",
    "회귀물 특유의 빌업 카타르시스와 미스터리 요소가 결합돼 몰입도가 강하다."
  ],
  risks: [
    "재벌가 복수물의 기시감이 있어 차별적 직업 디테일이 필요하다.",
    "회귀 설정 특성상 후반부 긴장감 유지가 어렵다.",
    "엔터산업 내부 묘사가 부정확할 경우 업계 팬덤 이탈 우려가 있다."
  ],
  targetAudience: "30-50대 복수극 시청자 / 웹소설 원작 팬덤 여성층 / 직장인 공감 코드를 선호하는 시청자",
  productionDifficulty: "보통",
  castingDirection: "주연: 지적인 긴장감을 가진 30대 남성 / 여주: 강단 있는 커리어 여성 이미지 / 연출: 장르와 감정선을 동시에 살리는 연출자",
  comparables: ["재벌집 막내아들", "스토브리그", "미생"],
  recommendation: "추천",
  scores: {
    dramaFit: 8.5,
    marketPotential: 9.2,
    productionFeasibility: 6.5,
    originality: 7.8,
    scalability: 8.5,
    globalPotential: 7.0,
    characterAppeal: 9.5
  },
  scoreRationales: {
    dramaFit: "복수, 가족 권력, 회귀라는 한국 드라마 친화적 장치가 뚜렷하고 회차별 미션 구조로 나누기 쉽다. 다만 후반부 반복감을 줄이는 각색이 필요해 만점보다는 낮게 평가했다.",
    marketPotential: "재벌가 복수극 및 직장인 성공 판타지가 결합돼 대중적 진입 장벽이 낮고, 원작형 회귀물 팬덤까지 흡수할 수 " + "있다.",
    productionFeasibility: "현대극 기반이라 기본 제작 난도는 중간이지만 재벌가 공간, 기업 인수전 묘사를 설득력 있게 구현하려면 세트와 고급 조연 캐스팅 비용이 올라갈 수 있다.",
    originality: "회귀 재벌 복수물 자체는 익숙하지만 엔터 IP 산업을 전면에 놓는 점이 차별화 포인트다.",
    scalability: "콘텐츠 기업, 아이돌, 제작사, 플랫폼 전쟁 등으로 에피소드 확장이 쉽고 시즌제나 스핀오프 가능성도 있다.",
    globalPotential: "권력 승계와 복수 정서는 보편적이지만 한국 재벌·엔터 산업의 세부 맥락은 해외 시청자에게 설명이 필요할 수 있습니다.",
    characterAppeal: "미래 정보를 활용하는 전략형 남주와 강단 있는 검사 캐릭터가 팬덤을 만들기 좋다."
  },
  notes: "차별화 포인트는 엔터 산업 리얼리티와 주인공의 도덕적 딜레마.",
};

const els = {
  views: document.querySelectorAll(".view"),
  navButtons: document.querySelectorAll(".nav-btn"),
  totalCount: document.querySelector("#totalCount"),
  recommendedCount: document.querySelector("#recommendedCount"),
  averageScore: document.querySelector("#averageScore"),
  researchCount: document.querySelector("#researchCount"),
  heldCount: document.querySelector("#heldCount"),
  statusTabs: document.querySelector("#statusTabs"),
  researchList: document.querySelector("#researchList"),
  holdList: document.querySelector("#holdList"),
  researchNavCount: document.querySelector("#researchNavCount"),
  favoriteList: document.querySelector("#favoriteList"),
  favoriteNavCount: document.querySelector("#favoriteNavCount"),
  searchInput: document.querySelector("#searchInput"),
  typeFilter: document.querySelector("#typeFilter"),
  sortSelect: document.querySelector("#sortSelect"),
  ipList: document.querySelector("#ipList"),
  emptyState: document.querySelector("#emptyState"),
  detailPanel: document.querySelector("#detailPanel"),
  detailTemplate: document.querySelector("#detailTemplate"),
  detailViewTitle: document.querySelector("#detailViewTitle"),
  backBtn: document.querySelector("#backBtn"),
  addSampleBtn: document.querySelector("#addSampleBtn"),
  toggleSelectBtn: document.querySelector("#toggleSelectBtn"),
  deleteSelectedBtn: document.querySelector("#deleteSelectedBtn"),
  pasteSampleBtn: document.querySelector("#pasteSampleBtn"),
  clearFormBtn: document.querySelector("#clearFormBtn"),
  jsonInput: document.querySelector("#jsonInput"),
  validateBtn: document.querySelector("#validateBtn"),
  saveBtn: document.querySelector("#saveBtn"),
  formMessage: document.querySelector("#formMessage"),
  schemaPreview: document.querySelector("#schemaPreview"),
  promptTitle: document.querySelector("#promptTitle"),
  promptText: document.querySelector("#promptText"),
  copyPromptBtn: document.querySelector("#copyPromptBtn"),
  copyMessage: document.querySelector("#copyMessage"),
  exportBtn: document.querySelector("#exportBtn"),
  backupText: document.querySelector("#backupText"),
  backupFileInput: document.querySelector("#backupFileInput"),
  restoreInput: document.querySelector("#restoreInput"),
  restoreBtn: document.querySelector("#restoreBtn"),
  backupMessage: document.querySelector("#backupMessage"),
  
  aiAnalysisSection: document.querySelector("#ai-analysis-section"),
  reanalyzeBtn: document.querySelector("#reanalyze-btn"),
  analysisLoading: document.querySelector("#analysis-loading"),
  analysisResult: document.querySelector("#analysis-result"),

  autoGenTitle: document.querySelector("#autoGenTitle"),
  autoGenBtn: document.querySelector("#autoGenBtn"),
  autoGenStatus: document.querySelector("#autoGenStatus")
};

let items = [];
let selectedId = null;
let selectMode = false;
let selectedIds = new Set();
let statusFilter = "all";

if (els.schemaPreview) {
  els.schemaPreview.textContent = JSON.stringify(requiredShape, null, 2);
}

// ==========================================
// 2. Supabase 동기화 함수
// ==========================================
function getLocalItems() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(parsed) ? parsed.map((item) => normalizeItem(item, { keepUpdatedAt: true })) : [];
  } catch {
    return [];
  }
}

function setLocalItems(nextItems) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextItems));
}

function getErrorMessage(error) {
  if (!error) return "알 수 없는 오류";
  if (typeof error === "string") return error;
  if (error.message) return error.message;
  try { return JSON.stringify(error); } catch { return String(error); }
}

function rowToItem(dbItem) {
  const content = dbItem?.content && typeof dbItem.content === "object" ? dbItem.content : {};
  return normalizeItem({
    ...content,
    id: dbItem.id || content.id,
    title: dbItem.title || content.title,
    createdAt: dbItem.createdAt || content.createdAt,
    updatedAt: dbItem.updatedAt || content.updatedAt,
  }, { keepUpdatedAt: true });
}

async function saveItemToCloud(normalizedItem) {
  if (!supabaseClient) return { ok: false, mode: "local", error: "Supabase client가 초기화되지 않았습니다." };
  const dbPayload = {
    id: normalizedItem.id,
    title: normalizedItem.title,
    createdAt: normalizedItem.createdAt,
    updatedAt: normalizedItem.updatedAt,
    content: normalizedItem,
  };
  const { error } = await supabaseClient.from("kdrama_ips").upsert(dbPayload, { onConflict: "id" });
  if (error) return { ok: false, mode: "cloud", error };
  return { ok: true, mode: "cloud" };
}

async function syncLoadItems() {
  const localItems = getLocalItems();
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from("kdrama_ips")
        .select("id,title,createdAt,updatedAt,content")
        .order("updatedAt", { ascending: false });
      if (error) throw error;
      const cloudItems = Array.isArray(data) ? data.map(rowToItem) : [];
      if (cloudItems.length === 0 && localItems.length > 0 && !localStorage.getItem(MIGRATION_KEY)) {
        const migrated = [];
        for (const item of localItems) {
          const result = await saveItemToCloud(item);
          if (!result.ok) throw new Error(getErrorMessage(result.error));
          migrated.push(item);
        }
        localStorage.setItem(MIGRATION_KEY, "true");
        items = migrated.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      } else {
        items = cloudItems;
      }
      setLocalItems(items);
      finalizeLoad();
      return;
    } catch (e) {
      console.warn("클라우드 로드 실패, 로컬 저장소 전환:", e);
      if (els.formMessage) els.formMessage.textContent = `Supabase 로드 실패: ${getErrorMessage(e)} / 로컬 데이터만 표시됩니다.`;
    }
  }
  items = localItems;
  finalizeLoad();
}

function finalizeLoad() {
  if (!selectedId && items.length > 0) selectedId = items[0].id;
  render();
}

async function syncSaveItem(normalizedItem, options = {}) {
  setLocalItems(items);
  if (!supabaseClient) return { ok: false, mode: "local", error: "Supabase가 연결되지 않아 현재 브라우저에만 저장했습니다." };
  const result = await saveItemToCloud(normalizedItem);
  if (!result.ok && !options.silent) console.error("서버 DB 저장 오류:", result.error);
  return result;
}

async function syncDeleteItem(id) {
  const previousItems = [...items];
  items = items.filter((candidate) => candidate.id !== id);
  setLocalItems(items);
  if (supabaseClient) {
    const { error } = await supabaseClient.from("kdrama_ips").delete().eq("id", id);
    if (error) {
      items = previousItems;
      setLocalItems(items);
      render();
      throw error;
    }
  }
}

async function replaceCloudItems(restoredItems) {
  if (!supabaseClient) return;
  const { data, error: loadError } = await supabaseClient.from("kdrama_ips").select("id");
  if (loadError) throw loadError;
  const restoredIds = new Set(restoredItems.map((item) => item.id));
  const idsToDelete = (data || []).map((row) => row.id).filter((id) => !restoredIds.has(id));
  if (idsToDelete.length > 0) {
    const { error: deleteError } = await supabaseClient.from("kdrama_ips").delete().in("id", idsToDelete);
    if (deleteError) throw deleteError;
  }
  for (const item of restoredItems) {
    const result = await saveItemToCloud(item);
    if (!result.ok) throw new Error(getErrorMessage(result.error));
  }
}

// ==========================================
// 3. 유틸리티 함수
// ==========================================
function clampScore(value) {
  const number = Number(value);
  if (Number.isNaN(number)) return 0.0;
  return Math.max(0.0, Math.min(10.0, Math.round(number * 10) / 10));
}

function averageScore(item) {
  const values = totalScoreKeys.map((key) => clampScore(item.scores?.[key]));
  const sum = values.reduce((acc, val) => acc + val, 0);
  return Math.round((sum / values.length) * 10) / 10;
}

// 추천 상태 분류 — 탭 필터·배지에 공통 사용
const STATUS_TABS = [
  { key: "all", label: "전체" },
  { key: "recommend", label: "검토 후보" },
  { key: "research", label: "리서치 필요" },
  { key: "hold", label: "보류" },
];

function statusKey(item) {
  const rec = String(item.recommendation || "");
  if (rec.includes("보류")) return "hold";
  if (rec.includes("리서치")) return "research";
  if (rec.includes("추천")) return "recommend";
  return "research";
}

function statusBadgeHtml(item) {
  if (statusKey(item) === "recommend") return ""; // 추천은 배지 없이 표시 (리서치 필요·보류만 표시)
  const reason = item.recommendationReason ? ` title="${escapeHtml(item.recommendationReason)}"` : "";
  return `<span class="status-badge status-${statusKey(item)}"${reason}>${escapeHtml(item.recommendation || "리서치 필요")}</span>`;
}

function starButtonHtml(item, extraClass = "") {
  const on = Boolean(item.starred);
  return `<button type="button" class="star-btn ${on ? "on" : ""} ${extraClass}" data-star-id="${escapeHtml(item.id)}" aria-pressed="${on ? "true" : "false"}" aria-label="${escapeHtml(item.title)} 관심 ${on ? "해제" : "표시"}" title="관심 ${on ? "해제" : "표시"}"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" fill="${on ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg></button>`;
}

async function toggleStar(id) {
  const item = items.find((candidate) => candidate.id === id);
  if (!item) return;
  item.starred = !item.starred;
  render();
  const detailOpen = document.querySelector("#detailView")?.classList.contains("active-view");
  if (detailOpen && selectedId === id) renderDetail();
  const result = await syncSaveItem(item, { silent: true });
  if (!result.ok) console.warn("관심 표시 저장 실패:", result.error);
}

function bindStarButtons(root) {
  root.querySelectorAll("[data-star-id]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleStar(btn.dataset.starId);
    });
  });
}

function openDetail(item) {
  selectedId = item.id;
  if (els.detailViewTitle) els.detailViewTitle.textContent = item.title;
  renderDetail();
  switchView("detail");
}

function scoreTone(value) {
  if (value >= 7.5) return "high";
  if (value >= 6.5) return "mid";
  return "low";
}

function normalizeScoreRationales(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  return Object.keys(scoreLabels).reduce((acc, key) => {
    acc[key] = String(source[key] || "").trim();
    return acc;
  }, {});
}

function scoreRationaleText(item, key) {
  const text = item.scoreRationales?.[key];
  if (text) return text;
  return "평가 근거가 입력되었습니다.";
}

// 캐릭터 매력도: 성격 40% · 갈등 35% · 직업 25%, 한국 60% + 북미 40%
const CHAR_WEIGHTS = { personality: 0.4, conflict: 0.35, occupation: 0.25 };
const CHAR_PART_LABELS = { personality: "성격", conflict: "갈등", occupation: "직업" };
const CHAR_REGION_WEIGHTS = { kr: 0.6, na: 0.4 };
const CHARACTER_RUBRIC_TEXT = `[캐릭터 매력도 기준] 주연급 인물이 한국(KR)·북미(NA) 대중에게 매력적인 성격·갈등·직업을 가졌는지 KR/NA 각각 personality·conflict·occupation을 10점 만점으로 채점. 성격=욕망 선명·결핍·주체성(수동적/고구마 감점, NA는 강압적 로맨스·권력차 미화 감점), 갈등=보편적 판돈(한국 특유 맥락은 NA만 감점), 직업=매회 사건을 공급하는 엔진인가. 9=캐릭터만으로 기획안이 팔림, 7=세 요소 중 둘이 강함, 5=기능적·무난, 3=대폭 재설계 필요. NA 근거(영문판 반응 등)가 없으면 confidence "낮음", NA 점수 7.0 이하.`;

function normalizeCharacterAnalysis(raw) {
  if (!raw || typeof raw !== "object") return null;
  const lowConfidence = String(raw.confidence || "").includes("낮");
  const region = (r, cap) => {
    if (!r || typeof r !== "object") return null;
    const out = {};
    let total = 0;
    for (const [key, weight] of Object.entries(CHAR_WEIGHTS)) {
      if (r[key] === undefined || Number.isNaN(Number(r[key]))) return null;
      let v = clampScore(r[key]);
      if (cap !== null) v = Math.min(v, cap);
      out[key] = v;
      total += v * weight;
    }
    out.total = clampScore(total);
    return out;
  };
  const kr = region(raw.kr, null);
  const na = region(raw.na, lowConfidence ? 7.0 : null);
  if (!kr || !na) return null;
  return {
    kr, na,
    reason: String(raw.reason || "").trim(),
    evidence: toArray(raw.evidence),
    confidence: String(raw.confidence || "").trim() || "중간",
  };
}

function characterAppealFrom(analysis) {
  return clampScore(analysis.kr.total * CHAR_REGION_WEIGHTS.kr + analysis.na.total * CHAR_REGION_WEIGHTS.na);
}

function normalizeItem(raw, options = {}) {
  const characterAnalysis = normalizeCharacterAnalysis(raw.characterAnalysis);
  const now = new Date().toISOString();
  const rawChars = raw.mainCharacters || raw.characters || [];
  const normalizedChars = Array.isArray(rawChars) ? rawChars.map(c => {
    if (typeof c === "object" && c !== null) {
      return {
        name: String(c.name || "이름 없음").trim(),
        role: String(c.role || "역할 없음").trim(),
        traits: String(c.traits || "분석 없음").trim(),
        appealPoints: String(c.appealPoints || "분석 없음").trim(),
        improvements: String(c.improvements || "분석 없음").trim()
      };
    }
    return { name: String(c).trim(), role: "주연", traits: "대사/행동 정보 없음", appealPoints: "입덕 포인트 없음", improvements: "각색점 정보 없음" };
  }) : [];

  return {
    id: raw.id || crypto.randomUUID(),
    createdAt: raw.createdAt || now,
    updatedAt: options.keepUpdatedAt ? (raw.updatedAt || raw.createdAt || now) : now,
    title: String(raw.title || "").trim(),
    originalType: String(raw.originalType || "기타").trim(),
    genre: toArray(raw.genre),
    logline: String(raw.logline || "").trim(),
    premise: String(raw.premise || "").trim(),
    mainCharacters: normalizedChars.slice(0, 4),
    strengths: toArray(raw.strengths),
    risks: toArray(raw.risks),
    targetAudience: String(raw.targetAudience || "").trim(),
    productionDifficulty: String(raw.productionDifficulty || "보통").trim(),
    castingDirection: String(raw.castingDirection || "").trim(),
    comparables: toArray(raw.comparables),
    recommendation: String(raw.recommendation || "리서치 필요").trim(),
    recommendationReason: String(raw.recommendationReason || "").trim(),
    starred: Boolean(raw.starred),
    userMemo: String(raw.userMemo || ""),
    scores: {
      dramaFit: clampScore(raw.scores?.dramaFit),
      marketPotential: clampScore(raw.scores?.marketPotential),
      productionFeasibility: clampScore(raw.scores?.productionFeasibility),
      originality: clampScore(raw.scores?.originality),
      scalability: clampScore(raw.scores?.scalability),
      globalPotential: clampScore(raw.scores?.globalPotential),
      characterAppeal: characterAnalysis ? characterAppealFrom(characterAnalysis) : clampScore(raw.scores?.characterAppeal),
    },
    characterAnalysis,
    scoreRationales: normalizeScoreRationales(raw.scoreRationales || raw.scoreReasons || raw.scoreAnalysis || raw.scoreDescriptions),
    notes: String(raw.notes || "").trim(),
    aiReport: raw.aiReport || ""
  };
}

function toArray(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (!value) return [];
  return String(value).split(",").map((item) => item.trim()).filter(Boolean);
}

function validateItem(raw) {
  const errors = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) errors.push("JSON 객체여야 합니다.");
  if (!raw.title) errors.push("title이 필요합니다.");
  if (!raw.logline) errors.push("logline이 필요합니다.");
  if (!raw.scores || typeof raw.scores !== "object") errors.push("scores가 필요합니다.");
  Object.keys(scoreLabels).forEach((key) => {
    const value = raw.scores?.[key];
    if (value === undefined || Number.isNaN(Number(value))) errors.push(`scores.${key}는 숫자여야 합니다.`);
  });
  return errors;
}

function parseInput() {
  const text = els.jsonInput.value.trim();
  if (!text) return { errors: ["JSON을 입력하세요."] };
  try {
    const parsed = JSON.parse(text);
    const raw = Array.isArray(parsed) ? parsed[0] : parsed;
    const errors = validateItem(raw);
    return { raw, errors };
  } catch (error) {
    return { errors: [`JSON 형식 오류: ${error.message}`] };
  }
}

async function upsertItem(raw) {
  const normalized = normalizeItem(raw);
  const existingIndex = items.findIndex((item) => item.id === normalized.id || item.title === normalized.title);
  if (existingIndex >= 0) {
    normalized.id = items[existingIndex].id;
    normalized.createdAt = items[existingIndex].createdAt;
    if (items[existingIndex].aiReport && !normalized.aiReport) {
      normalized.aiReport = items[existingIndex].aiReport;
    }
    items[existingIndex] = normalized;
  } else {
    items.unshift(normalized);
  }
  selectedId = normalized.id;
  render();
  const result = await syncSaveItem(normalized);
  if (!result.ok) throw new Error(getErrorMessage(result.error));
  return normalized;
}

// ==========================================
// 4. 선택 모드
// ==========================================
function toggleSelectMode() {
  selectMode = !selectMode;
  selectedIds.clear();
  if (els.toggleSelectBtn) els.toggleSelectBtn.textContent = selectMode ? "취소" : "선택 모드";
  if (els.deleteSelectedBtn) {
    els.deleteSelectedBtn.style.display = selectMode ? "inline-flex" : "none";
    els.deleteSelectedBtn.textContent = "선택 삭제 (0)";
  }
  renderList();
}

// ==========================================
// 5. 렌더링 함수
// ==========================================
function filteredItems() {
  const query = (els.searchInput?.value || "").trim().toLowerCase();
  const type = els.typeFilter?.value || "all";
  const sort = els.sortSelect?.value || "sort";
  const sorted = [...items];

  if (sort === "score") {
    sorted.sort((a, b) => {
      const avgA = averageScore(a);
      const avgB = averageScore(b);
      if (avgA !== avgB) return avgB - avgA;
      const priorityA = clampScore(a.scores?.dramaFit) + clampScore(a.scores?.marketPotential) + clampScore(a.scores?.characterAppeal);
      const priorityB = clampScore(b.scores?.dramaFit) + clampScore(b.scores?.marketPotential) + clampScore(b.scores?.characterAppeal);
      return priorityB - priorityA;
    });
  } else if (sort === "title") {
    sorted.sort((a, b) => a.title.localeCompare(b.title, "ko"));
  } else {
    sorted.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  return sorted.filter((item) => {
    const haystack = [item.title, item.originalType, item.recommendation, ...item.genre].join(" ").toLowerCase();
    const matchesQuery = !query || haystack.includes(query);
    const matchesType = type === "all" || item.originalType === type;
    const matchesStatus = statusFilter === "all" || statusKey(item) === statusFilter;
    return matchesQuery && matchesType && matchesStatus;
  });
}

function updatePrompt() {
  if (!els.promptText) return;
  const title = els.promptTitle?.value?.trim() || "{{원작 제목}}";
  els.promptText.value = `다음 원작 IP를 한국 드라마로 제작할 가능성 관점에서 분석해줘.\n반드시 JSON만 출력하고, JSON 밖에는 어떤 설명도 쓰지 마.\n\n원작 제목: ${title}\n\n${CHARACTER_RUBRIC_TEXT}\n\n${JSON.stringify(requiredShape, null, 2)}`;
}

function updateBackupText() {
  if (!els.backupText) return;
  els.backupText.value = JSON.stringify({ app: "kdrama-ip-dashboard", version: 2, exportedAt: new Date().toISOString(), items }, null, 2);
}

function render() {
  renderMetrics();
  renderFilters();
  renderStatusTabs();
  renderList();
  renderResearch();
  renderFavorites();
  updatePrompt();       
  updateBackupText();   
}

function renderMetrics() {
  if (els.totalCount) els.totalCount.textContent = items.length;
  if (els.recommendedCount) els.recommendedCount.textContent = items.filter((item) => statusKey(item) === "recommend").length;
  if (els.researchCount) els.researchCount.textContent = items.filter((item) => statusKey(item) === "research").length;
  if (els.heldCount) els.heldCount.textContent = items.filter((item) => statusKey(item) === "hold").length;
  const favoriteKpi = document.querySelector("#favoriteCount");
  if (favoriteKpi) favoriteKpi.textContent = items.filter((item) => item.starred).length;
  const rawAvg = items.length ? items.reduce((sum, item) => sum + averageScore(item), 0) / items.length : 0;
  if (els.averageScore) els.averageScore.textContent = rawAvg.toFixed(1);
}

function renderStatusTabs() {
  if (!els.statusTabs) return;
  els.statusTabs.innerHTML = "";
  STATUS_TABS.forEach((tab) => {
    const count = tab.key === "all" ? items.length : items.filter((item) => statusKey(item) === tab.key).length;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", statusFilter === tab.key ? "true" : "false");
    btn.className = `status-tab ${statusFilter === tab.key ? "active" : ""}`;
    btn.innerHTML = `${tab.label} <span>${count}</span>`;
    btn.addEventListener("click", () => {
      statusFilter = tab.key;
      renderStatusTabs();
      renderList();
    });
    els.statusTabs.append(btn);
  });
}

// 확인 필요 목록 — 리서치 필요·보류 사유 모아보기
function reasonCardsInto(container, list) {
  if (!container) return;
  container.innerHTML = "";
  if (!list.length) {
    container.innerHTML = '<p class="reason-empty">해당 IP가 없습니다.</p>';
    return;
  }
  list.forEach((item) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "reason-card";
    card.innerHTML = `
      <span class="reason-card-top">
        <strong>${escapeHtml(item.title)}</strong>
        <span class="reason-card-score">${averageScore(item).toFixed(1)}</span>
      </span>
      <span class="reason-card-meta">${escapeHtml([item.originalType, ...item.genre.slice(0, 2)].filter(Boolean).join(" · "))}</span>
      <span class="reason-card-text">${escapeHtml(item.recommendationReason || "사유가 아직 기록되지 않았습니다.")}</span>
    `;
    card.addEventListener("click", () => openDetail(item));
    container.append(card);
  });
}

function renderFavorites() {
  const favorites = items.filter((item) => item.starred).sort((a, b) => averageScore(b) - averageScore(a));
  if (els.favoriteNavCount) els.favoriteNavCount.textContent = favorites.length;
  if (!els.favoriteList) return;
  els.favoriteList.innerHTML = "";
  if (!favorites.length) {
    els.favoriteList.innerHTML = '<p class="reason-empty">아직 관심 표시한 IP가 없습니다. 목록이나 상세 화면에서 별표를 눌러 추가하세요.</p>';
    return;
  }
  favorites.forEach((item) => {
    const card = document.createElement("div");
    card.className = "fav-card";
    const reason = statusKey(item) !== "recommend" && item.recommendationReason ? `<span class="reason-card-text">${escapeHtml(item.recommendationReason)}</span>` : "";
    card.innerHTML = `
      ${starButtonHtml(item, "fav-star")}
      <button type="button" class="fav-open">
        <span class="reason-card-top">
          <strong>${escapeHtml(item.title)}</strong>
          <span class="reason-card-score">${averageScore(item).toFixed(1)}</span>
        </span>
        <span class="fav-meta">${statusBadgeHtml(item)}<span class="reason-card-meta">${escapeHtml([item.originalType, ...item.genre.slice(0, 2)].filter(Boolean).join(" · "))}</span></span>
        <span class="fav-logline">${escapeHtml(item.logline || "")}</span>
        ${reason}
        ${item.userMemo ? `<span class="fav-memo"><strong>내 메모</strong> ${escapeHtml(item.userMemo)}</span>` : ""}
      </button>
    `;
    card.querySelector(".fav-open").addEventListener("click", () => openDetail(item));
    bindStarButtons(card);
    els.favoriteList.append(card);
  });
}

function renderResearch() {
  const byScore = (a, b) => averageScore(b) - averageScore(a);
  const research = items.filter((item) => statusKey(item) === "research").sort(byScore);
  const hold = items.filter((item) => statusKey(item) === "hold").sort(byScore);
  if (els.researchNavCount) els.researchNavCount.textContent = research.length;
  reasonCardsInto(els.researchList, research);
  reasonCardsInto(els.holdList, hold);
}

function renderFilters() {
  if (!els.typeFilter) return;
  const current = els.typeFilter.value;
  const types = [...new Set(items.map((item) => item.originalType).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));
  els.typeFilter.innerHTML = '<option value="all">전체 유형</option>';
  types.forEach((type) => {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = type;
    els.typeFilter.append(option);
  });
  els.typeFilter.value = types.includes(current) ? current : "all";
}

function renderList() {
  if (!els.ipList) return;
  const visible = filteredItems();
  els.ipList.innerHTML = "";
  if (els.emptyState) els.emptyState.style.display = items.length ? "none" : "grid";

  if (visible.length) {
    const head = document.createElement("div");
    head.className = "ip-row ip-row-head";
    head.setAttribute("aria-hidden", "true");
    head.innerHTML = `
      <span>#</span>
      <span>작품</span>
      <span>상태</span>
      <span>총점</span>
      <span class="mini-bars-head"><span>드라마</span><span>흥행</span><span>차별</span><span>확장</span><span>캐릭터</span></span>
      <span>참고 (제작 · 글로벌)</span>
    `;
    els.ipList.append(head);
  } else if (items.length) {
    const none = document.createElement("div");
    none.className = "ip-row-empty";
    none.textContent = "조건에 맞는 IP가 없습니다.";
    els.ipList.append(none);
  }

  visible.forEach((item, index) => {
    const isSelected = selectedIds.has(item.id);
    const button = document.createElement("div");
    button.tabIndex = 0;
    const total = averageScore(item);
    const status = statusKey(item);
    button.className = `ip-row ${status === "hold" ? "is-held" : ""} ${!selectMode && item.id === selectedId ? "active" : ""} ${selectMode && isSelected ? "selected" : ""}`;
    const meta = [item.originalType, ...item.genre.slice(0, 2)].filter(Boolean).join(" · ");
    const bars = totalScoreKeys.map((key) => {
      const v = clampScore(item.scores?.[key]);
      return `<span class="mini-bar" title="${escapeHtml(scoreLabels[key])} ${v.toFixed(1)}"><span class="mini-track"><span class="mini-fill tone-${scoreTone(v)}" style="width:${v * 10}%"></span></span><span class="mini-val">${v.toFixed(1)}</span></span>`;
    }).join("");
    const ref = `${clampScore(item.scores?.productionFeasibility).toFixed(1)} · ${clampScore(item.scores?.globalPotential).toFixed(1)}`;
    button.innerHTML = `
      <span class="row-rank">${selectMode ? `<input type="checkbox" class="ip-checkbox" ${isSelected ? "checked" : ""} onclick="event.stopPropagation()" aria-label="${escapeHtml(item.title)} 선택">` : index + 1}</span>
      <span class="row-title">
        <span class="row-title-line">${starButtonHtml(item)}<strong>${escapeHtml(item.title)}</strong></span>
        <small>${escapeHtml(meta)}</small>
        ${status !== "recommend" && item.recommendationReason ? `<small class="row-reason">${escapeHtml(item.recommendationReason)}</small>` : ""}
      </span>
      <span>${statusBadgeHtml(item)}</span>
      <span class="row-total tone-${status === "hold" ? "held" : scoreTone(total)}">${total.toFixed(1)}</span>
      <span class="mini-bars">${bars}</span>
      <span class="row-ref">${ref}</span>
    `;

    button.addEventListener("click", () => {
      if (selectMode) {
        if (selectedIds.has(item.id)) {
          selectedIds.delete(item.id);
        } else {
          selectedIds.add(item.id);
        }
        if (els.deleteSelectedBtn) els.deleteSelectedBtn.textContent = `선택 삭제 (${selectedIds.size})`;
        renderList();
      } else {
        openDetail(item);
      }
    });
    button.addEventListener("keydown", (event) => {
      if (event.target !== button) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        button.click();
      }
    });
    bindStarButtons(button);

    els.ipList.append(button);
  });
}

let memoTimeout = null;

// ==========================================
// 6. 상세 화면 렌더링 및 에러 대책 보완 파트 🛠️
// ==========================================
function renderDetail() {
  if (!els.detailPanel) return;
  const item = items.find((candidate) => candidate.id === selectedId);
  if (!item) {
    els.detailPanel.innerHTML = '<div class="detail-empty">IP를 선택하면 상세 분석이 표시됩니다.</div>';
    return;
  }

  const node = els.detailTemplate.content.cloneNode(true);
  node.querySelector(".detail-type").innerHTML = `${statusBadgeHtml(item)}<span>${escapeHtml(`${item.originalType} · 제작 난이도 ${item.productionDifficulty}`)}</span>`;
  node.querySelector(".detail-title").innerHTML = `${escapeHtml(item.title)} ${starButtonHtml(item, "detail-star")}`;
  node.querySelector(".detail-logline").textContent = item.logline;
  const reasonBox = node.querySelector(".reason-box");
  if (reasonBox) {
    if (statusKey(item) !== "recommend" && item.recommendationReason) {
      reasonBox.className = `reason-box reason-${statusKey(item)}`;
      reasonBox.innerHTML = `<strong>${escapeHtml(item.recommendation)} 사유</strong><span>${escapeHtml(item.recommendationReason)}</span>`;
    } else {
      reasonBox.remove();
    }
  }
  node.querySelector(".score-value").textContent = averageScore(item).toFixed(1);
  node.querySelector(".detail-tags").innerHTML = [...item.genre].map(tagHtml).join("");
  const rank = [...items].sort((a, b) => averageScore(b) - averageScore(a)).findIndex((candidate) => candidate.id === item.id) + 1;
  const rankEl = node.querySelector(".score-rank");
  if (rankEl) rankEl.textContent = `전체 ${items.length}개 중 ${rank}위`;
  node.querySelector(".score-bars").innerHTML = totalScoreKeys
    .map((key) => coreScoreRow(scoreLabels[key], clampScore(item.scores[key]), scoreRationaleText(item, key), key === "characterAppeal" ? characterBreakdownHtml(item.characterAnalysis) : ""))
    .join("");
  const refBox = node.querySelector(".ref-scores");
  if (refBox) {
    refBox.innerHTML = TOTAL_EXCLUDED_KEYS.map((key) => `
      <div class="ref-item">
        <div class="ref-line"><span>${escapeHtml(scoreLabels[key])}</span><strong>${clampScore(item.scores[key]).toFixed(1)}</strong></div>
        <p>${escapeHtml(scoreRationaleText(item, key))}</p>
      </div>`).join("") + `<div class="ref-item"><div class="ref-line"><span>제작 난이도</span><strong>${escapeHtml(item.productionDifficulty)}</strong></div></div>`;
  }

  renderListInto(node.querySelector(".strengths"), item.strengths);
  renderListInto(node.querySelector(".risks"), item.risks);
  renderThreePoints(node.querySelector(".premise"), item.premise);
  renderThreePoints(node.querySelector(".target"), item.targetAudience);
  renderThreePoints(node.querySelector(".casting"), item.castingDirection);
  renderListInto(node.querySelector(".comparables-list"), item.comparables);

  // 주요 인물 — 이름 탭으로 한 명씩 보기
  const chars = (item.mainCharacters || []).filter((char) => char && char.name);
  const charContainer = document.createElement("section");
  charContainer.className = "character-deep-dive";
  const tabsHtml = chars.map((char, i) => `<button type="button" role="tab" class="char-tab ${i === 0 ? "active" : ""}" aria-selected="${i === 0 ? "true" : "false"}" data-char-index="${i}">${escapeHtml(char.name)}</button>`).join("");
  const panelsHtml = chars.map((char, i) => `
    <div class="char-panel" role="tabpanel" data-char-panel="${i}" ${i === 0 ? "" : "hidden"}>
      <p class="char-role">${escapeHtml(char.role)}</p>
      <div class="char-fields">
        <div><h4>특징 · 대사 · 평가</h4><p>${escapeHtml(char.traits)}</p></div>
        <div><h4 class="char-appeal">입덕 포인트</h4><p>${escapeHtml(char.appealPoints)}</p></div>
        <div><h4 class="char-improve">각색 보완점</h4><p>${escapeHtml(char.improvements)}</p></div>
      </div>
    </div>`).join("");
  charContainer.innerHTML = `
    <div class="char-head">
      <h3 class="char-dive-title">주요 인물</h3>
      <div class="char-tabs" role="tablist" aria-label="인물 선택">${tabsHtml}</div>
    </div>
    ${chars.length ? panelsHtml : '<p class="notes-empty">등록된 인물 정보가 없습니다.</p>'}`;
  charContainer.querySelectorAll(".char-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const idx = tab.dataset.charIndex;
      charContainer.querySelectorAll(".char-tab").forEach((t) => {
        const on = t.dataset.charIndex === idx;
        t.classList.toggle("active", on);
        t.setAttribute("aria-selected", on ? "true" : "false");
      });
      charContainer.querySelectorAll(".char-panel").forEach((panel) => { panel.hidden = panel.dataset.charPanel !== idx; });
    });
  });

  // 🚨 [크래시 방어] targetBlock 요소를 찾지 못해도 오류 없이 유연하게 결합하도록 예외 처리 보완
  const targetBlock = node.querySelector(".detail-blocks") || node.querySelector(".detail-info-grid");
  if (targetBlock && targetBlock.parentNode) {
    targetBlock.parentNode.insertBefore(charContainer, targetBlock);
  } else {
    const firstChild = node.firstElementChild;
    if (firstChild) {
      firstChild.appendChild(charContainer);
    }
  }

  // 분석 메모(읽기 전용) — 문장 단위로 나눠 표시
  const notesEl = node.querySelector(".analysis-notes");
  if (notesEl) {
    const parts = String(item.notes || "")
      .replace(/\s*(\[\d{4}-\d{2}-\d{2}[^\]]*\])/g, "\n$1")
      .replace(/\s*(검증:)/g, "\n$1")
      .split(/\n|(?<=\.)\s+(?=[^\s\d])/)
      .map((part) => part.trim())
      .filter(Boolean);
    notesEl.innerHTML = parts.length
      ? `<ul>${parts.map((part) => `<li>${escapeHtml(part)}</li>`).join("")}</ul>`
      : '<p class="notes-empty">분석 메모가 없습니다.</p>';
  }

  // 내 메모 — 사용자 전용 필드(userMemo), 자동 저장
  const memoInput = node.querySelector(".memo-input");
  const memoStatus = node.querySelector(".memo-status");
  if (memoInput) {
    memoInput.value = item.userMemo || "";
    memoInput.addEventListener("input", () => {
      item.userMemo = memoInput.value;
      if (memoStatus) memoStatus.textContent = "저장 중...";
      if (memoTimeout) clearTimeout(memoTimeout);
      memoTimeout = setTimeout(async () => {
        const result = await syncSaveItem(item, { silent: true });
        if (memoStatus) {
          const time = new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
          memoStatus.textContent = result.ok ? `저장됨 · ${time}` : "저장 실패 — 네트워크를 확인하세요";
        }
        if (!result.ok) console.warn("메모 클라우드 저장 실패:", result.error);
        renderFavorites();
      }, 600);
    });
  }

  node.querySelector(".delete-btn").addEventListener("click", async () => {
    if (!confirm(`${item.title}을 삭제할까요?`)) return;
    try {
      await syncDeleteItem(item.id);
      selectedId = items[0]?.id || null;
      switchView("dashboard");
      render();
    } catch (error) {
      alert(`삭제 실패: ${getErrorMessage(error)}`);
    }
  });

  els.detailPanel.innerHTML = "";
  els.detailPanel.append(node);
  bindStarButtons(els.detailPanel);

}

// ==========================================
// 7. Gemini API 연동 — 원작 자동 분석 (기획 리포트 기능은 제거됨)
// ==========================================

// 공통: /api/analyze 호출 + 서버의 실제 에러 메시지 표출
async function callAnalyzeApi(body) {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  let data = null;
  try {
    data = await response.json();
  } catch (_) {
    // JSON 파싱 실패 (예: Vercel 타임아웃 HTML 응답 등)
  }

  if (!response.ok || !data || data.success === false) {
    const serverMsg = data?.error || data?.message || "(서버 상세 메시지 없음 — Vercel Logs 탭에서 확인 필요)";
    throw new Error(`API 오류 (Status: ${response.status})\n서버 메시지: ${serverMsg}`);
  }
  return data;
}



// 대시보드 메인 — 원작 제목 기반 Gemini 자동 분석/등록
async function handleAiAutoGen() {
  if (!els.autoGenTitle || !els.autoGenBtn || !els.autoGenStatus) return;

  const title = els.autoGenTitle.value.trim();
  if (!title) {
    alert("분석하고자 하는 원작 작품의 제목을 입력해 주세요.");
    return;
  }

  els.autoGenBtn.disabled = true;
  els.autoGenStatus.style.display = "block";

  try {
    const data = await callAnalyzeApi({ title });

    const payload = data.payload;
    if (!payload || !payload.title) {
      throw new Error("응답은 수신했으나 payload 구조가 올바르지 않습니다.");
    }

    const newDashboardItem = await upsertItem(payload);

    els.autoGenTitle.value = "";
    selectedId = newDashboardItem.id;
    if (els.detailViewTitle) els.detailViewTitle.textContent = newDashboardItem.title;
    renderDetail();
    switchView("detail");

  } catch (error) {
    console.error("자동 대시보드 구축 에러 로그:", error);
    alert(`자동 생성 실패:\n${error.message}`);
  } finally {
    els.autoGenBtn.disabled = false;
    els.autoGenStatus.style.display = "none";
  }
}

function renderListInto(list, values) {
  if (!list) return;
  list.innerHTML = "";
  const padded = [...(Array.isArray(values) ? values : [])];
  while (padded.length < 3) padded.push("—");
  padded.slice(0, 3).forEach((value) => {
    const li = document.createElement("li");
    li.textContent = value;
    list.append(li);
  });
}

function renderThreePoints(el, text) {
  if (!el) return;
  if (!text) { el.textContent = "—"; return; }
  let points = [];
  if (text.includes("①") || text.includes("②") || text.includes("③")) {
    points = text.split(/[①②③]/).map(s => s.trim()).filter(Boolean);
  } else if (text.includes(" / ")) {
    points = text.split(" / ").map(s => s.trim()).filter(Boolean);
  } else if (text.includes("\n")) {
    points = text.split("\n").map(s => s.trim()).filter(Boolean);
  } else {
    el.textContent = text;
    return;
  }
  while (points.length < 3) points.push("—");
  const ul = document.createElement("ul");
  ul.style.cssText = "padding-left:1.2em;margin:0;display:flex;flex-direction:column;gap:4px";
  points.slice(0, 3).forEach(point => {
    const li = document.createElement("li");
    li.textContent = point;
    li.style.fontSize = "13px";
    ul.append(li);
  });
  el.innerHTML = "";
  el.append(ul);
}

function characterBreakdownHtml(analysis) {
  if (!analysis) return "";
  const cell = (v) => `<td>${Number(v).toFixed(1)}</td>`;
  const row = (name, r) => `<tr><th>${name}</th>${Object.keys(CHAR_WEIGHTS).map((k) => cell(r[k])).join("")}<td class="char-total">${r.total.toFixed(1)}</td></tr>`;
  const evidence = analysis.evidence.length
    ? `<ul class="char-evidence">${analysis.evidence.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul>` : "";
  return `
    <div class="char-breakdown">
      <table>
        <thead><tr><th></th>${Object.values(CHAR_PART_LABELS).map((l) => `<th>${l}</th>`).join("")}<th>합계</th></tr></thead>
        <tbody>${row("한국 (60%)", analysis.kr)}${row("북미 (40%)", analysis.na)}</tbody>
      </table>
      ${analysis.reason ? `<p class="score-reason"><strong>캐릭터 판단</strong> ${escapeHtml(analysis.reason)}</p>` : ""}
      ${evidence}
      <p class="char-confidence">근거 확신도: ${escapeHtml(analysis.confidence)}</p>
    </div>`;
}

function coreScoreRow(label, value, rationale, extraHtml = "") {
  return `
    <details class="core-score">
      <summary>
        <span class="core-label">${escapeHtml(label)}</span>
        <span class="bar-track"><span class="bar-fill tone-${scoreTone(value)}" style="width:${value * 10}%"></span></span>
        <span class="core-value">${value.toFixed(1)}</span>
      </summary>
      <p class="score-reason">${escapeHtml(rationale)}</p>
      ${extraHtml}
    </details>
  `;
}

function scoreRow(label, value, rationale, extraHtml = "") {
  const percentage = value * 10;
  return `
    <div class="score-card">
      <div class="score-row">
        <strong>${escapeHtml(label)}</strong>
        <div class="bar-track"><div class="bar-fill" style="width:${percentage}%"></div></div>
        <span>${value.toFixed(1)}</span>
      </div>
      <p class="score-reason"><strong>평가 근거</strong> ${escapeHtml(rationale)}</p>
      ${extraHtml}
    </div>
  `;
}

function tagHtml(value) { return value ? `<span class="tag">${escapeHtml(value)}</span>` : ""; }
function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function switchView(viewName = "dashboard") {
  const safeViewName = viewName || "dashboard";
  const targetView = document.querySelector(`#${safeViewName}View`);
  if (!targetView) return;
  els.views.forEach((view) => view.classList.remove("active-view"));
  targetView.classList.add("active-view");
  els.navButtons.forEach((button) => { button.classList.toggle("active", button.dataset.view === safeViewName); });
}

// ==========================================
// 8. 이벤트 바인딩 바디부
// ==========================================
els.navButtons.forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.view));
});

if (els.backBtn) {
  els.backBtn.addEventListener("click", () => { switchView("dashboard"); render(); });
}

if (els.toggleSelectBtn) {
  els.toggleSelectBtn.addEventListener("click", toggleSelectMode);
}

if (els.deleteSelectedBtn) {
  els.deleteSelectedBtn.addEventListener("click", async () => {
    if (selectedIds.size === 0) { alert("삭제할 IP를 선택해주세요."); return; }
    if (!confirm(`선택한 ${selectedIds.size}개의 IP를 삭제할까요?`)) return;
    els.deleteSelectedBtn.disabled = true;
    els.deleteSelectedBtn.textContent = "삭제 중...";
    try {
      for (const id of selectedIds) { await syncDeleteItem(id); }
      selectedIds.clear();
      toggleSelectMode();
      render();
    } catch (error) {
      alert(`삭제 실패: ${getErrorMessage(error)}`);
    } finally {
      els.deleteSelectedBtn.disabled = false;
    }
  });
}

[els.searchInput, els.typeFilter, els.sortSelect].forEach((control) => {
  if (control) control.addEventListener("input", render);
});

if (els.addSampleBtn) {
  els.addSampleBtn.addEventListener("click", async () => {
    try { await upsertItem(sampleIp); } catch (error) { alert(`샘플 저장 실패: ${getErrorMessage(error)}`); }
  });
}

if (els.pasteSampleBtn) {
  els.pasteSampleBtn.addEventListener("click", () => {
    els.jsonInput.value = JSON.stringify(sampleIp, null, 2);
    els.formMessage.textContent = "예시 JSON을 넣었습니다.";
  });
}

if (els.clearFormBtn) {
  els.clearFormBtn.addEventListener("click", () => { els.jsonInput.value = ""; els.formMessage.textContent = ""; });
}

if (els.validateBtn) {
  els.validateBtn.addEventListener("click", () => {
    const result = parseInput();
    els.formMessage.textContent = result.errors.length ? result.errors.join(" ") : "저장 가능한 JSON입니다.";
  });
}

if (els.saveBtn) {
  els.saveBtn.addEventListener("click", async () => {
    const result = parseInput();
    if (result.errors.length) { els.formMessage.textContent = result.errors.join(" "); return; }
    els.saveBtn.disabled = true;
    els.formMessage.textContent = "저장 중입니다...";
    try {
      await upsertItem(result.raw);
      els.formMessage.textContent = supabaseClient ? "Supabase DB에 저장했습니다." : "로컬에 저장했습니다.";
      switchView("dashboard");
    } catch (error) {
      els.formMessage.textContent = `저장 실패: ${getErrorMessage(error)}`;
    } finally {
      els.saveBtn.disabled = false;
    }
  });
}

if (els.autoGenBtn) {
  els.autoGenBtn.addEventListener("click", handleAiAutoGen);
}

// ==========================================
// 9. 초기화
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  initSupabase();
  switchView("dashboard");
  syncLoadItems();
});
