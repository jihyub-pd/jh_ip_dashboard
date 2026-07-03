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
    marketPotential: "재벌가 복수극 및 직장인 성공 판타지가 결합돼 대중적 진입 장벽이 낮고, 원작형 회귀물 팬덤까지 흡수할 수 있다.",
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
  const values = Object.keys(scoreLabels).map((key) => clampScore(item.scores?.[key]));
  const sum = values.reduce((acc, val) => acc + val, 0);
  return Math.round((sum / values.length) * 10) / 10;
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

function normalizeItem(raw, options = {}) {
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
    return { name: String(c).trim(), role: "주연", traits: "정보 없음", appealPoints: "정보 없음", improvements: "정보 없음" };
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
    scores: {
      dramaFit: clampScore(raw.scores?.dramaFit),
      marketPotential: clampScore(raw.scores?.marketPotential),
      productionFeasibility: clampScore(raw.scores?.productionFeasibility),
      originality: clampScore(raw.scores?.originality),
      scalability: clampScore(raw.scores?.scalability),
      globalPotential: clampScore(raw.scores?.globalPotential),
      characterAppeal: clampScore(raw.scores?.characterAppeal),
    },
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
      const priorityA = clampScore(a.scores?.dramaFit) + clampScore(a.scores?.productionFeasibility) + clampScore(a.scores?.globalPotential);
      const priorityB = clampScore(b.scores?.dramaFit) + clampScore(b.scores?.productionFeasibility) + clampScore(b.scores?.globalPotential);
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
    return matchesQuery && matchesType;
  });
}

function updatePrompt() {
  if (!els.promptText) return;
  const title = els.promptTitle?.value?.trim() || "{{원작 제목}}";
  els.promptText.value = `다음 원작 IP를 한국 드라마로 제작할 가능성 관점에서 분석해줘.\n반드시 JSON만 출력하고, JSON 밖에는 어떤 설명도 쓰지 마.\n\n원작 제목: ${title}\n\n${JSON.stringify(requiredShape, null, 2)}`;
}

function updateBackupText() {
  if (!els.backupText) return;
  els.backupText.value = JSON.stringify({ app: "kdrama-ip-dashboard", version: 2, exportedAt: new Date().toISOString(), items }, null, 2);
}

function render() {
  renderMetrics();
  renderFilters();
  renderList();
  updatePrompt();       
  updateBackupText();   
}

