import { DEFAULT_PRESET_ID, getPreset, setActivePresetId, createDefaultParams } from './presetManager.js';

/**
 * @typedef {{
 *   waveform: OscillatorType;
 *   masterVolume: number;
 *   octaveOffset: number;
 *   ampAdsr: { a: number; d: number; s: number; r: number };
 *   filter: {
 *     enabled: boolean;
 *     cutoff: number;
 *     resonance: number;
 *     feEnabled: boolean;
 *     depth?: number;
 *     feAdsr: { a: number; d: number; s: number; r: number };
 *   };
 *   delay: { time: number; feedback: number; mix: number };
 * }} SynthParams
 */

/**
 * @param {import('../audio/AudioEngine.js').AudioEngine} engine
 * @param {{ setOctave?: (n: number) => void } | null} keyboard
 * @returns {SynthParams}
 */
export function collectParamsFromEngine(engine, keyboard) {
  const vm = engine.voiceManager;
  const p = vm?.getParams();
  const filter = p?.filter ?? {};
  const feAdsr = filter.feAdsr ?? { a: 0.05, d: 0.15, s: 0.5, r: 0.2 };

  return {
    waveform: p?.waveform ?? 'sawtooth',
    masterVolume: engine.masterVolume,
    octaveOffset: keyboard?.octave ?? 3,
    ampAdsr: { ...(p?.ampAdsr ?? { a: 0.01, d: 0.2, s: 0.6, r: 0.3 }) },
    filter: {
      enabled: filter.enabled ?? true,
      cutoff: filter.cutoff ?? 2000,
      resonance: filter.resonance ?? 1,
      feEnabled: filter.feEnabled ?? false,
      depth: filter.depth ?? 4000,
      feAdsr: { ...feAdsr },
    },
    delay: {
      time: engine.delayTime,
      feedback: engine.delayFeedback,
      mix: engine.delayWet,
    },
  };
}

/**
 * Applies synth parameters to the audio engine and optional keyboard octave.
 * @param {import('../audio/AudioEngine.js').AudioEngine} engine
 * @param {SynthParams} params
 * @param {{ setOctave?: (n: number) => void } | null} [keyboard]
 */
export function applyPreset(engine, params, keyboard = null) {
  const vm = engine.voiceManager;
  if (!vm) return;

  const merged = {
    ...createDefaultParams(),
    ...params,
    ampAdsr: { ...createDefaultParams().ampAdsr, ...params.ampAdsr },
    filter: {
      ...createDefaultParams().filter,
      ...params.filter,
      feAdsr: {
        ...createDefaultParams().filter.feAdsr,
        ...(params.filter?.feAdsr ?? {}),
      },
    },
    delay: { ...createDefaultParams().delay, ...params.delay },
  };

  vm.setParams({
    waveform: merged.waveform,
    ampAdsr: merged.ampAdsr,
    filter: merged.filter,
  });
  vm.setFilterCutoff(merged.filter.cutoff);

  engine.masterVolume = merged.masterVolume;
  engine.delayTime = merged.delay.time;
  engine.delayFeedback = merged.delay.feedback;
  engine.delayWet = merged.delay.mix;

  if (keyboard?.setOctave) {
    keyboard.setOctave(merged.octaveOffset);
  }
}

/**
 * @param {import('../audio/AudioEngine.js').AudioEngine} engine
 * @param {string} presetId
 * @param {{ setOctave?: (n: number) => void } | null} [keyboard]
 * @returns {boolean}
 */
export function loadPresetById(engine, presetId, keyboard = null) {
  const preset =
    presetId === DEFAULT_PRESET_ID
      ? { params: createDefaultParams() }
      : getPreset(presetId);
  if (!preset) return false;
  applyPreset(engine, preset.params, keyboard);
  setActivePresetId(presetId);
  return true;
}