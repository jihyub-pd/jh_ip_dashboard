// ==========================================
// 1. Supabase 환경 설정
// ==========================================
const SUPABASE_URL = "https://ozhdfewlboheqpcvbqgz.supabase.co";
const SUPABASE_KEY = "sb_publishable_VbrlZgSIDMw06htQd8fXkQ_HkUxm3z";

let supabaseClient = null;

function initSupabase() {
  try {
    const lib = window.supabase || window.Supabase;
    if (lib && typeof lib.createClient === "function") {
      supabaseClient = lib.createClient(SUPABASE_URL, SUPABASE_KEY);
      console.log("Supabase 연동 성공");
    } else {
      console.warn("Supabase 라이브러리 없음 — 로컬 스토리지 모드");
    }
  } catch (e) {
    console.error("Supabase 초기화 실패:", e);
  }
}

const STORAGE_KEY = "kdrama-ip-dashboard-v1";

const scoreLabels = {
  dramaFit: "드라마 적합",
  marketPotential: "흥행성",
  productionFeasibility: "제작성",
  originality: "차별성",
  scalability: "확장성",
  globalPotential: "글로벌",
  characterAppeal: "캐릭터 매력도",
};

// ✦ 수정: 각 항목 3개 필수 명시
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
};

let items = [];
let selectedId = null;

if (els.schemaPreview) {
  els.schemaPreview.textContent = JSON.stringify(requiredShape, null, 2);
}

// ==========================================
// 2. Supabase 동기화 함수
// ==========================================
async function syncLoadItems() {
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from("kdrama_ips")
        .select("*")
        .order("updatedAt", { ascending: false });

      if (!error && data) {
        items = data.map(dbItem => ({
          id: dbItem.id,
          createdAt: dbItem.createdAt,
          updatedAt: dbItem.updatedAt,
          ...dbItem.content
        }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        finalizeLoad();
        return;
      }
    } catch (e) {
      console.warn("클라우드 로드 실패, 로컬 저장소 전환:", e);
    }
  }
  try {
    items = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    items = [];
  }
  finalizeLoad();
}

function finalizeLoad() {
  if (!selectedId && items.length > 0) {
    selectedId = items[0].id;
  }
  render();
}

async function syncSaveItem(normalizedItem) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  if (supabaseClient) {
    try {
      const dbPayload = {
        id: normalizedItem.id,
        updatedAt: normalizedItem.updatedAt,
        createdAt: normalizedItem.createdAt,
        title: normalizedItem.title,
        content: normalizedItem
      };
      const { error } = await supabaseClient.from("kdrama_ips").upsert(dbPayload, { onConflict: "id" });
      if (error) throw error;
    } catch (e) {
      console.error("서버 DB 저장 오류:", e);
    }
  }
}

