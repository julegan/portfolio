import { PALETTE_KEY, readPalette, fitColor } from './drapes.mjs';
import { toOKLCH } from './color.mjs';
import { STAGES, HOMES, REST_DRAPE, questionsFor, allQuestions, recordAnswer, profile, wardrobePalette } from './session.mjs';
import { createPortrait } from './portrait.mjs';

const $ = id => document.getElementById(id);
let stage = 0, index = 0, answers = {}, active = 0, resting = false, comparing = false, practice = null;
let seen = new Set([0]), palette = [], storageAvailable = true, capture;
let displayPair = [REST_DRAPE, REST_DRAPE], resultPreview = null;
const panels = [$('portrait-a'), $('portrait-b')];
const status = message => { $('source-status').textContent = message; };
const current = () => questionsFor(stage, answers)[index];
const canAssess = () => capture && capture.mode !== 'empty' && capture.mode !== 'camera';
const sources = { empty: 'No portrait', demo: 'Illustrated sample', photo: 'Your photo · session only', camera: 'Live camera', frozen: 'Frozen frame · camera off' };

function metallicFill(ctx, drape) {
  const { lightness: l, chroma: c, hue: h } = toOKLCH(drape.hex);
  const gradient = ctx.createLinearGradient(0, 250, 480, 570);
  const amount = drape.finish === 'polished' ? .24 : .12;
  for (const [stop, shift] of [[0,-amount],[.25,amount*.4],[.39,-amount*.5],[.55,amount],[.7,-amount*.3],[1,amount*.5]]) {
    gradient.addColorStop(stop, fitColor(Math.max(.08,Math.min(.98,l+shift)),c,h).hex);
  }
  return gradient;
}
function drawPanel(canvas, drape) {
  const ctx = canvas.getContext('2d'); ctx.setTransform(2,0,0,2,0,0); ctx.clearRect(0,0,480,600);
  // Surface colors are study content; interface theme colors never tint them.
  ctx.fillStyle = '#D4D1CC'; ctx.fillRect(0,0,480,600);
  ctx.fillStyle = drape.finish === 'matte' ? drape.hex : metallicFill(ctx,drape);
  ctx.beginPath(); ctx.moveTo(0,352); ctx.quadraticCurveTo(240,267,480,352); ctx.lineTo(480,600); ctx.lineTo(0,600); ctx.closePath(); ctx.fill();
  // Fixed, quiet folds are confined to the cloth, below the portrait window.
  ctx.save(); ctx.strokeStyle = '#FFFFFF18'; ctx.lineWidth = 1;
  for (let y = 438; y < 600; y += 65) { ctx.beginPath(); ctx.moveTo(0,y); ctx.quadraticCurveTo(235,y-50,480,y+15); ctx.stroke(); } ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.ellipse(240,216,140,185,0,0,Math.PI*2); ctx.clip();
  // The same neutral backing also protects transparent portrait pixels.
  ctx.fillStyle = '#D4D1CC'; ctx.fillRect(100,31,280,370); capture?.draw(ctx); ctx.restore();
  ctx.strokeStyle = '#65615B'; ctx.lineWidth = .7; ctx.beginPath(); ctx.ellipse(240,216,140,185,0,0,Math.PI*2); ctx.stroke();
}
function paint() {
  const pair = practice?.drapes ?? displayPair;
  drawPanel(panels[0],resting ? REST_DRAPE : pair[active]); drawPanel(panels[1],resting ? REST_DRAPE : pair[1-active]);
  $('caption-current').textContent = resting ? REST_DRAPE.name : pair[active].name;
  $('caption-other').textContent = resting ? REST_DRAPE.name : pair[1-active].name;
  $('drape-letter').textContent = stage === 0 || resting ? '—' : active === 0 ? 'A' : 'B';
  $('other-letter').textContent = active === 0 ? 'B' : 'A';
  $('finish-current').textContent = !resting && pair[active].finish !== 'matte' ? 'Metallic preview' : '';
  $('name-a').textContent = pair[0].name; $('name-b').textContent = pair[1].name;
  $('show-a').setAttribute('aria-pressed',String(active === 0 && !resting)); $('show-b').setAttribute('aria-pressed',String(active === 1 && !resting));
  $('rest').setAttribute('aria-pressed',String(resting));
}
function observations() {
  const q = current(), ready = canAssess() && seen.size === 2 && !practice && !resting;
  document.querySelectorAll('[data-answer]').forEach(button => {
    button.disabled = !ready;
    button.setAttribute('aria-pressed',String(q && answers[q.id] === button.dataset.answer));
    if (['a','b'].includes(button.dataset.answer)) button.textContent = q?.axis === 'finish' ? `I’d choose ${button.dataset.answer.toUpperCase()}` : `${button.dataset.answer.toUpperCase()} looks clearer`;
  });
  $('next').disabled = !ready || !q || !Object.hasOwn(answers,q.id);
  $('answer-hint').textContent = practice ? 'Practice only. Return to the closer comparison to record an observation.' : !canAssess() ? 'Add a photo or freeze a camera frame to compare.' : resting ? 'Return to A or B when your eye is ready.' : seen.size < 2 ? 'See both drapes, then record what you notice.' : 'You’ve seen both. What do you notice in your face?';
}
function stepView() {
  $('steps').replaceChildren(...STAGES.map((name,i) => {
    const li = document.createElement('li'); if (i === stage) li.setAttribute('aria-current','step');
    li.setAttribute('aria-label',`${i+1}. ${name}${i === stage ? ', current step' : ''}`);
    const n = document.createElement('span'); n.className = 'step-number'; n.textContent = i+1; n.setAttribute('aria-hidden','true');
    const label = document.createElement('span'); label.className = 'step-name'; label.textContent = name;
    li.append(n,label); return li;
  }));
}
function renderQuestion() {
  const q = current(); if (!q) return;
  displayPair = q.drapes; resultPreview = null;
  $('question-stage').textContent = `${STAGES[stage]} · ${index+1} of ${questionsFor(stage,answers).length}${q.subtle ? ' · closer comparison' : ''}`;
  $('question-title').textContent = q.title; $('question-prompt').textContent = q.prompt; $('question-guide').textContent = q.guide;
  $('mirror-context').textContent = q.purpose;
  $('stronger').hidden = !q.subtle;
  const selected = answers[q.id];
  $('observation-status').textContent = selected ? ({ a:'You recorded clearer framing with A.', b:'You recorded clearer framing with B.', both:'You recorded that both work. This leaves the direction open.', unsure:'You left this comparison open. The session will preserve that uncertainty.' }[selected]) : '';
  $('next').textContent = stage === 5 && index === questionsFor(5,answers).length-1 ? 'See my direction' : 'Continue';
  const p = profile(answers);
  $('branch-note').textContent = stage === 3 ? `Flow explores smaller differences within a working seasonal family. ${p.leader ? `Your observations currently point toward ${p.leader.name}.` : 'Your home season is still open; these comparisons are exploratory.'}` : stage === 5 ? 'These finishing touches help you explore colors and metals. They do not change the season suggestion.' : '';
  paint(); observations();
}
function render(focus = false) {
  $('main').classList.toggle('in-session',stage > 0); stepView();
  $('prepare').hidden = stage !== 0; $('question').hidden = stage === 0 || stage === 6; $('results').hidden = stage !== 6;
  $('drape-switch').hidden = stage === 0; $('view-tools').hidden = stage === 0;
  $('practice-tag').hidden = !practice; $('exit-practice').hidden = !practice;
  if (stage === 0) { displayPair = [REST_DRAPE,REST_DRAPE]; $('mirror-context').textContent = 'Your starting portrait'; paint(); }
  else if (stage === 6) renderResults();
  else renderQuestion();
  if (focus) (stage === 6 ? $('result-title') : stage > 0 ? $('question-title') : $('begin')).focus({preventScroll:true});
}
function resetSession() {
  stage = 0; index = 0; answers = {}; active = 0; seen = new Set([0]); practice = null; resting = false; resultPreview = null;
  $('guidance').hidden = true; $('help').setAttribute('aria-expanded','false');
  $('source-tools').open = true; render();
}
function go(stageNumber, questionIndex = 0) {
  stage = stageNumber; index = questionIndex; active = 0; seen = new Set(comparing ? [0,1] : [0]); practice = null; resting = false;
  $('guidance').hidden = true; $('help').setAttribute('aria-expanded','false'); $('source-tools').open = false;
  render(true);
  $('steps').scrollIntoView({block:'start',behavior:'instant'});
}
function evidenceLine(label,evidence,positive,negative) {
  const p = document.createElement('p');
  const undecided = 4-evidence.total;
  p.textContent = `${label}: ${positive} ${evidence.positive} · ${negative} ${evidence.negative} · undecided ${undecided}.`;
  return p;
}
function renderResults() {
  const p = profile(answers), demo = capture?.mode === 'demo';
  $('result-kicker').textContent = demo ? 'PRACTICE RESULT · ILLUSTRATION' : 'YOUR WORKING DIRECTION';
  $('result-title').textContent = p.label;
  $('result-description').textContent = demo ? 'This result describes your choices for the illustration, not your own coloring. Try a personal portrait for your session.' : p.leader ? `Your recorded comparisons point toward ${p.label}. This is an exploratory suggestion from your observations, ready to check with real fabric.` : 'Your observations do not yet distinguish a season consistently. Keep the possibilities open, review a comparison, or try another portrait in more even light.';
  $('evidence').replaceChildren(evidenceLine('Undertone',p.temperature,'warm','cool'),evidenceLine('Intensity',p.intensity,'bright','soft'));
  if (p.mixed) { const note=document.createElement('p'); note.textContent='Some comparisons pointed in different directions. Treat this as a starting point and revisit the differences.'; $('evidence').append(note); }
  $('flow-description').textContent = !p.leader ? 'Flow remains open while the home season is unresolved.' : p.flow ? `The closer comparisons suggest ${p.flow.kind === 'balanced' ? 'a balanced expression of this season' : `the ${p.flow.label.split(' ')[0].toLowerCase()} direction within this family`}. This prototype has not been validated against professional analysis.` : 'The closer comparisons did not single out one flow. We can suggest the home season without forcing a subtype.';
  $('palette-family').value = p.leader?.id ?? p.candidates[0].id;
  $('review-list').replaceChildren();
  for (const q of allQuestions(answers).filter(q => q.axis !== 'finish')) {
    const li=document.createElement('li');
    const choice=answers[q.id], description = choice === 'a' || choice === 'b' ? q.drapes[choice === 'a' ? 0:1].name : choice === 'both' ? 'both work' : 'undecided';
    const button=document.createElement('button'); button.type='button'; button.className='text-button'; button.textContent=`${q.title} — ${description}`;
    button.addEventListener('click',() => { for(let s=1;s<=4;s++){ const i=questionsFor(s,answers).findIndex(item=>item.id===q.id); if(i>=0){go(s,i);break;} } });
    li.append(button); $('review-list').append(li);
  }
  renderWardrobe();
  if (!resultPreview) { displayPair=[REST_DRAPE,REST_DRAPE]; $('mirror-context').textContent='Explore your finishing colors'; }
  paint();
}
function renderWardrobe() {
  const family=$('palette-family').value, p=profile(answers);
  const swatches=wardrobePalette(family,p.leader?.id === family ? p.flow?.kind : null);
  $('wardrobe-note').textContent=`Original ${HOMES[family].name} exploration colors. Tap one to try it; “Save this color” adds it to your personal collection.`;
  $('wardrobe').replaceChildren(...swatches.map(drape => {
    const button=document.createElement('button'); button.type='button'; button.setAttribute('aria-label','Try '+drape.name);
    const swatch=document.createElement('span'); swatch.style.backgroundColor=drape.hex; swatch.setAttribute('aria-hidden','true');
    const label=document.createElement('span'); label.textContent=drape.name; button.append(swatch,label);
    button.addEventListener('click',()=>{ resultPreview=drape; displayPair=[drape,REST_DRAPE]; active=0; resting=false; $('mirror-context').textContent='Wardrobe exploration · '+HOMES[family].name; paint(); }); return button;
  }));
}
function paletteView() {
  $('palette-count').textContent=palette.length; $('download-palette').disabled=palette.length===0;
  $('palette').replaceChildren(...palette.map((hex,i)=>{
    const chip=document.createElement('div'); chip.className='palette-chip';
    const color=document.createElement('span'); color.className='chip-color'; color.style.backgroundColor=hex;
    const known=[...allQuestions(answers).flatMap(q=>q.drapes),...Object.keys(HOMES).flatMap(h=>wardrobePalette(h))].find(d=>d.hex===hex);
    const label=document.createElement('p'); label.textContent=known?.name ?? `Saved color ${i+1}`;
    const actions=document.createElement('div'); actions.className='chip-actions';
    const remove=document.createElement('button'); remove.type='button'; remove.className='quiet'; remove.textContent='Remove'; remove.setAttribute('aria-label','Remove '+label.textContent);
    remove.addEventListener('click',()=>{ palette=palette.filter(c=>c!==hex); persist(); paletteView(); $('download-palette').focus(); });
    actions.append(remove); chip.append(color,label,actions); return chip;
  }));
}
function persist() {
  if(storageAvailable) try {localStorage.setItem(PALETTE_KEY,JSON.stringify(palette));} catch(_){storageAvailable=false;}
  $('palette-status').textContent=storageAvailable ? 'Color saved in this browser. No portrait or session observations are stored.' : 'Browser storage is unavailable. Download your colors to keep them after this session.';
}
function saveShown() {
  const drape=resting ? REST_DRAPE : (practice?.drapes ?? displayPair)[active];
  if(palette.includes(drape.hex)){ $('palette-status').textContent='That color is already saved.'; return; }
  if(palette.length>=20){ $('palette-status').textContent='Your collection has 20 colors. Remove one before adding another.'; $('saved').open=true; return; }
  palette.push(drape.hex); persist(); paletteView();
  $('mirror-note').textContent=`${drape.name} saved. Open Saved colors below to download or remove it.`;
}
function download(blob,filename) {
  if(!blob){status('The download could not be created. Try again.');return;}
  const url=URL.createObjectURL(blob), a=document.createElement('a'); a.href=url; a.download=filename;
  document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),30000);
}
capture=createPortrait($('camera'),{
  onFrame:paint,
  onTracking:message=>{ $('tracking-status').textContent=message; },
  onStatus:status,
  onState(state,reason){
    if(reason==='source'||reason==='clear') resetSession();
    $('source-tag').textContent=sources[state.mode];
    $('freeze').hidden=state.mode!=='camera'; $('clear').hidden=!state.waiting&&(state.mode==='demo'||state.mode==='empty'); $('clear').textContent=state.waiting?'Cancel camera':'Clear portrait'; $('use-sample').hidden=state.mode==='demo';
    $('freeze').disabled=!state.canFreeze; $('clear').disabled=state.mode==='empty'&&!state.waiting;
    $('start-camera').disabled=state.mode==='camera'||Boolean(state.waiting);
    $('auto-frame').disabled=state.mode==='empty'||state.mode==='demo';
    $('download-comparison').disabled=!state.ready||state.mode==='camera';
    $('begin').disabled=!state.ready||Boolean(state.waiting)||(state.mode==='camera'&&!state.canFreeze);
    $('begin').textContent=state.mode==='demo'?'Begin with illustration':state.mode==='camera'?'Freeze & begin':'Begin my session';
    for(const [id,key,factor] of [['frame-x','x',100],['frame-y','y',100],['frame-scale','zoom',100]]) $(id).value=state.frame[key]*factor;
    if(stage>0&&stage<6) observations();
  }
});
$('start-camera').addEventListener('click',()=>capture.startCamera()); $('freeze').addEventListener('click',()=>capture.freeze());
$('clear').addEventListener('click',()=>{ $('photo').value='';capture.clear(); });
$('use-sample').addEventListener('click',()=>capture.sample());
$('photo').addEventListener('change',event=>{ const file=event.target.files[0]; event.target.value=''; capture.choosePhoto(file); });
$('auto-frame').addEventListener('click',()=>capture.autoFrame());
for(const id of ['frame-x','frame-y','frame-scale']) $(id).addEventListener('input',()=>capture.setFrame({x:Number($('frame-x').value)/100,y:Number($('frame-y').value)/100,zoom:Number($('frame-scale').value)/100}));
$('begin').addEventListener('click',()=>{ if(capture.mode==='camera') capture.freeze(); if(canAssess())go(1); });
for(const [i,id] of ['show-a','show-b'].entries()) $(id).addEventListener('click',()=>{active=i;resting=false;seen.add(i);paint();observations();});
$('rest').addEventListener('click',()=>{resting=!resting;paint();observations();});
$('compare-view').addEventListener('click',()=>{
  comparing=!comparing; $('second-view').hidden=!comparing; $('portrait-pair').classList.toggle('comparing',comparing);
  $('compare-view').setAttribute('aria-pressed',String(comparing)); $('compare-view').textContent=comparing?'One mirror':'Side by side';
  if(comparing)seen=new Set([0,1]);paint();observations();
});
$('help').addEventListener('click',()=>{ const open=$('guidance').hidden; $('guidance').hidden=!open; $('help').setAttribute('aria-expanded',String(open)); });
$('stronger').addEventListener('click',()=>{
  const q=current();
  practice=q.id.includes('depth')?{drapes:[{...REST_DRAPE,name:'Deep blue-green',hex:fitColor(.32,.05,195).hex},{...REST_DRAPE,name:'Light blue-green',hex:fitColor(.84,.05,195).hex}]}:questionsFor(q.axis==='temperature'||q.id.includes('temperature')?1:2,answers)[0];
  active=0;resting=false; $('practice-tag').hidden=false; $('exit-practice').hidden=false; paint();observations();
});
$('exit-practice').addEventListener('click',()=>{practice=null;active=0;seen=new Set(comparing?[0,1]:[0]);$('practice-tag').hidden=true;$('exit-practice').hidden=true;paint();observations();});
document.querySelectorAll('[data-answer]').forEach(button=>button.addEventListener('click',()=>{answers=recordAnswer(answers,current().id,button.dataset.answer);renderQuestion();}));
$('next').addEventListener('click',()=>{ if($('next').disabled)return; if(index+1<questionsFor(stage,answers).length)go(stage,index+1);else go(stage+1); });
$('back').addEventListener('click',()=>{if(index>0)go(stage,index-1);else if(stage>1)go(stage-1,questionsFor(stage-1,answers).length-1);else{stage=0;render();$('source-tools').open=true;}});
$('restart').addEventListener('click',()=>{resetSession();$('begin').focus();});
$('palette-family').addEventListener('change',()=>{resultPreview=null;displayPair=[REST_DRAPE,REST_DRAPE];active=0;resting=false;$('mirror-context').textContent='Wardrobe exploration · '+HOMES[$('palette-family').value].name;renderWardrobe();paint();});
$('save-shown').addEventListener('click',saveShown);
$('download-palette').addEventListener('click',()=>download(new Blob([JSON.stringify({format:'draping-mirror-palette',version:1,colors:palette},null,2)],{type:'application/json'}),'draping-mirror-palette.json'));
$('download-comparison').addEventListener('click',()=>{
  if(!canAssess())return;
  const pair=practice?.drapes??displayPair, canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1320;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#151518';ctx.fillRect(0,0,1920,1320);
  const a=document.createElement('canvas'),b=document.createElement('canvas');a.width=b.width=960;a.height=b.height=1200;
  drawPanel(a,pair[0]);drawPanel(b,pair[1]);ctx.drawImage(a,0,0);ctx.drawImage(b,960,0);
  ctx.fillStyle='#F3F1EC';ctx.font='26px system-ui';ctx.fillText('A · '+pair[0].name,30,1245);ctx.fillText('B · '+pair[1].name,990,1245);
  ctx.fillStyle='#CFCCD5';ctx.font='22px system-ui';ctx.fillText('Draping mirror · '+(capture.mode==='demo'?'Illustrated practice':'Same portrait in both views')+' · Virtual drapes',30,1290);
  canvas.toBlob(blob=>{download(blob,'draping-mirror-comparison.png');canvas.width=canvas.height=a.width=a.height=b.width=b.height=0;},'image/png');
});
try{palette=readPalette(localStorage.getItem(PALETTE_KEY));}catch(_){try{localStorage.getItem(PALETTE_KEY);$('palette-status').textContent='The saved colors could not be read. You can start a new collection.';}catch(_){storageAvailable=false;$('palette-status').textContent='Browser storage is unavailable. Download your colors to keep them.';}}
paletteView();render();capture.sample();
