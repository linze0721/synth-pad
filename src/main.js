import './style.css'

import { createAudioEngine } from './audio/AudioEngine.js'
import { startWaveform } from './ui/waveform.js'

const engine = createAudioEngine()

if (engine.available) {
  engine.init()
  engine.attachUserGestureResume()
  void engine.resume()
  startWaveform(engine, '#waveform-canvas')
}