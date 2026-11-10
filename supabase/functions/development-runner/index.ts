import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { phaseRequest,PHASES,textOutput,FIELDS } from './prompts.ts';
import { makePdf } from './pdf.ts';
const URL=Deno.env.get('SUPABASE_URL')!;
const service=createClient(URL,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const origins=new Set(['https://ip-dashboard-kappa.vercel.app','http://127.0.0.1:8766']);
const cors={'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
async function rpc(name:string,args:any={}){const {data,error}=await service.rpc(name,args);if(error)throw Error(error.message);return data;}
function bytes(encoded:string){return Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));}
function base64(raw:Uint8Array){let s='';for(let i=0;i<raw.length;i+=8192)s+=String.fromCharCode(...raw.subarray(i,i+8192));return btoa(s);}
async function api(path:string,method='GET',body?:any){
 const response=await fetch('https://api.openai.com/v1/'+path,{method,headers:{Authorization:'Bearer '+Deno.env.get('OPENAI_API_KEY'),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(45000)});
 if(!response.ok)throw Error('AI API 요청 오류 ('+response.status+'). 키·결제·모델 권한을 확인하세요.');
 return await response.json();
}
async function saveAsset(job:any,name:string,mime:string,encoded:string){
 const rows=[];for(let i=0;i<encoded.length;i+=48000)rows.push({job_id:job.id,name,mime_type:mime,chunk_index:rows.length,data_base64:encoded.slice(i,i+48000)});
 if(rows.length>556)throw Error('생성 파일이 20MB 제한을 초과했습니다.');
 const {error:clearError}=await service.from('ip_development_assets').delete().eq('job_id',job.id).eq('name',name);if(clearError)throw clearError;
 for(let i=0;i<rows.length;i+=20){const {error}=await service.from('ip_development_assets').upsert(rows.slice(i,i+20));if(error)throw error;}
 return {name,mime,chunks:rows.length,bytes:bytes(encoded).length};
}
async function assetBytes(jobId:string,name:string){
 const {data,error}=await service.from('ip_development_assets').select('data_base64').eq('job_id',jobId).eq('name',name).order('chunk_index');if(error)throw error;return bytes(data.map(x=>x.data_base64).join(''));
}
async function advance(job:any){
 const state=job.runner_state||{};state.phase??=0;state.round??=0;
 if(state.submitting&&!state.response_id)throw Error('AI 접수 결과를 확인하지 못했습니다. 중복 과금을 피하기 위해 중단했습니다.');
 if(job.parent_id&&!state.parent){const {data,error}=await service.from('ip_development_jobs').select('result').eq('id',job.parent_id).single();if(error)throw error;state.parent=data.result;}
 if(state.phase===7){
  const fontResponse=await fetch('https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/OTF/Korean/NotoSansCJKkr-Regular.otf');if(!fontResponse.ok)throw Error('PDF 글꼴을 불러오지 못했습니다.');
  const images=await Promise.all(['characters.png','spaces.png'].map(name=>assetBytes(job.id,name)));
  const pdf=await makePdf(job.title,state.final,images,new Uint8Array(await fontResponse.arrayBuffer()));
  const pdfAsset=await saveAsset(job,'report.pdf','application/pdf',base64(pdf));
  const payload={...state.final,assets:[...state.assets,pdfAsset]};
  await rpc('ip_dev_finish',{job:job.id,token:job.lease_token,payload,verdict:state.recheck.passed?'completed':'needs_revision'});return;
 }
 if(!state.response_id){
  // Persist intent before charging the API. An ambiguous network failure becomes an explicit failure.
  state.submitting=true;
  const {error}=await service.from('ip_development_jobs').update({runner_state:state,stage:PHASES[state.phase]}).eq('id',job.id).eq('runner_lock',job.runner_lock);if(error)throw error;
  const response=await api('responses','POST',phaseRequest(job,state));
  state.response_id=response.id;state.started_at=Date.now();state.submitting=false;
  await rpc('ip_dev_runner_save',{job:job.id,lock_token:job.runner_lock,state,stage_label:PHASES[state.phase]});return;
 }
 if(Date.now()-state.started_at>45*60*1000){await api('responses/'+state.response_id+'/cancel','POST');throw Error('AI 작업이 제한 시간을 초과했습니다.');}
 const response=await api('responses/'+state.response_id);
 if(['queued','in_progress'].includes(response.status)){
  await rpc('ip_dev_runner_save',{job:job.id,lock_token:job.runner_lock,state,stage_label:PHASES[state.phase]});return;
 }
 if(response.status!=='completed')throw Error('AI 단계가 완료되지 않았습니다 ('+response.status+').');
 const completedId=state.response_id;
 if(state.phase===0){
  state.research=textOutput(response);if(!state.research.trim())throw Error('조사 결과가 비어 있습니다.');
  const sources=(response.output||[]).filter((o:any)=>o.type==='message').flatMap((o:any)=>o.content||[]).flatMap((c:any)=>c.annotations||[]).filter((a:any)=>a.type==='url_citation');
  state.research+='\n출처 인용\n'+JSON.stringify(sources);
 }
 if([1,3].includes(state.phase)){
  const report=JSON.parse(textOutput(response));if(FIELDS.some(k=>typeof report[k]!=='string'||!report[k].trim()))throw Error('기획안 필수 항목이 누락됐습니다.');
  if(state.phase===1){state.draft=report;state.author_id=completedId;await rpc('ip_dev_checkpoint',{job:job.id,token:job.lease_token,current_stage:'독립 레드팀 대기',draft_payload:report});}
  else state.final=report;
 }
 if([2,4].includes(state.phase)){
  const review=JSON.parse(textOutput(response));if(typeof review.passed!=='boolean'||!review.findings)throw Error('레드팀 응답 형식 오류');
  if(state.phase===2){state.review=review;state.reviewer_id=completedId;}
  else {state.recheck=review;state.recheck_id=completedId;}
  await rpc('ip_dev_checkpoint',{job:job.id,token:job.lease_token,current_stage:PHASES[state.phase],review_payload:{independent:true,author_run_id:state.author_id,reviewer_run_id:state.reviewer_id,findings:state.review.findings,recheck:state.recheck?.findings||'',recheck_run_id:state.recheck_id||''}});
 }
 if([5,6].includes(state.phase)){
  const image=(response.output||[]).find((o:any)=>o.type==='image_generation_call'&&o.result);
  if(!image)throw Error('프리비주얼 이미지가 생성되지 않았습니다.');
  const asset=await saveAsset(job,state.phase===5?'characters.png':'spaces.png','image/png',image.result);
  state.assets??=[];state.assets=state.assets.filter((a:any)=>a.name!==asset.name);state.assets.push(asset);
 }
 if(state.phase===4&&!state.recheck.passed&&state.round<1){state.round++;state.phase=3;}else state.phase++;
 delete state.response_id;delete state.started_at;
 await rpc('ip_dev_runner_save',{job:job.id,lock_token:job.runner_lock,state,stage_label:PHASES[state.phase]});
 // Response contents have been durably captured. Deletion failure does not repeat a stage.
 try{await api('responses/'+completedId,'DELETE');}catch{}
}
Deno.serve(async req=>{
 const origin=req.headers.get('origin');const headers={...cors,'Content-Type':'application/json',...(origin&&origins.has(origin)?{'Access-Control-Allow-Origin':origin}:{}),'Vary':'Origin'};
 const answer=(data:any,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(req.method==='OPTIONS')return new Response(null,{headers,status:204});
 if(req.method!=='POST')return answer({error:'POST 요청만 허용합니다.'},405);
 let job:any;
 try{
  const body=await req.json();const cronToken=body.worker_token;
  let ownerId:string|undefined;
  if(cronToken){if(cronToken!==await rpc('ip_dev_runner_token'))return answer({error:'권한 없음'},403);}
  else {
   const auth=req.headers.get('authorization')||'';const token=auth.replace(/^Bearer /,'');
   const {data,error}=await service.auth.getUser(token);if(error||!data.user)return answer({error:'소유자 로그인이 필요합니다.'},401);
   const user=createClient(URL,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:auth}}});
   const {data:allowed,error:checkError}=await user.rpc('ip_dashboard_can_write');if(checkError||allowed!==true)return answer({error:'소유자 권한이 필요합니다.'},403);
   ownerId=data.user.id;
  }
  if(body.action==='config')return answer({ready:!!Deno.env.get('OPENAI_API_KEY'),mode:'immediate'});
  if(!Deno.env.get('OPENAI_API_KEY'))return answer({error:'서버의 OPENAI_API_KEY 설정이 필요합니다.',code:'missing_api_key'},503);
  if(!cronToken){
   if(typeof body.job_id!=='string')return answer({error:'의뢰 번호가 필요합니다.'},400);
   const {data}=await service.from('ip_development_jobs').select('user_id').eq('id',body.job_id).maybeSingle();if(!data||data.user_id!==ownerId)return answer({error:'의뢰 접근 권한이 없습니다.'},403);
  }
  const claimed=await rpc('ip_dev_runner_claim',{job:cronToken?null:body.job_id});job=claimed?.[0];
  if(job)await advance(job);
  return answer({ok:true,advanced:!!job});
 }catch(error){
  const message=error instanceof Error?error.message:'처리에 실패했습니다.';
  if(job)try{await rpc('ip_dev_fail',{job:job.id,token:job.lease_token,reason:message});}catch{}
  return answer({error:message},500);
 }
});
