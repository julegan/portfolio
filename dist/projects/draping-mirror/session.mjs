import { fitColor } from './drapes.mjs';

// Original experimental drapes. Coordinates, selections and groupings are ours;
// no vendor's kit, swatch measurements or palette assets are reproduced.
export const COLLECTION = 'Draping mirror studies · 02';
export const STAGES = ['Prepare', 'Undertone', 'Season', 'Flow', 'Confirm', 'Finishes', 'Palette'];
export function drape(id, name, l, c, h, finish = 'matte') {
  return Object.freeze({ id, name, hex: fitColor(l, c, h).hex, finish });
}
export const REST_DRAPE = drape('rest', 'Neutral cape', .7, 0, 0);
const color = (id, name, l, c, h, finish) => drape(id, name, l, c, h, finish);
function pair(id, title, purpose, prompt, a, b, axis, values, guide, subtle = false) {
  return { id, title, purpose, prompt, drapes: [a, b], axis, values, guide, subtle };
}
const temperature = [
  pair('tone-red', 'Start with a clear contrast', 'Undertone · red family', 'Which drape makes your cheeks and jawline look more even?',
    color('poppy', 'Poppy', .62, .2, 35), color('fuchsia', 'Fuchsia', .62, .2, 345), 'temperature', [1, -1],
    'Keep your attention on your face, rather than the color you like. Look for a new color cast, more visible shadows, or clearer feature definition. Both drapes use the identical portrait.'),
  pair('tone-pink', 'Try a lighter pair', 'Undertone · pink family', 'Which looks clearer around your mouth and eyes?',
    color('peony', 'Peony', .79, .095, 345), color('apricot', 'Apricot', .79, .095, 55), 'temperature', [-1, 1],
    'Try A, then B, then A again. A difference can be easier to notice on returning. A warmer appearance is not automatically better or worse; look for an even, coherent effect.'),
  pair('tone-neutral', 'Compare the neutrals', 'Undertone · neutral family', 'Which framing looks more settled around your chin?',
    color('sandstone', 'Sandstone', .65, .06, 75), color('slate', 'Slate', .65, .06, 265), 'temperature', [1, -1],
    'This is another comparison, not a verdict from one color. If neither has a clear advantage, record that. We will keep uncertainty in the result.')
];
export const HOMES = {
  spring: { name: 'Spring', temperature: 1, intensity: 1, hue: 55, depth: 'Light', energy: 'Bright', thermal: 'Warm' },
  summer: { name: 'Summer', temperature: -1, intensity: -1, hue: 335, depth: 'Light', energy: 'Soft', thermal: 'Cool' },
  autumn: { name: 'Autumn', temperature: 1, intensity: -1, hue: 65, depth: 'Deep', energy: 'Soft', thermal: 'Warm' },
  winter: { name: 'Winter', temperature: -1, intensity: 1, hue: 330, depth: 'Deep', energy: 'Bright', thermal: 'Cool' }
};
function axisEvidence(answers, axis) {
  const entries = [];
  for (const item of [...temperature, ...seasonPairs(answers), ...confirmationPairs(answers)]) {
    if (item.axis !== axis || !['a', 'b'].includes(answers[item.id])) continue;
    entries.push({ id: item.id, value: item.values[answers[item.id] === 'a' ? 0 : 1] });
  }
  const positive = entries.filter(entry => entry.value > 0).length;
  const negative = entries.length - positive;
  const direction = positive === negative ? 0 : positive > negative ? 1 : -1;
  return { positive, negative, total: entries.length, direction, mixed: positive > 0 && negative > 0, clear: entries.length >= 2 && Math.abs(positive - negative) >= 2 };
}
// This helper uses only the initial undertone answers, avoiding recursion when
// generating the later, temperature-adapted comparisons.
function initialTemperature(answers) {
  let score = 0;
  for (const item of temperature) {
    const answer = answers[item.id];
    if (answer === 'a' || answer === 'b') score += item.values[answer === 'a' ? 0 : 1];
  }
  return Math.sign(score);
}
function seasonPairs(answers) {
  const warm = initialTemperature(answers) > 0;
  const h = warm ? 35 : 335;
  return [
    pair('season-green', 'Vivid or softened?', 'Home season · a broad intensity comparison', 'Which lets your face stay the focus?',
      color('clear-green-' + warm, warm ? 'Leaf green' : 'Clear jade', .62, .14, warm ? 135 : 160), color('soft-green-' + warm, warm ? 'Sage leaf' : 'Mist jade', .62, .025, warm ? 135 : 160), 'intensity', [1, -1],
      'One drape is deliberately vivid; the other is strongly muted. Notice whether your face remains the focus. The brighter drape is not meant to win just because it attracts attention.'),
    pair('season-rose', 'Try another color family', 'Home season · intensity across hues', 'Which gives your eyes and mouth clearer definition?',
      color('soft-rose-' + warm, warm ? 'Clay rose' : 'Hushed rose', .63, .03, h), color('clear-rose-' + warm, warm ? 'Vermilion' : 'Wild rose', .63, .18, h), 'intensity', [-1, 1],
      'Compare the edges around your eyes and mouth, then the face as a whole. A stronger drape can frame a face or distract from it. Your observation decides the direction.'),
    pair('season-blue', 'Check the pattern', 'Home season · a third intensity comparison', 'Which keeps your face more present?',
      color('clear-blue', 'Clear blue', .57, .18, 265), color('soft-blue', 'Dust blue', .57, .025, 265), 'intensity', [1, -1],
      'There is no need to make all your answers match. We repeat across hues to find a pattern and to notice when that pattern is uncertain.')
  ];
}
function provisionalHome(answers) {
  const t = initialTemperature(answers);
  let i = 0;
  for (const q of seasonPairs(answers)) {
    const a = answers[q.id]; if (a === 'a' || a === 'b') i += q.values[a === 'a' ? 0 : 1];
  }
  return Object.keys(HOMES).find(key => HOMES[key].temperature === (t || -1) && HOMES[key].intensity === (Math.sign(i) || 1));
}
function flowPairs(answers) {
  const key = provisionalHome(answers), home = HOMES[key];
  const warm = home.temperature > 0;
  const baseL = home.depth === 'Light' ? .72 : .51;
  const baseC = home.intensity > 0 ? .125 : .055;
  const base = color(key + '-anchor', 'Rose anchor', baseL, baseC, home.hue);
  const thermalHue = home.hue + (warm ? 13 : -13);
  return [
    pair('flow-temperature', 'Refine the temperature', 'Flow · warmth and coolness', 'Does the warmer or cooler shift improve the framing?',
      base, color(key + '-thermal', warm ? 'Warmer rose' : 'Cooler rose', baseL, baseC, thermalHue), 'flow', ['balanced', 'thermal'],
      'Switch slowly and look at the whole complexion. The second drape changes hue while keeping requested lightness and intensity close. If the difference is too small to judge, you can leave it open.', true),
    pair('flow-depth', 'Refine light and dark', 'Flow · depth', 'Does a little more lightness or depth help your face?',
      color(key + '-depth-anchor', 'Blue-green anchor', baseL, baseC * .6, warm ? 150 : 195), color(key + '-depth', home.depth === 'Light' ? 'Lighter blue-green' : 'Deeper blue-green', baseL + (home.depth === 'Light' ? .085 : -.085), baseC * .6, warm ? 150 : 195), 'flow', ['balanced', 'depth'],
      'Watch the shadows under your eyes and the definition around your face. Lightening your face is not the goal; compare whether the framing feels balanced.', true),
    pair('flow-intensity', 'Refine the intensity', 'Flow · softness and brightness', 'Does a little more softness or brightness help?',
      color(key + '-energy', home.energy === 'Bright' ? 'Brighter violet' : 'Softer violet', baseL, baseC + (home.intensity > 0 ? .035 : -.025), warm ? 305 : 315), color(key + '-energy-anchor', 'Violet anchor', baseL, baseC, warm ? 305 : 315), 'flow', ['energy', 'balanced'],
      'This is deliberately subtler than the first intensity tests. Look for a small improvement, rather than a dramatic transformation. A tie can remain a tie.', true)
  ];
}
function confirmationPairs(answers) {
  const warm = initialTemperature(answers) > 0;
  return [
    pair('check-temperature', 'Check temperature again', 'Confirmation · another color family', 'Does this closer pair support what you saw earlier?',
      color('cool-cherry', 'Cherry', .57, .125, 355), color('warm-cherry', 'Spiced cherry', .57, .125, 25), 'temperature', [-1, 1],
      'Use the same cues as before: an even complexion, visible shadows and feature definition. If this contradicts earlier answers, the result will acknowledge the disagreement.', true),
    pair('check-intensity', 'Check intensity again', 'Confirmation · a closer intensity comparison', 'Does the smaller intensity difference still help?',
      color('check-soft', warm ? 'Soft moss' : 'Soft lagoon', .61, .05, warm ? 130 : 200), color('check-clear', warm ? 'Clear moss' : 'Clear lagoon', .61, .095, warm ? 130 : 200), 'intensity', [-1, 1],
      'It is fine if the original strong difference was clear and this one is not. We will show how much evidence supports the direction instead of inventing precision.', true)
  ];
}
const finishes = [
  pair('finish-white', 'Find your white', 'Finishing touches · whites', 'Which white would you like to try near your face?', color('porcelain', 'Porcelain', .965, .006, 265), color('cream', 'Cream', .965, .035, 88), 'finish', [], 'These choices explore your wardrobe and do not change your season result. This comparison changes warmth as well as the character of the white.'),
  pair('finish-dark', 'Find your dark neutral', 'Finishing touches · dark neutrals', 'Which dark neutral settles comfortably around your face?', color('ink', 'Ink', .23, .012, 265), color('espresso', 'Espresso', .3, .04, 55), 'finish', [], 'This is a practical comparison, with changes in both lightness and hue. It does not isolate undertone.'),
  pair('finish-grey', 'Try middle neutrals', 'Finishing touches · gray and brown', 'Which neutral would you keep?', color('pewter-matte', 'Pebble gray', .6, .008, 260), color('taupe', 'Earth taupe', .6, .035, 65), 'finish', [], 'You can keep either or both. A favorite neutral is useful information even when it sits outside the suggested seasonal family.'),
  pair('finish-metals', 'Silver or gold?', 'Finishing touches · metallic preview', 'Which finish would you explore in real jewelry?', color('silver', 'Silver', .75, .012, 260, 'polished'), color('gold', 'Gold', .75, .11, 85, 'polished'), 'finish', [], 'These are simulated finishes. They cannot reproduce metal reflecting light onto your skin. Use them as a preview and confirm with real jewelry.'),
  pair('finish-special', 'Try softer metals', 'Finishing touches · specialty metallics', 'Would you try rose copper, champagne, or both?', color('rose-copper', 'Rose copper', .72, .065, 35, 'satin'), color('champagne', 'Champagne', .82, .045, 85, 'satin'), 'finish', [], 'These original specialty previews add softer metal options. They are not undertone measurements and do not influence the seasonal suggestion.')
];
export function questionsFor(stage, answers = {}) {
  return ({ 1: () => temperature, 2: () => seasonPairs(answers), 3: () => flowPairs(answers), 4: () => confirmationPairs(answers), 5: () => finishes }[stage]?.() ?? []);
}
export function allQuestions(answers = {}) { return [1, 2, 3, 4, 5].flatMap(stage => questionsFor(stage, answers)); }
export function recordAnswer(answers, id, answer) {
  if (!['a', 'b', 'both', 'unsure'].includes(answer)) throw new TypeError('Unknown observation');
  const ordered = allQuestions(answers), index = ordered.findIndex(q => q.id === id);
  if (index < 0) throw new TypeError('Unknown comparison');
  if (answers[id] === answer) return { ...answers };
  const next = { ...answers };
  // A changed observation invalidates later answers, whose drapes may depend on it.
  for (const q of ordered.slice(index + 1)) delete next[q.id];
  next[id] = answer;
  return next;
}
export function profile(answers = {}) {
  const temperature = axisEvidence(answers, 'temperature'), intensity = axisEvidence(answers, 'intensity');
  const candidates = Object.entries(HOMES).map(([id, home]) => ({ id, name: home.name,
    score: (home.temperature > 0 ? temperature.positive : temperature.negative) + (home.intensity > 0 ? intensity.positive : intensity.negative)
  })).sort((a, b) => b.score - a.score);
  const known = temperature.clear && intensity.clear;
  const leader = known ? candidates[0] : null;
  let flow = null;
  if (leader && flowPairs(answers).every(q => ['a', 'b'].includes(answers[q.id]))) {
    const qs = flowPairs(answers), scores = { balanced: 0, thermal: 0, depth: 0, energy: 0 };
    for (const q of qs) {
      const answer = answers[q.id];
      if (answer === 'a' || answer === 'b') scores[q.values[answer === 'a' ? 0 : 1]]++;
    }
    const winners = Object.entries(scores).filter(([key]) => key !== 'balanced').sort((a,b) => b[1] - a[1]);
    const home = HOMES[leader.id];
    // "Balanced" requires positive observations for the anchor in all three
    // tests; a tie, skipped response or missing evidence never becomes True.
    if (scores.balanced === 3) flow = { label: 'True ' + home.name, kind: 'balanced' };
    else if (winners[0][1] > 0 && winners[0][1] > winners[1][1]) {
      const kind = winners[0][0];
      flow = { kind, label: ({ thermal: home.thermal, depth: home.depth, energy: home.energy }[kind]) + ' ' + home.name };
    }
    // If confirmation changes the home, the previous flow tests concerned a
    // different family. Keep only the home result and invite a new session.
    if (leader.id !== provisionalHome(answers)) flow = null;
  }
  return { temperature, intensity, candidates, leader, flow,
    label: flow?.label ?? leader?.name ?? 'Still exploring',
    mixed: temperature.mixed || intensity.mixed,
    leadingIds: candidates.filter(c => c.score === candidates[0].score).map(c => c.id)
  };
}
// Every family includes wearable colors, neutral drapes and simulated metals.
// These are original exploration sets, not a prescribed professional kit.
export const FLOW_KINDS = ['home', 'balanced', 'thermal', 'depth', 'energy'];
export function flowOptions(homeId) {
  const h = HOMES[homeId]; if (!h) return [];
  return [
    { id: 'home', label: h.name + ' · full home range' },
    { id: 'balanced', label: 'True ' + h.name },
    { id: 'thermal', label: h.thermal + ' ' + h.name },
    { id: 'depth', label: h.depth + ' ' + h.name },
    { id: 'energy', label: h.energy + ' ' + h.name }
  ];
}
const hues = [
  // key, lightness offset, chroma scale, warmer hue, cooler hue
  ['red',0,1.05,30,355], ['rose',.06,.85,20,345], ['pink',.13,.7,30,340],
  ['coral',.08,.95,42,350], ['berry',-.09,1,15,338], ['wine',-.15,.7,25,335],
  ['violet',-.03,.95,300,305], ['lilac',.14,.6,300,305],
  ['blue',-.08,.95,250,265], ['sky',.12,.65,235,250], ['navy',-.2,.65,245,265],
  ['teal',-.06,.85,185,195], ['aqua',.12,.75,180,200],
  ['green',-.04,.9,140,155], ['sage',.1,.5,130,160], ['forest',-.18,.7,145,160],
  ['yellow',.18,.95,88,100], ['lemon',.21,.6,100,105], ['ochre',.03,.75,75,85],
  ['rust',-.06,.9,50,25], ['apricot',.18,.55,60,335], ['pale',.23,.32,150,225]
];
const names = {
  spring: ['Poppy','Peach rose','Blossom','Coral','Watermelon','Geranium','Orchid','Wisteria','Cornflower','Sky','Marine blue','Turquoise','Aqua','Leaf','Apple green','Emerald leaf','Daffodil','Lemon sorbet','Marigold','Persimmon','Apricot','Mint cream'],
  summer: ['Rose red','Old rose','Shell pink','Raspberry pink','Mulberry','Soft wine','Heather','Lilac','Denim','Air blue','Blueberry','Lagoon','Sea glass','Jade mist','Sage blue','Pine mist','Primrose','Lemon chiffon','Soft straw','Cranberry rose','Petal','Ice blue'],
  autumn: ['Brick','Clay rose','Terra pink','Paprika','Redwood','Oxblood','Aubergine','Smoky orchid','Petrol blue','Weathered blue','Midnight teal','Peacock','Verdigris','Moss','Olive leaf','Forest','Harvest gold','Golden pear','Ochre','Burnt orange','Peach clay','Eucalyptus'],
  winter: ['Cherry','Magenta rose','Shocking pink','Raspberry','Blackberry','Burgundy','Royal violet','Electric lilac','Cobalt','Glacier blue','Midnight blue','Deep teal','Arctic aqua','Emerald','Cool mint','Bottle green','Acid yellow','Icy lemon','Citron','Crimson','Icy pink','Ice water']
};
const neutrals = {
  spring: [['Chalk ivory',.965,.016,90],['Buttercream',.91,.045,90],['Oat',.82,.045,85],['Sand',.72,.055,80],['Warm taupe',.6,.035,65],['Camel',.6,.09,75],['Cocoa',.4,.055,55],['Warm navy',.32,.05,255]],
  summer: [['Soft white',.96,.007,265],['Pearl gray',.87,.012,265],['Rose beige',.78,.027,10],['Dove',.7,.015,265],['Cool taupe',.6,.025,300],['Blue gray',.53,.035,260],['Smoke',.4,.018,270],['Soft navy',.32,.04,265]],
  autumn: [['Cream',.95,.028,90],['Flax',.83,.055,85],['Wheat',.73,.065,80],['Mushroom',.61,.035,65],['Olive gray',.5,.035,110],['Tobacco',.45,.07,65],['Espresso',.28,.04,50],['Warm charcoal',.28,.015,70]],
  winter: [['Optic white',.985,0,0],['Icy gray',.9,.008,260],['Cool stone',.75,.012,265],['Pewter',.6,.015,260],['Graphite',.45,.015,265],['Ink navy',.28,.04,265],['Soft black',.21,.006,265],['Black',.135,0,0]]
};
const metals = {
  spring: [['Gold',.77,.09,85,'polished'],['Light gold',.85,.06,90,'satin'],['Champagne',.83,.035,85,'satin'],['Rosé gold',.77,.055,45,'satin'],['Bright brass',.69,.095,95,'polished'],['Pale silver',.86,.01,245,'polished']],
  summer: [['Silver',.78,.008,265,'satin'],['Pearl metal',.88,.012,295,'satin'],['Soft pewter',.6,.015,265,'satin'],['Rose silver',.79,.025,350,'satin'],['Soft champagne',.82,.025,85,'satin'],['Brushed steel',.64,.012,255,'satin']],
  autumn: [['Antique brass',.61,.075,90,'satin'],['Copper',.59,.1,45,'polished'],['Bronze',.49,.07,70,'satin'],['Antique gold',.65,.09,85,'satin'],['Rose copper',.64,.07,30,'satin'],['Oxidized silver',.5,.02,95,'satin']],
  winter: [['Bright silver',.84,.006,265,'polished'],['Platinum',.76,.012,260,'polished'],['Blackened steel',.37,.012,270,'satin'],['White gold',.82,.02,95,'polished'],['High gold',.73,.1,85,'polished'],['Rose metal',.7,.055,350,'polished']]
};
export function normalizeRefinements(input = {}) {
  return Object.fromEntries(['temperature','depth','intensity'].map(axis=>[axis,[-1,0,1].includes(input?.[axis]) ? input[axis] : 0]));
}
export function refinementLabel(input = {}) {
  const a=normalizeRefinements(input);
  return [a.temperature ? a.temperature>0?'warmer':'cooler' : '',a.depth ? a.depth>0?'deeper':'lighter' : '',a.intensity ? a.intensity>0?'brighter':'softer' : ''].filter(Boolean).join(', ');
}
export function wardrobePalette(homeId, flowKind = 'home', refinements = {}) {
  const home = HOMES[homeId]; if (!home) return [];
  const kind = FLOW_KINDS.includes(flowKind) ? flowKind : 'home';
  const adjustments=normalizeRefinements(refinements), keySuffix=`t${adjustments.temperature}d${adjustments.depth}i${adjustments.intensity}`;
  const warm = home.temperature > 0, light = home.depth === 'Light';
  const baseL = light ? .69 : homeId === 'autumn' ? .56 : .52;
  const baseC = { spring:.15, summer:.065, autumn:.085, winter:.185 }[homeId];
  function make(key,name,l,c,h,group,finish='matte',thermalShift) {
    if (kind === 'balanced') { if (group === 'colors') l += (baseL-l)*.08; c *= .96; }
    if (kind === 'thermal') {
      h += thermalShift ?? (warm ? -5 : 5);
      c *= group === 'colors' ? 1.04 : 1.12;
    }
    if (kind === 'depth') { l += light ? .055 : -.055; c *= .96; }
    if (kind === 'energy') c *= home.intensity > 0 ? 1.22 : .7;
    h += (thermalShift ?? (warm ? -5 : 5))*(warm?1:-1)*adjustments.temperature;
    l -= adjustments.depth*.055; c *= Math.pow(1.24,adjustments.intensity);
    const d = color(`${homeId}-${kind}-${key}-${keySuffix}`,name,Math.min(.985,Math.max(.12,l)),c,h,finish);
    return Object.freeze({ ...d, group, family: homeId, flow: kind, adjustments });
  }
  return [
    ...hues.flatMap(([key,dl,scale,wh,ch],i) => {
      const delta = ((wh-ch+540)%360)-180;
      return [[0,'',1],[.07,' · light',.9],[-.07,' · deep',.94]].map(([tone,suffix,chromaScale],n)=>make(key+'-'+n,names[homeId][i]+suffix,baseL+dl+tone,baseC*scale*chromaScale,warm?wh:ch,'colors','matte',delta*(warm ? .25 : -.25)));
    }),
    ...[ ['Silk white',.93,warm?.02:.008,warm?85:265], ['Stone beige',.76,.025,warm?70:290], ['Shadow gray',.46,.018,warm?70:265], ['Midnight',.24,.025,warm?60:265] ].map(([name,l,c,h],i)=>make('extra-neutral-'+i,name,l,c,h,'neutrals')),
    ...neutrals[homeId].map(([name,l,c,h],i)=>make('neutral-'+i,name,l,c,h,'neutrals')),
    ...[ ['Satin silver',.8,.008,265,'satin'], ['Smoked copper',.48,.06,45,'satin'] ].map(([name,l,c,h,finish],i)=>make('extra-metal-'+i,name,l,c,h,'metals',finish)),
    ...metals[homeId].map(([name,l,c,h,finish],i)=>make('metal-'+i,name,l,c,h,'metals',finish))
  ];
}
