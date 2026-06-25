/**
 * Computer + virtual keyboard (Ableton-style chromatic map).
 * Base octave: C3 = MIDI 48 when UI octave is 3.
 */

/** @type {Readonly<Record<string, number>>} semitone offset within octave (0 = C) */
export const KEY_TO_SEMITONE = Object.freeze({
  z: 0,
  s: 1,
  x: 2,
  d: 3,
  c: 4,
  v: 5,
  g: 6,
  b: 7,
  h: 8,
  n: 9,
  j: 10,
  m: 11,
});

export const PLAY_KEYS = Object.freeze(Object.keys(KEY_TO_SEMITONE));

const OCTAVE_MIN = 0;
const OCTAVE_MAX = 8;
const DEFAULT_OCTAVE = 3;
/** MIDI note for C in the displayed octave number (octave 3 → 48). */
const MIDI_C_FOR_OCTAVE = (oct) => 12 * (oct + 1);

/**
 * @param {import('../audio/AudioEngine.js').AudioEngine} engine
 * @param {object} [options]
 * @param {HTMLElement} [options.root]
 */
export function initKeyboard(engine, options = {}) {
  const root = options.root ?? document;
  const octaveEl = root.querySelector('#keyboard-octave');
  const keyboardRoot =
    root.querySelector('#virtual-keyboard') ??
    root.querySelector('footer .relative.mx-auto');

  let octave = DEFAULT_OCTAVE;
  /** @type {Set<string>} */
  const keysHeld = new Set();
  /** @type {Map<string, number>} key -> midi while held */
  const keyToMidi = new Map();
  /** @type {Set<number>} */
  const midisHeld = new Set();
  /** @type {Map<number, number>} midi -> ref count (pointer + keyboard) */
  const midiRefCount = new Map();

  function midiForSemitone(semitone) {
    return MIDI_C_FOR_OCTAVE(octave) + semitone;
  }

  function updateOctaveDisplay() {
    if (octaveEl) {
      octaveEl.textContent = String(octave);
      octaveEl.dataset.octave = String(octave);
    }
  }

  function keyFromEvent(event) {
    const k = event.key?.length === 1 ? event.key.toLowerCase() : event.key;
    if (k === ',') return 'comma';
    if (k === '.') return 'period';
    return k;
  }

  function isTypingTarget(target) {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    return target.isContentEditable;
  }

  function setKeyHighlight(dataKey, on) {
    if (!keyboardRoot) return;
    const el = keyboardRoot.querySelector(`[data-key="${dataKey}"]`);
    if (el) el.classList.toggle('active', on);
  }

  function syncHighlightForMidi(midi, on) {
    if (!keyboardRoot) return;
    const semitone = midi - MIDI_C_FOR_OCTAVE(octave);
    if (semitone < 0 || semitone > 11) return;
    const entry = Object.entries(KEY_TO_SEMITONE).find(([, s]) => s === semitone);
    if (entry) setKeyHighlight(entry[0], on);
  }

  function addMidiHold(midi) {
    const c = (midiRefCount.get(midi) ?? 0) + 1;
    midiRefCount.set(midi, c);
    if (c === 1) {
      midisHeld.add(midi);
      syncHighlightForMidi(midi, true);
    }
  }

  function removeMidiHold(midi) {
    const c = (midiRefCount.get(midi) ?? 0) - 1;
    if (c <= 0) {
      midiRefCount.delete(midi);
      midisHeld.delete(midi);
      syncHighlightForMidi(midi, false);
    } else {
      midiRefCount.set(midi, c);
    }
  }

  function noteOnForKey(dataKey) {
    const semitone = KEY_TO_SEMITONE[dataKey];
    if (semitone === undefined) return null;
    const midi = midiForSemitone(semitone);
    void engine.resume();
    engine.voiceManager?.noteOn(midi);
    keysHeld.add(dataKey);
    keyToMidi.set(dataKey, midi);
    setKeyHighlight(dataKey, true);
    addMidiHold(midi);
    return midi;
  }

  function noteOffForKey(dataKey) {
    if (!keysHeld.has(dataKey)) return;
    const midi = keyToMidi.get(dataKey) ?? midiForSemitone(KEY_TO_SEMITONE[dataKey]);
    engine.voiceManager?.noteOff(midi);
    keysHeld.delete(dataKey);
    keyToMidi.delete(dataKey);
    setKeyHighlight(dataKey, false);
    removeMidiHold(midi);
  }

  function pointerNoteOn(midi) {
    void engine.resume();
    engine.voiceManager?.noteOn(midi);
    addMidiHold(midi);
  }

  function pointerNoteOff(midi) {
    engine.voiceManager?.noteOff(midi);
    removeMidiHold(midi);
  }

  function shiftOctave(delta) {
    const next = Math.max(OCTAVE_MIN, Math.min(OCTAVE_MAX, octave + delta));
    if (next === octave) return;
    for (const dataKey of [...keysHeld]) {
      noteOffForKey(dataKey);
    }
    octave = next;
    updateOctaveDisplay();
    refreshVirtualKeyMidiAttributes();
  }

  function refreshVirtualKeyMidiAttributes() {
    if (!keyboardRoot) return;
    for (const [dataKey, semitone] of Object.entries(KEY_TO_SEMITONE)) {
      const el = keyboardRoot.querySelector(`[data-key="${dataKey}"]`);
      if (el) {
        const midi = midiForSemitone(Number(semitone));
        el.dataset.midi = String(midi);
        el.dataset.semitone = String(semitone);
      }
    }
  }

  function onKeyDown(event) {
    if (isTypingTarget(event.target)) return;

    const k = keyFromEvent(event);
    if (k === 'comma' || k === 'ArrowDown') {
      event.preventDefault();
      shiftOctave(-1);
      return;
    }
    if (k === 'period' || k === 'ArrowUp') {
      event.preventDefault();
      shiftOctave(1);
      return;
    }

    if (!(k in KEY_TO_SEMITONE)) return;
    if (keysHeld.has(k)) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    noteOnForKey(k);
  }

  function onKeyUp(event) {
    const k = keyFromEvent(event);
    if (!(k in KEY_TO_SEMITONE)) return;
    if (isTypingTarget(event.target)) return;
    event.preventDefault();
    noteOffForKey(k);
  }

  function onBlur() {
    for (const dataKey of [...keysHeld]) {
      noteOffForKey(dataKey);
    }
  }

  function bindVirtualKeys() {
    if (!keyboardRoot) return;

    const playable = keyboardRoot.querySelectorAll('[data-key]');
    for (const el of playable) {
      if (!(el instanceof HTMLElement)) continue;
      const dataKey = el.dataset.key;
      if (!dataKey || !(dataKey in KEY_TO_SEMITONE)) continue;

      const getMidi = () => {
        const fromAttr = el.dataset.midi;
        if (fromAttr) return Number(fromAttr);
        return midiForSemitone(KEY_TO_SEMITONE[dataKey]);
      };

      const down = (e) => {
        e.preventDefault();
        pointerNoteOn(getMidi());
      };
      const up = (e) => {
        e.preventDefault();
        pointerNoteOff(getMidi());
      };

      el.addEventListener('mousedown', down);
      el.addEventListener('mouseup', up);
      el.addEventListener('mouseleave', up);
      el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        pointerNoteOn(getMidi());
      }, { passive: false });
      el.addEventListener('touchend', (e) => {
        e.preventDefault();
        pointerNoteOff(getMidi());
      });
      el.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        pointerNoteOff(getMidi());
      });
    }
  }

  updateOctaveDisplay();
  refreshVirtualKeyMidiAttributes();
  bindVirtualKeys();

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  return {
    get octave() {
      return octave;
    },
    setOctave(value) {
      const o = Math.max(OCTAVE_MIN, Math.min(OCTAVE_MAX, Math.floor(Number(value))));
      shiftOctave(o - octave);
    },
    midiForKey(dataKey) {
      const s = KEY_TO_SEMITONE[dataKey];
      return s === undefined ? null : midiForSemitone(s);
    },
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      onBlur();
    },
  };
}