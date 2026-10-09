// Personal workflow state is independent of an IP's recommendation and score.
(() => {
 let scope='pending';const busy=new Set();
 window.IPReview={includes:item=>scope==='completed'?item.reviewCompleted===true:item.reviewCompleted!==true};
 const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n};
 const mainNav=document.querySelector('.side-nav [data-view="dashboard"]'),completedNav=make('button',null,'nav-btn');completedNav.type='button';completedNav.id='completedNav';const navCount=make('span','0','nav-count');completedNav.append(document.createTextNode('검토 완료 '),navCount);mainNav.after(completedNav);
 const msg=make('p',null,'review-state-message');msg.setAttribute('role','status');document.querySelector('#browseCount').after(msg);
 let pendingFilters=null;
 function snapshot(){return {query:els.searchInput.value,type:typeFilterValue,status:statusFilter,rights:rightsFilterValue,genre:genreFilterValue,favorites:favoritesOnly,sort:sortKey,direction:sortDir}}
 function setFilters(f){els.searchInput.value=f.query||'';typeFilterValue=f.type||'all';statusFilter=f.status||'all';rightsFilterValue=f.rights||'all';genreFilterValue=f.genre||'all';favoritesOnly=!!f.favorites;sortKey=f.sort||'total';sortDir=f.direction||'desc';syncSortSelect()}
 function setScope(next){if(next===scope){switchView('dashboard');return}if(next==='completed'){pendingFilters=snapshot();setFilters({})}else if(pendingFilters){setFilters(pendingFilters);pendingFilters=null}scope=next;render();switchView('dashboard')}
 mainNav.addEventListener('click',()=>setScope('pending'));completedNav.addEventListener('click',()=>setScope('completed'));
 const originalSwitch=switchView;switchView=function(view){originalSwitch(view);refreshNavigation()};
 function refreshNavigation(){const dashboard=document.querySelector('#dashboardView').classList.contains('active-view');mainNav.classList.toggle('active',dashboard&&scope==='pending');completedNav.classList.toggle('active',dashboard&&scope==='completed');const title=document.querySelector('#dashboardView .topbar h2');if(title)title.textContent=scope==='completed'?'검토 완료 작품':'원작 IP 후보';navCount.textContent=String(items.filter(i=>i.reviewCompleted).length)}
 async function toggle(item){
  if(!window.DashboardAuth?.canWrite||busy.has(item.id))return;
  if(!supabaseClient){msg.textContent='서버에 연결되지 않아 검토 상태를 저장하지 못했습니다.';return}
  busy.add(item.id);renderList();msg.textContent='검토 상태를 저장하고 있습니다.';
  try{
   const {data:latest,error:readError}=await supabaseClient.from(TABLE_NAME).select('id,title,createdAt,updatedAt,content').eq('id',item.id).single();
   if(readError||!latest)throw new Error('작품의 최신 상태를 확인하지 못했습니다.');
   const old=latest.content||{},next=!item.reviewCompleted;
   if((old.reviewCompleted===true)!==(item.reviewCompleted===true)){Object.assign(item,rowToItem(latest));throw new Error('다른 곳에서 검토 상태가 변경되었습니다. 갱신된 상태를 확인하세요.')}
   const stamp=new Date().toISOString(),content={...old,reviewCompleted:next,reviewCompletedAt:next?stamp:null,updatedAt:stamp};
   // Read-merge-write preserves every analysis field, memo and star. Timestamp
   // guard refuses a stale update rather than replacing a newer record.
   const {data:saved,error:writeError}=await supabaseClient.from(TABLE_NAME).update({content,updatedAt:stamp}).eq('id',item.id).eq('updatedAt',latest.updatedAt).select('id,title,createdAt,updatedAt,content');
   if(writeError)throw new Error('검토 상태 저장에 실패했습니다. 잠시 후 다시 시도하세요.');
   if(!Array.isArray(saved)||saved.length!==1||saved[0].content?.reviewCompleted!==next)throw new Error('저장 중 작품이 변경되었습니다. 새로고침 후 다시 시도하세요.');
   Object.assign(item,rowToItem(saved[0]));setLocalItems(items);msg.textContent=next?'검토 완료로 저장했습니다. 메인 목록에서 숨겼습니다.':'완료 표시를 해제했습니다. 메인 목록에 다시 표시됩니다.';
  }catch(error){msg.textContent=error.message||'검토 상태를 저장하지 못했습니다.'}
  finally{busy.delete(item.id);render();const detail=document.querySelector('#detailView');if(detail?.classList.contains('active-view'))renderDetail()}
 }
 function buttonFor(item){const button=make('button',item.reviewCompleted?'☑ 완료 해제':'☐ 검토 완료','review-complete-btn');button.type='button';button.setAttribute('role','checkbox');button.setAttribute('aria-checked',String(!!item.reviewCompleted));button.setAttribute('aria-label',item.title+' 검토 완료');button.disabled=busy.has(item.id);if(!window.DashboardAuth?.canWrite)button.title='소유자로 로그인하면 검토 상태를 변경할 수 있습니다.';button.addEventListener('click',e=>{e.stopPropagation();toggle(item)});button.addEventListener('keydown',e=>e.stopPropagation());return button}
 const originalList=renderList;renderList=function(){originalList();const visible=filteredItems();els.ipList.querySelectorAll('.ip-row:not(.ip-row-head)').forEach((row,i)=>{if(visible[i])row.querySelector('.row-badges').append(buttonFor(visible[i]))});refreshNavigation();const count=document.querySelector('#browseCount');if(count)count.textContent=count.textContent.replace('전체 '+items.length+'개',`${scope==='completed'?'검토 완료':'미검토'} ${items.filter(window.IPReview.includes).length}개 / 전체 ${items.length}개`)};
 const originalDetail=renderDetail;renderDetail=function(){originalDetail();const item=items.find(i=>i.id===selectedId),panel=els.detailPanel.querySelector('.detail-hero-text');if(item&&panel)panel.append(buttonFor(item))};
 renderList();
})();
