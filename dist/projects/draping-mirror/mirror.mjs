import { PALETTE_KEY, readPalette, fitColor } from './drapes.mjs';
import { toOKLCH } from './color.mjs';
import { STAGES, QUESTION_STAGES, HOMES, REST_DRAPE, questionsFor, allQuestions, recordAnswer, profile, wardrobePalette, FLOW_KINDS, flowOptions, refinementLabel, HUE_FAMILIES, seasonColorVariants } from './session.mjs';
import { emptyComparison, chooseCandidate, showPinned, pinVisible, comparisonPurpose } from './comparison.mjs';
import { createPortrait } from './portrait.mjs';
import { mirrorLayout } from './mirror-layout.mjs';
import { attachFraming } from './framing.mjs';
import { createContrast } from './contrast.mjs';
import { createFlagPicker } from './flags.mjs';
import { createPreferences } from './preferences.mjs';
import { paletteGraphic, renderReport } from './report.mjs';
import { DEFAULT_SETTINGS, SEASONS, SURROUNDS, analysisFile, buildReport, describeColor, parseAnalysis, retainComparison, savedPair, seasonalFlag } from './study.mjs';

const $ = id => document.getElementById(id);
const PRIMARY = 7, RESULTS = 6;
const PROGRESS = [0, 1, 2, 4, PRIMARY, 3, 5, RESULTS];
const primaryFlags = SEASONS.map(season => seasonalFlag(season));
let stage = 0, index = 0, answers = {}, active = 0, resting = false, comparing = false, practice = null;
let seen = new Set([0]), palette = [], storageAvailable = true, capture;
let displayPair = [REST_DRAPE, REST_DRAPE];
let primary = null, flagPreview = primaryFlags[0], modalFlag = flagPreview, flagsSeen = new Set();
let practiceSession = false, savedComparisons = [], sessionColors = [], notes = '', reading = null;
let welcome = true, loadedAnalysis = false, reattaching = false, importRevision = 0;
let cue = false, target = false, region = 'cheek', preferences;
let exploreDrape = REST_DRAPE, pinned = emptyComparison(), collectionGroup = 'colors', hueFamily = 'reds', refinements = {}, viewerMode = 'session', seasonMode = null;
const closeDialog = id => { if ($(id).open) $(id).close(); };
const panels = [$('portrait-a'), $('portrait-b')];
const setText = (id, value) => { if ($(id).textContent !== value) $(id).textContent = value; };
const status = message => setText('source-status', message);
const questions = step => questionsFor(step, answers, primary);
const current = () => questions(stage)[index];
const settings = () => preferences?.() ?? DEFAULT_SETTINGS;
const canAssess = () => capture && capture.mode !== 'empty' && capture.mode !== 'camera';
const sources = { empty: 'No portrait', demo: 'Sample portrait', photo: 'Your photo · session only', camera: 'Live camera', frozen: 'Frozen frame · camera off' };

