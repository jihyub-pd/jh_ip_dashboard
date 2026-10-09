// Read-only browsing and comparisons. Saved conditions stay in this browser.
(() => {
 const groups={로맨스:['로맨스','로판','멜로','순정'],판타지:['판타지','로판','이세계','무협'],스릴러:['스릴러','서스펜스'],미스터리:['미스터리','추리'],휴먼:['휴먼','힐링','일상','가족'],코미디:['코미디','개그','블랙코미디'],액션:['액션','격투'],SF:['sf','에스에프','공상과학'],사극:['사극','역사'],성장:['성장','청춘'],스포츠:['스포츠'],공포:['공포','호러']};
 const tags=item=>(item.genre||[]).map(s=>String(s).trim()).filter(Boolean);
 function matchesGenre(item,value){
  if(value==='all')return true;
  if(value==='unknown')return !tags(item).length;
  if(value.startsWith('tag:'))return tags(item).includes(value.slice(4));
  const words=Object.hasOwn(groups,value)?groups[value]:null;return !!words&&tags(item).some(t=>words.some(w=>t.toLowerCase().includes(w)));
 }
 window.IPExplorer={matchesGenre};
 const selected=new Set(),storageKey='ip-dashboard-browse-conditions-v1';let saved=[];
 try {const parsed=JSON.parse(localStorage.getItem(storageKey)||'[]');if(Array.isArray(parsed))saved=parsed.filter(s=>s&&typeof s.name==='string'&&s.filters&&typeof s.filters==='object').slice(0,20)}catch{}
 const make=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e};
 const bar=make('section',null,'explore-bar');bar.setAttribute('aria-label','장르 탐색과 작품 비교');
 const label=make('label','장르'),genre=make('select');genre.id='genreBrowse';label.htmlFor=genre.id;bar.append(label,genre);
 const presets=make('select');presets.id='browseSaved';presets.setAttribute('aria-label','저장한 검색 조건');bar.append(presets);
 const name=make('input');name.placeholder='조건 이름';name.maxLength=40;name.setAttribute('aria-label','저장할 조건 이름');bar.append(name);
 const save=make('button','조건 저장'),remove=make('button','조건 삭제'),reset=make('button','조건 초기화'),compare=make('button','선택 작품 비교 (0/5)'),clear=make('button','비교 선택 비우기');
 for(const e of [save,remove,reset,compare,clear]){e.type='button';bar.append(e)}compare.id='browseCompare';
 const manage=make('details',null,'explore-manage'),summary=make('summary','조건 저장·관리'),manageBody=make('div',null,'explore-manage-body');manage.append(summary,manageBody);manageBody.append(name,save,remove);bar.append(manage);
 const count=make('p',null,'explore-count'),message=make('p',null,'explore-message');count.id='browseCount';count.setAttribute('role','status');message.setAttribute('role','status');
 const help=make('p','장르·유형·판정·판권 조건을 함께 적용할 수 있습니다. 장르는 저장된 태그로 묶으며, 한 작품이 여러 장르에 포함될 수 있습니다. 조건 저장은 이 브라우저에만 적용됩니다.','explore-help');
 document.querySelector('.filter-bar').insertAdjacentElement('afterend',bar);bar.after(help,count,message);
 const dialog=make('dialog',null,'compare-dialog');dialog.id='browseComparison';dialog.setAttribute('aria-label','선택한 원작 IP 비교');
 document.body.append(dialog);
 function populateSaved(){presets.replaceChildren();const first=make('option','저장한 조건 선택');first.value='';presets.append(first);saved.forEach((s,i)=>{const o=make('option',s.name);o.value=String(i);presets.append(o)})}
 function persist(){try{localStorage.setItem(storageKey,JSON.stringify(saved));return true}catch{message.textContent='브라우저 저장 공간을 사용할 수 없어 조건을 저장하지 못했습니다.';return false}}
 function capture(){return {query:els.searchInput.value,type:typeFilterValue,status:statusFilter,rights:rightsFilterValue,serial:serialFilterValue,favorites:favoritesOnly,genre:genreFilterValue,sort:sortKey,direction:sortDir}}
 function apply(f){
  els.searchInput.value=typeof f.query==='string'?f.query:'';typeFilterValue=typeof f.type==='string'?f.type:'all';statusFilter=['all','recommend','research','hold'].includes(f.status)?f.status:'all';rightsFilterValue=RIGHTS_FILTERS.some(r=>r.key===f.rights)?f.rights:'all';serialFilterValue=typeof f.serial==='string'?f.serial:'all';favoritesOnly=f.favorites===true;genreFilterValue=typeof f.genre==='string'?f.genre:'all';sortKey=['total','date','title',...Object.keys(scoreLabels)].includes(f.sort)?f.sort:'total';sortDir=f.direction==='asc'?'asc':'desc';syncSortSelect();render();
 }
 genre.addEventListener('change',()=>{genreFilterValue=genre.value;renderList()});
 presets.addEventListener('change',()=>{if(presets.value==='')return;const s=saved[Number(presets.value)];if(s){apply(s.filters);name.value=s.name;message.textContent='저장한 조건을 적용했습니다.'}});
 save.addEventListener('click',()=>{const title=name.value.trim();if(!title){message.textContent='조건 이름을 입력하세요.';name.focus();return}const previous=saved.slice(),entry={name:title,filters:capture()},i=saved.findIndex(s=>s.name===title);if(i<0&&saved.length>=20){message.textContent='조건은 최대 20개까지 저장할 수 있습니다.';return}if(i<0)saved.push(entry);else saved[i]=entry;if(!persist()){saved=previous;return}populateSaved();presets.value=String(saved.findIndex(s=>s.name===title));message.textContent='현재 검색·장르·판권·판정·정렬 조건을 저장했습니다.'});
 remove.addEventListener('click',()=>{if(presets.value==='')return;const previous=saved.slice();saved.splice(Number(presets.value),1);if(!persist()){saved=previous;return}populateSaved();message.textContent='저장한 조건을 삭제했습니다.'});
 reset.addEventListener('click',()=>{apply({});presets.value='';message.textContent='전체 작품을 표시합니다. 비교 선택은 유지됩니다.'});
 clear.addEventListener('click',()=>{selected.clear();renderList()});
 function renderGenres(){
  const available=[...new Set(items.flatMap(tags))].sort((a,b)=>a.localeCompare(b,'ko'));genre.replaceChildren();
  const option=(parent,value,title)=>{const o=make('option',title);o.value=value;parent.append(o)};option(genre,'all','전체 장르');
  const broad=make('optgroup');broad.label='장르별 모아보기';for(const g of Object.keys(groups)){const n=items.filter(i=>matchesGenre(i,g)).length;if(n)option(broad,g,`${g} (${n})`)}genre.append(broad);
  const exact=make('optgroup');exact.label='저장된 세부 태그';for(const t of available)option(exact,'tag:'+t,`${t} (${items.filter(i=>tags(i).includes(t)).length})`);genre.append(exact);
  const unknown=items.filter(i=>!tags(i).length).length;if(unknown)option(genre,'unknown',`장르 미입력 (${unknown})`);
  if(![...genre.options].some(o=>o.value===genreFilterValue))genreFilterValue='all';genre.value=genreFilterValue;
 }
 function update(){
  for(const id of selected)if(!items.some(i=>i.id===id))selected.delete(id);
  const visible=filteredItems();count.textContent=`${visible.length}개 표시 / 전체 ${items.length}개 · 비교 선택 ${selected.size}개`;compare.textContent=`선택 작품 비교 (${selected.size}/5)`;compare.disabled=selected.size<2;clear.disabled=!selected.size;
  const rows=els.ipList.querySelectorAll('.ip-row:not(.ip-row-head)');rows.forEach((row,i)=>{
   const item=visible[i];if(!item||selectMode)return;
   const wrap=make('label',null,'compare-pick'),box=make('input');box.type='checkbox';box.checked=selected.has(item.id);box.setAttribute('aria-label',item.title+' 비교 선택');box.dataset.compareId=item.id;wrap.append(box,make('span','비교'));
   wrap.addEventListener('click',e=>e.stopPropagation());wrap.addEventListener('keydown',e=>e.stopPropagation());box.addEventListener('change',()=>{if(box.checked){if(selected.size>=5){box.checked=false;message.textContent='한 번에 최대 5개 작품을 비교할 수 있습니다.';return}selected.add(item.id)}else selected.delete(item.id);message.textContent='';renderList()});row.querySelector('.row-title').append(wrap);
  });
 }
 function showComparison(){
  const works=[...selected].map(id=>items.find(i=>i.id===id)).filter(Boolean);if(works.length<2)return;
  dialog.replaceChildren();const close=make('button','닫기');close.type='button';close.addEventListener('click',()=>dialog.close());dialog.append(close,make('h2','선택 작품 비교'),make('p','제작성·글로벌 점수는 참고 지표이며 총점에 포함하지 않습니다. 판권 상태는 작품 판정과 별개입니다.'));
  const scroll=make('div',null,'compare-scroll'),table=make('table'),caption=make('caption',`${works.length}개 원작의 분석·점수 비교`);table.append(caption);
  const head=make('thead'),hr=make('tr');hr.append(make('th','비교 항목'));for(const w of works){const th=make('th',w.title);th.scope='col';hr.append(th)}head.append(hr);table.append(head);
  const body=make('tbody');const add=(title,fn)=>{const tr=make('tr'),th=make('th',title);th.scope='row';tr.append(th);for(const w of works){const td=make('td'),value=fn(w);if(Array.isArray(value)){const ul=make('ul');for(const s of value)ul.append(make('li',s));td.append(ul)}else td.textContent=String(value||'미입력');tr.append(td)}body.append(tr)};
  add('로그라인',w=>w.logline);add('장르',w=>tags(w).join(' · '));add('판정',w=>w.recommendation);add('판정 이유',w=>w.recommendationReason||'별도 판정 이유 미입력 — 항목별 근거 참조');add('판권 상태',w=>w.rightsStatus);add('총점',w=>averageScore(w).toFixed(1));
  for(const [key,title]of Object.entries(scoreLabels)){add(title+(TOTAL_EXCLUDED_KEYS.includes(key)?' (참고)':''),w=>clampScore(w.scores[key]).toFixed(1));add(title+' 근거',w=>w.scoreRationales[key])}
  add('강점',w=>w.strengths);add('리스크',w=>w.risks);add('주요 인물',w=>w.mainCharacters.map(c=>`${c.name} — ${c.role}`));add('판권 확인 내용',w=>w.rightsInfo.note);add('분석 메모·한계',w=>w.notes);table.append(body);scroll.append(table);dialog.append(scroll);dialog.showModal();
 }
 compare.addEventListener('click',showComparison);populateSaved();
 const original=renderList;renderList=function(){renderGenres();original();update()};renderList();
})();
