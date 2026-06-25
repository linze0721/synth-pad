import {
  listPresets,
  savePreset,
  deletePreset,
  getActivePresetId,
  DEFAULT_PRESET_ID,
  ensureDefaultPreset,
} from '../presets/presetManager.js';
import { collectParamsFromEngine, loadPresetById } from '../presets/applyPreset.js';
import { syncControlsFromParams } from './syncControlsFromParams.js';

/**
 * @param {import('../audio/AudioEngine.js').AudioEngine} engine
 * @param {{ setOctave?: (n: number) => void; octave?: number } | null} keyboard
 */
export function bindPresetsOnMain(engine, keyboard) {
  ensureDefaultPreset();

  const nameInput = document.getElementById('preset-name');
  const saveBtn = document.getElementById('preset-save');
  const listEl = document.getElementById('preset-list');

  function renderList() {
    if (!listEl) return;
    const activeId = getActivePresetId();
    const presets = listPresets().filter((p) => p.id !== DEFAULT_PRESET_ID);

    listEl.innerHTML = '';
    if (presets.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'px-3 py-2 text-xs text-slate-500';
      empty.textContent = 'No saved presets yet — save one above.';
      listEl.appendChild(empty);
      return;
    }

    for (const preset of presets) {
      const isActive = preset.id === activeId;
      const li = document.createElement('li');
      li.className = `flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-surface-panel border ${
        isActive ? 'border-accent/30' : 'border-surface-border'
      }`;
      li.dataset.presetId = preset.id;

      const name = document.createElement('span');
      name.className = `text-sm truncate ${isActive ? 'text-white' : 'text-slate-300'}`;
      name.textContent = preset.name;

      const actions = document.createElement('div');
      actions.className = 'flex gap-1 shrink-0';

      const loadBtn = document.createElement('button');
      loadBtn.type = 'button';
      loadBtn.className = isActive
        ? 'px-2 py-1 text-[10px] uppercase font-semibold rounded bg-accent/20 text-accent-glow border border-accent/40'
        : 'px-2 py-1 text-[10px] uppercase font-semibold rounded bg-surface border border-surface-border text-slate-400 hover:text-white';
      loadBtn.textContent = 'Load';
      loadBtn.addEventListener('click', () => {
        loadPresetById(engine, preset.id, keyboard);
        syncControlsFromParams(engine, keyboard);
        renderList();
      });

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className =
        'px-2 py-1 text-[10px] uppercase font-semibold rounded bg-surface border border-surface-border text-slate-500 hover:text-danger';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => {
        if (!confirm(`Delete preset "${preset.name}"?`)) return;
        deletePreset(preset.id);
        renderList();
      });

      actions.append(loadBtn, delBtn);
      li.append(name, actions);
      listEl.appendChild(li);
    }
  }

  if (saveBtn && nameInput instanceof HTMLInputElement) {
    saveBtn.addEventListener('click', () => {
      try {
        const params = collectParamsFromEngine(engine, keyboard);
        savePreset(nameInput.value, params);
        nameInput.value = '';
        renderList();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Could not save preset');
      }
    });
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveBtn.click();
      }
    });
  }

  renderList();

  return { refreshPresetList: renderList };
}