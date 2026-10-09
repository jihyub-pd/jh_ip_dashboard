// app.js
// ==========================================
// 1. Supabase 환경 설정
// ==========================================
const SUPABASE_URL = "https://ozhdfewlboheqpcvbqgz.supabase.co";
const SUPABASE_KEY = "sb_publishable_VBrlZgSIDMwO6htQd8fXkQ_HkUxmg3z";

// 운영 주소에서만 운영 테이블을 쓰고, 그 외(미리보기·테스트 주소)는 전부 테스트 테이블을 쓴다.
const PROD_HOSTS = ["ip-dashboard-kappa.vercel.app"];
const IS_PROD = PROD_HOSTS.includes(window.location.hostname);
const TABLE_NAME = IS_PROD ? "kdrama_ips" : "kdrama_ips_test";

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

const STORAGE_KEY = IS_PROD ? "kdrama-ip-dashboard-v1" : "kdrama-ip-dashboard-test-v1";
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
// 총점 가중치(2026-09-30): 드라마 적합 1.0 · 흥행성 0.8 · 차별성·확장성·캐릭터 매력도 1.2 (가중 평균)
const TOTAL_WEIGHTS = { dramaFit: 1.0, marketPotential: 0.8, originality: 1.2, scalability: 1.2, characterAppeal: 1.2 };

const requiredShape = {
  title: "원작 제목",
  sourceInfo: { platform: "네이버웹툰 | 카카오웹툰 | 레진코믹스 | 카카오페이지 | 출판사명 등", status: "연재 중 | 완결 | 휴재", checkedAt: "YYYY-MM" },
  rightsInfo: { holder: "판권 보유처(원작사·제작사·출판사)", contact: "공식 문의 창구(회사 대표 메일·IP 사업팀 등, 개인 연락처 금지)", note: "판권 계약·옵션 현황", checkedAt: "YYYY-MM" },
  reactionMetrics: [{ label: "관심 수 | 별점 | 조회수 | 평균 댓글 수 등", value: "수치", checkedAt: "YYYY-MM", source: "출처" }],
  formatSuggestion: { format: "미니시리즈 16부 | 미니시리즈 12부 | OTT 8부 | OTT 6부 | 숏폼", reason: "원작 분량·구조 근거 한 줄" },
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
  rightsStatus: "열림 | 확인 필요 | 선점 | 영상화 완료",
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
  adaptableElements: [
    { category: "소재 | 설정 | 캐릭터 | 플롯", element: "가져올 요소", whyDrama: "드라마에 좋은 이유", howToUse: "원작 없이 가져다 쓰는 방법·변형 방향" }
  ],
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
  pdfBtn: document.querySelector("#pdfBtn"),
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
  backupMessage: document.querySelector("#backupMessage")
};

let items = [];
let selectedId = null;
let selectMode = false;
let selectedIds = new Set();
let statusFilter = "all";
let sortKey = "total";      // total | 5축 키 | productionFeasibility | globalPotential | title | date
let sortDir = "desc";       // desc | asc
let typeFilterValue = "all";
let favoritesOnly = false;
let genreFilterValue = "all";
let rightsFilterValue = "all"; // 전체 목록에서 조건을 조합해 탐색

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

function assertWriteAccess() {
  if (!window.DashboardAuth?.canWrite) throw new Error("소유자로 로그인한 뒤 수정할 수 있습니다.");
}

async function saveItemToCloud(normalizedItem) {
  if (!window.DashboardAuth?.canWrite) return { ok: false, error: "소유자 로그인 권한을 확인하세요." };
  if (!supabaseClient) return { ok: false, mode: "local", error: "Supabase client가 초기화되지 않았습니다." };
  const dbPayload = {
    id: normalizedItem.id,
    title: normalizedItem.title,
    createdAt: normalizedItem.createdAt,
    updatedAt: normalizedItem.updatedAt,
    content: normalizedItem,
  };
  const { error } = await supabaseClient.from(TABLE_NAME).upsert(dbPayload, { onConflict: "id" });
  if (error) return { ok: false, mode: "cloud", error };
  return { ok: true, mode: "cloud" };
}

