/* Private development requests, version history and server-backed progress. */
(() => {
 const $=id=>document.getElementById(id);
 const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text)el.textContent=text;if(cls)el.className=cls;return el;};
 let rows=[],active=null,busy=false,loading=false,revision=0,parent=null,ready=false,requestKey=crypto.randomUUID(),loadedUser=null,detailRevision=0;
 const objectUrls=new Set();
 const labels={queued:'접수 중',processing:'진행 중',completed:'완료',needs_revision:'보완 필요',failed:'처리 중단'};
 function allowed(){return !!window.DashboardAuth?.canWrite;}
 function setMessage(text){$('devMessage').textContent=text;}
 function revoke(){for(const url of objectUrls)URL.revokeObjectURL(url);objectUrls.clear();}
 async function invoke(body){const {data,error}=await supabaseClient.functions.invoke('development-runner',{body});if(error)throw Error(data?.error||'실행 서버 연결을 확인하세요.');if(data?.error)throw Error(data.error);return data;}
 function access(){
  $('devSubmit').disabled=busy||!allowed()||!!active||!ready;
  $('devInputFields').disabled=busy||!allowed()||!!active;
  $('developmentNav').textContent=active?'기획개발 · 진행 상황':'기획개발';
  $('devProgress').hidden=!active;
  $('devProgressText').textContent=active?active.title+' · '+active.stage:'';
  $('devProgressHint').textContent=active?'작업이 끝날 때까지 새 의뢰와 수정 요청을 받지 않습니다. 창을 닫아도 서버에서 계속 진행합니다.':'';
  $('devConnection').textContent=!allowed()?'소유자로 로그인하면 기획개발을 의뢰하고 결과를 확인할 수 있습니다.':!ready?'즉시 실행을 위한 서버 API 연결이 필요합니다.':'접수 즉시 시작 · 한 번에 한 작품 · AI API 사용료 발생';
 }
 async function config(){if(!allowed())return;try{const r=await invoke({action:'config'});ready=r.ready===true;}catch{ready=false;}access();}
 function populate(){
  const selected=$('devSource').value;$('devSource').replaceChildren(new Option('작품 선택',''));
  for(const item of [...items].sort((a,b)=>a.title.localeCompare(b.title,'ko'))) $('devSource').add(new Option(item.title,item.id));
  $('devSource').value=selected;
 }
 function mode(){const ip=$('devMode').value==='ip';$('devIpField').hidden=!ip;$('devIdeaField').hidden=ip;$('devSource').required=ip&&!parent;$('devTitle').required=!ip&&!parent;$('devMaterials').required=!ip&&!parent;}
 function reset(){parent=null;$('devForm').reset();requestKey=crypto.randomUUID();$('devParent').hidden=true;$('devSubmit').textContent='기획개발 시작';mode();}
 async function load(){
  if(loading)return;
  if(!allowed()) {revision++;rows=[];active=null;ready=false;loadedUser=null;revoke();$('devHistory').replaceChildren();$('devResult').replaceChildren();reset();access();return;}
  const current=++revision;loading=true;
  try{
   const {data:{session}}=await supabaseClient.auth.getSession();const user=session?.user?.id;
   if(loadedUser&&loadedUser!==user){revoke();$('devResult').replaceChildren();reset();}loadedUser=user;
   const {data,error}=await supabaseClient.from('ip_development_jobs').select('id,title,mode,source_id,parent_id,root_id,version,status,stage,error_message,created_at,updated_at').eq('environment',IS_PROD?'production':'test').order('created_at',{ascending:false}).limit(100);
   if(error)throw error;if(current!==revision||!allowed())return;
   rows=data;active=rows.find(r=>['queued','processing'].includes(r.status))||null;renderHistory();access();
  }catch{if(current===revision)setMessage('기획개발 목록을 불러오지 못했습니다. 연결 상태를 확인해 주세요.');}
  finally{loading=false;}
 }
 function renderHistory(){
  const list=$('devHistory');list.replaceChildren();
  if(!rows.length)list.append(node('p','아직 기획개발 의뢰가 없습니다.'));
  for(const r of rows){
   const card=node('article',null,'dev-card');card.append(node('h3',r.title+' · v'+r.version),node('p',labels[r.status]+' · '+r.stage),node('small',new Date(r.created_at).toLocaleString('ko-KR')));
   if(r.error_message)card.append(node('p',r.error_message,'dev-error'));
   if(['completed','needs_revision'].includes(r.status)){
    const view=node('button','결과 보기','primary-btn');view.type='button';view.onclick=()=>show(r.id);card.append(view);
   }
   if(r.status==='failed'){
    const retry=node('button','다시 시도','ghost-btn');retry.type='button';retry.disabled=!!active||busy||!ready;
    retry.onclick=async()=>{retry.disabled=true;try{const {data,error}=await supabaseClient.rpc('ip_dev_retry',{job:r.id});if(error)throw error;await load();await invoke({job_id:data});await load();}catch(e){setMessage('재시도 실패 · '+e.message);await load();}finally{retry.disabled=false;}};card.append(retry);
   }
   list.append(card);
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
  const current=++detailRevision;const panel=$('devResult');revoke();panel.replaceChildren(node('p','결과를 불러오고 있습니다.'));
  try{
   const {data:r,error}=await supabaseClient.from('ip_development_jobs').select('id,title,version,status,result,review').eq('id',id).single();if(error)throw error;
   if(!allowed()||current!==detailRevision)return;
   const report=r.result;panel.replaceChildren(node('h2',r.title+' · v'+r.version));
   panel.append(node('p',r.status==='needs_revision'?'필수 검토 항목에 보완할 내용이 남아 있습니다.':'독립 레드팀 및 수정안 재검토 완료'));
   const sections=[['로그라인','logline'],['작품 핵심 포인트','key_points'],['주요 인물','characters'],['간략 줄거리','synopsis'],['프리비주얼','assets'],['수정 의견 및 반영 방법','changes'],['검증표','verification'],['검토 범위와 이번 선택','scope']];
   for(const [label,key] of sections){
    const section=node('section');section.append(node('h3',label));
    if(key==='assets'){
     for(const asset of report.assets.filter(a=>['image/png','image/jpeg'].includes(a.mime))){
      const image=node('img');image.alt=asset.name==='characters.png'?'주요 인물 디자인 제안':'주요 공간 디자인 제안';image.loading='lazy';image.src=await blobUrl(id,asset);section.append(image);
     }
     section.append(node('p','각색을 위한 프리비주얼이며 원작 외형·역사 고증과 구분합니다.'));
    }else section.append(node('div',report[key],'dev-prose'));
    if(!allowed()||current!==detailRevision){revoke();return;}panel.append(section);
   }
   const pdf=report.assets.find(a=>a.mime==='application/pdf');
   if(pdf){const a=node('a','PDF 다운로드','primary-btn');a.href=await blobUrl(id,pdf);a.download=r.title+'-v'+r.version+'.pdf';panel.prepend(a);}
   const details=node('details');details.append(node('summary','독립 레드팀 상세'),node('div',r.review.findings+'\n\n재검증\n'+r.review.recheck,'dev-prose'));panel.append(details);
   const form=node('form');const label=node('label','이 버전에 대한 수정 의견');const input=node('textarea');input.required=true;input.maxLength=10000;input.rows=4;label.append(input);const submit=node('button','이 버전에서 수정기획안 만들기','primary-btn');submit.disabled=!!active||!ready;form.append(label,submit);
   form.onsubmit=async e=>{e.preventDefault();parent=id;$('devParent').hidden=false;$('devParent').textContent=r.title+' v'+r.version+'의 수정안';$('devRequest').value=input.value;$('devMode').value=rows.find(x=>x.id===id)?.mode||'ip';$('devMaterials').value='';$('devSource').required=false;$('devTitle').required=false;$('devMaterials').required=false;$('devSubmit').textContent='수정기획안 시작';requestKey=crypto.randomUUID();$('devForm').scrollIntoView({behavior:'smooth'});};panel.append(form);
   panel.scrollIntoView({behavior:'smooth'});
  }catch(e){panel.replaceChildren(node('p','결과 조회 실패 · '+e.message));}
 }
 $('devForm').onsubmit=async event=>{
  event.preventDefault();if(busy||active||!allowed()||!ready)return;
  const selection=items.find(i=>i.id===$('devSource').value);const ip=$('devMode').value==='ip';
  if(!parent&&ip&&!selection){setMessage('원작 IP를 선택하세요.');return;}
  busy=true;access();setMessage('의뢰를 접수하고 있습니다.');
  try{
   const values={request_key:requestKey,environment:IS_PROD?'production':'test',parent_id:parent,source_id:selection?.id||null,title:selection?.title||$('devTitle').value.trim()||'수정기획안',mode:ip?'ip':'idea',source_text:$('devMaterials').value.trim(),request_text:$('devRequest').value.trim()};
   let {data,error}=await supabaseClient.from('ip_development_jobs').insert(values).select('id').single();
   if(error?.code==='23505'){
    const existing=await supabaseClient.from('ip_development_jobs').select('id').eq('request_key',requestKey).maybeSingle();
    if(existing.data){data=existing.data;error=null;}else throw Error('이미 진행 중인 기획개발이 있습니다. 완료 후 접수할 수 있습니다.');
   }
   if(error)throw error;
   reset();setMessage('접수했습니다. 자료 분석을 시작합니다.');await load();
   await invoke({job_id:data.id});await load();
  }catch(e){setMessage('접수·실행 확인 · '+e.message);await load();}
  finally{busy=false;access();}
 };
 $('devMode').onchange=mode;$('devReset').onclick=()=>{reset();access();};
 $('devFile').onchange=async()=>{const file=$('devFile').files[0];if(!file)return;if(file.size>450000){setMessage('텍스트 파일은 450KB 이하로 첨부하세요.');return;}const value=await file.text();if(value.length>150000){setMessage('자료는 15만 글자 이하로 입력하세요.');return;}$('devMaterials').value=value;};
 $('devRefresh').onclick=async()=>{await config();await load();};
 $('developmentNav').onclick=async()=>{populate();await config();await load();};
 window.DevelopmentStudio={open(item){populate();reset();$('devMode').value='ip';$('devSource').value=item.id;mode();switchView('development');config();load();$('devForm').scrollIntoView({behavior:'smooth'});}};
 new MutationObserver(()=>{revision++;detailRevision++;if(!allowed()){revoke();$('devResult').replaceChildren();}config();load();}).observe($('authStatus'),{childList:true,characterData:true,subtree:true});
 setInterval(async()=>{if(!document.hidden&&$('developmentView').classList.contains('active-view')){await load();if(active&&ready)try{await invoke({job_id:active.id});}catch{}}},15000);
 mode();access();
})();
