import { toOKLCH } from './color.mjs';

// Exploration state stays in memory and is independent of assessment answers.
export const emptyComparison = () => ({ a:null, b:null, active:'a', rest:false });
export function showPinned(state, slot) {
  return (slot==='a'||slot==='b') && state[slot] ? {...state,active:slot,rest:false} : state;
}
export function chooseCandidate(state, drape) {
  if(!drape?.id) return state;
  if(!state.a) return {...state,a:drape,active:'a',rest:false};
  if(state.a.id===drape.id) return showPinned(state,'a');
  return {...state,b:drape,active:'b',rest:false};
}
export function pinVisible(state) {
  if(state.rest || state.active!=='b' || !state.b) return state;
  return {...state,a:state.b,b:state.a,active:'a',rest:false};
}
export function comparisonPurpose(a,b) {
  if(!a) return 'Choose a drape to pin as A, then choose B.';
  if(!b) return 'A is pinned. Choose a drape for B.';
  const x=toOKLCH(a.hex),y=toOKLCH(b.hex);
  const changes=[];
  const depth=Math.abs(x.lightness-y.lightness)>.035;
  const intensity=Math.abs(x.chroma-y.chroma)>.025;
  const hue=Math.min(x.chroma,y.chroma)>.025 && Math.abs(((x.hue-y.hue+540)%360)-180)>10;
  if(hue) changes.push('hue');
  if(depth) changes.push('depth');
  if(intensity) changes.push('intensity');
  if(a.finish!==b.finish) changes.push('finish');
  const similar=[];
  if(!depth) similar.push('depth');
  if(!intensity) similar.push('intensity');
  if(!hue && Math.min(x.chroma,y.chroma)>.025) similar.push('hue');
  if(changes.length===0) return 'A close comparison · similar depth and intensity.';
  const title=changes.join(' + ');
  return title[0].toUpperCase()+title.slice(1)+(changes.length===1&&similar.length ? ' · similar '+similar.join(' and ') : ' change together');
}
