export function createFlagPicker({ container, previous, next, status }, onSelect) {
  let list = [], buttons = [], index = 0;
  function select(position) {
    index = (position + list.length) % list.length;
    const flag = list[index];
    buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
    status.textContent = flag.name + ' · ' + (index + 1) + ' of ' + list.length;
    onSelect(flag);
  }
  previous.addEventListener('click', () => select(index - 1));
  next.addEventListener('click', () => select(index + 1));
  container.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key) || event.ctrlKey || event.altKey || event.metaKey) return;
    event.preventDefault();
    select(index + (event.key === 'ArrowLeft' ? -1 : 1));
    buttons[index].focus();
  });
  const show = (flags, selected) => {
    list = flags;
    buttons = flags.map((flag, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'quiet';
      const preview = document.createElement('span');
      preview.className = 'flag-miniature';
      preview.setAttribute('aria-hidden', 'true');
      for (const row of flag.rows) {
        const line = document.createElement('span');
        for (const drape of row) {
          const color = document.createElement('i');
          color.style.setProperty('--flag-color', drape.hex);
          line.append(color);
        }
        preview.append(line);
      }
      button.append(preview, document.createTextNode(flag.name));
      button.addEventListener('click', () => select(i));
      return button;
    });
    container.replaceChildren(...buttons);
    select(Math.max(0, list.findIndex(flag => flag.id === selected)));
  };
  return { show, step: direction => select(index + direction) };
}
