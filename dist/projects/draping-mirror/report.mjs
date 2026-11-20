import { SAMPLE_LABELS } from './study.mjs';
import { tonalSpan } from './contrast.mjs';

const DISCLAIMER = 'Lighting, camera processing, and displays can affect a digital analysis. Check these observations with physical drapes or a trained personal color professional.';
const element = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const heading = (title, description) => {
  const section = element('section', '', 'report-section');
  section.append(element('h3', title));
  if (description) section.append(element('p', description, 'small'));
  return section;
};

function swatch(drape) {
  const item = element('li');
  const color = element('span', '', 'report-chip');
  color.style.backgroundColor = drape.hex;
  color.setAttribute('aria-hidden', 'true');
  item.append(color, element('span', drape.name));
  return item;
}

export function renderReport(root, report, { openPair, removePair } = {}) {
  const printable = !openPair;
  const { result, groups, comparisons, observations, contrast, notes, practice, flagsSeen } = report;
  const sectionGrid = element('div', '', 'report-grid');
  const selected = [];
  if (report.collectionLabel) selected.push(element('p', 'Palette explored · ' + report.collectionLabel, 'small'));
  for (const group of groups) {
    const section = heading(group.title, group.origin);
    if (group.colors.length) {
      const list = element('ul', '', 'report-swatches');
      list.append(...group.colors.map(swatch));
      section.append(list);
    } else {
      section.append(element('p', group.title.startsWith('Best') ? 'Keep colors or record a drape preference to build this palette.' :
        'Choose a primary season to see palette ideas.', 'small'));
    }
    sectionGrid.append(section);
  }

  const observationsSection = heading('Your observations');
  for (const [axis, evidence, a, b] of [
    ['Undertone', result.temperature, 'warm', 'cool'], ['Intensity', result.intensity, 'bright', 'soft']
  ]) {
    observationsSection.append(element('p', axis + ' · ' + a + ' ' + evidence.positive + ' / ' + b + ' ' + evidence.negative +
      ' / undecided or unrecorded ' + (4 - evidence.total)));
  }
  if (flagsSeen.length) observationsSection.append(element('p', 'Primary-season flags viewed · ' +
    flagsSeen.map(season => season[0].toUpperCase() + season.slice(1)).join(', '), 'small'));
  if (result.mixed) observationsSection.append(element('p', 'Some comparisons pointed in different directions.', 'small'));
  if (observations.length) {
    const list = element('ul');
    for (const { title, choice } of observations) list.append(element('li', title + ' · ' + choice));
    if (printable) observationsSection.append(list);
    else {
      const details = element('details');
      details.append(element('summary', 'Read individual observations'), list);
      observationsSection.append(details);
    }
  }

  const measured = heading('Measured from the photo', 'Readings reflect the pixels, lighting, and exposure of one image.');
  if (contrast) {
    const list = element('ul');
    contrast.forEach((value, index) => list.append(element('li', SAMPLE_LABELS[index] + ' · ' + value.toFixed(1) + '% luminance')));
    measured.append(list, element('p', 'Tonal span · ' + tonalSpan(contrast).toFixed(1) + ' percentage points'));
  } else measured.append(element('p', 'No tonal reading saved.', 'small'));

  const saved = heading('Saved comparisons', 'Pairs you chose to keep.');
  if (comparisons.length) {
    const list = element('ul', '', 'saved-pairs');
    for (const [index, pair] of comparisons.entries()) {
      const row = element('li');
      row.append(element('strong', pair.title || 'Drape comparison'));
      const drapes = element('ul', '', 'report-swatches');
      drapes.append(swatch({ ...pair.a, name: 'A · ' + pair.a.name }), swatch({ ...pair.b, name: 'B · ' + pair.b.name }));
      row.append(drapes);
      if (pair.choice) row.append(element('p', 'Observation · ' + ({ a: pair.a.name, b: pair.b.name, both: 'Both work', unsure: 'Undecided' }[pair.choice]), 'small'));
      if (!printable) {
        const actions = element('div', '', 'action-row');
        for (const [name, action] of [['Review this pair', () => openPair(pair)], ['Remove pair', () => removePair(index)]]) {
          const button = element('button', name, 'text-button');
          button.type = 'button';
          button.setAttribute('aria-label', name + ' · ' + pair.a.name + ' and ' + pair.b.name);
          button.addEventListener('click', action);
          actions.append(button);
        }
        row.append(actions);
      }
      list.append(row);
    }
    saved.append(list);
  } else saved.append(element('p', 'Keep an A/B pair from Tools or the palette browser.', 'small'));

  if (!printable) {
    root.replaceChildren(...selected, sectionGrid, observationsSection, measured, saved);
    return;
  }
  const title = element('h1', 'DRAPER');
  const subtitle = element('h2', result.label);
  root.replaceChildren(title, element('p', practice ? 'Practice report · sample portrait' : 'Personal color analysis'), subtitle);
  if (report.primary) root.append(element('p', 'Season explored · ' + report.primary + (result.flow ? ' · ' + result.flow.label : ' · sub-season open')));
  else root.append(element('p', 'Sub-season open'));
  if (result.leader) root.append(element('p', 'Direction from your observations · ' + result.leader.name));
  root.append(...selected, sectionGrid, observationsSection, measured, saved);
  if (notes.trim()) {
    const note = heading('Your notes');
    note.append(element('p', notes, 'written-note'));
    root.append(note);
  }
  root.append(element('p', DISCLAIMER, 'small'));
}

