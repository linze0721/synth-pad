# Synth Pad

Browser **polyphonic synthesizer** built with **Vite**, **vanilla JavaScript**, and the **Web Audio API** (no audio libraries). Play with your computer keyboard or the on-screen keyboard, shape sound with ADSR, filter, and stereo delay, watch a realtime waveform, and save presets in **localStorage**.

**Live demo (GitHub Pages):** https://linze0721.github.io/synth-pad/

## Quick start

```bash
npm ci
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). The audio context resumes on your first click or key press.

Production build:

```bash
npm run build
```

Output is in `dist/`. Preview the build locally:

```bash
npm run preview
```

For GitHub Pages this repo uses a **project site** base path (`/synth-pad/`); `vite.config.js` sets `base` accordingly when `NODE_ENV=production`.

## Keyboard map (Ableton-style)

One chromatic octave from **C** (movable with octave shift):

| Role | Keys |
|------|------|
| White keys | **Z** · **X** · **C** · **V** · **B** · **N** · **M** |
| Black keys | **S** · **D** · **G** · **H** · **J** |
| Octave down | **,** (comma) or **↓** |
| Octave up | **.** (period) or **↑** |

- Click keys on the virtual keyboard at the bottom, or press **Tab** to focus it and use the computer keys.
- Mapped keys are ignored while typing in inputs (e.g. preset name).
- Tuning: equal temperament, **A4 = 440 Hz**. Up to **8** simultaneous voices (oldest note stolen on a 9th).

## Presets (localStorage)

- Saved under `localStorage` key `synth-pad-presets`; active preset id in `synth-pad-active-preset-id`.
- **Save / load** on the main page; full list and delete/rename on **Preset manager** (`presets.html`).
- Loading a preset from the manager can queue a load on return to the main page (`consumePendingPresetLoad`).
- Data stays in your browser only—no account or server.

## Architecture (brief)

```
index.html / presets.html
  → main.js or presetsPage.js
  → AudioEngine (context, master, delay, analyser)
  → VoiceManager (polyphony, ADSR, filter, oscillators)
  → keyboard.js (computer + virtual keys, octave)
  → bindControls / syncControlsFromParams / waveform canvas
  → presetManager + applyPreset (serialize ↔ engine params)
```

Audio graph (simplified): oscillator → filter → amp envelope → voice mix → stereo delay → master gain → analyser → destination.

## Requirements

- Modern desktop browser with **Web Audio API** (Chrome, Firefox, Safari). If unavailable, the app shows a banner and disables controls.
- **HTTPS** or `localhost` for reliable audio in most browsers.

## Optional product notes

A longer product requirements document (milestones, acceptance criteria, non-goals) was generated during initial scaffolding; the sections above are what you need to run, deploy, and play the app.