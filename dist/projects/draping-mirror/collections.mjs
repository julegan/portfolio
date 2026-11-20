import { toOKLCH } from './color.mjs';
import { fitColor } from './drapes.mjs';
import { HOMES, FLOW_KINDS, flowOptions, normalizeRefinements, refinementLabel, seasonColorVariants, wardrobePalette } from './session.mjs';

// Original exploration palettes between the corresponding seasonal drapes.
// These choices describe a collection and never enter the season classifier.
export const BRIDGES = {
  'deep-neutral': { name: 'Deep Neutral', members: ['autumn', 'winter'], flow: 'depth', description: 'Explore depth between Deep Autumn and Deep Winter.' },
  'light-neutral': { name: 'Light Neutral', members: ['spring', 'summer'], flow: 'depth', description: 'Explore lightness between Light Spring and Light Summer.' },
  'soft-neutral': { name: 'Soft Neutral', members: ['autumn', 'summer'], flow: 'energy', description: 'Explore softness between Soft Autumn and Soft Summer.' },
  'bright-neutral': { name: 'Bright Neutral', members: ['spring', 'winter'], flow: 'energy', description: 'Explore brightness between Bright Spring and Bright Winter.' }
};
export const COLLECTION_FAMILIES = [...Object.keys(HOMES), ...Object.keys(BRIDGES)];
const colorNames = {
  red: 'Red', rose: 'Rose', pink: 'Pink', coral: 'Coral', berry: 'Berry', wine: 'Wine', violet: 'Violet', lilac: 'Lilac',
  blue: 'Blue', sky: 'Sky blue', navy: 'Navy', teal: 'Teal', aqua: 'Aqua', green: 'Green', sage: 'Sage', forest: 'Forest',
  yellow: 'Yellow', lemon: 'Lemon', ochre: 'Ochre', rust: 'Rust', apricot: 'Apricot', pale: 'Pale blue-green'
};
const neutralNames = ['Soft white', 'Stone', 'Shadow gray', 'Midnight', 'Ivory white', 'Pearl beige', 'Sand beige', 'Taupe', 'Gray brown', 'Cocoa gray', 'Charcoal', 'Deep neutral'];
const metalSources = [
  ['winter', 'extra-metal-0'], ['autumn', 'extra-metal-1'], ['winter', 'metal-0'], ['spring', 'metal-0'],
  ['spring', 'metal-3'], ['spring', 'metal-2'], ['summer', 'metal-2'], ['autumn', 'metal-2']
];

function midpoint(first, second) {
  const a = toOKLCH(first.hex), b = toOKLCH(second.hex);
  const angleA = a.hue * Math.PI / 180, angleB = b.hue * Math.PI / 180;
  const x = (a.chroma * Math.cos(angleA) + b.chroma * Math.cos(angleB)) / 2;
  const y = (a.chroma * Math.sin(angleA) + b.chroma * Math.sin(angleB)) / 2;
  return fitColor((a.lightness + b.lightness) / 2, Math.hypot(x, y), Math.atan2(y, x) * 180 / Math.PI).hex;
}

export function collectionOptions(family) {
  return Object.hasOwn(BRIDGES, family) ? [{ id: 'home', label: BRIDGES[family].name }] : flowOptions(family);
}
export function collectionName(family, flow = 'home') {
  return collectionOptions(family).find(option => option.id === flow)?.label ?? '';
}
export function readCollection(input) {
  if (!input || !COLLECTION_FAMILIES.includes(input.family)) return null;
  const flow = Object.hasOwn(BRIDGES, input.family) ? 'home' : FLOW_KINDS.includes(input.flow) ? input.flow : 'home';
  return { family: input.family, flow, adjustments: normalizeRefinements(input.adjustments) };
}
export function collectionLabel(selection) {
  if (!selection) return '';
  const extra = refinementLabel(selection.adjustments);
  return collectionName(selection.family, selection.flow) + (extra ? ' · ' + extra : '');
}

export function collectionPalette(family, flow = 'home', refinements = {}) {
  if (!Object.hasOwn(BRIDGES, family)) return wardrobePalette(family, flow, refinements);
  const bridge = BRIDGES[family], adjustments = normalizeRefinements(refinements);
  const [warm, cool] = bridge.members.map(home => wardrobePalette(home, bridge.flow, adjustments));
  const metals = metalSources.map(([home, key]) => wardrobePalette(home, 'home', adjustments).find(drape => drape.swatchKey === key));
  let neutral = 0, metal = 0;
  return warm.map((a, i) => {
    const b = cool[i];
    let name, hex, finish = a.finish;
    if (a.group === 'colors') {
      const [hue, tone] = a.swatchKey.split('-');
      name = colorNames[hue] + (tone === '1' ? ' · light' : tone === '2' ? ' · deep' : '');
      hex = midpoint(a, b);
    } else if (a.group === 'neutrals') {
      name = neutralNames[neutral++]; hex = midpoint(a, b);
    } else {
      const source = metals[metal++];
      ({ name, hex, finish } = source);
    }
    return Object.freeze({ ...a, id: family + '-' + a.id, family, flow: 'home', name, hex, finish, adjustments });
  });
}

export function collectionColorVariants(selected) {
  if (selected?.group !== 'colors' || !COLLECTION_FAMILIES.includes(selected.family)) return [];
  const bridges = Object.keys(BRIDGES).map(family => collectionPalette(family, 'home', selected.adjustments).find(drape => drape.swatchKey === selected.swatchKey));
  if (Object.hasOwn(BRIDGES, selected.family)) {
    const bridge = BRIDGES[selected.family];
    const anchor = wardrobePalette(bridge.members[0], bridge.flow, selected.adjustments).find(drape => drape.swatchKey === selected.swatchKey);
    if (!anchor) return [];
    return [selected, ...seasonColorVariants(anchor), ...bridges.filter(drape => drape?.id !== selected.id)].filter(Boolean);
  }
  return [...seasonColorVariants(selected), ...bridges].filter(Boolean);
}
