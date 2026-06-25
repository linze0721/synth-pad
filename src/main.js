import './style.css'
import { createAudioEngine } from './audio/AudioEngine.js'
import { initKeyboard } from './input/keyboard.js'
import { bindSynthControls } from './ui/bindControls.js'
import { bindPresetsOnMain } from './ui/bindPresets.js'
import {
  ensureDefaultPreset,
  getActivePresetId,
  consumePendingPresetLoad,
  DEFAULT_PRESET_ID,
  setActivePresetId,
  createDefaultParams,
} from './presets/presetManager.js'
import { applyPreset, loadPresetById } from './presets/applyPreset.js'
import { syncControlsFromParams } from './ui/syncControlsFromParams.js'

const engine = createAudioEngine()

if (!engine.available) {
  console.warn(engine.unavailableMessage)
} else {
  engine.init()
  engine.attachUserGestureResume()
  bindSynthControls(engine)
  const keyboard = initKeyboard(engine)
  bindPresetsOnMain(engine, keyboard)

  ensureDefaultPreset()

  const pendingId = consumePendingPresetLoad()
  const activeId = getActivePresetId()
  const idToLoad = pendingId ?? activeId

  if (idToLoad) {
    loadPresetById(engine, idToLoad, keyboard)
  } else {
    applyPreset(engine, createDefaultParams(), keyboard)
    setActivePresetId(DEFAULT_PRESET_ID)
  }

  syncControlsFromParams(engine, keyboard)
}