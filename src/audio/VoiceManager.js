const MAX_VOICES = 8;
const A4_MIDI = 69;
const A4_FREQ = 440;

const DEFAULT_PARAMS = {
  waveform: 'sawtooth',
  ampAdsr: { a: 0.01, d: 0.2, s: 0.6, r: 0.3 },
  filter: {
    enabled: true,
    cutoff: 2000,
    resonance: 1,
    feEnabled: false,
    depth: 4000,
    feAdsr: { a: 0.05, d: 0.15, s: 0.5, r: 0.2 },
  },
};

/**
 * @param {number} midiNote
 * @returns {number}
 */
export function midiToFrequency(midiNote) {
  return A4_FREQ * 2 ** ((midiNote - A4_MIDI) / 12);
}

/**
 * @param {OscillatorType} type
 */
function normalizeWaveform(type) {
  const allowed = ['sine', 'sawtooth', 'square', 'triangle'];
  return allowed.includes(type) ? type : 'sawtooth';
}

/**
 * @param {AudioParam} param
 * @param {number} now
 * @param {{ a: number, d: number, s: number, r: number }} adsr
 * @param {number} peak
 */
function scheduleAmpAttack(param, now, adsr, peak = 1) {
  const a = Math.max(0.001, adsr.a ?? 0.01);
  const d = Math.max(0.001, adsr.d ?? 0.2);
  const s = Math.max(0, Math.min(1, adsr.s ?? 0.6));
  param.cancelScheduledValues(now);
  param.setValueAtTime(0, now);
  param.linearRampToValueAtTime(peak, now + a);
  param.linearRampToValueAtTime(peak * s, now + a + d);
}

/**
 * @param {AudioParam} param
 * @param {number} now
 * @param {{ r: number }} adsr
 */
function scheduleAmpRelease(param, now, adsr) {
  const r = Math.max(0.001, adsr.r ?? 0.3);
  param.cancelScheduledValues(now);
  const current = param.value;
  param.setValueAtTime(current, now);
  param.linearRampToValueAtTime(0, now + r);
}

/**
 * @param {AudioParam} cutoffParam
 * @param {number} now
 * @param {number} baseCutoff
 * @param {number} depth
 * @param {{ a: number, d: number, s: number }} feAdsr
 */
function scheduleFilterEnvAttack(cutoffParam, now, baseCutoff, depth, feAdsr) {
  const a = Math.max(0.001, feAdsr.a ?? 0.05);
  const d = Math.max(0.001, feAdsr.d ?? 0.15);
  const s = Math.max(0, Math.min(1, feAdsr.s ?? 0.5));
  const base = Math.max(20, baseCutoff);
  const peak = Math.min(22000, base + Math.max(0, depth));
  const sustain = base + (peak - base) * s;

  cutoffParam.cancelScheduledValues(now);
  cutoffParam.setValueAtTime(base, now);
  cutoffParam.linearRampToValueAtTime(peak, now + a);
  cutoffParam.linearRampToValueAtTime(sustain, now + a + d);
}

/**
 * @param {AudioParam} cutoffParam
 * @param {number} now
 * @param {number} baseCutoff
 * @param {{ r: number }} feAdsr
 */
function scheduleFilterEnvRelease(cutoffParam, now, baseCutoff, feAdsr) {
  const r = Math.max(0.001, feAdsr.r ?? 0.2);
  const base = Math.max(20, baseCutoff);
  cutoffParam.cancelScheduledValues(now);
  const current = cutoffParam.value;
  cutoffParam.setValueAtTime(current, now);
  cutoffParam.linearRampToValueAtTime(base, now + r);
}

export class VoiceManager {
  /**
   * @param {AudioContext} audioContext
   * @param {AudioNode} destination
   */
  constructor(audioContext, destination) {
    this.ctx = audioContext;
    this.destination = destination;
    /** @type {typeof DEFAULT_PARAMS} */
    this.params = structuredClone(DEFAULT_PARAMS);
    /** @type {Array<{ id: number, midiNote: number | null, osc: OscillatorNode, filter: BiquadFilterNode, gain: GainNode, filterBypass: GainNode, mix: GainNode, releasing: boolean }>} */
    this.voices = [];
    /** FIFO order of active voice ids (oldest first) */
    this._fifo = [];
    this._nextVoiceId = 1;
  }

