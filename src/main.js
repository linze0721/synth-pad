import './style.css'
import { createAudioEngine } from './audio/AudioEngine.js'
import { initKeyboard } from './input/keyboard.js'

const engine = createAudioEngine()

if (!engine.available) {
  console.warn(engine.unavailableMessage)
} else {
  engine.init()
  engine.attachUserGestureResume()
  initKeyboard(engine)
}