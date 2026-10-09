const reviewClient = window.supabase.createClient('https://ozhdfewlboheqpcvbqgz.supabase.co','sb_publishable_VBrlZgSIDMwO6htQd8fXkQ_HkUxmg3z');
let reviewData = null, applying = false, alreadyApplied = false;
const el = id => document.getElementById(id);
function textNode(tag, text, className) { const n=document.createElement(tag);n.textContent=text;if(className)n.className=className;return n; }
function renderReviews() {
  const query=el('reviewSearch').value.trim().toLowerCase(),changed=el('changesOnly').checked;
  const fragment=document.createDocumentFragment();
  for(const row of reviewData.records){
    if(!row.title.toLowerCase().includes(query)||changed&&!row.materialChange)continue;
    const detail=document.createElement('details');
    detail.append(textNode('summary',`${row.title} — ${row.after.total.toFixed(1)} · ${row.after.recommendation} · ${row.after.rightsStatus} · ${alreadyApplied ? '업로드 완료' : '반영 대기'}`));
    detail.append(textNode('p',`총점 ${row.before.total.toFixed(1)} → ${row.after.total.toFixed(1)} · 판정 ${row.before.recommendation} → ${row.after.recommendation} · 판권 ${row.before.rightsStatus} → ${row.after.rightsStatus}`,'meta'));
    const ul=document.createElement('ul');for(const f of row.findings)ul.append(textNode('li',f));detail.append(ul);
    if(row.scoreChanges.length){const t=document.createElement('table'),thead=document.createElement('tr');for(const h of ['항목','기존','변경'])thead.append(textNode('th',h));t.append(thead);for(const s of row.scoreChanges){const tr=document.createElement('tr');for(const v of [s.label,String(s.before),String(s.after)])tr.append(textNode('td',v));t.append(tr)}detail.append(t)}
    if(row.pending.length){detail.append(textNode('p','추가 확인: '+row.pending.join(' / '),'pending'))}
    const links=document.createElement('ul');for(const src of row.sources){try{const u=new URL(src.url);if(u.protocol!=='https:'&&u.protocol!=='http:')continue;const li=document.createElement('li'),a=textNode('a',src.label||src.url);a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';li.append(a);links.append(li)}catch{}}detail.append(links);
    const analysis=document.createElement('details');analysis.append(textNode('summary','수정 분석 보기'));
    for(const [key,label] of [['logline','한 줄 소개'],['premise','설정과 갈등'],['recommendationReason','판정 이유']])if(row.patch[key])analysis.append(textNode('p',label+': '+row.patch[key]));
    if(row.patch.mainCharacters){const chars=document.createElement('ul');for(const ch of row.patch.mainCharacters)chars.append(textNode('li',ch.name+' — '+ch.role));analysis.append(chars)}
    if(row.patch.scoreRationales){for(const [key,label] of [['dramaFit','드라마 적합도'],['marketPotential','흥행성'],['originality','차별성'],['scalability','확장성'],['characterAppeal','캐릭터 매력도']])if(row.patch.scoreRationales[key])analysis.append(textNode('p',label+': '+row.patch.scoreRationales[key]))}
    detail.append(analysis);fragment.append(detail);
  }
  el('reviewList').replaceChildren(fragment);
}
function applyButtonState(){el('reviewApply').disabled=applying||alreadyApplied||!reviewData||!window.DashboardAuth.canWrite}
el('reviewSearch').addEventListener('input',()=>reviewData&&renderReviews());el('changesOnly').addEventListener('change',()=>reviewData&&renderReviews());
el('copySetup').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(el('setupSql').value);el('applyStatus').textContent='설치 SQL을 복사했습니다. Supabase SQL Editor에 붙여넣고 실행하세요.'}catch{el('setupSql').closest('details').open=true;el('setupSql').focus();el('setupSql').select();el('applyStatus').textContent='SQL 전체를 선택했습니다. 복사해서 Supabase SQL Editor에서 실행하세요.'}});
el('reviewApply').addEventListener('click',async()=>{
  if(applying||alreadyApplied||!reviewData||!window.DashboardAuth.canWrite)return;
  applying=true;applyButtonState();el('applyStatus').textContent='현재 데이터를 백업하고 검토안을 반영하고 있습니다. 페이지를 유지해 주세요.';
  try{
    const {data,error}=await reviewClient.rpc('ip_dashboard_apply_review',{payload:reviewData.payload});
    if(error){
      if(error.code==='PGRST202')throw new Error('일괄 반영 함수가 아직 설치되지 않았습니다. 위 설치 SQL을 먼저 실행하세요.');
      if(/Analysis changed|work list has changed/.test(error.message))throw new Error('검토 이후 분석이 변경됐거나 검토안이 이미 반영됐습니다. 덮어쓰지 않고 중단했습니다.');
      throw error;
    }
    if(!data||data.reviewed!==211||!data.backup)throw new Error('반영 결과를 확인할 수 없습니다. 대시보드에서 상태를 확인하세요.');
    el('applyStatus').textContent=`업로드 완료: ${data.updated}개 갱신. 백업: ${data.backup}. 대시보드를 새로고침하세요.`;
    alreadyApplied=true; el('reviewSummary').textContent=el('reviewSummary').textContent.replace('아직 DB에 반영되지 않았습니다.','DB 반영을 완료했습니다.');
    for(const s of el('reviewList').querySelectorAll(':scope > details > summary'))s.textContent=s.textContent.replace('반영 대기','업로드 완료');
    applying=false;
  }catch(error){el('applyStatus').textContent=`반영 확인 실패: ${error.message||'연결 오류'}. 연결 오류라면 이미 처리됐을 수 있으니 대시보드를 확인하세요.`;applying=false}
  applyButtonState();
});
(async()=>{
  try{
    const responses=await Promise.all([fetch('review-data.json?v=20261009a',{cache:'no-store'}),fetch('install-review-apply.sql?v=20261009a',{cache:'no-store'})]);
    if(responses.some(r=>!r.ok))throw new Error('검토 파일을 불러올 수 없습니다.');
    reviewData=await responses[0].json();el('setupSql').value=await responses[1].text();
    if(reviewData.records.length!==211||reviewData.payload.length!==211)throw new Error('검토 파일의 작품 수가 일치하지 않습니다.');
    const s=reviewData.summary;el('reviewSummary').textContent=`211개 검토안 · 점수 변경 ${s.scoreChanged}개 · 총점 변경 ${s.totalChanged}개 · 판정 변경 ${s.recommendationChanged}개 · 인물 수정 ${s.charactersChanged}개. 추가 확인 사항은 각 작품을 펼쳐 볼 수 있습니다. 아직 DB에 반영되지 않았습니다.`;
    renderReviews();await window.DashboardAuth.initialize(reviewClient);new MutationObserver(applyButtonState).observe(el('authStatus'),{childList:true,subtree:true});applyButtonState();
    if (typeof reviewClient.from === 'function') {
      try {
        const {data, error} = await reviewClient.from('kdrama_ips').select('id,content');
        const canonical = v => { if(Array.isArray(v))return v.map(canonical); if(v && typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])); return v; };
        const same = (a,b) => JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
        const byId = new Map((data || []).map(row=>[row.id,row.content]));
        if (!error && reviewData.payload.every(row=>byId.has(row.id)&&Object.entries(row.patch).every(([key,value])=>same(byId.get(row.id)[key],value)))) {
          alreadyApplied=true;el('applyStatus').textContent='이 검토안이 DB에 반영된 것을 확인했습니다.';el('reviewSummary').textContent=el('reviewSummary').textContent.replace('아직 DB에 반영되지 않았습니다.','DB 반영 확인 완료.');renderReviews();applyButtonState();
        }
      } catch {}
    }
  }catch(e){el('reviewSummary').textContent=e.message;el('reviewApply').disabled=true}
})();
