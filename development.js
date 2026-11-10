/* Owner-only archive. Generation and publishing happen in the connected ChatGPT conversation. */
(() => {
 const $=id=>document.getElementById(id);
 const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text)el.textContent=text;if(cls)el.className=cls;return el;};
 let rows=[],revision=0,detailRevision=0,limit=50;
 const objectUrls=new Set();
 const labels={queued:'등록 대기',processing:'등록 중',completed:'완료',needs_revision:'보완 필요',failed:'등록 중단'};
 const allowed=()=>!!window.DashboardAuth?.canWrite;
 function revoke(){for(const url of objectUrls)URL.revokeObjectURL(url);objectUrls.clear();}
 function clear(){revision++;detailRevision++;rows=[];revoke();$('devHistory').replaceChildren();$('devResult').replaceChildren();$('devMore').hidden=true;}
 function access(){ $('devConnection').textContent=allowed()?'ChatGPT에서 완성한 기획안 · 원작별 버전 보관':'소유자로 로그인하면 등록된 기획안을 확인할 수 있습니다.'; $('devSource').disabled=!allowed(); }
 function populate(){const selected=$('devSource').value;$('devSource').replaceChildren(new Option('전체 기획안',''),new Option('아이디어 기획안','__idea__'));for(const item of [...items].sort((a,b)=>a.title.localeCompare(b.title,'ko'))) $('devSource').add(new Option(item.title,item.id));$('devSource').value=selected;}
 async function load(){
  access();if(!allowed()){clear();return;}const current=++revision;
  try{let query=supabaseClient.from('ip_development_jobs').select('id,title,mode,source_id,parent_id,root_id,version,status,stage,error_message,created_at,origin').eq('environment',IS_PROD?'production':'test').order('created_at',{ascending:false}).limit(limit+1);
   const source=$('devSource').value;if(source==='__idea__')query=query.eq('mode','idea');else if(source)query=query.eq('source_id',source);
   const {data,error}=await query;if(error)throw error;if(current!==revision||!allowed())return;
   $('devMore').hidden=data.length<=limit;rows=data.slice(0,limit);renderHistory();$('devMessage').textContent='';
  }catch{if(current===revision)$('devMessage').textContent='기획안 목록을 불러오지 못했습니다. 새로고침해 주세요.';}
 }
 function renderHistory(){const list=$('devHistory');list.replaceChildren();if(!rows.length)list.append(node('p','아직 등록된 기획안이 없습니다. ChatGPT에서 기획개발을 완료하면 이곳에 등록합니다.'));
  for(const r of rows){const card=node('article',null,'dev-card');card.append(node('h3',r.title+' · v'+r.version),node('p',(labels[r.status]||r.status)+' · '+r.stage),node('small',new Date(r.created_at).toLocaleString('ko-KR')));if(r.error_message)card.append(node('p',r.error_message,'dev-error'));
   if(['completed','needs_revision'].includes(r.status)){const view=node('button','기획안 보기','primary-btn');view.type='button';view.onclick=()=>show(r.id);card.append(view);}list.append(card);
  }
 }
 async function blobUrl(id,asset){
  const chunks=[];
  for(let offset=0;offset<asset.chunks;offset+=100){const {data,error}=await supabaseClient.from('ip_development_assets').select('chunk_index,data_base64').eq('job_id',id).eq('name',asset.name).order('chunk_index').range(offset,Math.min(offset+99,asset.chunks-1));if(error)throw error;chunks.push(...data);}
  if(chunks.length!==asset.chunks||chunks.some((c,i)=>c.chunk_index!==i))throw Error('파일 조각 누락');
  const raw=Uint8Array.from(atob(chunks.map(c=>c.data_base64).join('')),c=>c.charCodeAt(0));if(raw.length!==asset.bytes)throw Error('파일 크기 불일치');
  const url=URL.createObjectURL(new Blob([raw],{type:asset.mime}));objectUrls.add(url);return url;
 }

 async function show(id){
  const current=++detailRevision;revoke();const panel=$('devResult');panel.replaceChildren(node('p','기획안을 불러오고 있습니다.'));
  const valid=()=>allowed()&&current===detailRevision;
  try{const {data:r,error}=await supabaseClient.from('ip_development_jobs').select('id,title,version,status,result,review,source_id,origin').eq('id',id).single();if(error)throw error;if(!valid())return;
   const report=r.result||{};panel.replaceChildren(node('h2',r.title+' · v'+r.version));panel.append(node('p',r.status==='needs_revision'?'검증표에 보완할 내용이 남아 있습니다.':r.review?.independent?'독립 레드팀 검토 기록이 포함된 기획안입니다.':'검토 범위와 검증표를 확인하세요.'));
   const sections=[['로그라인','logline'],['작품 핵심 포인트','key_points'],['주요 인물','characters'],['간략 줄거리','synopsis'],['프리비주얼','assets'],['수정 의견 및 반영 방법','changes'],['검증표','verification'],['검토 범위와 이번 선택','scope']];
   for(const [label,key] of sections){const section=node('section');section.append(node('h3',label));if(key==='assets'){
    for(const asset of (report.assets||[]).filter(a=>['image/png','image/jpeg'].includes(a.mime))){const url=await blobUrl(id,asset);if(!valid()){URL.revokeObjectURL(url);objectUrls.delete(url);return;}const image=node('img');image.alt=asset.name==='characters.png'?'주요 인물 프리비주얼':'주요 공간 프리비주얼';image.loading='lazy';image.src=url;section.append(image);}
    section.append(node('p','각색을 위한 시각화 제안입니다. 원작에서 확인한 사실과 구분해 보세요.'));
   }else section.append(node('div',typeof report[key]==='string'?report[key]:'등록된 내용이 없습니다.','dev-prose'));if(!valid())return;panel.append(section);}
   const pdf=(report.assets||[]).find(a=>a.mime==='application/pdf');if(pdf){const url=await blobUrl(id,pdf);if(!valid()){URL.revokeObjectURL(url);objectUrls.delete(url);return;}const a=node('a','PDF 다운로드','primary-btn');a.href=url;a.download=r.title+'-v'+r.version+'.pdf';panel.prepend(a);}
   const details=node('details');details.append(node('summary','레드팀 검토 기록'),node('div',(r.review?.findings||'검토 기록 없음')+'\n\n재검증\n'+(r.review?.recheck||'재검증 기록 없음'),'dev-prose'));panel.append(details);
   const label=node('label','ChatGPT에 전달할 수정 의견');const input=node('textarea');input.rows=4;input.maxLength=10000;label.append(input);const copy=node('button','수정 요청 복사','primary-btn');copy.type='button';const status=node('p');status.setAttribute('role','status');copy.onclick=async()=>{const text='기획안 수정 요청: '+r.title+' v'+r.version+'\n기획안 ID: '+r.id+'\n'+(r.source_id?'원작 IP ID: '+r.source_id+'\n':'')+'수정 의견: '+input.value+'\n수정 완료 후 기존 버전을 보존하고 새 버전으로 대시보드에 등록해줘.';try{await navigator.clipboard.writeText(text);status.textContent='복사했습니다. 기획개발을 진행한 ChatGPT 대화에 붙여 넣으세요.';}catch{status.textContent=text;}};panel.append(label,copy,status);panel.scrollIntoView({behavior:'smooth'});
  }catch{if(valid())panel.replaceChildren(node('p','기획안 또는 첨부 파일을 불러오지 못했습니다. 다시 선택해 주세요.'));}
 }
 $('devRefresh').onclick=()=>{populate();load();};$('devSource').onchange=()=>{detailRevision++;revoke();$('devResult').replaceChildren();limit=50;load();};$('devMore').onclick=()=>{limit+=50;load();};$('developmentNav').onclick=()=>{populate();load();};
 window.DevelopmentStudio={open(item){populate();$('devSource').value=item.id;detailRevision++;revoke();$('devResult').replaceChildren();limit=50;switchView('development');load();}};
 new MutationObserver(()=>{clear();access();populate();load();}).observe($('authStatus'),{childList:true,characterData:true,subtree:true});
 setInterval(()=>{if(!document.hidden&&$('developmentView').classList.contains('active-view'))load();},15000);access();
})();
