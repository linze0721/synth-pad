/**
 * Updates DOM controls to match current engine / voice params (after preset load).
 * @param {import('../audio/AudioEngine.js').AudioEngine} engine
 * @param {{ octave?: number } | null} keyboard
 */
export function syncControlsFromParams(engine, keyboard) {
  const vm = engine.voiceManager;
  if (!vm) return;

  const params = vm.getParams();

  const waveButtons = document.querySelectorAll('[data-waveform]');
  for (const btn of waveButtons) {
    const isActive = btn.getAttribute('data-waveform') === params.waveform;
    btn.classList.toggle('border-accent', isActive);
    btn.classList.toggle('bg-accent/20', isActive);
    btn.classList.toggle('text-accent-glow', isActive);
    btn.classList.toggle('shadow-inner', isActive);
    btn.classList.toggle('shadow-accent/20', isActive);
    btn.classList.toggle('border-surface-border', !isActive);
    btn.classList.toggle('bg-surface-panel', !isActive);
    btn.classList.toggle('text-slate-400', !isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  }

  const masterVol = document.getElementById('master-volume');
  const masterVolLabel = document.getElementById('master-volume-value');
  if (masterVol instanceof HTMLInputElement) {
    masterVol.value = String(Math.round(engine.masterVolume * 100));
    if (masterVolLabel) {
      masterVolLabel.textContent = `${Math.round(engine.masterVolume * 100)}%`;
    }
  }

  const syncAdsr = (prefix, adsr) => {
    for (const key of ['a', 'd', 's', 'r']) {
      const input = document.getElementById(`${prefix}-${key}`);
      const label = document.getElementById(`${prefix}-${key}-value`);
      if (!(input instanceof HTMLInputElement)) continue;
      if (key === 's') {
        input.value = String(Math.round((adsr.s ?? 0.5) * 100));
        if (label) label.textContent = `${Math.round((adsr.s ?? 0.5) * 100)}%`;
      } else {
        const ms = Math.round((adsr[key] ?? 0.1) * 1000);
        input.value = String(ms);
        if (label) label.textContent = `${ms} ms`;
      }
    }
  };
  syncAdsr('amp', params.ampAdsr);
  syncAdsr('fe', params.filter.feAdsr);

  const cutoff = document.getElementById('filter-cutoff');
  const cutoffLabel = document.getElementById('filter-cutoff-value');
  if (cutoff instanceof HTMLInputElement) {
    cutoff.value = String(Math.round(params.filter.cutoff));
    if (cutoffLabel) {
      const n = params.filter.cutoff;
      cutoffLabel.textContent =
        n >= 1000 ? `${(n / 1000).toFixed(1)} kHz` : `${Math.round(n)} Hz`;
    }
  }

  const resonance = document.getElementById('filter-resonance');
  const resonanceLabel = document.getElementById('filter-resonance-value');
  if (resonance instanceof HTMLInputElement) {
    resonance.value = String(params.filter.resonance);
    if (resonanceLabel) {
      resonanceLabel.textContent = Number(params.filter.resonance).toFixed(1);
    }
  }

  const feToggle = document.getElementById('filter-fe-env');
  const fePanel = document.getElementById('filter-fe-adsr');
  const feOn = params.filter.feEnabled;
  if (fePanel) {
    fePanel.classList.toggle('opacity-40', !feOn);
    fePanel.classList.toggle('pointer-events-none', !feOn);
  }
  if (feToggle) {
    feToggle.setAttribute('aria-checked', feOn ? 'true' : 'false');
    const knob = feToggle.querySelector('[data-fe-knob]');
    const track = feToggle.querySelector('[data-fe-track]');
    if (knob && track) {
      track.classList.toggle('bg-accent', feOn);
      track.classList.toggle('bg-surface-panel', !feOn);
      knob.classList.remove('left-0.5', 'right-0.5');
      knob.classList.add(feOn ? 'right-0.5' : 'left-0.5');
    }
  }

  const delayTime = document.getElementById('delay-time');
  const delayTimeLabel = document.getElementById('delay-time-value');
  if (delayTime instanceof HTMLInputElement) {
    delayTime.value = String(Math.round(engine.delayTime * 1000));
    if (delayTimeLabel) {
      delayTimeLabel.textContent = `${Math.round(engine.delayTime * 1000)} ms`;
    }
  }

  const delayFeedback = document.getElementById('delay-feedback');
  const delayFeedbackLabel = document.getElementById('delay-feedback-value');
  if (delayFeedback instanceof HTMLInputElement) {
    delayFeedback.value = String(Math.round(engine.delayFeedback * 100));
    if (delayFeedbackLabel) {
      delayFeedbackLabel.textContent = `${Math.round(engine.delayFeedback * 100)}%`;
    }
  }

  const delayMix = document.getElementById('delay-mix');
  const delayMixLabel = document.getElementById('delay-mix-value');
  if (delayMix instanceof HTMLInputElement) {
    delayMix.value = String(Math.round(engine.delayWet * 100));
    if (delayMixLabel) {
      delayMixLabel.textContent = `${Math.round(engine.delayWet * 100)}% wet`;
    }
  }

  if (keyboard && typeof keyboard.octave === 'number') {
    const octaveEl = document.getElementById('keyboard-octave');
    if (octaveEl) {
      octaveEl.textContent = String(keyboard.octave);
      octaveEl.dataset.octave = String(keyboard.octave);
    }
  }
}