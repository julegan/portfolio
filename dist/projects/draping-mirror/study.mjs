import { normalizeHex, toOKLCH } from './color.mjs';
import { readPalette } from './drapes.mjs';
import { HOMES, allQuestions, profile } from './session.mjs';
import { BRIDGES, COLLECTION_FAMILIES, collectionLabel, collectionName, collectionPalette, readCollection } from './collections.mjs';

export const SEASONS = Object.keys(HOMES);
export const SURROUNDS = { pale: '#D4D4D4', middle: '#969696', charcoal: '#424242' };
export const DEFAULT_SETTINGS = Object.freeze({
  theme: 'dark', surround: 'pale', background: 'drape', guidance: 'independent', colorAccess: 'standard', large: false, paired: false
});
export const SETTINGS_KEY = 'julieowens.draper.settings.v1';
const oneOf = (value, options, fallback) => options.includes(value) ? value : fallback;
export function readSettings(input = {}) {
  return {
    theme: oneOf(input?.theme, ['system', 'light', 'dark'], 'dark'),
    surround: oneOf(input?.surround, Object.keys(SURROUNDS), 'pale'),
    background: oneOf(input?.background, ['drape', 'neutral'], 'drape'),
    guidance: oneOf(input?.guidance, ['independent', 'guided', 'assisted'], 'independent'),
    colorAccess: oneOf(input?.colorAccess, ['standard', 'red-green', 'blue-yellow', 'any'], 'standard'),
    large: input?.large === true, paired: input?.paired === true
  };
}

export function seasonalFlag(family, flow = 'home', adjustments) {
  const colors = collectionPalette(family, flow, adjustments);
  const wearable = colors.filter(drape => drape.group === 'colors');
  const rows = [0, 1, 2].map(tone => wearable.filter((_, index) => index % 3 === tone));
  rows.push(colors.filter(drape => drape.group !== 'colors'));
  return { id: 'flag-' + family + '-' + flow, name: flow === 'home' && HOMES[family] ? HOMES[family].name : collectionName(family, flow), family, flow, adjustments, rows };
}

export function describeColor(hex, colorAccess) {
  if (colorAccess === 'standard') return '';
  const { lightness, chroma, hue } = toOKLCH(hex);
  const depth = lightness < .36 ? 'deep' : lightness < .7 ? 'mid-tone' : 'light';
  const intensity = chroma < .025 ? 'near-neutral' : chroma < .10 ? 'muted' : 'vivid';
  // These are broad descriptions of the displayed swatch in OKLCH.
  const family = hue < 20 || hue >= 355 ? 'red-pink' : hue < 62 ? 'orange-red' : hue < 115 ? 'yellow' :
    hue < 175 ? 'green' : hue < 222 ? 'blue-green' : hue < 280 ? 'blue' : hue < 326 ? 'violet' : 'pink-violet';
  if (chroma < .025) return depth + ' · ' + intensity;
  if (colorAccess === 'red-green' && ['red-pink', 'orange-red', 'green', 'blue-green'].includes(family)) return family + ' · ' + depth + ', ' + intensity;
  if (colorAccess === 'blue-yellow' && ['yellow', 'blue-green', 'blue', 'violet'].includes(family)) return family + ' · ' + depth + ', ' + intensity;
  return colorAccess === 'any' ? family + ' · ' + depth + ', ' + intensity : depth + ', ' + intensity;
}

const MAX_COMPARISONS = 24;
const MAX_NOTES = 2000;
const ANSWERS = ['a', 'b', 'both', 'unsure'];
function cleanSwatch(input) {
  const hex = typeof input?.hex === 'string' && normalizeHex(input.hex);
  if (!hex || typeof input.name !== 'string' || !input.name.trim()) return null;
  return { name: input.name.trim().slice(0, 120), hex, finish: oneOf(input.finish, ['matte', 'polished', 'satin'], 'matte') };
}
export function savedPair(a, b, title, choice) {
  const first = cleanSwatch(a), second = cleanSwatch(b);
  if (!first || !second) return null;
  return { a: first, b: second, title: typeof title === 'string' ? title.trim().slice(0, 120) : 'Drape comparison', choice: oneOf(choice, ANSWERS, null) };
}
export function retainComparison(list, comparison) {
  const key = item => JSON.stringify(item);
  if (!comparison || list.some(item => key(item) === key(comparison)) || list.length >= MAX_COMPARISONS) return list;
  return [...list, comparison];
}

function reading(input) {
  if (!Array.isArray(input) || input.length !== 3) return null;
  if (!input.every(value => Number.isFinite(value) && value >= 0 && value <= 100)) return null;
  return input.map(value => Math.round(value * 10) / 10);
}

export function analysisFile({ answers, primary, practice, colors, comparisons, notes, contrast, flagsSeen, collection }) {
  const safeAnswers = {};
  const chosenHome = oneOf(primary, SEASONS, null);
  for (const q of allQuestions(answers, chosenHome)) {
    if (q.axis === 'flow' && !chosenHome) continue;
    if (Object.hasOwn(answers, q.id) && ANSWERS.includes(answers[q.id])) safeAnswers[q.id] = answers[q.id];
  }
  return {
    format: 'draper-analysis', version: 1, practice: practice === true,
    primary: chosenHome, answers: safeAnswers,
    colors: readPalette(JSON.stringify(Array.isArray(colors) ? colors : [])),
    comparisons: Array.isArray(comparisons) ? comparisons.slice(0, MAX_COMPARISONS).flatMap(item => {
      const pair = savedPair(item?.a, item?.b, item?.title, item?.choice);
      return pair ? [pair] : [];
    }) : [],
    notes: typeof notes === 'string' ? notes.slice(0, MAX_NOTES) : '',
    contrast: reading(contrast),
    flagsSeen: Array.isArray(flagsSeen) ? [...new Set(flagsSeen.filter(season => SEASONS.includes(season)))] : [],
    collection: readCollection(collection)
  };
}