function metalStops(drape) {
  const { lightness: l, chroma: c, hue: h } = toOKLCH(drape.hex);
  const amount = drape.finish === 'polished' ? .24 : .12;
  return [[0,-amount],[.25,amount*.4],[.39,-amount*.5],[.55,amount],[.7,-amount*.3],[1,amount*.5]].map(([stop,shift]) =>
    [stop,fitColor(Math.max(.08,Math.min(.98,l+shift)),c,h).hex]);
}
function swatchFill(drape) {
  return drape.finish === 'matte' ? drape.hex : `linear-gradient(130deg,${metalStops(drape).map(([stop,hex])=>`${hex} ${stop*100}%`).join(',')})`;
}
function metallicFill(ctx, drape, width, height, scale) {
  const gradient = ctx.createLinearGradient(0, 250 * scale, width, height - 30 * scale);
  for (const [stop,hex] of metalStops(drape)) gradient.addColorStop(stop,hex);
  return gradient;
}
function panelFrame(canvas, fallback) {
  const rect = canvas.getBoundingClientRect(), style = getComputedStyle(canvas);
  const width = rect.width - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth);
  const height = rect.height - parseFloat(style.borderTopWidth) - parseFloat(style.borderBottomWidth);
  return width > 0 && height > 0 ? { width, height } : fallback;
}
function drawPanel(canvas, drape, frame = panelFrame(canvas)) {
  if (!frame) return;
  const { width, height, scale, left, pixelWidth, pixelHeight, portrait } = mirrorLayout(frame.width, frame.height);
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  const ctx = canvas.getContext('2d'); ctx.setTransform(pixelWidth/width,0,0,pixelHeight/height,0,0);
  // Numeric bounds let pixel checks follow the portrait after a frame resize.
  canvas.dataset.portraitBounds = JSON.stringify({x:portrait.x*pixelWidth/width,y:portrait.y*pixelHeight/height,width:portrait.width*pixelWidth/width,height:portrait.height*pixelHeight/height});
  const surround = SURROUNDS[settings().surround];
  ctx.fillStyle = surround; ctx.fillRect(0,0,width,height);
  ctx.save(); ctx.beginPath(); ctx.moveTo(0,410*scale); ctx.quadraticCurveTo(width/2,330*scale,width,410*scale); ctx.lineTo(width,height); ctx.lineTo(0,height); ctx.closePath(); ctx.clip();
  if (drape.rows) {
    const start = 369 * scale, rowHeight = (height - start) / drape.rows.length;
    drape.rows.forEach((row, y) => row.forEach((swatch, x) => {
      ctx.fillStyle = swatch.hex;
      ctx.fillRect(x * width / row.length, start + y * rowHeight, width / row.length + .4, rowHeight + .4);
    }));
  } else {
    ctx.fillStyle = drape.finish === 'matte' ? drape.hex : metallicFill(ctx,drape,width,height,scale);
    ctx.fillRect(0,0,width,height);
  }
  // Fixed, quiet folds are confined to the cloth, below the portrait window.
  ctx.save(); ctx.strokeStyle = '#FFFFFF18'; ctx.lineWidth = scale;
  for (let y = 438*scale; y < height; y += 65*scale) { ctx.beginPath(); ctx.moveTo(0,y); ctx.quadraticCurveTo(width/2,y-50*scale,width,y+15*scale); ctx.stroke(); } ctx.restore();
  ctx.restore();
  ctx.save(); ctx.translate(left,0); ctx.scale(scale,scale);
  ctx.save(); ctx.beginPath(); ctx.ellipse(240,248,180,238,0,0,Math.PI*2); ctx.clip();
  // The same neutral backing also protects transparent portrait pixels.
  ctx.fillStyle = surround; ctx.fillRect(60,10,360,476); ctx.translate(60-100*360/280,10-31*360/280); ctx.scale(360/280,360/280); capture?.draw(ctx); ctx.restore();
  ctx.strokeStyle = '#65615B'; ctx.lineWidth = .7; ctx.beginPath(); ctx.ellipse(240,248,180,238,0,0,Math.PI*2); ctx.stroke();
  ctx.restore();
}
function paint() {
  const pair = practice?.drapes ?? displayPair;
  const shown = resting ? REST_DRAPE : pair[active];
  setText('caption-current', shown.name);
  setText('caption-other', resting ? REST_DRAPE.name : pair[1-active].name);
  setText('drape-letter', !current() || resting ? '—' : active === 0 ? 'A' : 'B');
  setText('other-letter', active === 0 ? 'B' : 'A');
  setText('finish-current', !resting && shown.finish && shown.finish !== 'matte' ? 'Metallic preview' : '');
  if (current()) {
    setText('name-a', pair[0].name); setText('name-b', pair[1].name);
    $('show-a').style.setProperty('--swatch',swatchFill(pair[0])); $('show-b').style.setProperty('--swatch',swatchFill(pair[1]));
  }
  $('show-a').setAttribute('aria-pressed',String(active === 0 && !resting)); $('show-b').setAttribute('aria-pressed',String(active === 1 && !resting));
  $('rest').setAttribute('aria-pressed',String(resting));
  const description = shown.hex && describeColor(shown.hex, settings().colorAccess);
  $('color-description').hidden = !current() || !description;
  if (description) setText('color-description', shown.name + ' · ' + description);
  setText('active-drape', current() && !description ? shown.name + (resting ? '' : active === 0 ? ' · A' : ' · B') : '');
  // Labels can change the available frame height on small screens.
  const frame = panelFrame(panels[0]);
  drawPanel(panels[0],shown,frame); drawPanel(panels[1],resting ? REST_DRAPE : pair[1-active],panelFrame(panels[1],frame));
  paintTarget();
  if ($('flag-studio').open) drawPanel($('portrait-flags'), modalFlag);
  if($('palette-explorer').open) paintExplorer();
  if($('mirror-viewer').open) paintViewer();
}
function observations() {
  const q = current(), ready = canAssess() && seen.size === 2 && !practice && !resting;
  document.querySelectorAll('[data-answer]').forEach(button => {
    button.disabled = !ready;
    button.setAttribute('aria-pressed',String(q && answers[q.id] === button.dataset.answer));
    if (['a','b'].includes(button.dataset.answer)) button.textContent = q?.axis === 'finish' ? `I’d choose ${button.dataset.answer.toUpperCase()}` : `${button.dataset.answer.toUpperCase()} looks clearer`;
  });
  $('decide').disabled=!ready; $('save-session-pair').disabled=!ready;
  $('decide').textContent=practice ? 'Practice · return to compare' : ready ? 'Choose what works →' : resting ? 'Return to a drape' : 'See both drapes first';
  $('next').disabled = !ready || !q || !Object.hasOwn(answers,q.id);
  $('answer-hint').textContent = practice ? 'Practice only. Return to the closer comparison to record an observation.' : !canAssess() ? 'Add a photo or freeze a frame to compare.' : resting ? 'Return to A or B when your eye is ready.' : seen.size < 2 ? 'Tap A and B to compare, then choose.' : 'Which drape supports your face?';
}
function stepView() {
  const visible = PROGRESS.filter(step => step !== 3 || primary || stage === PRIMARY || stage < 3 || stage === 4);
  $('steps').replaceChildren(...visible.map((step,i) => {
    const li = document.createElement('li');
    if (step === stage) li.setAttribute('aria-current', 'step');
    const n = document.createElement('span');
    n.className = 'step-number'; n.textContent = i+1; n.setAttribute('aria-hidden','true');
    const label = document.createElement('span');
    label.className = 'step-name'; label.textContent = STAGES[step];
    li.append(n,label); return li;
  }));
}
const cueText = {
  cheek: 'Find the cheek just below the eye. Switch A and B and see whether the way you notice the shadow changes.',
  eyes: 'Find an eyelid or brow edge. Does your gaze come back to it when you switch drapes?',
  jaw: 'Trace the edge from the jaw to the chin. Does one surround make that edge easier for you to follow?'
};
function paintTarget() {
  const dot = $('face-target'), point = capture?.guide(region);
  const size = panels[0].dataset.portraitBounds;
  dot.hidden = !target || !cue || !current() || !point || !size || !Number.isFinite(point.x) ||
    !Number.isFinite(point.y) || Math.hypot((point.x - .5) * 2, (point.y - .5) * 2) > .98;
  if (dot.hidden) return;
  const bounds = JSON.parse(size);
  dot.style.left = (bounds.x + bounds.width * point.x) / panels[0].width * 100 + '%';
  dot.style.top = (bounds.y + bounds.height * point.y) / panels[0].height * 100 + '%';
  dot.dataset.target = region;
}
function renderCue() {
  $('guided-cue').hidden = !cue || !current();
  const available = target && capture?.guide(region);
  $('seek-tip').textContent = cueText[region] + ' Both drapes use the same image.' +
    (available ? ' The ring is an approximate location.' : '');
  document.querySelectorAll('[data-region]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.region === region)));
  paintTarget();
}
function renderQuestion() {
  const q = current(); if (!q) return;
  displayPair = q.drapes;
  $('question-stage').textContent = `${STAGES[stage]} · ${index+1} / ${questions(stage).length}`;
  $('question-title').textContent = stage === 3 ? q.title : q.axis==='temperature' ? 'Compare temperature' : q.axis==='intensity' ? 'Compare intensity' : q.title;
  $('question-prompt').textContent = q.prompt; $('question-guide').textContent = q.guide;
  $('mirror-context').textContent = q.purpose;
  $('stronger').hidden = !q.subtle;
  const selected = answers[q.id];
  $('observation-status').textContent = selected ? ({ a:'You kept A as your preference.', b:'You kept B as your preference.', both:'You recorded that both work.', unsure:'You left this comparison open.' }[selected]) : '';
  $('next').textContent = index < questions(stage).length - 1 ? 'Continue' : stage === 5 ? 'See my results' : stage === 4 ? 'Compare primary seasons' : 'Continue';
  $('branch-note').textContent = stage === 3 ? `These are smaller differences within ${HOMES[primary].name}, the season you chose to explore.` :
    stage === 5 ? 'These choices give you neutrals and metallic previews to try in person.' : '';
  observations(); renderCue(); paint();
}
function setComparisonView(on) {
  comparing = on;
  const paired = on && Boolean(current());
  $('second-view').hidden = !paired;
  $('portrait-pair').classList.toggle('comparing', paired);
  $('compare-view').setAttribute('aria-pressed', String(paired));
  $('compare-view').textContent = paired ? 'One mirror' : 'Side by side';
  if (paired) seen = new Set([0, 1]);
}
function renderPrimary() {
  const suggestion = profile(answers, null).leader;
  $('primary-evidence').textContent = suggestion ? 'Your observations point toward ' + suggestion.name +
    '. Compare the four flags to choose a season to refine.' : 'Your observations leave more than one season open. Compare the four flags.';
  setText('primary-skip', suggestion ? 'Leave refinement open' : 'Keep my season open');
  primaryPicker.show(primaryFlags, 'flag-' + (primary ?? suggestion?.id ?? 'spring') + '-home');
}
function render(focus = false) {
  const question = Boolean(current());
  $('welcome').hidden = !welcome;
  $('workbench').hidden = welcome;
  document.body.classList.toggle('is-preparing', stage === 0 && !welcome);
  document.body.classList.toggle('is-comparing', question && !welcome);
  document.body.classList.toggle('is-primary', stage === PRIMARY && !welcome);
  document.body.classList.toggle('is-results', stage === RESULTS && !welcome);
  $('prepare').hidden = stage !== 0; $('question').hidden = !question;
  $('primary').hidden = stage !== PRIMARY; $('results').hidden = stage !== RESULTS;
  $('drape-switch').hidden = !question; $('view-tools').hidden = !question;
  $('save-session-pair').disabled = !question || Boolean(practice);
  $('download-comparison').disabled = !canAssess() || !question;
  $('practice-tag').hidden = !practice; $('exit-practice').hidden = !practice;
  $('focus-mirror').disabled = !canAssess() && capture?.mode !== 'camera';
  setComparisonView(comparing);
  stepView(); syncFraming();
  if (!welcome) {
    if (stage === 0) { displayPair = [REST_DRAPE, REST_DRAPE]; paint(); }
    else if (stage === RESULTS) renderResults();
    else if (stage === PRIMARY) renderPrimary();
    else renderQuestion();
  }
  if (focus) {
    const id = welcome ? 'welcome-title' : stage === 0 ? 'prepare-title' : stage === PRIMARY ? 'primary-title' : stage === RESULTS ? 'result-title' : 'question-title';
    window.scrollTo(0, 0);
    $(id).focus({ preventScroll: true });
  }
}
function closeSessionDialogs() {
  for (const id of ['mirror-viewer', 'collection-settings', 'flag-studio', 'contrast', 'palette-explorer', 'guidance', 'session-tools', 'response-sheet']) closeDialog(id);
}
function resetSession() {
  stage=0; index=0; answers={}; primary=null; flagsSeen=new Set(); active=0; seen=new Set([0]); practice=null; resting=false;
  savedComparisons=[]; sessionColors=[]; reading=null; notes=''; $('session-notes').value=''; loadedAnalysis=false; reattaching=false;
  closeSessionDialogs(); setText('mirror-note',''); setText('report-status','');
  seasonMode=null; pinned=emptyComparison(); exploreDrape=REST_DRAPE; setText('explore-status','');
  $('source-tools').open = true; $('framing').open = false;
  $('palette-family').value = SEASONS[0]; refinements = {}; renderFlows();
  render();
}
function go(stageNumber, questionIndex = 0) {
  welcome=false; stage=stageNumber; index=questionIndex; active=0; seen=new Set([0]); practice=null; resting=false;
  cue = settings().guidance !== 'independent';
  target = settings().guidance === 'assisted';
  region = current()?.axis === 'intensity' ? 'eyes' : current()?.axis === 'finish' ? 'jaw' : 'cheek';
  closeSessionDialogs(); $('source-tools').open = stageNumber === 0;
  if (stageNumber !== 0) { $('framing').open = false; capture.lockFraming(); }
  render(true);
}
function nextQuestion() {
  if (index+1 < questions(stage).length) { go(stage, index+1); return; }
  if (stage === 4) { go(PRIMARY); return; }
  if (stage === 5) { prepareResults(); return; }
  go(stage === 1 ? 2 : stage === 2 ? 4 : 5);
}
function previousQuestion() {
  if (index > 0) { go(stage,index-1); return; }
  if (stage === 3 || (stage === 5 && !primary)) { go(PRIMARY); return; }
  const previous = ({ 1:0, 2:1, 4:2, 5:3, [PRIMARY]:4 })[stage];
  go(previous, Math.max(0, questions(previous).length-1));
}
function sessionData() {
  return analysisFile({ answers, primary, practice: practiceSession, colors: sessionColors, comparisons: savedComparisons, notes, contrast: reading, flagsSeen: [...flagsSeen] });
}
function resultCopy(report) {
  const { result } = report;
  if (report.practice) return 'Your choices were made using the sample portrait. Use a personal portrait to explore your own coloring.';
  if (primary && result.leader?.id !== primary) {
    return 'You chose ' + HOMES[primary].name + ' to explore. ' +
      (result.leader ? 'Your recorded drapes point toward ' + result.leader.name + '.' : 'Your recorded drapes leave the primary season open.');
  }
  if (!result.leader) return 'Your recorded comparisons leave the season open. Review the pairs or compare more colors with real fabric.';
  if (!result.flow) return 'Your recorded comparisons point toward ' + result.leader.name + '. The sub-season remains open.';
  return 'Your recorded comparisons suggest ' + result.flow.label + ' as a starting point. Try the palette in real fabric.';
}
function renderResults() {
  const report = buildReport(sessionData()), { result: p, home } = report;
  setText('result-kicker', practiceSession ? 'Practice result · sample portrait' : 'Personal color analysis');
  setText('result-title', p.label); setText('result-description', resultCopy(report));
  const exploratoryFlow = primary && p.leader?.id !== primary && p.flow;
  $('result-flow').hidden = !exploratoryFlow;
  if (exploratoryFlow) setText('result-flow', 'Within ' + HOMES[primary].name + ', you preferred comparisons associated with ' + p.flow.label + '.');
  $('resume-analysis').hidden = !loadedAnalysis || canAssess();
  $('review').hidden = !canAssess();
  $('session-notes').value = notes;
  const lead = home ? seasonalFlag(home, p.flow?.kind).rows[0].filter((_, i) => i % 3 === 0) : [];
  $('result-colors').replaceChildren(...lead.map(drape => {
    const band = document.createElement('span'); band.style.backgroundColor = drape.hex; return band;
  }));
  $('result-colors').hidden = lead.length === 0;
  setText('mirror-context','Explore your finishing colors');
  renderReport($('report-details'), report, {
    openPair(pair) {
      pinned = { a: { ...pair.a, id: 'saved-a' }, b: { ...pair.b, id: 'saved-b' }, active: 'a', rest: false };
      seasonMode = null; setText('explore-status',''); openExplorer();
    },
    removePair(position) {
      savedComparisons.splice(position, 1); renderResults();
      ($('report-details').querySelector('.saved-pairs button') ?? $('report-json')).focus();
      setText('report-status', 'Comparison removed.');
    }
  });
  $('review-list').replaceChildren();
  for (const q of allQuestions(answers, primary).filter(q => answers[q.id])) {
    const li = document.createElement('li');
    const choice = answers[q.id];
    const description = choice === 'a' || choice === 'b' ? q.drapes[choice === 'a' ? 0 : 1].name : choice === 'both' ? 'both work' : 'undecided';
    const button = document.createElement('button');
    button.type='button'; button.className='text-button'; button.textContent=q.title + ' · ' + description;
    button.addEventListener('click', () => {
      const step = QUESTION_STAGES.find(value => questions(value).some(item => item.id === q.id));
      go(step, questions(step).findIndex(item => item.id === q.id));
    });
    li.append(button); $('review-list').append(li);
  }
}
function prepareResults() {
  const result = profile(answers, primary);
  refinements = {};
  $('palette-family').value = primary ?? result.leader?.id ?? result.candidates[0].id;
  renderFlows(result.flow?.kind);
  go(RESULTS);
}
function renderFlows(selected = 'home') {
  $('palette-flow').replaceChildren(...flowOptions($('palette-family').value).map(flow=>{
    const option=document.createElement('option'); option.value=flow.id; option.textContent=flow.id==='home' ? 'Full home range' : flow.label; return option;
  }));
  $('palette-flow').value=FLOW_KINDS.includes(selected) ? selected : 'home';
}
function drapeOrigin(d) {
  return d?.family ? flowOptions(d.family).find(f=>f.id===d.flow).label+(refinementLabel(d.adjustments)?' · '+refinementLabel(d.adjustments):'') : '';
}
function paintExplorer() {
  exploreDrape=pinned.rest ? REST_DRAPE : pinned[pinned.active] ?? REST_DRAPE;
  $('explore-caption').textContent=exploreDrape===REST_DRAPE ? 'Neutral cape' : `${pinned.active.toUpperCase()} · ${exploreDrape.name} · ${drapeOrigin(exploreDrape)}${exploreDrape.finish!=='matte'?' · metallic preview':''}`;
  for(const slot of ['a','b']) {
    const d=pinned[slot], button=$('explore-'+slot);
    button.disabled=!d;
    button.setAttribute('aria-pressed',String(!pinned.rest&&pinned.active===slot&&Boolean(d)));
    button.setAttribute('aria-label',d ? `${slot.toUpperCase()} · ${d.name} · ${drapeOrigin(d)}${slot==='a'?' · pinned reference':''}` : `${slot.toUpperCase()} · choose a drape`);
    button.querySelector('.pin-swatch').style.background=d?swatchFill(d):'transparent';
    const label=button.querySelector('.pin-label');label.replaceChildren(document.createTextNode(slot.toUpperCase()+' · '+(d?.name??'Choose a drape')+' '));
    const origin=document.createElement('small');origin.textContent=d?.family?flowOptions(d.family).find(f=>f.id===d.flow).label:slot==='a'?'First choice pins A':'New choices go here';label.append(origin);button.setAttribute('aria-label',label.textContent+(d&&slot==='a'?' · pinned reference':'')+(d&&refinementLabel(d.adjustments)?' · '+refinementLabel(d.adjustments):''));
  }
  $('pin-reference').disabled=pinned.rest||pinned.active!=='b'||!pinned.b;
  $('explore-save').disabled=exploreDrape===REST_DRAPE;
  $('save-explore-pair').disabled=!pinned.a||!pinned.b;
  refreshSeasonControls();
  $('explore-rest').setAttribute('aria-pressed',String(pinned.rest));
  const hasStatus=Boolean($('explore-status').textContent);
  const access = exploreDrape === REST_DRAPE ? '' : describeColor(exploreDrape.hex, settings().colorAccess);
  $('comparison-purpose').textContent=(pinned.rest ? 'Neutral rest · choose A or B to resume.' : comparisonPurpose(pinned.a,pinned.b)) + (access ? ' · ' + access : '');
  $('comparison-purpose').hidden=hasStatus; $('explore-status').hidden=!hasStatus;
  drawPanel($('portrait-explorer'),exploreDrape);
  if($('mirror-viewer').open)paintViewer();
  $('wardrobe').querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.drape===exploreDrape.id)));
}
function browsedDrapes() {
  return wardrobePalette($('palette-family').value,$('palette-flow').value,refinements).filter(d=>d.group===collectionGroup&&(collectionGroup!=='colors'||hueFamily==='all'||d.hueFamily===hueFamily));
}
function familyOptions() {
  const select=$('drape-family');
  const group=document.createElement('optgroup');group.label='Color families';
  for(const [value,label] of HUE_FAMILIES){const o=document.createElement('option');o.value=value;o.textContent=label;group.append(o);}
  const other=document.createElement('optgroup');other.label='Finishing drapes';
  for(const [value,label] of [['neutrals','Neutrals'],['metals','Metallics']]){const o=document.createElement('option');o.value=value;o.textContent=label;other.append(o);}
  select.replaceChildren(group,other);select.value=hueFamily;
}
function renderWardrobe() {
  const family=$('palette-family').value, flow=$('palette-flow').value;
  const swatches=browsedDrapes();
  $('wardrobe-note').textContent=swatches.length+' '+collectionGroup+' · swipe the rail to explore';
  const name=flowOptions(family).find(f=>f.id===flow)?.label ?? HOMES[family].name, extra=refinementLabel(refinements);
  $('collection-picker').replaceChildren(document.createTextNode(name+(extra?' · '+extra:'')));
  const hint=document.createElement('span');hint.textContent='Change season & flow ▾';$('collection-picker').append(hint);
  $('collection-summary').textContent=name+(extra?' · '+extra:' · original set');
  document.querySelectorAll('[data-adjust]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.value)===(refinements[b.dataset.adjust]??0))));
  $('drape-family').value=collectionGroup==='colors'?hueFamily:collectionGroup;
  $('wardrobe').replaceChildren(...swatches.map(drape => {
    const button=document.createElement('button'); button.type='button'; button.dataset.drape=drape.id; button.setAttribute('aria-label','Try '+drape.name); button.setAttribute('aria-pressed',String(drape.id===exploreDrape.id));
    const swatch=document.createElement('span'); swatch.style.background=swatchFill(drape); swatch.setAttribute('aria-hidden','true');
    const label=document.createElement('span'); label.textContent=drape.name; button.append(swatch,label);
    const description = describeColor(drape.hex, settings().colorAccess);
    if (description) {
      const small = document.createElement('small'); small.textContent = description; label.append(small);
      button.setAttribute('aria-label', 'Try ' + drape.name + ' · ' + description);
    }
    button.addEventListener('click',()=>selectExplorerDrape(drape)); return button;
  }));
  $('wardrobe').scrollTop=0; $('wardrobe').scrollLeft=0;
  refreshSeasonControls();
}
function selectExplorerDrape(drape) {
  seasonMode=null;
  pinned=chooseCandidate(pinned,drape); $('explore-status').textContent='';paintExplorer();
}
function refreshSeasonControls() {
  const available=!seasonMode&&exploreDrape?.group==='colors';
  $('season-start').hidden=!available;
  $('season-cycle').hidden=!seasonMode;
  if(seasonMode){
    const variant=seasonMode.variants[seasonMode.index];
    $('season-position').textContent=`${drapeOrigin(variant)} · ${seasonMode.index+1} of ${seasonMode.variants.length}`;
  }
}
function seasonStep(direction) {
  if(!seasonMode)return;
  const {variants,reference}=seasonMode;
  seasonMode.index=(seasonMode.index+direction+variants.length)%variants.length;
  const next=variants[seasonMode.index];
  pinned=next.id===reference.id
    ? {a:reference,b:null,active:'a',rest:false}
    : {a:reference,b:next,active:'b',rest:false};
  $('explore-status').textContent='';
  paintExplorer();
}
function startSeasonCycle() {
  const reference=exploreDrape, variants=seasonColorVariants(reference);
  if(variants.length<2)return;
  seasonMode={reference,variants,index:variants.findIndex(d=>d.id===reference.id)};
  if(seasonMode.index<0)seasonMode.index=0;
  pinned={a:reference,b:null,active:'a',rest:false};
  seasonStep(1);
}
function exitSeasonCycle() {
  if(!seasonMode)return;
  pinned={a:seasonMode.reference,b:null,active:'a',rest:false};
  seasonMode=null;
  $('explore-status').textContent='';
  paintExplorer();
}
function paintViewer() {
  const d=viewerMode==='explorer' ? exploreDrape : (resting?REST_DRAPE:(practice?.drapes??displayPair)[active]);
  drawPanel($('portrait-viewer'),d); $('viewer-caption').textContent=viewerMode==='explorer'&&d!==REST_DRAPE ? pinned.active.toUpperCase()+' · '+d.name+(seasonMode?' · '+drapeOrigin(d):'') : d.name;
  for(const id of ['viewer-previous','viewer-next']) $(id).disabled=viewerMode==='explorer' ? !seasonMode&&!(pinned.a&&pinned.b) : !current() && stage !== PRIMARY;
}
function openViewer(mode) { viewerMode=mode; $('mirror-viewer').showModal(); paintViewer(); }
function viewerStep(step) {
  if(viewerMode==='explorer') {
    if(seasonMode){seasonStep(step);return;}
    if(pinned.a&&pinned.b){pinned=showPinned(pinned,pinned.active==='a'?'b':'a');$('explore-status').textContent='';paintExplorer();}
  } else if (stage === PRIMARY) { primaryPicker.step(step); return; }
  else if (current()) { active=1-active; resting=false; seen.add(active);paint();observations(); }
  paintViewer();
}
function openExplorer() {
  if(capture.mode==='camera') capture.freeze();
  capture.lockFraming();
  renderWardrobe(); $('palette-explorer').showModal(); paintExplorer();
}
function paletteView() {
  $('palette-count').textContent=palette.length; $('download-palette').disabled=palette.length===0;
  $('palette').replaceChildren(...palette.map((hex,i)=>{
    const chip=document.createElement('div'); chip.className='palette-chip';
    const color=document.createElement('span'); color.className='chip-color'; color.style.backgroundColor=hex;
    const known=[...allQuestions(answers).flatMap(q=>q.drapes),...Object.keys(HOMES).flatMap(h=>FLOW_KINDS.flatMap(flow=>wardrobePalette(h,flow)))].find(d=>d.hex===hex);
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
function saveShown() { saveDrape(resting ? REST_DRAPE : (practice?.drapes ?? displayPair)[active]); }
function saveDrape(drape, target='mirror-note') {
  sessionColors=readPalette(JSON.stringify([...sessionColors,drape.hex]));
  if(palette.includes(drape.hex)){ $('palette-status').textContent='That color is already saved.'; $(target).textContent='That color is already in Saved colors.';if(target==='explore-status')paintExplorer();return; }
  if(palette.length>=64){ $('palette-status').textContent='Your collection has 64 colors. Remove one before adding another.'; $('saved').open=true; $(target).textContent='64 colors saved. Remove one in Tools to add another.';if(target==='explore-status')paintExplorer();return; }
  palette.push(drape.hex); persist(); paletteView();
  if(target==='explore-status') { $(target).textContent=storageAvailable ? `${drape.name} saved.` : 'Kept for this session. Download in Tools.';paintExplorer(); return; }
  $(target).textContent=storageAvailable ? `${drape.name} saved. Open Tools → Saved colors to download or remove it.` : `${drape.name} kept for this session. Browser storage is unavailable; download it from Saved colors to keep a copy.`;
}
function download(blob,filename) {
  if(!blob){status('The download could not be created. Try again.');return;}
  const url=URL.createObjectURL(blob), a=document.createElement('a'); a.href=url; a.download=filename;
  document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function syncFraming() {
  const active = stage === 0 && !welcome && $('source-tools').open && $('framing').open && capture?.mode !== 'empty';
  $('frame-surface').classList.toggle('is-framing', active);
  document.body.classList.toggle('framing-open', active);
  if (active) {
    panels[0].tabIndex = 0; panels[0].setAttribute('aria-describedby', 'framing-help');
  } else {
    panels[0].removeAttribute('tabindex'); panels[0].removeAttribute('aria-describedby');
    framing.clear();
  }
}
function imageBounds() {
  const rect = panels[0].getBoundingClientRect();
  const { x, y, width, height } = JSON.parse(panels[0].dataset.portraitBounds);
  return {
    left: rect.left + x / panels[0].width * rect.width, top: rect.top + y / panels[0].height * rect.height,
    width: width / panels[0].width * rect.width, height: height / panels[0].height * rect.height
  };
}
const framing = attachFraming($('frame-surface'), (...args) => capture.move(...args), imageBounds);

capture=createPortrait($('camera'),{
  onFrame:paint,
  onTracking:message=>setText('tracking-status',message),
  onStatus:status,
  onState(state,reason){
    if (reason==='source' || reason==='clear') {
      if (!reattaching || reason==='clear' || (state.mode==='demo') !== practiceSession) resetSession();
      practiceSession = state.mode === 'demo';
    }
    setText('source-tag', state.waiting ? 'Opening camera…' : sources[state.mode]);
    if(stage===0) setText('mirror-context', state.waiting ? 'Opening camera…' : state.mode==='camera' ? 'Live preview · freeze when ready' :
      state.mode==='demo' ? 'Sample portrait · practice' : state.mode==='empty' ? 'Add a camera frame or photo' : 'Your portrait preview');
    $('freeze').hidden=state.mode!=='camera'; $('clear').hidden=!state.waiting&&(state.mode==='demo'||state.mode==='empty');
    setText('clear',state.waiting?'Cancel camera':'Clear portrait'); $('use-sample').hidden=state.mode==='demo'||reattaching&&!practiceSession;
    $('freeze').disabled=!state.canFreeze; $('clear').disabled=state.mode==='empty'&&!state.waiting;
    $('start-camera').disabled=state.mode==='camera'||Boolean(state.waiting);
    $('auto-frame').disabled=state.mode==='empty'||state.mode==='camera'&&!state.canFreeze;
    $('framing').hidden=!state.ready;
    if (!state.ready) $('framing').open=false;
    if (reason !== 'frame') {
      const rotation = Math.round(state.frame.rotation ?? 0);
      const angle = rotation ? Math.abs(rotation) + '° ' + (rotation < 0 ? 'left' : 'right') : 'level';
      setText('framing-values', 'Zoom ' + Math.round(Math.max(1, state.frame.zoom) * 100) + '% · ' + angle);
    }
    $('download-comparison').disabled=!canAssess()||!current();
    $('contrast-tools').disabled=$('contrast-prepare').disabled=!canAssess();
    $('begin').disabled=!state.ready||Boolean(state.waiting)||(state.mode==='camera'&&!state.canFreeze);
    $('browse-before').disabled=$('begin').disabled;
    const action = reattaching ? 'Resume analysis' : state.mode==='demo' ? 'Begin with sample' : state.mode==='camera' ? 'Freeze & begin' : 'Begin my session';
    setText('begin',action);
    $('focus-mirror').disabled=!state.ready;
    syncFraming();
    if (current()) observations();
  }
});
preferences = createPreferences($, (settings, patch) => {
  if (Object.hasOwn(patch, 'paired')) {
    setComparisonView(settings.paired);
    cue = settings.guidance !== 'independent';
    target = settings.guidance === 'assisted';
    if (current()) observations();
    renderCue(); renderWardrobe();
  }
  paint();
});
setComparisonView(settings().paired);

function flagControls(prefix, container, action) {
  return createFlagPicker({ container: $(container), previous: $(prefix+'-prev'), next: $(prefix+'-next'), status: $(prefix==='primary'?'primary-flag-status':'flag-status') }, action);
}
const primaryPicker = flagControls('primary', 'primary-flags', flag => {
  flagPreview = flag; displayPair = [flag, flag];
  if (!flagsSeen.has(flag.family)) flagsSeen.add(flag.family);
  setText('primary-choose', 'Refine ' + flag.name);
  setText('mirror-context', 'Whole palette · ' + flag.name);
  paint();
});
const modalPicker = flagControls('flag', 'flag-options', flag => {
  modalFlag = flag;
  drawPanel($('portrait-flags'), flag);
});
function setFlagRange() {
  const family = $('palette-family').value;
  if ($('flag-range').value === 'flow') {
    modalPicker.show(FLOW_KINDS.filter(flow => flow !== 'home').map(flow => seasonalFlag(family, flow, refinements)), 'flag-' + family + '-' + $('palette-flow').value);
  } else modalPicker.show(primaryFlags, 'flag-' + (primary ?? family) + '-home');
}
function openFlags() {
  if (capture.mode === 'camera') capture.freeze();
  capture.lockFraming();
  $('flag-range').value = 'primary';
  $('flag-range').options[1].textContent = 'Sub-seasons · ' + HOMES[$('palette-family').value].name;
  $('flag-studio').showModal();
  setFlagRange();
}
$('flag-range').addEventListener('change', setFlagRange);
for (const id of ['flags-explorer', 'flags-tools']) $(id).addEventListener('click', openFlags);
$('close-flags').addEventListener('click', () => closeDialog('flag-studio'));
$('primary-back').addEventListener('click', previousQuestion);
function chooseHome(value) {
  if (primary !== value) {
    for (const q of questionsFor(3, answers)) delete answers[q.id];
    primary = value;
  }
  if (primary) { $('palette-family').value = primary; refinements = {}; renderFlows(); }
  go(primary ? 3 : 5);
}
$('primary-choose').addEventListener('click', () => chooseHome(flagPreview.family));
$('primary-skip').addEventListener('click', () => chooseHome(null));

const openContrast = createContrast($('contrast'), capture, values => { reading = values; if (stage === RESULTS) renderResults(); });
for (const id of ['contrast-prepare', 'contrast-tools']) $(id).addEventListener('click', () => {
  if (canAssess()) { capture.lockFraming(); openContrast(); }
});
$('close-contrast').addEventListener('click', () => closeDialog('contrast'));

$('home').addEventListener('click', () => {
  if (capture.mode==='camera') capture.freeze();
  welcome=true; render(true);
});
$('start-analysis').addEventListener('click', () => stage === RESULTS ? go(RESULTS) : go(stage,index));
$('try-sample').addEventListener('click', () => {
  reattaching = false;
  if (capture.mode !== 'demo') capture.sample();
  else resetSession();
  go(0);
});
// Setup alone uses a sticky preview. Keep focus below it when Tab scrolls.
$('source-tools').addEventListener('focusin',event=>{
  const control=event.target;
  if(!document.body.classList.contains('framing-open')||!matchMedia('(max-width:760px) and (min-height:516px) and (min-width:280px)').matches)return;
  requestAnimationFrame(()=>{
    if(stage!==0||document.activeElement!==control||!control.getClientRects().length)return;
    const preview=document.querySelector('.mirror-workspace').getBoundingClientRect();
    const rect=control.getBoundingClientRect(),top=preview.bottom+8,bottom=innerHeight-8;
    if(rect.bottom>bottom)window.scrollBy({top:rect.bottom-bottom,behavior:'instant'});
    else if(rect.top<top)window.scrollBy({top:rect.top-top,behavior:'instant'});
  });
});
$('start-camera').addEventListener('click',()=>capture.startCamera()); $('freeze').addEventListener('click',()=>capture.freeze());
$('clear').addEventListener('click',()=>{ $('photo').value='';capture.clear(); $('photo').focus(); });
$('use-sample').addEventListener('click',()=>capture.sample());
$('photo').addEventListener('change',event=>{ const file=event.target.files[0]; event.target.value=''; capture.choosePhoto(file); });
$('auto-frame').addEventListener('click',()=>capture.autoFrame());
$('reset-frame').addEventListener('click',()=>capture.resetFrame());
$('keyboard-frame').addEventListener('click', () => {
  syncFraming();
  panels[0].focus();
});
panels[0].addEventListener('keydown', framing.keyboard);
for (const id of ['framing', 'source-tools']) $(id).addEventListener('toggle', syncFraming);
for(const button of document.querySelectorAll('[data-frame]')) button.addEventListener('click', () => {
  framing.adjust(...button.dataset.frame.split(',').map(Number));
});
function resumeAtFirstUnanswered() {
  const course = [1, 2, 4, PRIMARY, 3, 5];
  for (const step of course) {
    if (step === PRIMARY) {
      if (!primary && !questions(5).some(q => answers[q.id])) { go(PRIMARY); return; }
      continue;
    }
    const pending = questions(step).findIndex(q => !answers[q.id]);
    if (pending !== -1) { go(step, pending); return; }
  }
  prepareResults();
}
$('begin').addEventListener('click',()=>{
  if(capture.mode==='camera') capture.freeze();
  if(!canAssess()) return;
  if (reattaching) { reattaching=false; resumeAtFirstUnanswered(); }
  else go(1);
});
for(const [i,id] of ['show-a','show-b'].entries()) $(id).addEventListener('click',()=>{active=i;resting=false;seen.add(i);paint();observations();});
$('rest').addEventListener('click',()=>{resting=!resting;closeDialog('session-tools');paint();observations();});
$('compare-view').addEventListener('click',()=>{
  setComparisonView(!comparing); closeDialog('session-tools'); paint(); observations();
});
$('help').addEventListener('click',()=>{ $('guidance').showModal(); $('help').setAttribute('aria-expanded','true'); });
$('close-help').addEventListener('click',()=>closeDialog('guidance'));
$('guidance').addEventListener('close',()=>$('help').setAttribute('aria-expanded','false'));
$('show-cue').addEventListener('click', () => { cue = target = true; closeDialog('guidance'); renderCue(); });
$('hide-cue').addEventListener('click', () => { cue = target = false; renderCue(); $('help').focus(); });
for (const button of document.querySelectorAll('[data-region]')) button.addEventListener('click', () => {
  region = button.dataset.region; target = true; renderCue();
});
for(const id of ['open-tools','question-tools']) $(id).addEventListener('click',()=>$('session-tools').showModal());
$('close-tools').addEventListener('click',()=>closeDialog('session-tools'));
$('change-portrait').addEventListener('click',()=>go(0));
for(const id of ['browse-before','browse-results']) $(id).addEventListener('click',openExplorer);
$('close-explorer').addEventListener('click',()=>closeDialog('palette-explorer'));
$('collection-picker').addEventListener('click',()=>$('collection-settings').showModal());
$('season-start').addEventListener('click',startSeasonCycle);
$('season-previous').addEventListener('click',()=>seasonStep(-1));
$('season-next').addEventListener('click',()=>seasonStep(1));
$('season-exit').addEventListener('click',exitSeasonCycle);
$('apply-collection').addEventListener('click',()=>closeDialog('collection-settings'));
$('focus-mirror').addEventListener('click',()=>openViewer('session'));
$('focus-explorer').addEventListener('click',()=>openViewer('explorer'));
$('close-viewer').addEventListener('click',()=>closeDialog('mirror-viewer'));
$('viewer-previous').addEventListener('click',()=>viewerStep(-1));$('viewer-next').addEventListener('click',()=>viewerStep(1));
function swipe(element, next) {
  let origin=null;
  element.classList.add('swipable');
  element.addEventListener('pointerdown',e=>{origin=e.isPrimary?{x:e.clientX,y:e.clientY}:null;});
  element.addEventListener('pointercancel',()=>origin=null);
  element.addEventListener('pointerup',e=>{if(origin){const dx=e.clientX-origin.x,dy=e.clientY-origin.y;origin=null;if(Math.abs(dx)>45&&Math.abs(dy)<35)next(dx<0?1:-1);}});
}
swipe($('portrait-a'),()=>{if(current()){active=1-active;resting=false;seen.add(active);paint();observations();}});
swipe($('portrait-explorer'),step=>{const mode=viewerMode;viewerMode='explorer';viewerStep(step);viewerMode=mode;});
swipe($('portrait-viewer'),viewerStep);
$('stronger').addEventListener('click',()=>{
  const q=current();
  practice=q.id.includes('depth')?{drapes:[{...REST_DRAPE,name:'Deep blue-green',hex:fitColor(.32,.05,195).hex},{...REST_DRAPE,name:'Light blue-green',hex:fitColor(.84,.05,195).hex}]}:questionsFor(q.axis==='temperature'||q.id.includes('temperature')?1:2,answers)[0];
  closeDialog('guidance'); $('save-session-pair').disabled=true; active=0;resting=false; $('practice-tag').hidden=false; $('exit-practice').hidden=false; paint();observations();
});
$('exit-practice').addEventListener('click',()=>{practice=null;active=0;seen=new Set(comparing?[0,1]:[0]);$('practice-tag').hidden=true;$('exit-practice').hidden=true;paint();observations();});
document.querySelectorAll('[data-answer]').forEach(button=>button.addEventListener('click', () => {
  const id = current().id, choice = button.dataset.answer;
  const revised = answers[id] !== choice;
  answers = recordAnswer(answers, id, choice, primary);
  if (revised && [1, 2, 4].includes(stage)) { primary = null; flagsSeen.clear(); }
  renderQuestion();
}));
$('decide').addEventListener('click',()=>{if(!$('decide').disabled)$('response-sheet').showModal();});
$('close-response').addEventListener('click',()=>closeDialog('response-sheet'));
$('next').addEventListener('click',()=>{ if(!$('next').disabled) nextQuestion(); });
$('back').addEventListener('click', previousQuestion);
$('restart').addEventListener('click',()=>{ resetSession(); go(0); });
$('palette-family').addEventListener('change',()=>{seasonMode=null;refinements={};renderFlows();renderWardrobe();});
$('palette-flow').addEventListener('change',()=>{seasonMode=null;refinements={};renderWardrobe();});
document.querySelectorAll('[data-adjust]').forEach(b=>b.addEventListener('click',()=>{seasonMode=null;refinements={...refinements,[b.dataset.adjust]:Number(b.dataset.value)};renderWardrobe();}));
$('drape-family').addEventListener('change',()=>{
  seasonMode=null;
  const value=$('drape-family').value;
  if(value==='neutrals'||value==='metals')collectionGroup=value;else{collectionGroup='colors';hueFamily=value;}
  renderWardrobe();
});
for(const slot of ['a','b']) $('explore-'+slot).addEventListener('click',()=>{pinned=showPinned(pinned,slot);$('explore-status').textContent='';paintExplorer();});
$('pin-reference').addEventListener('click',()=>{seasonMode=null;pinned=pinVisible(pinned);$('explore-status').textContent=pinned.a.name+' pinned as A. New choices go into B.';paintExplorer();});
$('explore-rest').addEventListener('click',()=>{seasonMode=null;pinned={...pinned,rest:!pinned.rest};$('explore-status').textContent='';paintExplorer();});
$('explore-save').addEventListener('click',()=>saveDrape(exploreDrape,'explore-status'));
$('save-shown').addEventListener('click',saveShown);
function keepPair(pair, statusId) {
  const next = retainComparison(savedComparisons, pair);
  setText(statusId, next.length > savedComparisons.length ? 'Comparison added to your report.' :
    savedComparisons.length >= 24 ? 'Your report can hold 24 comparisons. Remove a pair to make room.' : 'This comparison is already in your report.');
  savedComparisons = next;
  if (stage === RESULTS) renderResults();
  if (statusId === 'explore-status') paintExplorer();
}
$('save-session-pair').addEventListener('click', () => {
  const q = current();
  if (q && !practice) keepPair(savedPair(...q.drapes, q.title, answers[q.id]), 'mirror-note');
});
$('save-explore-pair').addEventListener('click', () => {
  if (pinned.a && pinned.b) keepPair(savedPair(pinned.a, pinned.b, 'Seasonal drapes'), 'explore-status');
});
$('download-palette').addEventListener('click',()=>download(new Blob([JSON.stringify({format:'draping-mirror-palette',version:1,colors:palette},null,2)],{type:'application/json'}),'draping-mirror-palette.json'));
$('download-comparison').addEventListener('click',()=>{
  if(!canAssess()||!current())return;
  const pair=practice?.drapes??displayPair, canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1320;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#151518';ctx.fillRect(0,0,1920,1320);
  const a=document.createElement('canvas'),b=document.createElement('canvas');a.width=b.width=960;a.height=b.height=1200;
  drawPanel(a,pair[0],{width:480,height:600});drawPanel(b,pair[1],{width:480,height:600});ctx.drawImage(a,0,0);ctx.drawImage(b,960,0);
  ctx.fillStyle='#F3F1EC';ctx.font='26px system-ui';ctx.fillText('A · '+pair[0].name,30,1245);ctx.fillText('B · '+pair[1].name,990,1245);
  ctx.fillStyle='#CFCCD5';ctx.font='22px system-ui';ctx.fillText('DRAPER · '+(capture.mode==='demo'?'Sample portrait':'Same portrait in both views')+' · Virtual drapes',30,1290);
  canvas.toBlob(blob=>{download(blob,'draper-comparison.png');canvas.width=canvas.height=a.width=a.height=b.width=b.height=0;},'image/png');
});
$('session-notes').addEventListener('input', event => { notes = event.target.value; });
$('report-pdf').addEventListener('click', () => {
  renderReport($('print-report'), buildReport(sessionData()));
  window.print();
});
window.addEventListener('afterprint', () => $('print-report').replaceChildren());
$('report-png').addEventListener('click', () => {
  const canvas = paletteGraphic(buildReport(sessionData()));
  canvas.toBlob(blob => {
    if (blob) download(blob, 'draper-palette.png');
    else setText('report-status','The palette image could not be created. Try again.');
    canvas.width = canvas.height = 0;
  }, 'image/png');
});
for (const id of ['report-json','download-analysis-tools']) $(id).addEventListener('click', () => {
  download(new Blob([JSON.stringify(sessionData(),null,2)], { type:'application/json' }), 'draper-analysis.json');
});
for (const id of ['open-analysis-welcome','open-analysis-tools']) $(id).addEventListener('click', () => $('analysis-input').click());
$('analysis-input').addEventListener('change', async event => {
  const file = event.target.files[0], revision = ++importRevision;
  event.target.value = '';
  if (!file) return;
  setText('import-status','');
  try {
    if (file.size > 256_000) throw new TypeError('Large file');
    const data = parseAnalysis(await file.text());
    if (revision !== importRevision) return;
    if (data.format === 'draping-mirror-palette') {
      palette = readPalette(JSON.stringify([...palette, ...data.colors]));
      persist(); paletteView();
      if ($('session-tools').open) setText('mirror-note','Saved colors opened.');
      else setText('import-status','Saved colors opened. Find them in Tools.');
      return;
    }
    capture.clear();
    ({ answers, primary, notes, colors: sessionColors, comparisons: savedComparisons, contrast: reading, practice: practiceSession } = data);
    flagsSeen = new Set(data.flagsSeen);
    loadedAnalysis = true;
    prepareResults();
    setText('report-status','Analysis opened. You can review and export it or continue with a portrait.');
  } catch (_) {
    if (revision !== importRevision) return;
    const message = 'Choose a DRAPER analysis JSON or a saved Draping Mirror palette.';
    setText($('session-tools').open ? 'mirror-note' : 'import-status',message);
  }
});
$('resume-analysis').addEventListener('click', () => {
  reattaching = true;
  go(0);
  if (practiceSession) capture.sample();
  else status('Choose the same portrait to resume this analysis, or clear the portrait to begin again.');
});
try{palette=readPalette(localStorage.getItem(PALETTE_KEY));}catch(_){try{localStorage.getItem(PALETTE_KEY);$('palette-status').textContent='The saved colors could not be read. You can start a new collection.';}catch(_){storageAvailable=false;$('palette-status').textContent='Browser storage is unavailable. Download your colors to keep them.';}}
// Redraw on rotation, responsive layout changes and dialog expansion. Updating
// the bitmap does not change the CSS frame's explicit size/aspect ratio.
let resizePaint = 0;
const mirrorResize = new ResizeObserver(() => {
  if (!resizePaint) resizePaint = requestAnimationFrame(() => { resizePaint=0; paint(); });
});
for (const canvas of [...panels,$('portrait-explorer'),$('portrait-viewer'),$('portrait-flags')]) mirrorResize.observe(canvas);
familyOptions();renderFlows();renderWardrobe();paletteView();render();capture.sample();