async function syncDeleteItem(id) {
  items = items.filter((candidate) => candidate.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  if (supabaseClient) {
    try {
      const { error } = await supabaseClient.from("kdrama_ips").delete().eq("id", id);
      if (error) throw error;
    } catch (e) {
      console.error("서버 DB 삭제 오류:", e);
    }
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

function normalizeItem(raw) {
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
    updatedAt: now,
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
    notes: String(raw.notes || "").trim(),
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
    if (value === undefined || Number.isNaN(Number(value))) {
      errors.push(`scores.${key}는 숫자여야 합니다.`);
    }
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

function upsertItem(raw) {
  const normalized = normalizeItem(raw);
  const existingIndex = items.findIndex((item) => item.id === normalized.id || item.title === normalized.title);
  if (existingIndex >= 0) {
    normalized.id = items[existingIndex].id;
    normalized.createdAt = items[existingIndex].createdAt;
    items[existingIndex] = normalized;
  } else {
    items.unshift(normalized);
  }
  selectedId = normalized.id;
  syncSaveItem(normalized);
  render();
}

// ==========================================
// 4. 렌더링 함수
// ==========================================
function filteredItems() {
  const query = (els.searchInput?.value || "").trim().toLowerCase();
  const type = els.typeFilter?.value || "all";
  const sort = els.sortSelect?.value || "score";
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
    const button = document.createElement("button");
    button.className = `ip-card ${item.id === selectedId ? "active" : ""}`;
    button.type = "button";
    button.innerHTML = `
      <div class="ip-card-top">
        <div>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.logline || "로그라인 없음")}</p>
        </div>
        <span class="mini-score">${averageScore(item).toFixed(1)}</span>
      </div>
      <div class="tag-row">${[item.originalType, item.recommendation, ...item.genre.slice(0, 3)].map(tagHtml).join("")}</div>
    `;
    button.addEventListener("click", () => {
      selectedId = item.id;
      if (els.detailViewTitle) els.detailViewTitle.textContent = item.title;
      renderDetail();
      switchView("detail");
    });
    els.ipList.append(button);
  });
}

let memoTimeout = null;
function renderDetail() {
  if (!els.detailPanel) return;
  const item = items.find((candidate) => candidate.id !== null && candidate.id === selectedId);
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
    .map(([key, label]) => scoreRow(label, clampScore(item.scores[key])))
    .join("");

  // ✦ 수정: 각 리스트 항목 3개 보장
  renderListInto(node.querySelector(".strengths"), item.strengths);
  renderListInto(node.querySelector(".risks"), item.risks);

  // ✦ 수정: premise, targetAudience, castingDirection, comparables 3가지 특징 렌더링
  renderThreePoints(node.querySelector(".premise"), item.premise);
  renderThreePoints(node.querySelector(".target"), item.targetAudience);
  renderThreePoints(node.querySelector(".casting"), item.castingDirection);
  renderListInto(node.querySelector(".comparables-list"), item.comparables);

  const charContainer = document.createElement("div");
  charContainer.className = "character-deep-dive";
  charContainer.innerHTML = `
    <h3 class="char-dive-title">주인공 4인 심층 분석</h3>
    <div class="char-grid">
      ${(item.mainCharacters || []).map(char => `
        <div class="char-sub-card">
          <h4>${escapeHtml(char.name)} <small>(${escapeHtml(char.role)})</small></h4>
          <p><strong>특징/대사/행동/평가:</strong> ${escapeHtml(char.traits)}</p>
          <p><strong style="color:var(--accent-3);">입덕 포인트:</strong> ${escapeHtml(char.appealPoints)}</p>
          <p><strong style="color:var(--accent-2);">개선/각색점:</strong> ${escapeHtml(char.improvements)}</p>
        </div>
      `).join("")}
    </div>
  `;
  const targetBlock = node.querySelector(".detail-blocks");
  if (targetBlock) targetBlock.parentNode.insertBefore(charContainer, targetBlock);

  const memoInput = node.querySelector(".memo-input");
  if (memoInput) {
    memoInput.value = item.notes;
    memoInput.addEventListener("input", () => {
      item.notes = memoInput.value;
      item.updatedAt = new Date().toISOString();
      if (memoTimeout) clearTimeout(memoTimeout);
      memoTimeout = setTimeout(() => { syncSaveItem(item); }, 600);
    });
  }

  node.querySelector(".delete-btn").addEventListener("click", async () => {
    if (!confirm(`${item.title}을 삭제할까요?`)) return;
    await syncDeleteItem(item.id);
    selectedId = items[0]?.id || null;
    switchView("dashboard");
    render();
  });

  els.detailPanel.innerHTML = "";
  els.detailPanel.append(node);
}

// ✦ 수정: 리스트 항목 3개 보장 (부족하면 — 으로 채움)
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

// ✦ 추가: 텍스트를 / 또는 ① ② ③ 기준으로 3가지로 나눠 ul로 렌더링
function renderThreePoints(el, text) {
  if (!el) return;
  if (!text) { el.textContent = "—"; return; }

  // ① ② ③ 형태로 구분된 경우
  let points = [];
  if (text.includes("①") || text.includes("②") || text.includes("③")) {
    points = text.split(/[①②③]/).map(s => s.trim()).filter(Boolean);
  } else if (text.includes(" / ")) {
    points = text.split(" / ").map(s => s.trim()).filter(Boolean);
  } else if (text.includes("\n")) {
    points = text.split("\n").map(s => s.trim()).filter(Boolean);
  } else {
    // 구분자 없으면 그냥 텍스트로 표시
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

function scoreRow(label, value) {
  const percentage = value * 10;
  return `
    <div class="score-row">
      <strong>${escapeHtml(label)}</strong>
      <div class="bar-track"><div class="bar-fill" style="width:${percentage}%"></div></div>
      <span>${value.toFixed(1)}</span>
    </div>
  `;
}

function tagHtml(value) {
  return value ? `<span class="tag">${escapeHtml(value)}</span>` : "";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ==========================================
// 5. 뷰 전환
// ==========================================
function switchView(viewName = "dashboard") {
  const safeViewName = viewName || "dashboard";
  const targetView = document.querySelector(`#${safeViewName}View`);
  if (!targetView) {
    console.error(`[switchView] #${safeViewName}View를 찾을 수 없습니다.`);
    return;
  }
  els.views.forEach((view) => view.classList.remove("active-view"));
  targetView.classList.add("active-view");
  els.navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === safeViewName);
  });
}

// ==========================================
// 6. 프롬프트 / 백업
// ==========================================
function updatePrompt() {
  if (!els.promptText) return;
  const title = els.promptTitle?.value.trim() || "{{원작 제목}}";
  els.promptText.value = `다음 원작 IP를 한국 드라마로 제작할 가능성 관점에서 분석해줘.
반드시 JSON만 출력하고, JSON 밖에는 어떤 설명도 쓰지 마.

원작 제목: ${title}

주요 분석 가이드라인:
1. 주인공 4인(핵심 주연급)을 선정하여 심층 분석해줘.
2. 각 캐릭터의 'traits'란에는 원작에서 보여준 대표적인 대사 스타일, 시그니처 행동 패턴, 혹은 작중 타 인물들의 커뮤니티나 인물의 평가를 녹여내서 작성해줘.
3. 'appealPoints'에는 독자/시청자들이 열광하는 결정적 입덕 매력 요소를 기술해줘.
4. 'improvements'에는 웹툰/웹소설의 문법을 드라마 편수로 바꿀 때 반드시 보완해야 하는 단점 및 각색 방향을 짚어줘.
5. 점수 체계는 10.0점 만점이며, 소수점 첫째 자리(예: 8.5)까지 세부적으로 평가해줘.
6. ★ strengths는 반드시 서로 다른 관점의 강점 3가지를 배열로 작성해줘.
7. ★ risks는 반드시 서로 다른 리스크 3가지를 배열로 작성해줘.
8. ★ comparables는 반드시 유사 성공작 3가지를 배열로 작성해줘.
9. ★ targetAudience는 연령대/성별/취향 등 3가지 측면을 포함해서 작성하되, 각 측면을 ' / ' 로 구분해줘. 예: "30-40대 직장인 남성 / 복수극 선호 여성층 / 재벌 드라마 팬덤"
10. ★ castingDirection은 주연/조연/연출 방향 3가지를 포함해서 작성하되, 각 항목을 ' / ' 로 구분해줘. 예: "주연: 냉철한 30대 남자 배우 / 여주: 강단 있는 커리어우먼 이미지 / 연출: 장르와 감성 균형 잡는 감독"
11. ★ premise는 세계관/설정/갈등구조 3가지 특징을 포함해서 작성하되, 각 항목을 ① ② ③ 으로 구분해줘.

아래 명시된 스키마 JSON 포맷을 완벽하게 준수해줘:

${JSON.stringify(requiredShape, null, 2)}`;
}

function backupPayload() {
  return {
    app: "kdrama-ip-dashboard",
    version: 1,
    exportedAt: new Date().toISOString(),
    items,
  };
}

function updateBackupText() {
  if (!els.backupText) return;
  els.backupText.value = JSON.stringify(backupPayload(), null, 2);
}

function parseBackup(text) {
  const parsed = JSON.parse(text);
  const rawItems = Array.isArray(parsed) ? parsed : parsed.items;
  if (!Array.isArray(rawItems)) {
    throw new Error("items 배열이 있는 백업 JSON이어야 합니다.");
  }
  return rawItems.map(normalizeItem);
}

async function restoreBackup(text) {
  const restored = parseBackup(text);
  items = restored;
  selectedId = items[0]?.id || null;
  for (const item of items) {
    await syncSaveItem(item);
  }
  render();
  if (els.backupMessage) els.backupMessage.textContent = `${items.length}개 IP를 전체 복원 및 클라우드 동기화했습니다.`;
}

function exportBackupFile() {
  const blob = new Blob([JSON.stringify(backupPayload(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = `kdrama-ip-dashboard-${date}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

// ==========================================
// 7. 이벤트 바인딩
// ==========================================
els.navButtons.forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.view));
});

if (els.backBtn) {
  els.backBtn.addEventListener("click", () => {
    switchView("dashboard");
    render();
  });
}

[els.searchInput, els.typeFilter, els.sortSelect].forEach((control) => {
  if (control) control.addEventListener("input", render);
});

if (els.addSampleBtn) els.addSampleBtn.addEventListener("click", () => upsertItem(sampleIp));
if (els.pasteSampleBtn) els.pasteSampleBtn.addEventListener("click", () => {
  els.jsonInput.value = JSON.stringify(sampleIp, null, 2);
  els.formMessage.textContent = "예시 JSON을 넣었습니다.";
});
if (els.clearFormBtn) els.clearFormBtn.addEventListener("click", () => {
  els.jsonInput.value = "";
  els.formMessage.textContent = "";
});
if (els.validateBtn) els.validateBtn.addEventListener("click", () => {
  const result = parseInput();
  els.formMessage.textContent = result.errors.length ? result.errors.join(" ") : "저장 가능한 JSON입니다.";
});
if (els.saveBtn) els.saveBtn.addEventListener("click", () => {
  const result = parseInput();
  if (result.errors.length) {
    els.formMessage.textContent = result.errors.join(" ");
    return;
  }
  upsertItem(result.raw);
  els.formMessage.textContent = "저장했습니다.";
  switchView("dashboard");
});
if (els.promptTitle) els.promptTitle.addEventListener("input", updatePrompt);
if (els.copyPromptBtn) els.copyPromptBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(els.promptText.value);
    els.copyMessage.textContent = "복사했습니다.";
  } catch {
    els.promptText.select();
    els.copyMessage.textContent = "선택된 프롬프트를 복사하세요.";
  }
});
if (els.exportBtn) els.exportBtn.addEventListener("click", exportBackupFile);
if (els.restoreBtn) els.restoreBtn.addEventListener("click", async () => {
  try {
    await restoreBackup(els.restoreInput.value.trim());
    switchView("dashboard");
  } catch (error) {
    if (els.backupMessage) els.backupMessage.textContent = `복원 실패: ${error.message}`;
  }
});
if (els.backupFileInput) els.backupFileInput.addEventListener("change", async () => {
  const file = els.backupFileInput.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    els.restoreInput.value = text;
    await restoreBackup(text);
    switchView("dashboard");
  } catch (error) {
    els.backupMessage.textContent = `복원 실패: ${error.message}`;
  } finally {
    els.backupFileInput.value = "";
  }
});

// ==========================================
// ✦ 초기화
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  initSupabase();
  switchView("dashboard");
  syncLoadItems();
});
