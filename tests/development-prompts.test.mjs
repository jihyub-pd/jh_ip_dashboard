import {test} from 'node:test';
import assert from 'node:assert/strict';
import {phaseRequest,textOutput} from '../supabase/functions/development-runner/prompts.ts';
globalThis.Deno={env:{get:()=>undefined}};
const job={title:'테스트',mode:'idea',source_text:'인정받기 위해 거짓말하는 의사',request_text:'태도 강조'};
test('red team receives source and draft in a fresh response without author self-assessment',()=>{
 const req=phaseRequest(job,{phase:2,research:'근거',draft:{logline:'초안'},self_review:'칭찬'});
 const input=JSON.parse(req.input);
 assert.equal(input.source.title,'테스트');assert.equal(input.research,'근거');assert.deepEqual(input.draft,{logline:'초안'});
 assert.equal(req.previous_response_id,undefined);assert.equal(input.self_review,undefined);assert.equal(req.text.format.schema.properties.passed.type,'boolean');
});
test('revision gets the latest independent recheck and prior revised draft',()=>{
 const req=phaseRequest(job,{phase:3,draft:'v1',final:'v2',review:'레드팀',recheck:'목표 불명확'});
 const input=JSON.parse(req.input);assert.equal(input.draft,'v2');assert.equal(input.recheck,'목표 불명확');
});
test('recheck is another fresh response and image stages request actual generation',()=>{
 assert.equal(phaseRequest(job,{phase:4}).previous_response_id,undefined);
 for(const phase of [5,6]){const req=phaseRequest(job,{phase,final:{character_visual_prompt:'인물',space_visual_prompt:'공간'}});assert.equal(req.tools[0].type,'image_generation');assert.equal(req.tools[0].output_format,'png');}
});
test('output extraction excludes tool outputs and handles refusal',()=>{
 assert.equal(textOutput({output:[{type:'web_search_call'},{type:'message',content:[{type:'output_text',text:'정상'},{type:'refusal',refusal:'거절'}]}]}),'정상');
 assert.equal(textOutput({output:[]}),'');
});
