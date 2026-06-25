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
import { startWaveform } from './ui/waveform.js'

/** @param {Element | null} target */
function isTypingTarget(target) {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return target.isContentEditable
}

function showWebAudioUnavailable(message) {
  const banner = document.getElementById('web-audio-unavailable')
  const detail = document.getElementById('web-audio-unavailable-detail')
  if (detail) detail.textContent = message
  if (banner) banner.classList.remove('hidden')
  const main = document.querySelector('main')
  if (main) {
    for (const section of main.querySelectorAll('section, .grid')) {
      section.classList.add('opacity-50', 'pointer-events-none')
    }
  }
  const footer = document.querySelector('footer')
  if (footer) footer.classList.add('opacity-50', 'pointer-events-none')
}

const engine = createAudioEngine()

if (!engine.available) {
  console.warn(engine.unavailableMessage)
  showWebAudioUnavailable(
    engine.unavailableMessage +
      ' Try a recent Chrome, Firefox, or Safari over HTTPS. Sound and controls need the Web Audio API.',
  )
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

  // Preset applied to engine before UI sync and before new notes use params.
  if (idToLoad) {
    loadPresetById(engine, idToLoad, keyboard)
  } else {
    applyPreset(engine, createDefaultParams(), keyboard)
    setActivePresetId(DEFAULT_PRESET_ID)
  }

  syncControlsFromParams(engine, keyboard)
  startWaveform(engine, '#waveform-canvas')

  const vk = document.getElementById('virtual-keyboard')
  if (vk && !isTypingTarget(document.activeElement)) {
    vk.focus({ preventScroll: true })
  }
}