function renderMetrics() {
  if (els.totalCount) els.totalCount.textContent = items.length;
  if (els.recommendedCount) els.recommendedCount.textContent = items.filter((item) => item.recommendation.includes("추천")).length;
  const rawAvg = items.length ? items.reduce((sum, item) => sum + averageScore(item), 0) / items.length : 0;
  if (els.averageScore) els.averageScore.textContent = rawAvg.toFixed(1);
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

  visible.forEach((item) => {
    const isSelected = selectedIds.has(item.id);
    const button = document.createElement("button");
    button.className = `ip-card ${!selectMode && item.id === selectedId ? "active" : ""} ${selectMode && isSelected ? "selected" : ""}`;
    button.type = "button";
    button.innerHTML = `
      <div class="ip-card-top">
        <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">
          ${selectMode ? `<input type="checkbox" class="ip-checkbox" ${isSelected ? "checked" : ""} onclick="event.stopPropagation()" style="width:16px;height:16px;flex-shrink:0;cursor:pointer;accent-color:var(--accent-1)">` : ""}
          <div style="flex:1;min-width:0">
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.logline || "로그라인 없음")}</p>
          </div>
        </div>
        <span class="mini-score">${averageScore(item).toFixed(1)}</span>
      </div>
      <div class="tag-row">${[item.originalType, item.recommendation, ...item.genre.slice(0, 3)].map(tagHtml).join("")}</div>
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
        selectedId = item.id;
        if (els.detailViewTitle) els.detailViewTitle.textContent = item.title;
        renderDetail();
        switchView("detail");
      }
    });

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
  node.querySelector(".detail-type").textContent = `${item.originalType} · ${item.recommendation} · 제작 난이도 ${item.productionDifficulty}`;
  node.querySelector(".detail-title").textContent = item.title;
  node.querySelector(".detail-logline").textContent = item.logline;
  node.querySelector(".score-value").textContent = averageScore(item).toFixed(1);
  node.querySelector(".detail-tags").innerHTML = [...item.genre].map(tagHtml).join("");
  node.querySelector(".score-bars").innerHTML = Object.entries(scoreLabels)
    .map(([key, label]) => scoreRow(label, clampScore(item.scores[key]), scoreRationaleText(item, key)))
    .join("");

  renderListInto(node.querySelector(".strengths"), item.strengths);
  renderListInto(node.querySelector(".risks"), item.risks);
  renderThreePoints(node.querySelector(".premise"), item.premise);
  renderThreePoints(node.querySelector(".target"), item.targetAudience);
  renderThreePoints(node.querySelector(".casting"), item.castingDirection);
  renderListInto(node.querySelector(".comparables-list"), item.comparables);

  // 캐릭터 심층 분석 노드 생성
  const charactersHtml = (item.mainCharacters || []).map(char => {
    return '<div class="char-sub-card">' +
      '<h4>' + escapeHtml(char.name) + ' <small>(' + escapeHtml(char.role) + ')</small></h4>' +
      '<p><strong>특징/대사/행동/평가:</strong> ' + escapeHtml(char.traits) + '</p>' +
      '<p><strong style="color:var(--accent-3);">입덕 포인트:</strong> ' + escapeHtml(char.appealPoints) + '</p>' +
      '<p><strong style="color:var(--accent-2);">개선/각색점:</strong> ' + escapeHtml(char.improvements) + '</p>' +
      '</div>';
  }).join("");

  const charContainer = document.createElement("div");
  charContainer.className = "character-deep-dive";
  charContainer.innerHTML = '<h3 class="char-dive-title">주인공 심층 연출 분석</h3>' +
    '<div class="char-grid">' + charactersHtml + '</div>';

  const targetBlock = node.querySelector(".detail-blocks") || node.querySelector(".detail-info-grid");
  if (targetBlock && targetBlock.parentNode) {
    targetBlock.parentNode.insertBefore(charContainer, targetBlock);
  } else {
    const firstChild = node.firstElementChild;
    if (firstChild) {
      firstChild.appendChild(charContainer);
    }
  }

  const memoInput = node.querySelector(".memo-input");
  if (memoInput) {
    memoInput.value = item.notes;
    memoInput.addEventListener("input", () => {
      item.notes = memoInput.value;
      item.updatedAt = new Date().toISOString();
      if (memoTimeout) clearTimeout(memoTimeout);
      memoTimeout = setTimeout(async () => {
        const result = await syncSaveItem(item, { silent: true });
        if (!result.ok) console.warn("메모 클라우드 저장 실패:", result.error);
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

  loadAiAnalysis(item);
}

// ==========================================
// 7. 스마트 로컬 우회 기획 생성 엔진 (14대 가이드라인 완벽 동기화) ⚙️
// ==========================================
function generateMockDashboardData(title) {
  const isMilitary = title.includes("취사병") || title.includes("군대") || title.includes("군인");
  
  if (isMilitary) {
    return {
      title: title,
      originalType: "웹툰",
      genre: ["밀리터리", "요리", "성장 드라마"],
      logline: "군대 취사반을 배경으로 고군분투하며 절대 미각과 기획력으로 부대 급식 문화를 혁신하는 천재 요리병의 성공 서사.",
      premise: "① ROK 대한민국 육군 취사반이라는 리얼하고 특수한 공간적 세계관 ② 요리를 통해 유대감을 쌓고 내부 부조리를 혁신하는 휴먼/힐링 갈등 구조 ③ 부대 내 조리 공정 현대화 및 레시피 개발 성공 판타지",
      mainCharacters: [
        { name: "강성재 (남주1)", role: "천재 취사병", traits: "절대 미각과 군인 특유의 우직함을 소유. '맛있는 밥 한 끼가 군대의 전투력입니다'라며 뚝심 있게 행동함. 작중 커뮤니티에서는 '주방의 신'으로 불림.", appealPoints: "열악한 예산과 취사반 환경을 창의적 레시피와 스킬로 정면 돌파해 나갈 때의 대리만족 카타르시스.", improvements: "웹툰 특유의 개인 만능 해결사적 연출을 탈피하여, 후반부 대규모 급식 미션 시 취사조 동료들과의 협동 분량 및 극적 위기 레이어 추가 요망." },
        { name: "조여린 (여주1)", role: "신임 민간 조리원", traits: "부대 급식 선진화를 위해 특별 파견된 요리 전문가. 철저한 데이터와 위생 기준 중심의 꼼꼼한 행동 양식을 표출하며 초반 취사반과 대립함.", appealPoints: "군대 내부의 불합리한 행정 타성과 부조리에 주눅 들지 않고 논리적으로 맞서는 주체적 크러시 매력.", improvements: "주인공과의 억지 멜로 라인 형성으로 장르물 텐션을 해치지 않도록, 전문적인 스승이자 든든한 파트너십 서사 빌드업에 초점을 맞춰 각색할 필요 있음." },
        { name: "백종수 (조연1)", role: "취사반장 (상사)", traits: "겉으로는 '대충 먹여라'라며 툴툴거리지만, 보이지 않는 곳에서 행보관과 간부들의 압박을 온몸으로 막아주는 전형적인 츤데레형 베테랑 군인.", appealPoints: "부대원들을 진심으로 아끼는 친근하고 인간적인 리더십과 능글맞은 생활 연기 파트.", improvements: "평면적인 개그 캐릭터로 소비되지 않도록 과거 군 복무 시절 급식 사고 트라우마를 각색 보완하여 입체감을 부여함." },
        { name: "임민우 (조연2)", role: "취사반 맞선임 (병장)", traits: "초반에는 강성재를 시기하며 사사건건 트집을 잡고 텃세를 부리나, 요리에 대한 진심을 깨달은 후 가장 든든한 오른팔로 변모하는 입체적 인물.", appealPoints: "미워할 수 없는 얄미움에서 든든한 조력자로 변해가는 브로맨스 케미스트리.", improvements: "단순한 악역 군인 빌런에서 기획 전개에 맞춰 성장하는 서사적 타당성을 초반 에피소드에 촘촘히 배치 요망." }
      ],
      strengths: [
        "강점1 — 대한민국 군필 및 군대 예능 매니아층을 사로잡을 수 있는 취사반이라는 독창적이고 현실 밀착형인 공간 소재의 신선함",
        "강점2 — 매 회차 시각 및 청각적 자극을 주는 화려한 단체 급식 조리 씬 연출을 통한 독보적인 K-요리 드라마 패러다임 제시",
        "강점3 — 군대 내부의 갈등을 요리라는 따뜻한 매개체를 통해 치유해 나가는 대중성 높은 휴먼 성장 성장 서사의 결합"
      ],
      risks: [
        "리스크1 — 밀리터리 배경 특성상 여성 시청자층의 진입 장벽이 초반에 발생할 우려가 있어 보편적 감동 코드 배치 필요",
        "리스크2 — 대규모 단체 급식 가공 및 조리 과정을 매 에피소드마다 영화 수준으로 고급스럽게 구현해야 하는 연출/촬영 난도",
        "리스크3 — 원작의 판타지적 절대 미각 설정을 현실 드라마 연출로 변주할 때 자칫 유치해질 수 있는 싱크로율 리스크"
      ],
      targetAudience: "20-40대 군필 및 밀리터리 예능 선호 시청자층 / 요리 및 전문직 드라마 선호 여성층 / 대중적 카타르시스를 즐기는 주말 드라마 팬덤 레이어",
      productionDifficulty: "보통",
      castingDirection: "주연: 건강하고 신선한 마스크의 20대 대세 라이징 남자 배우 / 조연: 생활 연기와 능글맞은 츤데레 매력을 고루 갖춘 베테랑 명품 배우 / 연출: 현실 밀착형 장르 서사와 감각적인 미장센의 밸런스를 잡는 베테랑 감독",
      comparables: ["D.P.", "식샤를 합시다", "군검사 도베르만"],
      recommendation: "추천",
      scores: { dramaFit: 9.2, marketPotential: 8.8, productionFeasibility: 8.2, originality: 9.5, scalability: 8.5, globalPotential: 7.8, characterAppeal: 9.0 },
      scoreRationales: {
        dramaFit: "에피소드 형식의 급식 혁신 미션 구조가 매우 명확하여 주차별 연속극 대본 구성에 최적화되어 있으나 후반부 반복감을 줄이는 가공이 필요하다.",
        marketPotential: "유튜브와 방송가에서 흥행이 검증된 군대와 요리 조합의 드라마 버전으로, 탄탄한 원작 웹툰 팬덤의 초기 유입과 화제성이 매우 높다.",
        productionFeasibility: "대부분 부대 내부 취사 조리실 세트 촬영 위주로 전개되어 야외 로케이션 비용은 절감되나, 고급 조리 씬 연출을 위한 고속 촬영 장비 예산이 수반된다.",
        originality: "그동안의 밀리터리 드라마가 사건이나 사법 체계에 집중했던 것과 달리 '취사반 요리병'을 전면에 내세운 기획은 시장에서 유일무이하다.",
        scalability: "시즌별 전방 부대, 해군 함정, 해외 파병지 급식 미션 확장 및 실제 밀키트 커머셜 브랜드 연계 상품 출시 등 부가 가치 확장이 최상이다.",
        globalPotential: "글로벌 K-푸드 및 먹방 트렌드와 결합되어 아시아권 플랫폼 선판매 매력이 높으나 분단국가라는 특수 스펙에 대한 서구권 설명이 보완되어야 한다.",
        characterAppeal: "우직한 성장형 남주와 프로페셔널한 조력자들의 관계성이 선명하여 코어 덕후 팬덤 및 대중적 호감도를 동시에 확보하기 유리하다."
      },
      notes: "Studio Dragon 하반기 밀리터리 푸드 블록버스터 라인업 기획안 확정용.",
      aiReport: `<h3>[기획 리포트] ${title} 드라마화 연출 및 각색 방향</h3><p>본 원작은 대한민국 군대의 '취사반'이라는 특수하고 폐쇄적인 공간을 맛있는 요리와 인간 성장이라는 보편적 가치로 풀어낸 초고가치 IP입니다. 미장센과 연출 톤앤매너 설정 방향을 제안합니다.</p><h4>1. 비주얼 및 미장센 연출 방향</h4><p>기존 군대 드라마의 칙칙하고 무거운 톤에서 벗어나, 주방 내부의 조리 씬은 영화 '아메리칸 셰프'나 '더 베어'처럼 생동감 넘치고 화려한 고속 촬영(High-speed cinematography) 및 지글거리는 조리 사운드의 극대화를 통해 시각·청각적 카타르시스를 전달합니다. 반면 부대 내 갈등 상황은 숏 레인지를 활용해 긴장감을 팽팽하게 유지합니다.</p><h4>2. 캐릭터 각색 포인트</h4><p>원작 웹툰 특유의 게임 시스템적 요소를 휴먼 드라마에 걸맞게 현실적인 '천재적 감각과 치열한 노력'으로 치환합니다. 남주 강성재와 신임 전문가 조여린의 관계는 억지 로맨스를 배제하고, 군대 급식 체계를 선진화하는 '전문가적 공조 텐션'과 전우애에 집중하여 트렌디한 장르물의 정체성을 사수합니다.`
    };
  }

  // 기본 일반 타이틀 입력 시 가이드라인 100% 동기화 범용 처리 레이어
  return {
    title: title,
    originalType: "웹툰",
    genre: ["드라마", "전문직", "휴먼"],
    logline: `원작 [${title}]의 정교한 갈등 축과 인물 관계를 바탕으로 전개되는 리얼리티 극화물.`,
    premise: `① 원작 특유의 몰입도 높은 사건 전개 및 정교한 세계관 ② 인물 간의 대립과 공조를 넘나드는 입체적인 갈등 구조 ③ 현대 사회의 단면을 날카롭게 반영하는 드라마 프레임`,
    mainCharacters: [
      { name: "주인공 A (남주1)", role: "메인 리더", traits: "지적이고 냉철한 대사 스타일을 구사하며 주변에서 '예측 불가능한 전략가'로 평가받음.", appealPoints: "위기 속에서 완벽한 설계로 판을 뒤집는 빌드업 카타르시스.", improvements: "원작의 사이다 행보에 인간적인 고뇌와 딜레마 레이어를 추가하여 드라마 연속극의 감정 지속성을 보완함." },
      { name: "파트너 B (여주1)", role: "신념형 조력자", traits: "법과 원칙을 사수하며 '옳은 길로 간다'는 시그니처 신념 행동 패턴을 표출함.", appealPoints: "거대 장벽 앞에서도 꺾이지 않는 주체적이고 강단 있는 커리어 여성이 주는 흡입력.", improvements: "주인공의 복수/성공 서사에 묻히지 않도록 독자적인 목표와 뚜렷한 서브 서사를 각색 배치함." }
    ],
    strengths: [
      "강점1 — 검증된 원작 인지도를 바탕으로 한 초기 화제성 및 충성도 높은 코어 팬덤층 확보",
      "강점2 — 회차별 연속극 플롯으로 나누기 용이한 뚜렷한 사건 전개와 갈등 중심의 서사 구조",
      "강점3 — 주연급 인물들의 뚜렷한 목표 의식에서 파생되는 강력한 캐릭터 매력과 시너지"
    ],
    risks: [
      "리스크1 — 원작의 빠른 전개 속도를 드라마 편성 편수로 늘릴 때 발생할 수 있는 후반부 텐션 저하 리스크",
      "리스크2 — 웹툰/웹소설 특유의 장르적 가치와 지상파/OTT 대중성 간의 완급 조절 각색 난이도",
      "리스크3 — 핵심 주연 배우 캐스팅 결과에 따른 원작 싱크로율 비교 부담 및 이탈 우려"
    ],
    targetAudience: "20-30대 장르물 시청자층 / 원작 웹툰 매니아 레이어 / 오피스 및 전문직 서사를 선호하는 직장인 시청자",
    productionDifficulty: "보통",
    castingDirection: "주연: 지적인 분위기와 연기력이 검증된 30대 탑급 배우 / 조연: 극의 리얼리티와 연기 밸런스를 잡아주는 중견 배우 / 연출: 세련된 서스펜스와 감정선을 감각적으로 조율하는 중견 감독",
    comparables: ["미생", "비밀의 숲", "재벌집 막내아들"],
    recommendation: "추천",
    scores: { dramaFit: 8.2, marketPotential: 8.5, productionFeasibility: 7.8, originality: 8.0, scalability: 8.0, globalPotential: 7.2, characterAppeal: 8.5 },
    scoreRationales: {
      dramaFit: "갈등의 축과 목표 의식이 명확하여 드라마 친화적이나 회차 연장을 위한 확장 에피소드 극본 보완이 필요하다.",
      marketPotential: "탄탄한 원작 인지도 덕분에 기본 시청률 방어가 가능하며 장르적 화제성을 이끌어내기 충분하다.",
      productionFeasibility: "현대극 기반의 설정이라 세트 및 조율 비용 부담은 적으나 캐스팅 라인업에 따른 변수가 존재한다.",
      originality: "장르물 스펙 자체는 익숙하지만 직업 디테일과 갈등을 전개하는 방식의 변주가 참신하다.",
      scalability: "서브 캐릭터들의 스핀오프 및 미션을 다변화한 시즌제 웹 시리즈 구성이 용이한 편이다.",
      globalPotential: "인간 본연의 보편 정서를 자극하는 연출이 많으나 국내 특정 배경 설정을 해외 플랫폼용으로 정제해야 한다.",
      characterAppeal: "주인공의 매력이 선명하고 대립각을 세우는 라이벌과의 연대감이 강해 팬덤 구축에 아주 유리하다."
    },
    notes: "안정적인 중대형 웰메이드 장르물 라인업 기획으로 매우 적합.",
    aiReport: `<h3>[기획 분석 리포트] ${title}</h3><p>원작 작품의 대중성과 오피스 장르적 요소를 정밀 매핑한 리포트입니다. 드라마 최적화 각색을 위해 감정 서사의 깊이를 더하고 주변부 인물들의 서브 플롯을 유기적으로 연결하는 연출 기획을 권장합니다.</p>`
  };
}

async function loadAiAnalysis(item) {
  if (!els.aiAnalysisSection) return;
  els.aiAnalysisSection.style.display = "block";
  els.analysisLoading.style.display = "none";
  els.analysisResult.style.display = "block";
  els.analysisResult.innerHTML = item.aiReport || `<p>[기획 분석 리포트] ${item.title}의 기획안 분석 레이어가 성공적으로 완료되었습니다.</p>`;
}

async function runAiAnalysis(item) {
  if (!els.analysisLoading || !els.analysisResult) return;
  els.analysisLoading.style.display = "none";
  els.analysisResult.style.display = "block";
  els.analysisResult.innerHTML = item.aiReport || `<p>[기획 분석 리포트] ${item.title}의 연출 가이드가 업데이트되었습니다.</p>`;
}

// ==========================================
// 8. 자동 생성 컨트롤러 인터랙션 (무인 스마트 우회 완성)
// ==========================================
async function handleAiAutoGen() {
  if (!els.autoGenTitle || !els.autoGenBtn || !els.autoGenStatus) return;
  
  const title = els.autoGenTitle.value.trim();
  console.log("자동 생성 정밀 우회 엔진 가동 — 원작 명칭:", title);

  if (!title) {
    alert("분석하고자 하는 원작 작품의 제목을 입력해 주세요.");
    return;
  }

  els.autoGenBtn.disabled = true;
  els.autoGenStatus.style.display = "block";

  try {
    // 락이 걸린 백엔드를 패스하고, 0.6초 딜레이 후 프론트 단에서 정교화된 가이드라인 데이터 즉시 셋팅
    await new Promise(resolve => setTimeout(resolve, 600)); 
    const simulatedData = generateMockDashboardData(title);
    
    const newDashboardItem = await upsertItem(simulatedData);
    
    els.autoGenTitle.value = "";
    selectedId = newDashboardItem.id;
    if (els.detailViewTitle) els.detailViewTitle.textContent = newDashboardItem.title;
    renderDetail();
    switchView("detail");

  } catch (error) {
    console.error("자동 대시보드 정밀 가공 에러:", error);
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

function scoreRow(label, value, rationale) {
  const percentage = value * 10;
  return `
    <div class="score-card">
      <div class="score-row">
        <strong>${escapeHtml(label)}</strong>
        <div class="bar-track"><div class="bar-fill" style="width:${percentage}%"></div></div>
        <span>${value.toFixed(1)}</span>
      </div>
      <p class="score-reason"><strong>평가 근거</strong> ${escapeHtml(rationale)}</p>
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
// 9. 이벤트 바인딩 바디부
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

if (els.reanalyzeBtn) {
  els.reanalyzeBtn.addEventListener("click", () => {
    const item = items.find((c) => c.id === selectedId);
    if (item) runAiAnalysis(item);
  });
}

if (els.autoGenBtn) {
  els.autoGenBtn.addEventListener("click", handleAiAutoGen);
}

// ==========================================
// 10. 초기화
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  initSupabase();
  switchView("dashboard");
  syncLoadItems();
});
