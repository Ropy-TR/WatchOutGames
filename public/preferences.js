(() => {
  const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
  const write = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
  const picker = document.querySelector('#accentColor');
  const toggle = document.querySelector('#turnSound');
  const luminance = rgb => rgb.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
  function readableColor(rgb) {
    let result = rgb.slice();
    for (let amount = 0; luminance(result) < .27 && amount <= 1; amount += .025) result = rgb.map(v => Math.round(v + (255 - v) * amount));
    return result;
  }
  function applyColor(value) {
    if (!/^#[0-9a-f]{6}$/i.test(value)) value = '#f2cf43';
    const rgb = value.slice(1).match(/../g).map(v => parseInt(v, 16));
    const light = luminance(rgb);
    const ink = (light + .05) / .05 >= 1.05 / (light + .05) ? '#000000' : '#ffffff';
    // Keep text legible on the black panels even when the selected accent is dark.
    const readable = readableColor(rgb);
    let inverse = rgb.map(v => 255 - v), opponent = readableColor(inverse);
    // Mid-grey is almost its own inverse. Keep the two teams visibly different there too.
    if (Math.hypot(...readable.map((value, i) => value - opponent[i])) < 110) {
      inverse = [113, 181, 255]; opponent = readableColor(inverse);
    }
    const style = document.documentElement.style;
    style.setProperty('--accent', value);
    style.setProperty('--accent-ink', ink);
    style.setProperty('--yellow', `rgb(${readable.join(',')})`);
    style.setProperty('--opponent', `rgb(${opponent.join(',')})`);
    style.setProperty('--opponent-accent', `rgb(${inverse.join(',')})`);
    picker.value = value;
    write('wg-accent', value);
  }
  applyColor(read('wg-accent') || '#f2cf43');
  picker.addEventListener('input', () => applyColor(picker.value));
  let enabled = read('wg-turn-sound') !== 'off', context;
  const seen = new Set();
  function updateButton() { toggle.textContent = enabled ? 'Ses açık' : 'Ses kapalı'; toggle.setAttribute('aria-pressed', String(enabled)); toggle.title = 'XOX sıra sesi'; }
  function unlock() {
    if (!enabled) return;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    try { context ||= new Audio(); if (context.state === 'suspended') context.resume().catch(() => {}); } catch {}
  }
  document.addEventListener('pointerdown', unlock, { passive: true });
  document.addEventListener('keydown', unlock);
  function chime() {
    if (!enabled || !context || context.state !== 'running') return;
    try {
      const start = context.currentTime;
      [660, 880].forEach((frequency, i) => {
        const oscillator = context.createOscillator(), gain = context.createGain(), at = start + i * .13;
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(.12, at + .015);
        gain.gain.exponentialRampToValueAtTime(.001, at + .18);
        oscillator.connect(gain); gain.connect(context.destination);
        oscillator.start(at); oscillator.stop(at + .2);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      });
    } catch {}
  }
  toggle.onclick = () => { enabled = !enabled; write('wg-turn-sound', enabled ? 'on' : 'off'); updateButton(); if (enabled) { unlock(); chime(); } };
  updateButton();
  window.watchoutPreferences = {
    notifyTurn(game, playerId) {
      if (!game || !['xox', 'lol-xox'].includes(game.kind) || game.winner || !game.boardId || !game.turnId) return;
      const key = `${game.kind}:${game.boardId}:${game.turnId}`;
      if (seen.has(key)) return;
      seen.add(key);
      if (seen.size > 500) seen.delete(seen.values().next().value);
      if (game.teams?.[game.turn]?.includes(playerId)) chime();
    }
  };
})();
