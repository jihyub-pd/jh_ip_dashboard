/* Owner-only requests; the hourly worker processes production rows. */
(() => {
  const form = document.getElementById('requestForm');
  const message = document.getElementById('requestMessage');
  const list = document.getElementById('requestList');
  const submit = document.getElementById('requestSubmit');
  const labels = {queued:'접수 · 분석 대기',processing:'분석 중',completed:'완료',failed:'처리 실패'};
  let busy = false, loading = false, revision = 0;
  const node = (tag, text, cls) => {const el=document.createElement(tag); el.textContent=text;if(cls)el.className=cls;return el;};
  function canWrite() {return !!window.DashboardAuth?.canWrite;}
  function updateAccess() {submit.disabled=busy||!canWrite();}
  async function load() {
    if (loading) return;
    if (!canWrite()) {revision++;list.replaceChildren(node('p','소유자로 로그인하면 의뢰 내역을 확인할 수 있습니다.'));return;}
    const current=++revision; loading=true;
    try {
      const {data,error}=await supabaseClient.from('ip_analysis_requests').select('id,title,purpose,source_url,questions,status,attempts,result_id,error_message,created_at,completed_at').eq('environment',IS_PROD?'production':'test').order('created_at',{ascending:false}).limit(100);
      if(error)throw error;
      if(current!==revision||!canWrite())return;
      const fragment=document.createDocumentFragment();
      for(const r of data){
        const card=node('article','', 'request-card');
        const head=node('div','', 'request-card-head');head.append(node('h3',r.title),node('span',labels[r.status]||r.status,'request-status request-'+r.status));card.append(head);
        card.append(node('p',r.purpose),node('small',new Date(r.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})+' 접수'));
        if(r.questions)card.append(node('p',r.questions,'request-question'));
        if(r.source_url){try{const url=new URL(r.source_url);if(['http:','https:'].includes(url.protocol)){const a=node('a','참고 링크');a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';card.append(a);}}catch{}}
        if(r.error_message&&r.status!=='completed')card.append(node('p',r.status==='queued'?'다음 확인 때 다시 처리합니다. '+r.error_message:r.error_message,'request-error'));
        if(r.status==='completed'&&r.result_id){const button=node('button','분석 결과 보기','primary-btn');button.type='button';button.addEventListener('click',async()=>{button.disabled=true;try{const {data:row,error}=await supabaseClient.from(TABLE_NAME).select('id,title,createdAt,updatedAt,content').eq('id',r.result_id).single();if(error)throw error;const item=rowToItem(row);const index=items.findIndex(x=>x.id===item.id);if(index<0)items.push(item);else items[index]=item;render();openDetail(item);}catch{message.textContent='결과를 불러오지 못했습니다. 새로고침해 주세요.';}finally{button.disabled=false;}});card.append(button);}
        if(r.status==='failed'){const retry=node('button','다시 시도','ghost-btn');retry.type='button';retry.addEventListener('click',async()=>{retry.disabled=true;try{const {data:updated,error}=await supabaseClient.from('ip_analysis_requests').update({status:'queued'}).eq('id',r.id).eq('status','failed').select('id');if(error||!updated?.length)throw error||Error('상태가 변경됐습니다.');await load();}catch{message.textContent='재시도 접수에 실패했습니다. 로그인과 연결을 확인하세요.';}finally{retry.disabled=false;}});card.append(retry);}
        fragment.append(card);
      }
      if(!data.length)fragment.append(node('p','아직 접수한 의뢰가 없습니다.'));
      list.replaceChildren(fragment);
    }catch{if(current===revision)list.replaceChildren(node('p','의뢰 목록을 불러오지 못했습니다. 로그인과 연결 상태를 확인한 뒤 새로고침해 주세요.'));}
    finally{loading=false;}
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!canWrite())return;
    const title=document.getElementById('requestTitle').value.trim();
    const source_url=document.getElementById('requestSource').value.trim();
    if(!title){message.textContent='원작 제목을 입력하세요.';return;}
    if(source_url){try{if(!['http:','https:'].includes(new URL(source_url).protocol))throw Error();}catch{message.textContent='참고 링크는 http 또는 https 주소로 입력하세요.';return;}}
    busy=true;updateAccess();message.textContent='의뢰를 접수하고 있습니다.';
    try{
      const {error}=await supabaseClient.from('ip_analysis_requests').insert({title,source_url,purpose:document.getElementById('requestPurpose').value,questions:document.getElementById('requestQuestions').value.trim(),environment:IS_PROD?'production':'test'});
      if(error)throw error;
      form.reset();message.textContent=IS_PROD?'접수했습니다. 매시간 의뢰를 확인하며, 완료되면 분석 결과가 등록됩니다.':'테스트 의뢰를 저장했습니다. 자동 분석 대상에는 포함되지 않습니다.';await load();
    }catch{message.textContent='접수에 실패했습니다. 로그인과 연결을 확인한 뒤 다시 시도하세요.';}
    finally{busy=false;updateAccess();}
  });
  document.getElementById('requestRefresh').addEventListener('click',load);
  const authObserver=new MutationObserver(()=>{updateAccess();load();});
  authObserver.observe(document.getElementById('authStatus'),{childList:true,characterData:true,subtree:true});
  document.querySelectorAll('[data-view="requests"]').forEach(b=>b.addEventListener('click',()=>{switchView('requests');load();}));
  setInterval(()=>{if(!document.hidden&&document.getElementById('requestsView').classList.contains('active-view'))load();},30000);
  updateAccess();load();
})();
