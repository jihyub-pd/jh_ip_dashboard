const batchClient = window.supabase.createClient('https://ozhdfewlboheqpcvbqgz.supabase.co', 'sb_publishable_VBrlZgSIDMwO6htQd8fXkQ_HkUxmg3z');
const batchProduction = location.hostname === 'ip-dashboard-kappa.vercel.app';
const batchEl = id => document.getElementById(id);
const batchNormalize = value => String(value || '').toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
const batchCanonical = v => Array.isArray(v) ? v.map(batchCanonical) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, batchCanonical(v[k])])) : v;
const batchSame = (a,b) => JSON.stringify(batchCanonical(a)) === JSON.stringify(batchCanonical(b));
let batchPack = null, batchBusy = false, batchCurrent = null, batchVerified = new Set(), batchConflicts = [];
function batchNode(tag,text) { const n=document.createElement(tag);n.textContent=text;return n; }
function batchTotal(a) { const s=a.scores; return Math.round((s.dramaFit+s.marketPotential*.8+s.originality*1.2+s.scalability*1.2+s.characterAppeal*1.2)/5.4*10)/10; }
function batchValidate(pack) {
  if (pack.records?.length !== 20 || new Set(pack.records.map(r=>r.id)).size !== 20 || new Set(pack.records.map(r=>batchNormalize(r.analysis.title))).size !== 20) throw Error('분석 수 또는 중복 검증에 실패했습니다.');
  for (const r of pack.records) {
    const a=r.analysis;
    if (!r.id || !a.title || !['추천','보류','리서치 필요'].includes(a.recommendation) || !['열림','확인 필요','선점','영상화 완료'].includes(a.rightsStatus)) throw Error('분석 형식이 올바르지 않습니다.');
    for (const key of ['dramaFit','marketPotential','originality','scalability','characterAppeal','productionFeasibility','globalPotential']) if (typeof a.scores?.[key] !== 'number' || a.scores[key]<0 || a.scores[key]>10) throw Error('점수 검증에 실패했습니다.');
    if (a.recommendation==='추천' && batchTotal(a)<6.5) throw Error('추천 점수 기준이 맞지 않습니다.');
  }
}
function batchState() { batchEl('batchApply').disabled=batchBusy||!batchProduction||!batchPack||!batchCurrent||batchConflicts.length>0||batchVerified.size===20||!window.DashboardAuth.canWrite;batchEl('batchRefresh').disabled=batchBusy; }
function batchRender() {
  if(!batchPack)return;
  const query=batchEl('batchSearch').value.trim(); const fragment=document.createDocumentFragment();
  const labels={dramaFit:'드라마 적합도',marketPotential:'원작 흥행성',originality:'차별성',scalability:'확장성',characterAppeal:'캐릭터 매력도',productionFeasibility:'제작성 (참고)',globalPotential:'글로벌 (참고)'};
  for(const r of batchPack.records){const a=r.analysis;if(!a.title.includes(query))continue;const d=document.createElement('details');
    d.append(batchNode('summary',`${a.title} — ${r.scoreState==='not_evaluated'?'미평가':batchTotal(a).toFixed(1)} · ${a.recommendation} · ${a.rightsStatus} · ${batchVerified.has(r.id)?'업로드 완료':'업로드 대기'}`));
    d.append(batchNode('p',`${r.author} · ${a.originalType} · ${a.sourceInfo.platform} · ${a.sourceInfo.status}`));
    if(r.scoreState==='not_evaluated')d.append(batchNode('p','서지만 확인한 리서치 대기 작품입니다. 아래 점수는 저장 형식에 필요한 중립값이며 실제 평가가 아닙니다.'));
    for(const [key,label] of [['logline','한 줄 소개'],['premise','설정과 갈등'],['recommendationReason','판정 이유']])if(a[key])d.append(batchNode('p',`${label}: ${a[key]}`));
    d.append(batchNode('p',`판권: ${a.rightsInfo.note}`));d.append(batchNode('p',`형식 제안: ${a.formatSuggestion.format||'미평가'} — ${a.formatSuggestion.reason||'원작 구조 확인 후 제안'}`));
    for(const [key,label] of Object.entries(labels))d.append(batchNode('p',`${label} ${a.scores[key].toFixed(1)}: ${a.scoreRationales[key]}`));
    for(const [key,label] of [['mainCharacters','인물'],['strengths','강점'],['risks','리스크'],['comparables','비교작']]){d.append(batchNode('h3',label));const ul=document.createElement('ul');for(const x of a[key])ul.append(batchNode('li',typeof x==='string'?x:`${x.name}: ${x.role} / ${x.improvements}`));d.append(ul)}
    d.append(batchNode('p',a.notes));const raw=document.createElement('details');raw.append(batchNode('summary','전체 분석 보기'));raw.append(batchNode('pre',JSON.stringify(a,null,2)));d.append(raw);fragment.append(d);
  }
  batchEl('batchList').replaceChildren(fragment);
  batchEl('batchSummary').textContent=`1차 20개 · 추천 ${batchPack.records.filter(r=>r.analysis.recommendation==='추천').length}개 · 보류 ${batchPack.records.filter(r=>r.analysis.recommendation==='보류').length}개 · 리서치 필요 ${batchPack.records.filter(r=>r.analysis.recommendation==='리서치 필요').length}개 · DB 업로드 확인 ${batchVerified.size}/20개`;
}
async function batchCheck() {
  batchCurrent=null;batchVerified=new Set();batchConflicts=[];batchState();
  const {data,error}=await batchClient.from('kdrama_ips').select('id,title,content');
  if(error||!Array.isArray(data))throw Error('대시보드 데이터와 중복 여부를 확인하지 못했습니다.');
  batchCurrent=data;
  const ids=new Map(data.map(r=>[r.id,r]));
  for(const r of batchPack.records){const old=ids.get(r.id),matching=data.filter(x=>batchNormalize(x.title)===batchNormalize(r.analysis.title)||(x.content?.originalAliases||[]).some(t=>batchNormalize(t)===batchNormalize(r.analysis.title)));
    if(old && batchSame(old.title,r.analysis.title) && Object.entries(r.analysis).every(([k,v])=>batchSame(old.content?.[k],v)) && matching.length===1)batchVerified.add(r.id);
    else if(old||matching.length)batchConflicts.push(r.analysis.title);
  }
  batchRender();batchState();
  if(batchConflicts.length)batchEl('applyStatus').textContent='기존 항목과 겹치거나 분석이 변경되어 업로드를 중단했습니다: '+batchConflicts.join(', ');
  else if(batchVerified.size===20)batchEl('applyStatus').textContent='20개 모두 대시보드에 저장된 분석과 일치합니다. 업로드 완료.';
  else batchEl('applyStatus').textContent=batchProduction?`${batchVerified.size}/20개 반영 확인. 소유자로 로그인 후 남은 작품을 추가할 수 있습니다.`:'미리보기에서는 업로드할 수 없습니다. 운영 대시보드에서 진행하세요.';
}
batchEl('batchSearch').addEventListener('input',batchRender);
batchEl('batchRefresh').addEventListener('click',async()=>{if(batchBusy||!batchPack)return;batchBusy=true;batchState();try{await batchCheck()}catch(e){batchEl('applyStatus').textContent=e.message}finally{batchBusy=false;batchState()}});
batchEl('batchApply').addEventListener('click',async()=>{
  if(batchBusy||!batchProduction||!batchPack||!window.DashboardAuth.canWrite)return;
  batchBusy=true;batchState();batchEl('applyStatus').textContent='중복을 다시 확인하고 신규 작품을 추가하고 있습니다.';
  try{
    await batchCheck();if(batchConflicts.length)throw Error('중복 또는 기존 분석 변경으로 업로드를 중단했습니다.');if(batchVerified.size===20)return;
    if(!window.DashboardAuth.canWrite)throw Error('소유자 로그인을 다시 확인하세요.');
    const stamp=new Date().toISOString();const rows=batchPack.records.filter(r=>!batchVerified.has(r.id)).map(r=>({id:r.id,title:r.analysis.title,createdAt:stamp,updatedAt:stamp,content:{...r.analysis,id:r.id,createdAt:stamp,updatedAt:stamp,aiReport:'',starred:false,userMemo:''}}));
    const {error}=await batchClient.from('kdrama_ips').insert(rows).select('id');
    await batchCheck();
    if(batchVerified.size!==20)throw Error(error?.message||'저장 결과가 모두 일치하지 않습니다. 상태 확인 후 다시 시도하세요.');
  }catch(e){
    try{await batchCheck()}catch{}
    if(batchVerified.size!==20)batchEl('applyStatus').textContent='업로드 미완료: '+e.message;
  }finally{batchBusy=false;batchState()}
});
(async()=>{try{
  const response=await fetch('batch-data.json?v=20261009b',{cache:'no-store'});if(!response.ok)throw Error('분석 파일을 불러오지 못했습니다.');batchPack=await response.json();batchValidate(batchPack);batchRender();
  new MutationObserver(batchState).observe(batchEl('authStatus'),{childList:true,subtree:true});await window.DashboardAuth.initialize(batchClient);await batchCheck();
}catch(e){batchEl('applyStatus').textContent=e.message;batchCurrent=null;batchState()}})();
