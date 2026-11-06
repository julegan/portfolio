import { fitColor } from './drapes.mjs';

// Original experimental drapes. Coordinates, selections and groupings are ours;
// no vendor's kit, swatch measurements or palette assets are reproduced.
export const COLLECTION = 'Draping mirror studies · 01';
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
  pair('tone-red', 'Start with a strong difference', 'Undertone · red family', 'Swap the drapes while watching your cheeks and jawline. Which framing makes your complexion appear more even?',
    color('poppy', 'Poppy', .62, .2, 35), color('fuchsia', 'Fuchsia', .62, .2, 345), 'temperature', [1, -1],
    'Keep your attention on your face, rather than the color you like. Look for a new color cast, more visible shadows, or clearer feature definition. Both drapes use the identical portrait.'),
  pair('tone-pink', 'Look again in a lighter family', 'Undertone · pink family', 'Does the same direction help around your mouth and eyes when the drapes are lighter?',
    color('peony', 'Peony', .79, .095, 345), color('apricot', 'Apricot', .79, .095, 55), 'temperature', [-1, 1],
    'Try A, then B, then A again. A difference can be easier to notice on returning. A warmer appearance is not automatically better or worse; look for an even, coherent effect.'),
  pair('tone-neutral', 'Give the neutrals a turn', 'Undertone · neutral family', 'Compare the framing around your chin. Which looks more settled with your complexion?',
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
    pair('season-green', 'Strong or softened?', 'Home season · a broad intensity comparison', 'Both drapes belong to the same green family. Which supports your face without fading away or taking over?',
      color('clear-green-' + warm, warm ? 'Leaf green' : 'Clear jade', .62, .14, warm ? 135 : 160), color('soft-green-' + warm, warm ? 'Sage leaf' : 'Mist jade', .62, .025, warm ? 135 : 160), 'intensity', [1, -1],
      'One drape is deliberately vivid; the other is strongly muted. Notice whether your face remains the focus. The brighter drape is not meant to win just because it attracts attention.'),
    pair('season-rose', 'Repeat in another family', 'Home season · intensity across hues', 'Which framing gives your features clearer definition in this color family?',
      color('soft-rose-' + warm, warm ? 'Clay rose' : 'Hushed rose', .63, .03, h), color('clear-rose-' + warm, warm ? 'Vermilion' : 'Wild rose', .63, .18, h), 'intensity', [-1, 1],
      'Compare the edges around your eyes and mouth, then the face as a whole. A stronger drape can frame a face or distract from it. Your observation decides the direction.'),
    pair('season-blue', 'Check the pattern', 'Home season · a third intensity comparison', 'Does the quieter or more saturated framing keep your face more present?',
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
    pair('flow-temperature', 'A smaller temperature shift', 'Flow · warmth and coolness', 'The difference is smaller now. Does leaning further into warmth or coolness improve the framing?',
      base, color(key + '-thermal', warm ? 'Warmer rose' : 'Cooler rose', baseL, baseC, thermalHue), 'flow', ['balanced', 'thermal'],
      'Switch slowly and look at the whole complexion. The second drape changes hue while keeping requested lightness and intensity close. If the difference is too small to judge, you can leave it open.', true),
    pair('flow-depth', 'A smaller light–dark shift', 'Flow · depth', 'Do you benefit from a little more lightness or depth than the anchor?',
      color(key + '-depth-anchor', 'Blue-green anchor', baseL, baseC * .6, warm ? 150 : 195), color(key + '-depth', home.depth === 'Light' ? 'Lighter blue-green' : 'Deeper blue-green', baseL + (home.depth === 'Light' ? .085 : -.085), baseC * .6, warm ? 150 : 195), 'flow', ['balanced', 'depth'],
      'Watch the shadows under your eyes and the definition around your face. Lightening your face is not the goal; compare whether the framing feels balanced.', true),
    pair('flow-intensity', 'A smaller intensity shift', 'Flow · softness and brightness', 'Would a touch more softness or brightness help compared with the anchor?',
      color(key + '-energy', home.energy === 'Bright' ? 'Brighter violet' : 'Softer violet', baseL, baseC + (home.intensity > 0 ? .035 : -.025), warm ? 305 : 315), color(key + '-energy-anchor', 'Violet anchor', baseL, baseC, warm ? 305 : 315), 'flow', ['energy', 'balanced'],
      'This is deliberately subtler than the first intensity tests. Look for a small improvement, rather than a dramatic transformation. A tie can remain a tie.', true)
  ];
}
function confirmationPairs(answers) {
  const warm = initialTemperature(answers) > 0;
  return [
    pair('check-temperature', 'Revisit your temperature direction', 'Confirmation · another color family', 'Does this closer comparison support your earlier undertone observations?',
      color('cool-cherry', 'Cherry', .57, .125, 355), color('warm-cherry', 'Spiced cherry', .57, .125, 25), 'temperature', [-1, 1],
      'Use the same cues as before: an even complexion, visible shadows and feature definition. If this contradicts earlier answers, the result will acknowledge the disagreement.', true),
    pair('check-intensity', 'Revisit your intensity direction', 'Confirmation · a closer intensity comparison', 'Does a smaller intensity difference still point in the same direction?',
      color('check-soft', warm ? 'Soft moss' : 'Soft lagoon', .61, .05, warm ? 130 : 200), color('check-clear', warm ? 'Clear moss' : 'Clear lagoon', .61, .095, warm ? 130 : 200), 'intensity', [-1, 1],
      'It is fine if the original strong difference was clear and this one is not. We will show how much evidence supports the direction instead of inventing precision.', true)
  ];
}
const finishes = [
  pair('finish-white', 'Find a white you enjoy', 'Finishing touches · whites', 'Which white would you like to try near your face?', color('porcelain', 'Porcelain', .965, .006, 265), color('cream', 'Cream', .965, .035, 88), 'finish', [], 'These choices explore your wardrobe and do not change your season result. This comparison changes warmth as well as the character of the white.'),
  pair('finish-dark', 'Find your dark neutral', 'Finishing touches · dark neutrals', 'Which dark neutral feels more comfortable around your face?', color('ink', 'Ink', .23, .012, 265), color('espresso', 'Espresso', .3, .04, 55), 'finish', [], 'This is a practical comparison, with changes in both lightness and hue. It does not isolate undertone.'),
  pair('finish-grey', 'Explore the middle neutrals', 'Finishing touches · gray and brown', 'Which of these everyday neutrals would you keep?', color('pewter-matte', 'Pebble gray', .6, .008, 260), color('taupe', 'Earth taupe', .6, .035, 65), 'finish', [], 'You can keep either or both. A favorite neutral is useful information even when it sits outside the suggested seasonal family.'),
  pair('finish-metals', 'Try two metal directions', 'Finishing touches · metallic preview', 'Compare the silver and gold previews. Which would you like to explore in jewelry?', color('silver', 'Silver', .75, .012, 260, 'polished'), color('gold', 'Gold', .75, .11, 85, 'polished'), 'finish', [], 'These are simulated finishes. They cannot reproduce metal reflecting light onto your skin. Use them as a preview and confirm with real jewelry.'),
  pair('finish-special', 'Explore softer metals', 'Finishing touches · specialty metallics', 'Do you prefer rose copper, champagne, or both?', color('rose-copper', 'Rose copper', .72, .065, 35, 'satin'), color('champagne', 'Champagne', .82, .045, 85, 'satin'), 'finish', [], 'These original specialty previews add softer metal options. They are not undertone measurements and do not influence the seasonal suggestion.')
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
export function wardrobePalette(homeId, flowKind = null) {
  const home = HOMES[homeId]; if (!home) return [];
  const warm = home.temperature > 0;
  let l = home.depth === 'Light' ? .72 : .5;
  let c = home.intensity > 0 ? .12 : .05;
  if (flowKind === 'depth') l += home.depth === 'Light' ? .05 : -.04;
  if (flowKind === 'energy') c += home.intensity > 0 ? .025 : -.012;
  return [
    color(homeId+'-rose','Rose',l,c,warm?35:345), color(homeId+'-green','Green',l,c,warm?135:170),
    color(homeId+'-blue','Blue',l,c,warm?235:265), color(homeId+'-violet','Violet',l,c,warm?305:315),
    color(homeId+'-accent',warm?'Golden yellow':'Berry',l+.05,c,warm?85:355),
    color(homeId+'-white',warm?'Warm white':'Cool white',.95,warm?.025:.006,warm?85:265),
    color(homeId+'-neutral',warm?'Soft earth':'Soft gray',.58,.025,warm?65:265),
    color(homeId+'-dark',warm?'Deep brown':'Deep navy',.29,.035,warm?55:265)
  ];
}
