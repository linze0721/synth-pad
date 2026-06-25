export const STORAGE_KEY = 'synth-pad-presets';
export const ACTIVE_PRESET_ID_KEY = 'synth-pad-active-preset-id';
export const PENDING_LOAD_PRESET_KEY = 'synth-pad-pending-load';

export const DEFAULT_PRESET_ID = 'factory-default';
export const DEFAULT_PRESET_NAME = 'Factory Default';

/** @typedef {import('./applyPreset.js').SynthParams} SynthParams */

/**
 * @typedef {{
 *   id: string;
 *   name: string;
 *   createdAt: string;
 *   params: SynthParams;
 * }} Preset
 */

/**
 * @returns {SynthParams}
 */
export function createDefaultParams() {
  return {
    waveform: 'sawtooth',
    masterVolume: 0.8,
    octaveOffset: 3,
    ampAdsr: { a: 0.01, d: 0.2, s: 0.6, r: 0.3 },
    filter: {
      enabled: true,
      cutoff: 2000,
      resonance: 1,
      feEnabled: false,
      depth: 4000,
      feAdsr: { a: 0.05, d: 0.15, s: 0.5, r: 0.2 },
    },
    delay: { time: 0.375, feedback: 0.4, mix: 0.25 },
  };
}

/**
 * @returns {Preset}
 */
export function createDefaultPreset() {
  return {
    id: DEFAULT_PRESET_ID,
    name: DEFAULT_PRESET_NAME,
    createdAt: new Date(0).toISOString(),
    params: createDefaultParams(),
  };
}

/**
 * @returns {Preset[]}
 */
function readRawList() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return /** @type {Preset[]} */ (parsed);
  } catch {
    return [];
  }
}

function writeRawList(presets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

/**
 * Ensures storage exists with the factory default preset on first visit.
 * @returns {Preset[]}
 */
export function ensureDefaultPreset() {
  let list = readRawList();
  const hasDefault = list.some((p) => p.id === DEFAULT_PRESET_ID);
  if (list.length === 0 || !hasDefault) {
    const factory = createDefaultPreset();
    if (!hasDefault) {
      list = [factory, ...list.filter((p) => p.id !== DEFAULT_PRESET_ID)];
    }
    if (list.length === 0) {
      list = [factory];
    }
    writeRawList(list);
  }
  return list;
}

/**
 * @returns {Preset[]}
 */
export function listPresets() {
  return ensureDefaultPreset();
}

/**
 * @param {string} id
 * @returns {Preset | null}
 */
export function getPreset(id) {
  return listPresets().find((p) => p.id === id) ?? null;
}

/**
 * @param {string} name
 * @param {SynthParams} params
 * @returns {Preset}
 */
export function savePreset(name, params) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Preset name is required');
  }
  const list = listPresets();
  const preset = {
    id: crypto.randomUUID(),
    name: trimmed,
    createdAt: new Date().toISOString(),
    params: structuredClone(params),
  };
  list.push(preset);
  writeRawList(list);
  setActivePresetId(preset.id);
  return preset;
}

/**
 * @param {string} id
 * @param {Partial<Pick<Preset, 'name' | 'params'>>} patch
 * @returns {Preset | null}
 */
export function updatePreset(id, patch) {
  const list = listPresets();
  const idx = list.findIndex((p) => p.id === id);
  if (idx < 0) return null;
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (!trimmed) throw new Error('Preset name is required');
    list[idx].name = trimmed;
  }
  if (patch.params !== undefined) {
    list[idx].params = structuredClone(patch.params);
    list[idx].createdAt = new Date().toISOString();
  }
  writeRawList(list);
  return list[idx];
}

/**
 * @param {string} id
 * @returns {boolean}
 */
export function deletePreset(id) {
  if (id === DEFAULT_PRESET_ID) {
    return false;
  }
  const list = listPresets().filter((p) => p.id !== id);
  writeRawList(list);
  if (getActivePresetId() === id) {
    localStorage.removeItem(ACTIVE_PRESET_ID_KEY);
  }
  return true;
}

/**
 * @param {string | null} id
 */
export function setActivePresetId(id) {
  if (id) {
    localStorage.setItem(ACTIVE_PRESET_ID_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_PRESET_ID_KEY);
  }
}

/**
 * @returns {string | null}
 */
export function getActivePresetId() {
  return localStorage.getItem(ACTIVE_PRESET_ID_KEY);
}

/**
 * @param {string} id
 */
export function queuePresetLoadOnMain(id) {
  localStorage.setItem(PENDING_LOAD_PRESET_KEY, id);
}

/**
 * @returns {string | null}
 */
export function consumePendingPresetLoad() {
  const id = localStorage.getItem(PENDING_LOAD_PRESET_KEY);
  if (id) {
    localStorage.removeItem(PENDING_LOAD_PRESET_KEY);
  }
  return id;
}