const THROTTLE_MS = 32;

/**
 * @param {(...args: unknown[]) => void} fn
 * @param {number} ms
 */
function throttle(fn, ms) {
  let last = 0;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let timer = null;
  return (...args) => {
    const now = Date.now();
    const run = () => {
      last = Date.now();
      fn(...args);
    };
    if (now - last >= ms) {
      run();
    } else if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        run();
      }, ms - (now - last));
    }
  };
}

/**
 * @param {import('../audio/AudioEngine.js').AudioEngine} engine
 * @returns {string[]}
 */
export function bindSynthControls(engine) {
  const vm = () => engine.voiceManager;
  if (!vm()) {
    return [];
  }

  const wired = [];

  const waveButtons = document.querySelectorAll('[data-waveform]');
  const setWaveformActive = (type) => {
    for (const btn of waveButtons) {
      const isActive = btn.getAttribute('data-waveform') === type;
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
  };

  for (const btn of waveButtons) {
    if (btn.id) {
      wired.push(btn.id);
    }
    btn.addEventListener('click', () => {
      const wf = /** @type {OscillatorType} */ (btn.getAttribute('data-waveform'));
      vm().setParams({ waveform: wf });
      setWaveformActive(wf);
    });
  }
  setWaveformActive(vm().getParams().waveform);

  const masterVol = document.getElementById('master-volume');
  const masterVolLabel = document.getElementById('master-volume-value');
  if (masterVol instanceof HTMLInputElement) {
    wired.push('master-volume');
    masterVol.value = String(Math.round(engine.masterVolume * 100));
    const applyMaster = throttle((v) => {
      engine.masterVolume = v / 100;
      if (masterVolLabel) {
        masterVolLabel.textContent = `${Math.round(v)}%`;
      }
    }, THROTTLE_MS);
    masterVol.addEventListener('input', () => applyMaster(Number(masterVol.value)));
    applyMaster(Number(masterVol.value));
  }

  const bindAdsr = (prefix, key) => {
    const input = document.getElementById(`${prefix}-${key}`);
    const label = document.getElementById(`${prefix}-${key}-value`);
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    wired.push(`${prefix}-${key}`);
    const params = vm().getParams();
    const adsr =
      prefix === 'amp' ? params.ampAdsr : params.filter.feAdsr;
    if (key === 's') {
      input.value = String(Math.round((adsr.s ?? 0.5) * 100));
    } else if (key === 'a' || key === 'd' || key === 'r') {
      input.value = String(Math.round((adsr[key] ?? 0.1) * 1000));
    }
    const apply = throttle((raw) => {
      const num = Number(raw);
      if (prefix === 'amp') {
        if (key === 's') {
          vm().setParams({ ampAdsr: { [key]: num / 100 } });
          if (label) {
            label.textContent = `${Math.round(num)}%`;
          }
        } else {
          vm().setParams({ ampAdsr: { [key]: num / 1000 } });
          if (label) {
            label.textContent = `${Math.round(num)} ms`;
          }
        }
      } else if (prefix === 'fe') {
        if (key === 's') {
          vm().setParams({ filter: { feAdsr: { [key]: num / 100 } } });
          if (label) {
            label.textContent = `${Math.round(num)}%`;
          }
        } else {
          vm().setParams({ filter: { feAdsr: { [key]: num / 1000 } } });
          if (label) {
            label.textContent = `${Math.round(num)} ms`;
          }
        }
      }
    }, THROTTLE_MS);
    input.addEventListener('input', () => apply(input.value));
    apply(input.value);
  };

  ['a', 'd', 's', 'r'].forEach((k) => bindAdsr('amp', k));

  const cutoff = document.getElementById('filter-cutoff');
  const cutoffLabel = document.getElementById('filter-cutoff-value');
  if (cutoff instanceof HTMLInputElement) {
    wired.push('filter-cutoff');
    const p = vm().getParams().filter;
    cutoff.value = String(Math.round(p.cutoff));
    const applyCutoff = throttle((hz) => {
      vm().setFilterCutoff(hz);
      if (cutoffLabel) {
        const n = Number(hz);
        cutoffLabel.textContent =
          n >= 1000 ? `${(n / 1000).toFixed(1)} kHz` : `${Math.round(n)} Hz`;
      }
    }, THROTTLE_MS);
    cutoff.addEventListener('input', () => applyCutoff(Number(cutoff.value)));
    applyCutoff(Number(cutoff.value));
  }

  const resonance = document.getElementById('filter-resonance');
  const resonanceLabel = document.getElementById('filter-resonance-value');
  if (resonance instanceof HTMLInputElement) {
    wired.push('filter-resonance');
    resonance.value = String(vm().getParams().filter.resonance);
    const applyQ = throttle((q) => {
      vm().setParams({ filter: { resonance: Number(q) } });
      if (resonanceLabel) {
        resonanceLabel.textContent = Number(q).toFixed(1);
      }
    }, THROTTLE_MS);
    resonance.addEventListener('input', () => applyQ(resonance.value));
    applyQ(resonance.value);
  }

  const feToggle = document.getElementById('filter-fe-env');
  const fePanel = document.getElementById('filter-fe-adsr');
  const syncFePanel = (on) => {
    if (fePanel) {
      fePanel.classList.toggle('opacity-40', !on);
      fePanel.classList.toggle('pointer-events-none', !on);
    }
    if (feToggle) {
      feToggle.setAttribute('aria-checked', on ? 'true' : 'false');
      const knob = feToggle.querySelector('[data-fe-knob]');
      const track = feToggle.querySelector('[data-fe-track]');
      if (knob && track) {
        track.classList.toggle('bg-accent', on);
        track.classList.toggle('bg-surface-panel', !on);
        knob.classList.remove('left-0.5', 'right-0.5');
        knob.classList.add(on ? 'right-0.5' : 'left-0.5');
      }
    }
  };

  if (feToggle) {
    wired.push('filter-fe-env');
    const feOn = vm().getParams().filter.feEnabled;
    feToggle.addEventListener('click', () => {
      const next = !vm().getParams().filter.feEnabled;
      vm().setParams({ filter: { feEnabled: next } });
      syncFePanel(next);
    });
    syncFePanel(feOn);
  }

  ['a', 'd', 's', 'r'].forEach((k) => bindAdsr('fe', k));

  const delayTime = document.getElementById('delay-time');
  const delayTimeLabel = document.getElementById('delay-time-value');
  if (delayTime instanceof HTMLInputElement) {
    wired.push('delay-time');
    delayTime.value = String(Math.round(engine.delayTime * 1000));
    const apply = throttle((ms) => {
      engine.delayTime = Number(ms) / 1000;
      if (delayTimeLabel) {
        delayTimeLabel.textContent = `${Math.round(ms)} ms`;
      }
    }, THROTTLE_MS);
    delayTime.addEventListener('input', () => apply(delayTime.value));
    apply(delayTime.value);
  }

  const delayFeedback = document.getElementById('delay-feedback');
  const delayFeedbackLabel = document.getElementById('delay-feedback-value');
  if (delayFeedback instanceof HTMLInputElement) {
    wired.push('delay-feedback');
    delayFeedback.value = String(Math.round(engine.delayFeedback * 100));
    const apply = throttle((pct) => {
      engine.delayFeedback = Number(pct) / 100;
      if (delayFeedbackLabel) {
        delayFeedbackLabel.textContent = `${Math.round(pct)}%`;
      }
    }, THROTTLE_MS);
    delayFeedback.addEventListener('input', () => apply(delayFeedback.value));
    apply(delayFeedback.value);
  }

  const delayMix = document.getElementById('delay-mix');
  const delayMixLabel = document.getElementById('delay-mix-value');
  if (delayMix instanceof HTMLInputElement) {
    wired.push('delay-mix');
    delayMix.value = String(Math.round(engine.delayWet * 100));
    const apply = throttle((pct) => {
      engine.delayWet = Number(pct) / 100;
      if (delayMixLabel) {
        delayMixLabel.textContent = `${Math.round(pct)}% wet`;
      }
    }, THROTTLE_MS);
    delayMix.addEventListener('input', () => apply(delayMix.value));
    apply(delayMix.value);
  }

  wired.push('keyboard-octave');

  return wired;
}