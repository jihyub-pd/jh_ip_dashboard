const candidatesUrl = 'https://ozhdfewlboheqpcvbqgz.supabase.co', candidatesKey = 'sb_publishable_VBrlZgSIDMwO6htQd8fXkQ_HkUxmg3z';
let candidatePack=null, registered=new Set();
const get=id=>document.getElementById(id), normalize=value=>String(value).toLowerCase().replace(/[^a-z0-9가-힣]/g,'');
function node(tag,text){const n=document.createElement(tag);n.textContent=text;return n}
function renderCandidates(){
 const query=get('candidateSearch').value.trim().toLowerCase(),type=get('candidateType').value,batch=get('candidateBatch').value,hide=get('candidateHideExisting').checked;
 const records=candidatePack.records.filter(r=>(type==='all'||r.originalType===type)&&(batch==='all'||String(r.batch)===batch)&&(!hide||!registered.has(normalize(r.title)))&&[r.title,r.author,r.genre,r.platform].join(' ').toLowerCase().includes(query));
 const fragment=document.createDocumentFragment();for(const r of records){
  const tr=document.createElement('tr');tr.append(node('td',String(r.order)));const title=document.createElement('td'),link=node('a',r.title);link.href=r.source;link.target='_blank';link.rel='noopener noreferrer';title.append(link);
  if(r.relatedWorks?.length)title.append(node('small','함께 검토: '+r.relatedWorks.join(', ')));title.append(node('small','서지 확인 · 판권 확인 필요'));tr.append(title,node('td',r.author),node('td',r.originalType),node('td',r.genre),node('td',r.platform));tr.append(node('td',registered.has(normalize(r.title))?'분석 보드 등록됨':(r.status||'분석 대기')));fragment.append(tr)
 }
 get('candidateRows').replaceChildren(fragment);get('candidateCount').textContent=`${records.length}개 표시 / 최초 후보 100개`;
}
for(const id of ['candidateSearch','candidateType','candidateBatch','candidateHideExisting'])get(id).addEventListener(id==='candidateSearch'?'input':'change',()=>candidatePack&&renderCandidates());
(async()=>{try{
 const response=await fetch('candidates-data.json?v=20261009a',{cache:'no-store'});if(!response.ok)throw Error('후보 목록을 불러오지 못했습니다.');candidatePack=await response.json();if(candidatePack.records.length!==100)throw Error('후보 수가 일치하지 않습니다.');
 const counts={};for(const r of candidatePack.records)counts[r.originalType]=(counts[r.originalType]||0)+1;
 get('candidateSummary').textContent=`${candidatePack.createdAt} 선정 · 웹툰 ${counts['웹툰']||0}개 · 웹소설 ${counts['웹소설']||0}개 · 소설 ${counts['소설']||0}개. 기존 ${candidatePack.baselineCount}개와 중복 제거 완료.`;renderCandidates();
 try{const live=await fetch(candidatesUrl+'/rest/v1/kdrama_ips?select=title,content',{headers:{apikey:candidatesKey},cache:'no-store'});if(!live.ok)throw Error();const rows=await live.json();registered=new Set(rows.map(r=>normalize(r.title)));for(const r of rows){for(const alias of r.content?.originalAliases||[])registered.add(normalize(alias))}renderCandidates()}
 catch{get('candidateSummary').textContent+=' 현재 분석 보드와의 재대조는 연결 후 새로고침하세요.'}
}catch(error){get('candidateSummary').textContent=error.message}})();