export function parseAnalysis(raw) {
  const data = JSON.parse(raw);
  if (data?.format === 'draping-mirror-palette' && data.version === 1 && Array.isArray(data.colors)) {
    return { format: data.format, colors: readPalette(JSON.stringify(data.colors)) };
  }
  if (data?.format !== 'draper-analysis' || data.version !== 1 || typeof data.practice !== 'boolean' ||
      !data.answers || typeof data.answers !== 'object' || Array.isArray(data.answers) ||
      !Array.isArray(data.colors) || !Array.isArray(data.comparisons)) throw new TypeError('Invalid DRAPER analysis');
  return analysisFile(data);
}

const makeupFamilies = {
  spring: { lip: ['coral-0', 'pink-0', 'rose-0'], face: ['apricot-0', 'rose-1', 'neutral-4'], eye: ['neutral-5', 'green-2', 'teal-0'] },
  summer: { lip: ['rose-0', 'pink-0', 'berry-0'], face: ['rose-1', 'pink-1', 'neutral-4'], eye: ['lilac-0', 'neutral-6', 'neutral-7'] },
  autumn: { lip: ['rust-0', 'red-0', 'wine-0'], face: ['apricot-0', 'rose-0', 'neutral-5'], eye: ['neutral-3', 'sage-0', 'forest-0'] },
  winter: { lip: ['red-0', 'berry-0', 'wine-0'], face: ['pink-1', 'rose-0', 'neutral-4'], eye: ['lilac-0', 'neutral-4', 'neutral-5'] }
};

export const SAMPLE_LABELS = ['Skin', 'Hair or brow', 'Eye or lip'];

export function buildReport(data) {
  const result = profile(data.answers, data.primary);
  const home = data.primary ?? result.leader?.id;
  const selection = readCollection(data.collection);
  const family = selection?.family ?? home;
  const drapes = family ? collectionPalette(family, selection?.flow ?? result.flow?.kind, selection?.adjustments) : [];
  const lookup = keys => keys.map(key => drapes.find(drape => drape.swatchKey === key)).filter(Boolean);
  const makeup = makeupFamilies[family] ?? (BRIDGES[family] && { lip: ['red-0', 'rose-0', 'berry-0'], face: ['pink-1', 'rose-1', 'neutral-4'], eye: ['lilac-0', 'neutral-4', 'neutral-5'] });
  const favorites = [];
  const finishes = { neutrals: [], metals: [] };
  const observations = [];
  for (const q of allQuestions(data.answers, data.primary)) {
    const choice = data.answers[q.id];
    if (!choice) continue;
    const picks = choice === 'a' ? [q.drapes[0]] : choice === 'b' ? [q.drapes[1]] : choice === 'both' ? q.drapes : [];
    if (q.axis === 'finish') finishes[q.drapes[0].finish === 'matte' ? 'neutrals' : 'metals'].push(...picks);
    else if (picks.length === 1) favorites.push(...picks);
    observations.push({ title: q.title, choice: picks.map(drape => drape.name).join(' and ') || 'Undecided' });
  }
  const namedColors = new Map([...favorites, ...COLLECTION_FAMILIES.flatMap(season => collectionPalette(season))].map(drape => [drape.hex, drape.name]));
  const kept = data.colors.map(hex => ({ name: namedColors.get(hex) ?? 'Saved color', hex }));
  const unique = swatches => [...new Map(swatches.map(drape => [drape.hex, drape])).values()];
  const groups = [
    { title: 'Best colors from your comparisons', origin: 'Your picks and saved colors', colors: unique([...kept, ...favorites]) },
    { title: 'Neutrals', origin: finishes.neutrals.length ? 'Your finishing choices' : 'Palette ideas to try', colors: unique(finishes.neutrals.length ? finishes.neutrals : lookup(['neutral-0', 'neutral-4', 'neutral-6'])) },
    { title: 'Metals', origin: finishes.metals.length ? 'Your finishing choices · simulated' : 'Palette ideas to try · simulated', colors: unique(finishes.metals.length ? finishes.metals : lookup(['metal-0', 'metal-1', 'metal-2'])) },
    { title: 'Lipstick', origin: 'Palette ideas to try', colors: makeup ? lookup(makeup.lip) : [] },
    { title: 'Makeup palette · cheeks', origin: 'Palette ideas to try', colors: makeup ? lookup(makeup.face) : [] },
    { title: 'Makeup palette · eyes', origin: 'Palette ideas to try', colors: makeup ? lookup(makeup.eye) : [] }
  ];
  const bridge = BRIDGES[family];
  if (bridge) {
    groups.splice(1, 0, { title: bridge.name, origin: 'Palette explored · ' + bridge.description, colors: lookup(['red-0', 'rose-0', 'violet-0', 'blue-0', 'teal-0', 'green-0', 'yellow-0']) });
  }
  return { ...data, result, home, groups, observations, collectionLabel: collectionLabel(selection) };
}