  get maxVoices() {
    return MAX_VOICES;
  }

  /**
   * @returns {Readonly<typeof DEFAULT_PARAMS>}
   */
  getParams() {
    return this.params;
  }

  /**
   * Partial param update (applies to new notes; filter cutoff/resonance also updates active voices when set).
   * @param {Partial<typeof DEFAULT_PARAMS> & { filter?: Partial<typeof DEFAULT_PARAMS.filter> }} next
   */
  setParams(next) {
    if (next.waveform !== undefined) {
      this.params.waveform = normalizeWaveform(next.waveform);
    }
    if (next.ampAdsr) {
      this.params.ampAdsr = { ...this.params.ampAdsr, ...next.ampAdsr };
    }
    if (next.filter) {
      this.params.filter = { ...this.params.filter, ...next.filter };
      if (next.filter.feAdsr) {
        this.params.filter.feAdsr = {
          ...this.params.filter.feAdsr,
          ...next.filter.feAdsr,
        };
      }
      if (next.filter.cutoff !== undefined || next.filter.resonance !== undefined) {
        this._applyLiveFilterToActiveVoices();
      }
    }
  }

  /**
   * Live UI tweak for filter cutoff on all non-releasing voices.
   * @param {number} cutoffHz
   */
  setFilterCutoff(cutoffHz) {
    this.params.filter.cutoff = Math.max(20, Math.min(22000, Number(cutoffHz)));
    this._applyLiveFilterToActiveVoices();
  }

  /**
   * @param {number} midiNote 0–127
   * @returns {number | null} voice id
   */
  noteOn(midiNote) {
    const midi = Math.max(0, Math.min(127, Math.floor(Number(midiNote))));
    const existing = this.voices.find((v) => v.midiNote === midi && !v.releasing);
    if (existing) {
      this._retriggerVoice(existing, midi);
      return existing.id;
    }

    let voice = this.voices.find((v) => v.midiNote === null && !v.releasing);
    if (!voice && this.voices.length < MAX_VOICES) {
      voice = this._createVoice();
      this.voices.push(voice);
    }
    if (!voice) {
      const stealId = this._fifo[0];
      voice = this.voices.find((v) => v.id === stealId);
      if (!voice) {
        voice = this.voices[0];
      }
      this._hardStopVoice(voice);
    }

    this._startVoice(voice, midi);
    this._touchFifo(voice.id);
    return voice.id;
  }

  /**
   * @param {number} midiNoteOrVoiceId
   */
  noteOff(midiNoteOrVoiceId) {
    const n = Number(midiNoteOrVoiceId);
    const byMidi = this.voices.filter((v) => v.midiNote === n && !v.releasing);
    if (byMidi.length > 0) {
      for (const v of byMidi) {
        this._releaseVoice(v);
      }
      return;
    }
    const byId = this.voices.find((v) => v.id === n && !v.releasing);
    if (byId) {
      this._releaseVoice(byId);
    }
  }

  /** Stop all voices immediately. */
  allNotesOff() {
    for (const voice of this.voices) {
      this._hardStopVoice(voice);
    }
    this._fifo = [];
  }

  _createVoice() {
    const ctx = this.ctx;
    const id = this._nextVoiceId++;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const filterSend = ctx.createGain();
    const bypass = ctx.createGain();
    const sum = ctx.createGain();
    const gain = ctx.createGain();

    osc.connect(filter);
    filter.connect(filterSend);
    filterSend.connect(sum);
    osc.connect(bypass);
    bypass.connect(sum);
    sum.connect(gain);
    gain.connect(this.destination);

    gain.gain.value = 0;
    filterSend.gain.value = 1;
    bypass.gain.value = 0;
    sum.gain.value = 1;

    osc.start();

    return {
      id,
      midiNote: null,
      osc,
      filter,
      filterSend,
      bypass,
      sum,
      gain,
      releasing: false,
      /** @type {number | null} */
      releaseTimer: null,
    };
  }