export function paletteGraphic(report) {
  const width = 1200, margin = 72, tile = 142, stride = 151, columns = 7;
  const groups = report.groups.filter(group => group.colors.length);
  const rows = group => Math.ceil(group.colors.length / columns);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = (report.collectionLabel ? 450 : 410) + groups.reduce((height, group) => height + 96 + 105 * rows(group), 0);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#181218'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#E9B9D0'; ctx.font = '600 28px system-ui'; ctx.fillText('D R A P E R', margin, 86);
  ctx.fillStyle = '#FFF3F5'; ctx.font = '84px "Instrument Serif", Georgia, serif'; ctx.fillText(report.result.label, margin, 190, width - 2 * margin);
  ctx.font = '24px system-ui'; ctx.fillStyle = '#DCC8D4';
  ctx.fillText(report.practice ? 'Practice palette · sample portrait' : 'Personal color palette', margin, 246);
  if (report.collectionLabel) ctx.fillText('Palette explored · ' + report.collectionLabel, margin, 284, width - 2 * margin);
  let y = report.collectionLabel ? 360 : 320;
  for (const group of groups) {
    ctx.fillStyle = '#FFF3F5'; ctx.font = '36px "Instrument Serif", Georgia, serif'; ctx.fillText(group.title, margin, y);
    ctx.fillStyle = '#DCC8D4'; ctx.font = '20px system-ui'; ctx.fillText(group.origin, margin, y + 31);
    group.colors.forEach(({ name, hex }, index) => {
      const x = margin + index % columns * stride, top = y + 53 + Math.floor(index / columns) * 105;
      ctx.fillStyle = hex; ctx.fillRect(x, top, tile, 61);
      ctx.fillStyle = '#FFF3F5'; ctx.font = '17px system-ui'; ctx.fillText(name, x, top + 85, tile - 4);
    });
    y += 96 + 105 * rows(group);
  }
  if (!groups.length) {
    ctx.fillStyle = '#DCC8D4'; ctx.fillText('Your palette is open. Try more comparisons to collect colors.', margin, 325);
  }
  ctx.fillStyle = '#DCC8D4'; ctx.font = '16px system-ui'; ctx.fillText('Digital swatches · verify with physical materials', margin, canvas.height - 37);
  return canvas;
}
