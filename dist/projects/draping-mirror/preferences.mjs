import { DEFAULT_SETTINGS, readSettings, SETTINGS_KEY } from './study.mjs';

export function createPreferences($, changed) {
  let settings = DEFAULT_SETTINGS;
  try { settings = readSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY)) ?? DEFAULT_SETTINGS); } catch (_) {}
  const deviceDark = matchMedia('(prefers-color-scheme: dark)');
  function appearance() {
    const dark = settings.theme === 'dark' || (settings.theme === 'system' && deviceDark.matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.dataset.large = String(settings.large);
    document.querySelector('meta[name="theme-color"]').content = dark ? '#151515' : '#F3F1EC';
  }
  function set(patch) {
    settings = readSettings({ ...settings, ...patch });
    appearance();
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (_) {}
    changed(settings, patch);
  }
  deviceDark.addEventListener('change', appearance);
  appearance();

  $('preferences').addEventListener('click', () => {
    $('interface-theme').value = settings.theme;
    $('mirror-surround').value = settings.background === 'drape' ? 'drape' : settings.surround;
    $('appearance').showModal();
  });
  $('interface-theme').addEventListener('change', event => set({ theme: event.target.value }));
  $('mirror-surround').addEventListener('change', event => {
    const value = event.target.value;
    set(value === 'drape' ? { background: 'drape' } : { background: 'neutral', surround: value });
  });
  $('close-appearance').addEventListener('click', () => $('appearance').close());

  function step(guidance, focus) {
    $('assistance-needs').hidden = guidance;
    $('assistance-guidance').hidden = !guidance;
    if (focus) (guidance ? $('assistance-form').querySelector('[name=guidance]:checked') : $('color-access')).focus();
  }
  const colorHelp = {
    standard: 'Every drape has a name and a letter for comparisons.',
    'red-green': 'Add hue labels for reds and greens, plus lightness and intensity cues across the mirror.',
    'blue-yellow': 'Add hue labels for blues and yellows, plus lightness and intensity cues across the mirror.',
    any: 'Add hue, lightness, and intensity descriptions to each drape.'
  };
  function updateColorHelp() { $('color-help').textContent = colorHelp[$('color-access').value]; }
  $('color-access').addEventListener('change', updateColorHelp);
  function open() {
    $('color-access').value = settings.colorAccess;
    updateColorHelp();
    $('large-controls').checked = settings.large;
    $('paired-view').checked = settings.paired;
    $('assistance-form').querySelector('[value="' + settings.guidance + '"]').checked = true;
    step(false, false);
    $('assistance').showModal();
    $('assistance-title').focus();
  }
  for (const id of ['header-assist', 'setup-assistance']) $(id).addEventListener('click', open);
  $('close-assistance').addEventListener('click', () => $('assistance').close());
  $('assistance-next').addEventListener('click', () => step(true, true));
  $('assistance-back').addEventListener('click', () => step(false, true));
  $('assistance-form').addEventListener('submit', event => {
    event.preventDefault();
    set({
      colorAccess: $('color-access').value, large: $('large-controls').checked, paired: $('paired-view').checked,
      guidance: $('assistance-form').querySelector('[name=guidance]:checked').value
    });
    $('assistance').close();
    $('import-status').textContent = 'Assistance settings applied.';
  });
  return () => settings;
}
