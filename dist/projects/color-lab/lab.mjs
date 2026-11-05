import { sample, contrast } from './engine.mjs';

const byId = id => document.getElementById(id);
const hue = byId('hue');
const background = byId('bg');
const target = byId('target');
const choices = byId('choices');
const field = byId('field');
let selected = { row: 5, column: 7 };
let available = [];

function selectTile(tile) {
  field.querySelector('.chosen')?.classList.remove('chosen');
  selected = tile;
  tile.element.classList.add('chosen');
  choices.value = tile.key;
  const specimen = byId('specimen');
  specimen.style.color = tile.hex;
  specimen.style.backgroundColor = background.value;
  specimen.style.fontSize = [1, 3].includes(target.selectedIndex) ? '24px' : '16px';
  byId('foreground').textContent = tile.hex;
  byId('ratio').textContent = tile.ratio.toFixed(2) + ':1';
}

function render() {
  available = [];
  choices.replaceChildren();
  field.replaceChildren();
  byId('degrees').value = hue.value + '°';
  for (let row = 0; row <= 20; row++) {
    const lightness = 1 - row / 20;
    for (let column = 0; column <= 12; column++) {
      const chroma = column * 0.025;
      const hex = sample(lightness, chroma, Number(hue.value));
      const ratio = hex && contrast(hex, background.value);
      const element = document.createElement('div');
      field.append(element);
      if (!hex || ratio < Number(target.value)) {
        element.className = 'tile ' + (hex ? 'low' : 'outside');
        continue;
      }
      const key = row + '-' + column;
      const label = hex + ' · L ' + lightness.toFixed(2) + ' · C ' + chroma.toFixed(3);
      const tile = { row, column, hex, ratio, key, element };
      available.push(tile);
      choices.add(new Option(label, key));
      element.className = 'tile valid';
      element.title = label;
      element.style.backgroundColor = hex;
      element.addEventListener('click', () => selectTile(tile));
    }
  }
  choices.disabled = !available.length;
  byId('count').textContent = available.length + ' of 273 samples meet this target.';
  if (!available.length) {
    choices.add(new Option('No matching colors'));
    byId('foreground').textContent = '';
    byId('ratio').textContent = '';
    byId('specimen').hidden = true;
    byId('count').textContent += ' Change the background or target to explore more colors.';
    return;
  }
  byId('specimen').hidden = false;
  const distance = t => (t.row - selected.row)**2 + (t.column - selected.column)**2;
  selectTile(available.reduce((best, t) => distance(t) < distance(best) ? t : best));
}

choices.addEventListener('change', () => selectTile(available[choices.selectedIndex]));
hue.addEventListener('input', render);
target.addEventListener('change', render);
const hexInput = byId('hex');
background.addEventListener('input', () => {
  hexInput.value = background.value.toUpperCase();
  hexInput.removeAttribute('aria-invalid');
  byId('error').textContent = '';
  render();
});
hexInput.addEventListener('change', () => {
  const match = hexInput.value.trim().match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!match) {
    hexInput.setAttribute('aria-invalid', 'true');
    byId('error').textContent = 'Enter 3 or 6 hex digits. The previous background is still in use.';
    return;
  }
  const digits = match[1];
  background.value = '#' + (digits.length === 3 ? digits.replace(/./g, '$&$&') : digits);
  background.dispatchEvent(new Event('input'));
});
render();
