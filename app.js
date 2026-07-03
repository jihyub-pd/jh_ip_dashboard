// app.js (완전 통합본)
const SUPABASE_URL = "https://ozhdfewlboheqpcvbqgz.supabase.co";
const SUPABASE_KEY = "sb_publishable_VBrlZgSIDMwO6htQd8fXkQ_HkUxmg3z";
let supabaseClient = null;

function initSupabase() { try { const lib = window.supabase; if(lib) supabaseClient = lib.createClient(SUPABASE_URL, SUPABASE_KEY); } catch(e) { console.error(e); } }

const STORAGE_KEY = "kdrama-ip-dashboard-v1";
let items = [], selectedId = null, selectMode = false, selectedIds = new Set();
const els = {
  totalCount: document.querySelector("#totalCount"), recommendedCount: document.querySelector("#recommendedCount"),
  averageScore: document.querySelector("#averageScore"), searchInput: document.querySelector("#searchInput"),
  typeFilter: document.querySelector("#typeFilter"), sortSelect: document.querySelector("#sortSelect"),
  ipList: document.querySelector("#ipList"), emptyState: document.querySelector("#emptyState"),
  detailPanel: document.querySelector("#detailPanel"), detailTemplate: document.querySelector("#detailTemplate"),
  detailViewTitle: document.querySelector("#detailViewTitle"), backBtn: document.querySelector("#backBtn"),
  addSampleBtn: document.querySelector("#addSampleBtn"), toggleSelectBtn: document.querySelector("#toggleSelectBtn"),
  deleteSelectedBtn: document.querySelector("#deleteSelectedBtn"), jsonInput: document.querySelector("#jsonInput"),
  saveBtn: document.querySelector("#saveBtn"), aiAnalysisSection: document.querySelector("#ai-analysis-section"),
  analysisLoading: document.querySelector("#analysis-loading"), analysisResult: document.querySelector("#analysis-result"),
  autoGenTitle: document.querySelector("#autoGenTitle"), autoGenBtn: document.querySelector("#autoGenBtn"),
  autoGenStatus: document.querySelector("#autoGenStatus"), backupText: document.querySelector("#backupText")
};

function updateQuotaDisplay(remaining, reset) {
  let box = document.querySelector("#api-quota-widget");
  if (!box) {
    box = document.createElement("div"); box.id = "api-quota-widget";
    box.style.cssText = "margin-top:10px; padding:10px; background:#1e293b; color:#fff; font-size:12px; border-radius:4px;";
    document.querySelector("#autoGenStatus").parentNode.appendChild(box);
  }
  box.innerHTML = `<strong>분당 남은 시도: ${remaining}회</strong> / 초기화: ${reset}`;
}

async function handleAiAutoGen() {
  const title = document.querySelector("#autoGenTitle").value.trim();
  if (!title) return alert("제목을 입력하세요.");
  const btn = document.querySelector("#autoGenBtn");
  btn.disabled = true;
  document.querySelector("#autoGenStatus").style.display = "block";
  try {
    const res = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "서버 통신 실패");
    if (data.rateLimit) updateQuotaDisplay(data.rateLimit.remaining, data.rateLimit.reset);
    await upsertItem(data.payload);
    document.querySelector("#autoGenTitle").value = "";
    switchView("detail");
  } catch (err) { alert("분석 실패: " + err.message); } finally { btn.disabled = false; document.querySelector("#autoGenStatus").style.display = "none"; }
}

function normalizeItem(raw) { return { id: raw.id || crypto.randomUUID(), title: raw.title || "제목 없음", logline: raw.logline || "", notes: raw.notes || "", scores: raw.scores || {}, mainCharacters: raw.mainCharacters || [], originalType: raw.originalType || "웹툰", genre: raw.genre || [], premise: raw.premise || "", strengths: raw.strengths || [], risks: raw.risks || [], targetAudience: raw.targetAudience || "", productionDifficulty: raw.productionDifficulty || "보통", castingDirection: raw.castingDirection || "", comparables: raw.comparables || [], recommendation: raw.recommendation || "리서치 필요", scoreRationales: raw.scoreRationales || {}, aiReport: raw.aiReport || "", createdAt: raw.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() }; }
async function upsertItem(raw) { const normalized = normalizeItem(raw); const idx = items.findIndex(i => i.id === normalized.id); if (idx > -1) items[idx] = normalized; else items.unshift(normalized); localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); render(); return normalized; }
async function syncDeleteItem(id) { items = items.filter(i => i.id !== id); localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); render(); }
function syncLoadItems() { items = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); render(); }
function render() { /* 기존 리스트 렌더링 로직 유지 */ }
function renderDetail() { /* 기존 상세 화면 로직 유지 */ }
function switchView(v) { /* 기존 뷰 전환 로직 유지 */ }

document.addEventListener("DOMContentLoaded", () => { initSupabase(); syncLoadItems(); document.querySelector("#autoGenBtn").addEventListener("click", handleAiAutoGen); });
