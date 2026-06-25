import '../style.css'
import {
  STORAGE_KEY,
  DEFAULT_PRESET_ID,
  DEFAULT_PRESET_NAME,
  listPresets,
  savePreset,
  deletePreset,
  updatePreset,
  getActivePresetId,
  setActivePresetId,
  queuePresetLoadOnMain,
  ensureDefaultPreset,
  createDefaultParams,
} from './presetManager.js'
import { applyPreset, collectParamsFromEngine } from './applyPreset.js'
import { createAudioEngine } from '../audio/AudioEngine.js'

function formatPresetMeta(preset) {
  const d = new Date(preset.createdAt)
  const dateStr = Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  const wave = preset.params.waveform?.slice(0, 3) ?? 'saw'
  const delayPct = Math.round((preset.params.delay?.mix ?? 0) * 100)
  const filter = preset.params.filter?.enabled ? 'filter on' : 'filter off'
  return `${dateStr} · ${wave} · delay ${delayPct}% · ${filter}`
}

function initPresetsPage() {
  ensureDefaultPreset()

  const engine = createAudioEngine()
  if (engine.available) {
    engine.init()
  }

  const countEl = document.getElementById('preset-count-label')
  const listEl = document.getElementById('preset-list')
  const nameInput = document.getElementById('preset-save-name')
  const saveForm = document.getElementById('preset-save-form')
  const loadDefaultBtn = document.getElementById('load-default-preset')
  const storageKeyEl = document.getElementById('storage-key-display')

  if (storageKeyEl) {
    storageKeyEl.textContent = STORAGE_KEY
  }

  function render() {
    const presets = listPresets()
    const userPresets = presets.filter((p) => p.id !== DEFAULT_PRESET_ID)
    const activeId = getActivePresetId()

    if (countEl) {
      const n = userPresets.length
      countEl.textContent = `${n} stored locally · persists after refresh on this device`
    }

    if (!listEl) return
    listEl.innerHTML = ''

    if (userPresets.length === 0) {
      const li = document.createElement('li')
      li.className = 'px-5 py-8 text-center text-sm text-slate-500 sm:px-6'
      li.textContent = 'No custom presets yet. Save one from the synth or use the form above.'
      listEl.appendChild(li)
      return
    }

    for (const preset of userPresets) {
      const isActive = preset.id === activeId
      const li = document.createElement('li')
      li.className = `preset-row px-5 py-4 sm:px-6 ${isActive ? 'bg-accent/5' : 'transition hover:bg-surface-panel/50'}`

      const row = document.createElement('div')
      row.className = 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'

      const info = document.createElement('div')
      info.className = 'min-w-0'

      const titleRow = document.createElement('div')
      titleRow.className = 'flex flex-wrap items-center gap-2'
      const title = document.createElement('p')
      title.className = `truncate font-medium ${isActive ? 'text-white' : 'text-slate-200'}`
      title.textContent = preset.name
      titleRow.appendChild(title)
      if (isActive) {
        const badge = document.createElement('span')
        badge.className =
          'rounded bg-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-glow'
        badge.textContent = 'Active'
        titleRow.appendChild(badge)
      }

      const meta = document.createElement('p')
      meta.className = 'mt-0.5 font-mono text-xs text-slate-500'
      meta.textContent = formatPresetMeta(preset)

      info.append(titleRow, meta)

      const actions = document.createElement('div')
      actions.className = 'preset-actions flex gap-2'

      const loadBtn = document.createElement('button')
      loadBtn.type = 'button'
      loadBtn.className = isActive
        ? 'rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-surface'
        : 'rounded-lg border border-accent/50 bg-surface-panel px-3 py-2 text-xs font-semibold text-accent-glow hover:bg-accent/10'
      loadBtn.textContent = 'Load'
      loadBtn.addEventListener('click', () => {
        queuePresetLoadOnMain(preset.id)
        window.location.href = 'index.html'
      })

      const renameBtn = document.createElement('button')
      renameBtn.type = 'button'
      renameBtn.className =
        'rounded-lg border border-surface-border px-3 py-2 text-xs font-medium text-slate-300 hover:border-slate-500'
      renameBtn.textContent = 'Rename'
      renameBtn.addEventListener('click', () => {
        const next = prompt('New preset name', preset.name)
        if (next == null) return
        try {
          updatePreset(preset.id, { name: next })
          render()
        } catch (err) {
          alert(err instanceof Error ? err.message : 'Rename failed')
        }
      })

      const delBtn = document.createElement('button')
      delBtn.type = 'button'
      delBtn.className =
        'rounded-lg border border-danger/30 px-3 py-2 text-xs font-medium text-danger hover:bg-danger/10'
      delBtn.textContent = 'Delete'
      delBtn.addEventListener('click', () => {
        if (!confirm(`Delete "${preset.name}"?`)) return
        deletePreset(preset.id)
        render()
      })

      actions.append(loadBtn, renameBtn, delBtn)
      row.append(info, actions)
      li.appendChild(row)
      listEl.appendChild(li)
    }
  }

  if (loadDefaultBtn) {
    loadDefaultBtn.addEventListener('click', () => {
      if (engine.available && engine.voiceManager) {
        applyPreset(engine, createDefaultParams(), null)
      }
      setActivePresetId(DEFAULT_PRESET_ID)
      queuePresetLoadOnMain(DEFAULT_PRESET_ID)
      window.location.href = 'index.html'
    })
  }

  if (saveForm && nameInput instanceof HTMLInputElement) {
    saveForm.addEventListener('submit', (e) => {
      e.preventDefault()
      if (!engine.available) {
        alert('Web Audio is not available in this browser.')
        return
      }
      try {
        const params = engine.voiceManager
          ? collectParamsFromEngine(engine, null)
          : createDefaultParams()
        savePreset(nameInput.value, params)
        nameInput.value = ''
        render()
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Could not save')
      }
    })
  }

  render()
}

initPresetsPage()