async function syncLoadItems() {
  const localItems = getLocalItems();
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from(TABLE_NAME)
        .select("id,title,createdAt,updatedAt,content")
        .order("updatedAt", { ascending: false });
      if (error) throw error;
      const cloudItems = Array.isArray(data) ? data.map(rowToItem) : [];
      if (window.DashboardAuth?.canWrite && cloudItems.length === 0 && localItems.length > 0 && !localStorage.getItem(MIGRATION_KEY)) {
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
  if (!window.DashboardAuth?.canWrite) return { ok: false, error: "소유자 로그인 권한을 확인하세요." };
  setLocalItems(items);
  if (!supabaseClient) return { ok: false, mode: "local", error: "Supabase가 연결되지 않아 현재 브라우저에만 저장했습니다." };
  const result = await saveItemToCloud(normalizedItem);
  if (!result.ok && !options.silent) console.error("서버 DB 저장 오류:", result.error);
  return result;
}

async function syncDeleteItem(id) {
  assertWriteAccess();
  const previousItems = [...items];
  items = items.filter((candidate) => candidate.id !== id);
  setLocalItems(items);
  if (supabaseClient) {
    const { data, error } = await supabaseClient.from(TABLE_NAME).delete().eq("id", id).select("id");
    if (error || !data?.some(row => row.id === id)) {
      items = previousItems;
      setLocalItems(items);
      render();
      throw error || new Error("삭제 권한이 없거나 삭제 대상이 없습니다.");
    }
  }
}

async function replaceCloudItems(restoredItems) {
  assertWriteAccess();
  if (!supabaseClient) return;
  const { data, error: loadError } = await supabaseClient.from(TABLE_NAME).select("id");
  if (loadError) throw loadError;
  const restoredIds = new Set(restoredItems.map((item) => item.id));
  const idsToDelete = (data || []).map((row) => row.id).filter((id) => !restoredIds.has(id));
  if (idsToDelete.length > 0) {
    const { error: deleteError } = await supabaseClient.from(TABLE_NAME).delete().in("id", idsToDelete);
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
  // 가중 평균: 가중치 합으로 나눠 10점 만점 유지
  let sum = 0;
  let weightSum = 0;
  totalScoreKeys.forEach((key) => {
    const w = TOTAL_WEIGHTS[key] ?? 1;
    sum += clampScore(item.scores?.[key]) * w;
    weightSum += w;
  });
  return weightSum ? Math.round((sum / weightSum) * 10) / 10 : 0;
}

// 추천 상태 분류 — 탭 필터·배지에 공통 사용
const STATUS_TABS = [
  { key: "all", label: "전체" },
  { key: "recommend", label: "추천" },
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

// 판권 상태 — 판정(추천/보류/리서치)과 별개로 관리
const RIGHTS_STATUSES = ["열림", "확인 필요", "선점", "영상화 완료"];
const RIGHTS_FILTERS = [
  { key: "available", label: "열림·확인 필요", match: (rs) => rs === "열림" || rs === "확인 필요" },
  { key: "all", label: "전체", match: () => true },
  ...RIGHTS_STATUSES.map((rs) => ({ key: rs, label: rs, match: (v) => v === rs })),
];

function normalizeRightsStatus(value) {
  const v = String(value || "").trim();
  return RIGHTS_STATUSES.includes(v) ? v : "확인 필요";
}

function rightsKey(item) {
  return { "열림": "open", "확인 필요": "check", "선점": "taken", "영상화 완료": "made" }[item.rightsStatus] || "check";
}

function rightsBadgeHtml(item) {
  return `<span class="rights-badge rights-${rightsKey(item)}" title="판권 상태">${escapeHtml(item.rightsStatus)}</span>`;
}

function matchesRightsFilter(item) {
  const f = RIGHTS_FILTERS.find((r) => r.key === rightsFilterValue) || RIGHTS_FILTERS[0];
  return f.match(item.rightsStatus);
}

function starButtonHtml(item, extraClass = "") {
  const on = Boolean(item.starred);
  return `<button type="button" class="star-btn ${on ? "on" : ""} ${extraClass}" data-star-id="${escapeHtml(item.id)}" aria-pressed="${on ? "true" : "false"}" aria-label="${escapeHtml(item.title)} 관심 ${on ? "해제" : "표시"}" title="관심 ${on ? "해제" : "표시"}"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" fill="${on ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg></button>`;
}

async function toggleStar(id) {
  if (!window.DashboardAuth?.canWrite) return;
  const item = items.find((candidate) => candidate.id === id);
  if (!item) return;
  const previousStarred = item.starred;
  item.starred = !item.starred;
  render();
  const detailOpen = document.querySelector("#detailView")?.classList.contains("active-view");
  if (detailOpen && selectedId === id) renderDetail();
  const result = await syncSaveItem(item, { silent: true });
  if (!result.ok) {
    item.starred = previousStarred;
    setLocalItems(items);
    render();
    if (detailOpen) renderDetail();
    alert(`관심 표시 저장 실패: ${getErrorMessage(result.error)}`);
  }
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

// 캐릭터 매력도: 성격 40% · 갈등 35% · 직업·능력·역할 25%, 한국 60% + 북미 40%
const CHAR_WEIGHTS = { personality: 0.4, conflict: 0.35, occupation: 0.25 };
const CHAR_PART_LABELS = { personality: "성격", conflict: "갈등", occupation: "직업·능력·역할" };
const CHAR_REGION_WEIGHTS = { kr: 0.6, na: 0.4 };
const CHARACTER_RUBRIC_TEXT = `[캐릭터 매력도 기준] 주연급 인물이 한국(KR)·북미(NA) 대중에게 매력적인 성격·갈등·직업(능력·역할)을 가졌는지 KR/NA 각각 personality·conflict·occupation을 10점 만점으로 채점. 성격=욕망 선명·결핍·주체성(수동적/고구마 감점, NA는 강압적 로맨스·권력차 미화 감점), 갈등=보편적 판돈(한국 특유 맥락은 NA만 감점), 직업·능력·역할=직업 또는 고유 능력·서사적 역할이 매회 사건을 공급하는 엔진인가. 9=캐릭터만으로 기획안이 팔림, 7=세 요소 중 둘이 강함, 5=기능적·무난, 3=대폭 재설계 필요. NA 근거(영문판 반응 등)가 없으면 confidence "낮음", NA 점수 7.0 이하.`;

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
    dbComparisons: toArray(raw.dbComparisons),
    recommendation: String(raw.recommendation || "리서치 필요").trim(),
    recommendationReason: String(raw.recommendationReason || "").trim(),
    rightsStatus: normalizeRightsStatus(raw.rightsStatus),
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
    adaptableElements: normalizeAdaptableElements(raw.adaptableElements),
    scoreRationales: normalizeScoreRationales(raw.scoreRationales || raw.scoreReasons || raw.scoreAnalysis || raw.scoreDescriptions),
    notes: String(raw.notes || "").trim(),
    sourceInfo: normalizeFactObject(raw.sourceInfo, ["platform", "status", "checkedAt"]),
    rightsInfo: normalizeFactObject(raw.rightsInfo, ["holder", "contact", "note", "checkedAt"]),
    reactionMetrics: (Array.isArray(raw.reactionMetrics) ? raw.reactionMetrics : [])
      .map((m) => normalizeFactObject(m, ["label", "value", "checkedAt", "source"]))
      .filter((m) => m.label && m.value),
    formatSuggestion: normalizeFactObject(raw.formatSuggestion, ["format", "reason"]),
    aiReport: raw.aiReport || ""
  };
}

const ADAPT_CATEGORIES = ["소재", "설정", "캐릭터", "플롯"];

function normalizeAdaptableElements(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => entry && typeof entry === "object" && String(entry.element || "").trim())
    .map((entry) => ({
      category: ADAPT_CATEGORIES.includes(String(entry.category || "").trim()) ? String(entry.category).trim() : "소재",
      element: String(entry.element || "").trim(),
      whyDrama: String(entry.whyDrama || "").trim(),
      howToUse: String(entry.howToUse || "").trim(),
    }))
    .sort((a, b) => ADAPT_CATEGORIES.indexOf(a.category) - ADAPT_CATEGORIES.indexOf(b.category));
}

function renderAdaptableElements(el, elements) {
  if (!el) return;
  if (!elements || !elements.length) {
    el.innerHTML = '<p class="notes-empty">아직 분석되지 않았습니다.</p>';
    return;
  }
  el.innerHTML = ADAPT_CATEGORIES.map((category) => {
    const group = elements.filter((entry) => entry.category === category);
    if (!group.length) return "";
    return `
      <div class="adapt-col">
        <h4 class="adapt-cat">${escapeHtml(category)}</h4>
        ${group.map((entry) => `
          <div class="adapt-card">
            <p class="adapt-element">${escapeHtml(entry.element)}</p>
            ${entry.whyDrama ? `<p class="adapt-line"><span>왜 좋은가</span>${escapeHtml(entry.whyDrama)}</p>` : ""}
            ${entry.howToUse ? `<p class="adapt-line"><span>활용 방법</span>${escapeHtml(entry.howToUse)}</p>` : ""}
          </div>`).join("")}
      </div>`;
  }).join("");
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
  assertWriteAccess();
  const previousItems = [...items];
  const normalized = normalizeItem(raw);
  const existingIndex = items.findIndex((item) => item.id === normalized.id || item.title === normalized.title);
  if (existingIndex >= 0) {
    normalized.id = items[existingIndex].id;
    normalized.createdAt = items[existingIndex].createdAt;
    normalized.starred = items[existingIndex].starred;
    normalized.userMemo = items[existingIndex].userMemo;
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
  if (!result.ok) {
    items = previousItems;
    setLocalItems(items);
    render();
    throw new Error(getErrorMessage(result.error));
  }
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
  const sorted = [...items];
  const dir = sortDir === "asc" ? 1 : -1;
  const valueOf = (item) => {
    if (sortKey === "total") return averageScore(item);
    if (sortKey === "date") return new Date(item.updatedAt).getTime();
    return clampScore(item.scores?.[sortKey]);
  };
  if (sortKey === "title") {
    sorted.sort((a, b) => dir * a.title.localeCompare(b.title, "ko"));
  } else {
    sorted.sort((a, b) => {
      const diff = valueOf(a) - valueOf(b);
      if (diff !== 0) return dir * diff;
      return averageScore(b) - averageScore(a);
    });
  }

  return sorted.filter((item) => {
    const haystack = [item.title, item.originalType, item.recommendation, item.rightsStatus, item.sourceInfo.platform, item.rightsInfo.holder, ...item.genre].join(" ").toLowerCase();
    const matchesQuery = !query || haystack.includes(query);
    const matchesType = typeFilterValue === "all" || item.originalType === typeFilterValue;
    const matchesStatus = statusFilter === "all" || statusKey(item) === statusFilter;
    const matchesFav = !favoritesOnly || item.starred;
    const matchesRights = matchesRightsFilter(item);
    const matchesGenre = typeof window.IPExplorer?.matchesGenre !== "function" || window.IPExplorer.matchesGenre(item, genreFilterValue);
    return matchesQuery && matchesType && matchesStatus && matchesFav && matchesRights && matchesGenre;
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
  renderProposal();
  updatePrompt();
  updateBackupText();
}

function renderMetrics() {
  if (els.totalCount) els.totalCount.textContent = items.length;
  if (els.recommendedCount) els.recommendedCount.textContent = items.filter((item) => statusKey(item) === "recommend").length;
  if (els.researchCount) els.researchCount.textContent = items.filter((item) => statusKey(item) === "research").length;
  if (els.heldCount) els.heldCount.textContent = items.filter((item) => statusKey(item) === "hold").length;
  const pickKpi = document.querySelector("#pickCount");
  if (pickKpi) pickKpi.textContent = items.filter((item) => statusKey(item) === "recommend" && (item.rightsStatus === "열림" || item.rightsStatus === "확인 필요")).length;
  const favoriteKpi = document.querySelector("#favoriteCount");
  if (favoriteKpi) favoriteKpi.textContent = items.filter((item) => item.starred).length;
  const rawAvg = items.length ? items.reduce((sum, item) => sum + averageScore(item), 0) / items.length : 0;
  if (els.averageScore) els.averageScore.textContent = rawAvg.toFixed(1);
}

function renderStatusTabs() {
  if (!els.statusTabs) return;
  els.statusTabs.innerHTML = "";
  STATUS_TABS.forEach((tab) => {
    const pool = items.filter(matchesRightsFilter);
    const count = tab.key === "all" ? pool.length : pool.filter((item) => statusKey(item) === tab.key).length;
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
      <span class="fav-meta">${rightsBadgeHtml(item)}</span>
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
        <span class="fav-meta">${statusBadgeHtml(item)}${rightsBadgeHtml(item)}<span class="reason-card-meta">${escapeHtml([item.originalType, ...item.genre.slice(0, 2)].filter(Boolean).join(" · "))}</span></span>
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
  const types = [...new Set(items.map((item) => item.originalType).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));
  if (!types.includes(typeFilterValue)) typeFilterValue = "all";
  if (els.typeFilter) {
    els.typeFilter.innerHTML = '<option value="all">전체 유형</option>' + types.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");
    els.typeFilter.value = typeFilterValue;
  }
  let chipBar = document.querySelector("#typeChips");
  if (!chipBar) {
    chipBar = document.createElement("div");
    chipBar.id = "typeChips";
    chipBar.className = "type-chips";
    const filterBar = document.querySelector(".filter-bar");
    if (filterBar) filterBar.insertAdjacentElement("afterend", chipBar);
  }
  const count = (t) => items.filter((i) => t === "all" || i.originalType === t).length;
  chipBar.innerHTML = `
    <span class="chip-label">유형</span>
    ${["all", ...types].map((t) => `<button type="button" class="type-chip ${typeFilterValue === t ? "on" : ""}" data-type="${escapeHtml(t)}">${t === "all" ? "전체" : escapeHtml(t)} <span>${count(t)}</span></button>`).join("")}
    <span class="chip-sep"></span>
    <button type="button" class="type-chip fav-chip ${favoritesOnly ? "on" : ""}" data-fav="1">★ 관심만 <span>${items.filter((i) => i.starred).length}</span></button>
    <span class="chip-sep"></span>
    <span class="chip-label">판권</span>
    ${RIGHTS_FILTERS.map((r) => {
      const n = items.filter((i) => r.match(i.rightsStatus)).length;
      return `<button type="button" class="type-chip ${rightsFilterValue === r.key ? "on" : ""}" data-rights="${escapeHtml(r.key)}">${escapeHtml(r.label)} <span>${n}</span></button>`;
    }).join("")}
    `;
  chipBar.querySelectorAll("[data-type]").forEach((btn) => btn.addEventListener("click", () => {
    typeFilterValue = btn.dataset.type;
    renderFilters();
    renderList();
  }));
  chipBar.querySelectorAll("[data-rights]").forEach((btn) => btn.addEventListener("click", () => {
    rightsFilterValue = btn.dataset.rights;
    renderFilters();
    renderStatusTabs();
    renderList();
  }));
  chipBar.querySelector("[data-fav]")?.addEventListener("click", () => {
    favoritesOnly = !favoritesOnly;
    renderFilters();
    renderList();
  });
}

function syncSortSelect() {
  if (!els.sortSelect) return;
  const map = { total: "score", date: "date", title: "title" };
  els.sortSelect.value = map[sortKey] || "custom";
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
    head.removeAttribute("aria-hidden");
    const sb = (key, label) => {
      const on = sortKey === key;
      const arrow = on ? (sortDir === "desc" ? "▼" : "▲") : "";
      return `<button type="button" class="sort-btn ${on ? "on" : ""}" data-sort="${key}" aria-label="${label} 정렬">${label}<i>${arrow}</i></button>`;
    };
    head.innerHTML = `
      <span>#</span>
      <span>${sb("title", "작품")}</span>
      <span>상태</span>
      <span>${sb("total", "총점")}</span>
      <span class="mini-bars-head">${sb("dramaFit", "드라마")}${sb("marketPotential", "흥행")}${sb("originality", "차별")}${sb("scalability", "확장")}${sb("characterAppeal", "캐릭터")}</span>
      <span class="ref-sort">참고 ${sb("productionFeasibility", "제작")} · ${sb("globalPotential", "글로벌")}</span>
    `;
    head.querySelectorAll(".sort-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.sort;
        if (sortKey === key) sortDir = sortDir === "desc" ? "asc" : "desc";
        else { sortKey = key; sortDir = key === "title" ? "asc" : "desc"; }
        syncSortSelect();
        renderList();
      });
    });
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
    const meta = [item.sourceInfo.platform || item.originalType, ...item.genre.slice(0, 2)].filter(Boolean).join(" · ");
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
      <span class="row-badges">${statusBadgeHtml(item)}${rightsBadgeHtml(item)}</span>
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
  node.querySelector(".detail-type").innerHTML = `${statusBadgeHtml(item)}${rightsBadgeHtml(item)}<span>${escapeHtml(`${item.originalType} · 제작 난이도 ${item.productionDifficulty}`)}</span>`;
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
  renderDbComparisons(node.querySelector(".db-compare"), item);
  renderFactPanel(node.querySelector(".fact-panel"), item);
  renderAdaptableElements(node.querySelector(".adapt-grid"), item.adaptableElements);

  // 주요 인물 — 이름 탭으로 한 명씩 보기
  const chars = (item.mainCharacters || []).filter((char) => char && char.name);
  const charContainer = document.createElement("section");
  charContainer.className = "character-deep-dive";
  const tabsHtml = chars.map((char, i) => `<button type="button" role="tab" class="char-tab ${i === 0 ? "active" : ""}" aria-selected="${i === 0 ? "true" : "false"}" data-char-index="${i}">${escapeHtml(char.name)}</button>`).join("");
  const panelsHtml = chars.map((char, i) => `
    <div class="char-panel" role="tabpanel" data-char-panel="${i}" ${i === 0 ? "" : "hidden"}>
      <h4 class="char-print-name">${escapeHtml(char.name)}</h4>
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
      if (!window.DashboardAuth?.canWrite) return;
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

// 상세 페이지 PDF 저장 — 브라우저 인쇄 창에서 'PDF로 저장'을 고르면 됨
function exportDetailPdf() {
  const item = items.find((candidate) => candidate.id === selectedId);
  if (!item || !els.detailPanel) return;
  const panel = els.detailPanel;
  const closedDetails = [...panel.querySelectorAll("details")].filter((d) => !d.open);
  closedDetails.forEach((d) => { d.open = true; });

  const today = new Date();
  const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  const meta = document.createElement("p");
  meta.className = "print-meta";
  meta.textContent = `원작 IP 평가 · 출력일 ${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}`;
  panel.prepend(meta);

  const previousTitle = document.title;
  document.title = `${item.title}_IP평가_${ymd}`.replace(/[\\/:*?"<>|]/g, "");
  document.body.classList.add("printing-detail");

  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    closedDetails.forEach((d) => { d.open = false; });
    meta.remove();
    document.title = previousTitle;
    document.body.classList.remove("printing-detail");
    window.removeEventListener("afterprint", restore);
  };
  window.addEventListener("afterprint", restore);
  window.print();
  setTimeout(restore, 1000);
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

if (els.pdfBtn) {
  els.pdfBtn.addEventListener("click", exportDetailPdf);
}

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

if (els.searchInput) els.searchInput.addEventListener("input", renderList);
if (els.typeFilter) els.typeFilter.addEventListener("input", () => { typeFilterValue = els.typeFilter.value; renderFilters(); renderList(); });
if (els.sortSelect) els.sortSelect.addEventListener("input", () => {
  const map = { score: "total", date: "date", title: "title" };
  const key = map[els.sortSelect.value];
  if (!key) return;
  sortKey = key;
  sortDir = key === "title" ? "asc" : "desc";
  renderList();
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

// ==========================================
// 9. 초기화
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
  initSupabase();
  await window.DashboardAuth?.initialize(supabaseClient);
  if (!IS_PROD) {
    const badge = document.createElement("div");
    badge.textContent = "TEST 서버 · kdrama_ips_test";
    badge.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:9999;background:#d9480f;color:#fff;text-align:center;font:600 12px/24px sans-serif;";
    document.body.appendChild(badge);
    document.body.style.paddingTop = "24px";
  }
  switchView("dashboard");
  syncLoadItems();
});


// ── DB 내 유사작 비교 ──────────────────────────────
// dbComparisons(제목 배열)가 있으면 그 작품을, 없으면 장르 키워드가 겹치는 작품을 자동으로 찾는다.
// 점수는 저장값이 아니라 현재 DB 값을 매번 불러오므로 재평가 후에도 최신으로 유지된다.
const GENRE_STOPWORDS = new Set(["드라마", "물", "장르", "현대", "코미디 드라마"]);

function genreTokens(item) {
  const tokens = new Set();
  (item.genre || []).forEach((g) => {
    String(g).split(/[\s·,/()]+/).forEach((t) => {
      const w = t.replace(/물$/, "").trim();
      if (w.length >= 2 && !GENRE_STOPWORDS.has(w)) tokens.add(w);
    });
  });
  return tokens;
}

function findSimilarItems(item, limit = 3) {
  const others = items.filter((c) => c.id !== item.id);
  if (item.dbComparisons && item.dbComparisons.length) {
    const picked = item.dbComparisons
      .map((title) => others.find((c) => c.title.replace(/\s/g, "") === String(title).replace(/\s/g, "")))
      .filter(Boolean);
    if (picked.length) return picked.slice(0, limit);
  }
  const base = genreTokens(item);
  if (!base.size) return [];
  return others
    .map((c) => {
      const t = genreTokens(c);
      let overlap = 0;
      base.forEach((w) => { if ([...t].some((x) => x.includes(w) || w.includes(x))) overlap += 1; });
      return { c, overlap };
    })
    .filter((x) => x.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap || averageScore(b.c) - averageScore(a.c))
    .slice(0, limit)
    .map((x) => x.c);
}

function renderDbComparisons(container, item) {
  if (!container) return;
  const similar = findSimilarItems(item);
  if (!similar.length) {
    container.innerHTML = '<p class="ref-sub">DB 내 유사작 없음</p>';
    return;
  }
  const keys = totalScoreKeys;
  const cell = (v, base) => {
    const diff = v - base;
    const cls = Math.abs(diff) < 0.05 ? "" : diff > 0 ? "cmp-up" : "cmp-down";
    return `<td class="${cls}">${v.toFixed(1)}</td>`;
  };
  const row = (it, isSelf) => `
    <tr class="${isSelf ? "cmp-self" : ""}">
      <th scope="row">${isSelf ? escapeHtml(it.title) : `<button type="button" class="cmp-link" data-cmp-id="${escapeHtml(it.id)}">${escapeHtml(it.title)}</button>`}</th>
      <td><strong>${averageScore(it).toFixed(1)}</strong></td>
      ${keys.map((k) => isSelf ? `<td>${clampScore(it.scores[k]).toFixed(1)}</td>` : cell(clampScore(it.scores[k]), clampScore(item.scores[k]))).join("")}
      <td>${escapeHtml(it.recommendation)}</td>
    </tr>`;
  container.innerHTML = `
    <p class="ref-sub">DB 내 유사작 비교</p>
    <div class="cmp-scroll">
      <table class="cmp-table"><colgroup><col class="cmp-col-title">${keys.map(() => "<col>").join("")}<col><col class="cmp-col-judge"></colgroup>
        <thead><tr><th>작품</th><th>총점</th>${keys.map((k) => `<th>${escapeHtml({ dramaFit: "드라마", marketPotential: "흥행", originality: "차별", scalability: "확장", characterAppeal: "캐릭터" }[k] || scoreLabels[k])}</th>`).join("")}<th>판정</th></tr></thead>
        <tbody>${row(item, true)}${similar.map((s) => row(s, false)).join("")}</tbody>
      </table>
    </div>`;
  container.querySelectorAll(".cmp-link").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = items.find((c) => c.id === btn.dataset.cmpId);
      if (target) { openDetail(target); window.scrollTo({ top: 0, behavior: "smooth" }); }
    });
  });
}


// ── 사실 정보(총점 미반영): 연재처·연재 상태, 판권 보유처, 원작 반응 수치, 예상 편성 규격 ──
function normalizeFactObject(raw, keys) {
  const out = {};
  keys.forEach((k) => { out[k] = raw && raw[k] != null ? String(raw[k]).trim() : ""; });
  return out;
}

function serialTagHtml(item) {
  const st = item.sourceInfo.status;
  if (!st) return "";
  const cls = st === "완결" ? "done" : st === "휴재" ? "pause" : "live";
  return `<span class="serial-tag serial-${cls}">${escapeHtml(st)}</span>`;
}

function renderFactPanel(container, item) {
  if (!container) return;
  const dash = '<span class="fact-empty">미입력</span>';
  const when = (d) => (d ? `<small class="fact-date">${escapeHtml(d)} 확인</small>` : "");
  const src = item.sourceInfo;
  const rights = item.rightsInfo;
  const fmt = item.formatSuggestion;
  const metrics = item.reactionMetrics.length
    ? `<ul class="fact-metrics">${item.reactionMetrics.map((m) => `<li><span>${escapeHtml(m.label)}</span><strong>${escapeHtml(m.value)}</strong>${m.checkedAt || m.source ? `<small>${escapeHtml([m.checkedAt, m.source].filter(Boolean).join(" · "))}</small>` : ""}</li>`).join("")}</ul>`
    : dash;
  container.innerHTML = `
    <div class="section-head"><h3>원작 정보</h3><span>사실 정보 · 총점에 들어가지 않음</span></div>
    <dl class="fact-grid">
      <div><dt>연재처 · 상태</dt><dd>${src.platform || src.status ? `${escapeHtml(src.platform || "-")} ${serialTagHtml(item)} ${when(src.checkedAt)}` : dash}</dd></div>
      <div><dt>판권 보유처</dt><dd>${rights.holder || rights.note ? `${escapeHtml(rights.holder || "보유처 미확인")}${rights.contact ? `<br><small>${escapeHtml(rights.contact)}</small>` : ""}${rights.note ? `<br><small>${escapeHtml(rights.note)}</small>` : ""} ${when(rights.checkedAt)}` : dash}</dd></div>
      <div><dt>예상 편성 규격</dt><dd>${fmt.format ? `<strong>${escapeHtml(fmt.format)}</strong>${fmt.reason ? `<br><small>${escapeHtml(fmt.reason)}</small>` : ""}` : dash}</dd></div>
      <div class="fact-wide"><dt>원작 반응 수치</dt><dd>${metrics}</dd></div>
    </dl>`;
}


// ==========================================
// 10. 가중치 개편안 — 시뮬레이션 전용 화면 (2026-10-07)
// 점수를 읽어 화면에서만 다시 계산한다. items·DB에는 아무것도 쓰지 않는다.
// ==========================================
const CURRENT_RECOMMEND_CUT = 6.5;
const PROPOSAL_KEYS = ["dramaFit", "marketPotential", "originality", "scalability", "characterAppeal"];
const PROPOSAL_PRESETS = [
  { key: "proposal", label: "보고서 제안값", weights: { dramaFit: 1.0, marketPotential: 0.8, originality: 1.0, scalability: 1.2, characterAppeal: 1.4 } },
  { key: "noMarket", label: "제안값 · 흥행성 제외", weights: { dramaFit: 1.0, marketPotential: 0, originality: 1.0, scalability: 1.2, characterAppeal: 1.4 } },
  { key: "current", label: "현행과 같게", weights: { ...TOTAL_WEIGHTS } },
];
const PROPOSAL_STORE_KEY = `${STORAGE_KEY}-weight-proposal`;
const PROPOSAL_VIEWS = [
  { key: "flip", label: "판정이 바뀌는 작품" },
  { key: "candidate", label: "후보작" },
  { key: "comparison", label: "비교용" },
  { key: "all", label: "전체" },
];

function loadProposalState() {
  const fallback = { weights: { ...PROPOSAL_PRESETS[0].weights }, cut: CURRENT_RECOMMEND_CUT };
  try {
    const saved = JSON.parse(localStorage.getItem(PROPOSAL_STORE_KEY));
    if (!saved || typeof saved !== "object") return fallback;
    const weights = {};
    for (const key of PROPOSAL_KEYS) {
      const v = Number(saved.weights?.[key]);
      weights[key] = Number.isFinite(v) && v >= 0 ? v : fallback.weights[key];
    }
    const cut = Number(saved.cut);
    return { weights, cut: Number.isFinite(cut) ? cut : fallback.cut };
  } catch {
    return fallback;
  }
}

function saveProposalState() {
  try { localStorage.setItem(PROPOSAL_STORE_KEY, JSON.stringify({ weights: proposalWeights, cut: proposalCut })); } catch { /* 저장 실패해도 화면 동작에는 영향 없음 */ }
}

const proposalState = loadProposalState();
let proposalWeights = proposalState.weights;
let proposalCut = proposalState.cut;
let proposalViewKey = "flip";
let proposalSortKey = "next";
let proposalSortDir = "desc";
let proposalControlsBuilt = false;

function weightedTotal(item, weights) {
  let sum = 0;
  let weightSum = 0;
  PROPOSAL_KEYS.forEach((key) => {
    const w = Number(weights[key]) || 0;
    sum += clampScore(item.scores?.[key]) * w;
    weightSum += w;
  });
  return weightSum ? Math.round((sum / weightSum) * 10) / 10 : 0;
}

function comparisonGroup(item) {
  const notes = String(item.notes || "");
  if (notes.startsWith("[비교용·흥행 부진")) return "flop";
  if (notes.startsWith("[비교용")) return "hit";
  return null;
}

function verdictLabel(item) {
  return { recommend: "추천", research: "리서치 필요", hold: "보류" }[statusKey(item)];
}

function proposedVerdict(item, currentTotal, nextTotal) {
  const status = statusKey(item);
  if (status === "research") return "리서치 필요";
  if (status === "hold" && currentTotal >= CURRENT_RECOMMEND_CUT) return "보류"; // 치명적 리스크 보류는 유지
  return nextTotal >= proposalCut ? "추천" : "보류";
}

function separationRate(rows, totalOf) {
  const hits = rows.filter((r) => r.group === "hit");
  const flops = rows.filter((r) => r.group === "flop");
  if (!hits.length || !flops.length) return { rate: null, hits: hits.length, flops: flops.length };
  let win = 0;
  hits.forEach((h) => flops.forEach((f) => {
    const a = totalOf(h), b = totalOf(f);
    win += a > b ? 1 : a === b ? 0.5 : 0;
  }));
  return { rate: win / (hits.length * flops.length), hits: hits.length, flops: flops.length };
}

function buildProposalRows() {
  const noMarket = (weights) => ({ ...weights, marketPotential: 0 });
  return items.map((item) => {
    const current = averageScore(item);
    const next = weightedTotal(item, proposalWeights);
    const before = verdictLabel(item);
    const after = proposedVerdict(item, current, next);
    return {
      item,
      group: comparisonGroup(item),
      current,
      next,
      delta: Math.round((next - current) * 10) / 10,
      before,
      after,
      flipped: before !== after,
      currentNoMarket: weightedTotal(item, noMarket(TOTAL_WEIGHTS)),
      nextNoMarket: weightedTotal(item, noMarket(proposalWeights)),
    };
  });
}

function buildProposalControls() {
  const presetBox = document.querySelector("#proposalPresets");
  const weightBox = document.querySelector("#proposalWeights");
  if (!presetBox || !weightBox) return false;

  const activePreset = PROPOSAL_PRESETS.find((p) => PROPOSAL_KEYS.every((k) => Number(p.weights[k]) === Number(proposalWeights[k])));
  presetBox.innerHTML = PROPOSAL_PRESETS.map((p) => `<button type="button" class="ghost-btn ${activePreset?.key === p.key ? "on" : ""}" data-preset="${p.key}">${escapeHtml(p.label)}</button>`).join("");
  presetBox.querySelectorAll("[data-preset]").forEach((btn) => btn.addEventListener("click", () => {
    const preset = PROPOSAL_PRESETS.find((p) => p.key === btn.dataset.preset);
    if (!preset) return;
    proposalWeights = { ...preset.weights };
    saveProposalState();
    buildProposalControls();
    renderProposalResults();
  }));

  weightBox.innerHTML = PROPOSAL_KEYS.map((key) => {
    const changed = Number(proposalWeights[key]) !== Number(TOTAL_WEIGHTS[key]);
    return `
      <div class="pw ${changed ? "changed" : ""}" data-pw="${key}">
        <label for="pw-${key}">${escapeHtml(scoreLabels[key])}</label>
        <div class="pw-row"><span>현행 ${Number(TOTAL_WEIGHTS[key]).toFixed(1)} →</span>
          <input id="pw-${key}" type="number" inputmode="decimal" step="0.1" min="0" max="3" value="${Number(proposalWeights[key]).toFixed(1)}" data-weight="${key}" />
        </div>
      </div>`;
  }).join("") + `
      <div class="pw pw-cut ${proposalCut !== CURRENT_RECOMMEND_CUT ? "changed" : ""}">
        <label for="pw-cut">추천 컷</label>
        <div class="pw-row"><span>현행 ${CURRENT_RECOMMEND_CUT.toFixed(1)} →</span>
          <input id="pw-cut" type="number" inputmode="decimal" step="0.1" min="0" max="10" value="${proposalCut.toFixed(1)}" />
        </div>
      </div>`;

  weightBox.querySelectorAll("[data-weight]").forEach((input) => input.addEventListener("input", () => {
    const key = input.dataset.weight;
    const v = Number(input.value);
    if (!Number.isFinite(v) || v < 0) return;
    proposalWeights[key] = v;
    input.closest(".pw")?.classList.toggle("changed", v !== Number(TOTAL_WEIGHTS[key]));
    const nowActive = PROPOSAL_PRESETS.find((p) => PROPOSAL_KEYS.every((k) => Number(p.weights[k]) === Number(proposalWeights[k])));
    presetBox.querySelectorAll("[data-preset]").forEach((b) => b.classList.toggle("on", nowActive?.key === b.dataset.preset));
    saveProposalState();
    renderProposalResults();
  }));
  weightBox.querySelector("#pw-cut")?.addEventListener("input", (event) => {
    const v = Number(event.target.value);
    if (!Number.isFinite(v)) return;
    proposalCut = v;
    event.target.closest(".pw")?.classList.toggle("changed", v !== CURRENT_RECOMMEND_CUT);
    saveProposalState();
    renderProposalResults();
  });

  const search = document.querySelector("#proposalSearch");
  if (search && !search.dataset.bound) {
    search.dataset.bound = "1";
    search.addEventListener("input", renderProposalResults);
  }
  return true;
}

function renderProposal() {
  if (!proposalControlsBuilt) proposalControlsBuilt = buildProposalControls();
  renderProposalResults();
}

function renderProposalResults() {
  const formula = document.querySelector("#proposalFormula");
  const kpiBox = document.querySelector("#proposalKpis");
  const tabBox = document.querySelector("#proposalTabs");
  const head = document.querySelector("#proposalHead");
  const body = document.querySelector("#proposalBody");
  if (!kpiBox || !tabBox || !head || !body) return;

  const weightSum = PROPOSAL_KEYS.reduce((sum, key) => sum + (Number(proposalWeights[key]) || 0), 0);
  if (formula) {
    formula.textContent = `개편안 총점 = (${PROPOSAL_KEYS.map((k) => `${scoreLabels[k]}×${Number(proposalWeights[k]).toFixed(1)}`).join(" + ")}) ÷ ${weightSum.toFixed(1)}`
      + (weightSum ? "" : " · 가중치가 모두 0이라 계산할 수 없습니다.");
  }

  const rows = buildProposalRows();
  const flips = rows.filter((r) => r.flipped);
  const candidates = rows.filter((r) => !r.group);
  const comparisons = rows.filter((r) => r.group);
  const toRecommend = flips.filter((r) => r.after === "추천").length;
  const toHold = flips.filter((r) => r.after === "보류").length;
  const recBefore = candidates.filter((r) => r.before === "추천").length;
  const recAfter = candidates.filter((r) => r.after === "추천").length;
  const sepNow = separationRate(rows, (r) => r.current);
  const sepNext = separationRate(rows, (r) => r.next);
  const sepNowNm = separationRate(rows, (r) => r.currentNoMarket);
  const sepNextNm = separationRate(rows, (r) => r.nextNoMarket);
  const pct = (s) => (s.rate === null ? "—" : `${(s.rate * 100).toFixed(1)}%`);

  const navCount = document.querySelector("#proposalNavCount");
  if (navCount) navCount.textContent = flips.length;

  kpiBox.innerHTML = `
    <div class="kpi"><span>판정이 바뀌는 작품</span><strong>${flips.length}</strong><small>보류 → 추천 ${toRecommend} · 추천 → 보류 ${toHold}</small></div>
    <div class="kpi"><span>후보작 추천 (비교용 제외)</span><strong class="kpi-recommend">${recBefore}<span class="kpi-arrow">→</span>${recAfter}</strong><small>후보작 ${candidates.length}편 기준</small></div>
    <div class="kpi"><span>흥행·부진 구분력</span><strong>${pct(sepNow)}<span class="kpi-arrow">→</span>${pct(sepNext)}</strong><small>비교용 흥행 ${sepNow.hits} × 부진 ${sepNow.flops}</small></div>
    <div class="kpi"><span>구분력 · 흥행성 제외</span><strong>${pct(sepNowNm)}<span class="kpi-arrow">→</span>${pct(sepNextNm)}</strong><small>결과를 알고 매긴 흥행성을 빼고 본 값</small></div>`;

  const pools = { flip: flips, candidate: candidates, comparison: comparisons, all: rows };
  tabBox.innerHTML = "";
  PROPOSAL_VIEWS.forEach((v) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", proposalViewKey === v.key ? "true" : "false");
    btn.className = `status-tab ${proposalViewKey === v.key ? "active" : ""}`;
    btn.innerHTML = `${v.label} <span>${pools[v.key].length}</span>`;
    btn.addEventListener("click", () => { proposalViewKey = v.key; renderProposalResults(); });
    tabBox.append(btn);
  });

  const query = (document.querySelector("#proposalSearch")?.value || "").trim().toLowerCase();
  const dir = proposalSortDir === "asc" ? 1 : -1;
  const sortValue = (r) => ({ title: r.item.title, current: r.current, next: r.next, delta: r.delta, verdict: r.after }[proposalSortKey]);
  const visible = pools[proposalViewKey]
    .filter((r) => !query || r.item.title.toLowerCase().includes(query))
    .sort((a, b) => {
      const x = sortValue(a), y = sortValue(b);
      const diff = typeof x === "string" ? x.localeCompare(y, "ko") : x - y;
      return dir * diff || b.next - a.next || a.item.title.localeCompare(b.item.title, "ko");
    });

  const sb = (key, label, cls = "") => {
    const on = proposalSortKey === key;
    return `<th class="${cls}"><button type="button" class="sort-btn ${on ? "on" : ""}" data-psort="${key}">${label}<i>${on ? (proposalSortDir === "desc" ? "▼" : "▲") : ""}</i></button></th>`;
  };
  head.innerHTML = `<tr><th class="pt-rank">#</th>${sb("title", "작품")}${sb("current", "현행", "pt-num")}${sb("next", "개편안", "pt-num")}${sb("delta", "변화", "pt-num")}${sb("verdict", "판정 (현행 → 개편안)")}</tr>`;
  head.querySelectorAll("[data-psort]").forEach((btn) => btn.addEventListener("click", () => {
    const key = btn.dataset.psort;
    if (proposalSortKey === key) proposalSortDir = proposalSortDir === "desc" ? "asc" : "desc";
    else { proposalSortKey = key; proposalSortDir = key === "title" || key === "verdict" ? "asc" : "desc"; }
    renderProposalResults();
  }));

  if (!visible.length) {
    const msg = !items.length ? "데이터를 불러오는 중입니다."
      : proposalViewKey === "flip" && !query ? "이 가중치로는 판정이 바뀌는 작품이 없습니다."
      : "조건에 맞는 작품이 없습니다.";
    body.innerHTML = `<tr><td colspan="6" class="pt-empty">${msg}</td></tr>`;
    return;
  }

  const pill = (v) => `<span class="status-badge status-${{ "추천": "recommend", "보류": "hold", "리서치 필요": "research" }[v]}">${escapeHtml(v)}</span>`;
  body.innerHTML = visible.map((r, i) => {
    const deltaCls = r.delta > 0 ? "up" : r.delta < 0 ? "down" : "zero";
    const deltaText = `${r.delta > 0 ? "+" : ""}${r.delta.toFixed(1)}`;
    const groupChip = r.group ? `<span class="pt-group pt-${r.group}">${r.group === "hit" ? "비교용 · 흥행" : "비교용 · 부진"}</span>` : "";
    return `
      <tr class="${r.flipped ? "pt-flip" : ""}" data-pid="${escapeHtml(r.item.id)}" tabindex="0">
        <td class="pt-rank">${i + 1}</td>
        <td class="pt-title"><strong>${escapeHtml(r.item.title)}</strong><span class="pt-meta">${rightsBadgeHtml(r.item)}${groupChip}</span></td>
        <td class="pt-num">${r.current.toFixed(1)}</td>
        <td class="pt-num"><strong>${r.next.toFixed(1)}</strong></td>
        <td class="pt-num pt-delta ${deltaCls}">${deltaText}</td>
        <td class="pt-verdict">${r.flipped ? `${pill(r.before)}<span class="pt-arrow">→</span>${pill(r.after)}` : pill(r.after)}</td>
      </tr>`;
  }).join("");
  body.querySelectorAll("tr[data-pid]").forEach((tr) => {
    const open = () => {
      const item = items.find((c) => c.id === tr.dataset.pid);
      if (item) openDetail(item);
    };
    tr.addEventListener("click", open);
    tr.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); }
    });
  });
}