  _touchFifo(voiceId) {
    this._fifo = this._fifo.filter((id) => id !== voiceId);
    this._fifo.push(voiceId);
  }

  _removeFromFifo(voiceId) {
    this._fifo = this._fifo.filter((id) => id !== voiceId);
  }

  _applyFilterRouting(voice) {
    const now = this.ctx.currentTime;
    const { enabled } = this.params.filter;
    if (enabled) {
      voice.filterSend.gain.setValueAtTime(1, now);
      voice.bypass.gain.setValueAtTime(0, now);
    } else {
      voice.filterSend.gain.setValueAtTime(0, now);
      voice.bypass.gain.setValueAtTime(1, now);
    }
  }

  _applyLiveFilterToActiveVoices() {
    const now = this.ctx.currentTime;
    const { cutoff, resonance, feEnabled } = this.params.filter;
    for (const voice of this.voices) {
      if (voice.midiNote === null || voice.releasing) {
        continue;
      }
      if (!feEnabled) {
        voice.filter.frequency.cancelScheduledValues(now);
        voice.filter.frequency.setValueAtTime(cutoff, now);
      }
      voice.filter.Q.setValueAtTime(resonance, now);
      this._applyFilterRouting(voice);
    }
  }

  _startVoice(voice, midiNote) {
    const now = this.ctx.currentTime;
    const { waveform, ampAdsr, filter } = this.params;

    if (voice.releaseTimer != null) {
      clearTimeout(voice.releaseTimer);
      voice.releaseTimer = null;
    }
    voice.releasing = false;
    voice.midiNote = midiNote;

    voice.osc.type = normalizeWaveform(waveform);
    voice.osc.frequency.setValueAtTime(midiToFrequency(midiNote), now);

    voice.filter.Q.setValueAtTime(filter.resonance, now);
    this._applyFilterRouting(voice);

    if (filter.feEnabled) {
      scheduleFilterEnvAttack(
        voice.filter.frequency,
        now,
        filter.cutoff,
        filter.depth ?? 0,
        filter.feAdsr,
      );
    } else {
      voice.filter.frequency.cancelScheduledValues(now);
      voice.filter.frequency.setValueAtTime(filter.cutoff, now);
    }

    scheduleAmpAttack(voice.gain.gain, now, ampAdsr, 1);
  }

  _retriggerVoice(voice, midiNote) {
    this._startVoice(voice, midiNote);
    this._touchFifo(voice.id);
  }

  _releaseVoice(voice) {
    if (voice.midiNote === null || voice.releasing) {
      return;
    }
    voice.releasing = true;
    const now = this.ctx.currentTime;
    const { ampAdsr, filter } = this.params;

    scheduleAmpRelease(voice.gain.gain, now, ampAdsr);

    if (filter.feEnabled) {
      scheduleFilterEnvRelease(
        voice.filter.frequency,
        now,
        filter.cutoff,
        filter.feAdsr,
      );
    }

    const releaseMs =
      Math.max(ampAdsr.r ?? 0.3, filter.feEnabled ? (filter.feAdsr?.r ?? 0.2) : 0) *
        1000 +
      50;

    this._removeFromFifo(voice.id);

    voice.releaseTimer = setTimeout(() => {
      voice.releaseTimer = null;
      if (voice.releasing) {
        this._hardStopVoice(voice);
      }
    }, releaseMs);
  }

  _hardStopVoice(voice) {
    if (voice.releaseTimer != null) {
      clearTimeout(voice.releaseTimer);
      voice.releaseTimer = null;
    }
    const now = this.ctx.currentTime;
    try {
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(0, now);
      voice.filter.frequency.cancelScheduledValues(now);
    } catch {
      // context may be closed
    }
    voice.midiNote = null;
    voice.releasing = false;
    this._removeFromFifo(voice.id);
  }
}