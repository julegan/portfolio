import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toOKLCH, normalizeHex } from '../dist/projects/draping-mirror/color.mjs';
import { PALETTE_KEY, fitColor, portraitCrop, landmarkFrame, readPalette } from '../dist/projects/draping-mirror/drapes.mjs';
import { questionsFor, allQuestions, profile, recordAnswer, wardrobePalette, HOMES, FLOW_KINDS, flowOptions } from '../dist/projects/draping-mirror/session.mjs';
import worker from '../src/shows-feedback.mjs';
import { isDrapingPath } from '../src/draping-headers.mjs';

const coolBright = { 'tone-red':'b','tone-pink':'a','tone-neutral':'b','season-green':'a','season-rose':'b','season-blue':'a','check-temperature':'a','check-intensity':'b' };
const warmSoft = { 'tone-red':'a','tone-pink':'b','tone-neutral':'a','season-green':'b','season-rose':'a','season-blue':'b','check-temperature':'b','check-intensity':'a' };
test('original drapes have valid display colors and isolate the intended dimensions where specified',()=>{
  for(const answers of [{},coolBright,warmSoft]) for(const q of allQuestions(answers)) for(const d of q.drapes){assert.equal(d.hex,normalizeHex(d.hex));assert(d.name);}
  const warm=questionsFor(1)[0].drapes.map(d=>toOKLCH(d.hex));
  assert(Math.abs(warm[0].lightness-warm[1].lightness)<.005);
  const [bright,soft]=questionsFor(2,coolBright)[0].drapes.map(d=>toOKLCH(d.hex));
  assert(Math.abs(bright.lightness-soft.lightness)<.005);assert(bright.chroma-soft.chroma>.1);
  const fine=questionsFor(4,coolBright)[1].drapes.map(d=>toOKLCH(d.hex));
  assert(Math.abs(fine[1].chroma-fine[0].chroma)<bright.chroma-soft.chroma);
  const catalog=allQuestions(coolBright).flatMap(q=>q.drapes).map(d=>toOKLCH(d.hex));
  assert(Math.max(...catalog.map(d=>d.chroma))>.18,'drapes are not limited to a muted site theme');
  assert(Math.min(...catalog.map(d=>d.lightness))<.25);assert(Math.max(...catalog.map(d=>d.lightness))>.95);
});
test('uncertainty, insufficient observations and tied refinement never manufacture a season or flow',()=>{
  assert.equal(profile().leader,null);assert.equal(profile({'tone-red':'a','season-green':'a'}).leader,null);
  const unsure=Object.fromEntries(allQuestions().map(q=>[q.id,'unsure']));assert.equal(profile(unsure).leader,null);assert.equal(profile(unsure).flow,null);
  assert.equal(profile(coolBright).leader.id,'winter');assert.equal(profile(coolBright).flow,null);
  assert.equal(profile({...coolBright,'flow-depth':'b'}).flow,null,'one refinement observation is insufficient');
  assert.equal(profile({...coolBright,'flow-temperature':'b','flow-depth':'b','flow-intensity':'b'}).flow,null,'two competing refinements stay unresolved');
  assert.equal(profile({...coolBright,'flow-temperature':'a','flow-depth':'a','flow-intensity':'b'}).flow.label,'True Winter');
  assert.equal(profile({...warmSoft,'flow-temperature':'a','flow-depth':'b','flow-intensity':'b'}).flow.label,'Deep Autumn');
  const mixed=profile({...coolBright,'check-temperature':'b'});assert(mixed.mixed);assert.equal(mixed.leader.id,'winter');
});
test('all four home directions and their four refinement outcomes are reachable without feature stereotypes',()=>{
  for(const [t,i,home] of [[1,1,'spring'],[1,-1,'autumn'],[-1,1,'winter'],[-1,-1,'summer']]){
    let answers={};
    for(const stage of [1,2,4]) for(const q of questionsFor(stage,answers)) answers[q.id]=q.values.indexOf(q.axis==='temperature'?t:i)===0?'a':'b';
    for(const kind of ['balanced','thermal','depth','energy']){
      const refined={...answers};
      for(const q of questionsFor(3,answers)){const chosen=q.values.includes(kind)?kind:'balanced';refined[q.id]=q.values.indexOf(chosen)===0?'a':'b';}
      const result=profile(refined);assert.equal(result.leader.id,home);assert.equal(result.flow.kind,kind);assert.equal(wardrobePalette(home,kind).length,36);
    }
  }
});
test('every home and flow has a broad, independently browsable collection including neutrals and metals',()=>{
  for(const home of Object.keys(HOMES)) {
    assert.equal(flowOptions(home).length,5);
    const base=wardrobePalette(home);
    for(const kind of FLOW_KINDS) {
      const colors=wardrobePalette(home,kind);
      assert.equal(colors.length,36);assert.equal(new Set(colors.map(d=>d.id)).size,36);
      assert.equal(colors.filter(d=>d.group==='colors').length,22);
      assert.equal(colors.filter(d=>d.group==='neutrals').length,8);
      assert.equal(colors.filter(d=>d.group==='metals').length,6);
      for(const d of colors) {assert.equal(d.hex,normalizeHex(d.hex));assert.equal(d.family,home);assert.equal(d.flow,kind);assert.equal(d.finish!=='matte',d.group==='metals');}
      if(kind!=='home') {
        for(const group of ['colors','neutrals','metals'])assert(colors.some((d,i)=>d.group===group&&d.hex!==base[i].hex),`${home} ${kind} changes ${group}`);
      }
    }
    const ls=base.filter(d=>d.group==='neutrals').map(d=>toOKLCH(d.hex).lightness);
    assert(Math.max(...ls)-Math.min(...ls)>.6,'neutral drapes cover pale through dark');
  }
  assert.deepEqual(wardrobePalette('unknown'),[]);
});
test('changing an earlier answer clears later branch-dependent observations',()=>{
  const original={...coolBright,'flow-depth':'b','finish-metals':'b'};
  const next=recordAnswer(original,'tone-red','a');assert.deepEqual(next,{'tone-red':'a'});assert.equal(original['finish-metals'],'b');
  assert.deepEqual(recordAnswer(original,'tone-red','b'),original);
  assert.throws(()=>recordAnswer({},'invented','a'));assert.throws(()=>recordAnswer({},'tone-red','invented'));
});
test('finishing neutrals and simulated metals do not influence classification',()=>{
  const a=profile(coolBright),b=profile({...coolBright,...Object.fromEntries(questionsFor(5).map(q=>[q.id,'b']))});
  assert.deepEqual(a,b);assert.equal(questionsFor(5).filter(q=>q.drapes.some(d=>d.finish!=='matte')).length,2);
});
test('out-of-gamut requests reduce chroma while preserving the requested direction',()=>{
  const fitted=fitColor(.6,.3,180);assert(fitted.fitted);const p=toOKLCH(fitted.hex);assert(Math.abs(p.lightness-.6)<.003);assert(p.chroma<.3);assert(Math.abs(p.hue-180)<1);
});
test('portrait crop stays within bounds in all supported orientations',()=>{
  for(const [w,h] of [[1600,900],[900,1600],[740,560],[1,1]])for(const x of [0,.5,1])for(const y of [0,.5,1])for(const zoom of [.7,1,2.4]){
    const crop=portraitCrop(w,h,{x,y,zoom});assert(crop.x>=0&&crop.y>=0);assert(crop.width>0&&crop.height>0);assert(crop.x+crop.width<=w+1e-8&&crop.y+crop.height<=h+1e-8);assert(Math.abs(crop.width/crop.height-280/370)<1e-8);
  }
  assert.equal(landmarkFrame([],640,480),null);assert(landmarkFrame([{x:.4,y:.2},{x:.6,y:.7}],640,480).zoom>=.7);
});
test('palette persistence accepts validated colors and never portrait or session records',()=>{
  assert.deepEqual(readPalette('["#fff","#FFFFFF",{"photo":"data:image/jpeg;base64,private"},"invalid","#126c54"]'),['#FFFFFF','#126C54']);assert.deepEqual(readPalette(null),[]);assert.throws(()=>readPalette('{broken'));assert.throws(()=>readPalette('{"photo":"private"}'));
});
test('only the independent draping route receives camera permission and upload methods remain rejected',async()=>{
  const calls=[];const env={ASSETS:{fetch:async request=>{calls.push(request.method);return new Response('<html>mirror</html>',{headers:{'Content-Type':'text/html','Permissions-Policy':'camera=(), microphone=()'}});}}};
  assert(isDrapingPath('/projects/draping-mirror/'));assert(isDrapingPath('/projects/draping-mirror'));assert(!isDrapingPath('/projects/color-lab/'));assert(!isDrapingPath('/projects/color-lab/draping/'));assert(!isDrapingPath('/projects/draping-mirror-other/'));
  const response=await worker.fetch(new Request('https://julieowens.me/projects/draping-mirror/'),env);assert.equal(response.status,200);assert.match(response.headers.get('Permissions-Policy'),/^camera=\(self\), microphone=\(\)/);assert.match(response.headers.get('Content-Security-Policy'),/connect-src 'self'/);
  for(const method of ['POST','PUT','PATCH'])assert.equal((await worker.fetch(new Request('https://julieowens.me/projects/draping-mirror/',{method,body:'private photo'}),env)).status,405);
  assert.deepEqual(calls,['GET']);assert.match(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'),/"\/projects\/draping-mirror\/\*"/);
});
test('guided personal-color session stays independent from the digital picker',()=>{
  const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
  for(const file of ['index.html','mirror.css','mirror.mjs','drapes.mjs','color.mjs','session.mjs','portrait.mjs'])assert.doesNotMatch(read('dist/projects/draping-mirror/'+file),/color[- .]?lab|\.\.\/.*(?:\.css|\.mjs)/i,file);
  const html=read('dist/projects/draping-mirror/index.html');assert.doesNotMatch(html,/type="color"|hex code|drape-chroma|drape-lightness/);assert.doesNotMatch(read('dist/projects/color-lab/index.html'),/draping/i);assert.equal(PALETTE_KEY,'julieowens.draping-mirror.palette.v1');
});
