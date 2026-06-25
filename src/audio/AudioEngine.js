const MAX_DELAY_SEC = 2;

let engineInstance = null;

function createStereoDelaySubgraph(ctx) {
  const input = ctx.createGain();
  const output = ctx.createGain();

  const dryGain = ctx.createGain();
  const wetGain = ctx.createGain();

  const splitter = ctx.createChannelSplitter(2);
  const merger = ctx.createChannelMerger(2);

  const delayL = ctx.createDelay(MAX_DELAY_SEC);
  const delayR = ctx.createDelay(MAX_DELAY_SEC);
  const feedbackL = ctx.createGain();
  const feedbackR = ctx.createGain();
  const tapL = ctx.createGain();
  const tapR = ctx.createGain();

  delayL.delayTime.value = 0.35;
  delayR.delayTime.value = 0.35;
  feedbackL.gain.value = 0.35;
  feedbackR.gain.value = 0.35;
  dryGain.gain.value = 0.85;
  wetGain.gain.value = 0.35;

  input.connect(splitter);
  input.connect(dryGain);

  splitter.connect(delayL, 0);
  splitter.connect(delayR, 1);

  delayL.connect(feedbackR);
  feedbackR.connect(delayR);
  delayR.connect(feedbackL);
  feedbackL.connect(delayL);

  delayL.connect(tapL);
  delayR.connect(tapR);
  tapL.connect(merger, 0, 0);
  tapR.connect(merger, 0, 1);

  merger.connect(wetGain);
  dryGain.connect(output);
  wetGain.connect(output);

  return {
    input,
    output,
    dryGain,
    wetGain,
    delayL,
    delayR,
    feedbackL,
    feedbackR,
  };
}

/**
 * @returns {import('./AudioEngine.js').AudioEngine}
 */
export function createAudioEngine() {
  if (engineInstance) {
    return engineInstance;
  }

  const AudioContextCtor =
    globalThis.AudioContext ?? globalThis.webkitAudioContext;

  const unavailableMessage = AudioContextCtor
    ? null
    : 'Web Audio API is not available in this browser.';

  /** @type {AudioContext | null} */
  let ctx = null;
  /** @type {GainNode | null} */
  let masterGain = null;
  /** @type {AnalyserNode | null} */
  let analyser = null;
  /** @type {ReturnType<typeof createStereoDelaySubgraph> | null} */
  let delayGraph = null;
  /** @type {GainNode | null} */
  let sourceInput = null;

  let gestureListenersAttached = false;

  function ensureGraph() {
    if (!AudioContextCtor) {
      return false;
    }
    if (ctx) {
      return true;
    }

    ctx = new AudioContextCtor();
    sourceInput = ctx.createGain();
    delayGraph = createStereoDelaySubgraph(ctx);
    masterGain = ctx.createGain();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.75;

    masterGain.gain.value = 0.8;

    sourceInput.connect(delayGraph.input);
    delayGraph.output.connect(masterGain);
    masterGain.connect(analyser);
    analyser.connect(ctx.destination);

    return true;
  }

  async function resume() {
    if (!ensureGraph() || !ctx) {
      return false;
    }
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    return ctx.state === 'running';
  }

  function attachUserGestureResume(target = document) {
    if (gestureListenersAttached || !AudioContextCtor) {
      return () => {};
    }
    gestureListenersAttached = true;

    const handler = () => {
      void resume();
    };

    const options = { passive: true };
    target.addEventListener('pointerdown', handler, options);
    target.addEventListener('keydown', handler, options);
    target.addEventListener('click', handler, options);

    return () => {
      target.removeEventListener('pointerdown', handler, options);
      target.removeEventListener('keydown', handler, options);
      target.removeEventListener('click', handler, options);
      gestureListenersAttached = false;
    };
  }

  const engine = {
    get available() {
      return Boolean(AudioContextCtor);
    },

    get unavailableMessage() {
      return unavailableMessage;
    },

    get context() {
      ensureGraph();
      return ctx;
    },

    get input() {
      ensureGraph();
      return sourceInput;
    },

    get analyser() {
      ensureGraph();
      return analyser;
    },

    get masterGainNode() {
      ensureGraph();
      return masterGain;
    },

    init() {
      return ensureGraph();
    },

    resume,

    attachUserGestureResume,

    get masterVolume() {
      return masterGain?.gain.value ?? 0.8;
    },

    set masterVolume(value) {
      if (!masterGain) {
        ensureGraph();
      }
      if (masterGain) {
        masterGain.gain.value = Math.max(0, Math.min(1, Number(value)));
      }
    },

    get delayTime() {
      return delayGraph?.delayL.delayTime.value ?? 0.35;
    },

    set delayTime(seconds) {
      if (!delayGraph) {
        ensureGraph();
      }
      if (!delayGraph) {
        return;
      }
      const t = Math.max(0, Math.min(MAX_DELAY_SEC, Number(seconds)));
      delayGraph.delayL.delayTime.value = t;
      delayGraph.delayR.delayTime.value = t;
    },

    get delayFeedback() {
      return delayGraph?.feedbackL.gain.value ?? 0.35;
    },

    set delayFeedback(amount) {
      if (!delayGraph) {
        ensureGraph();
      }
      if (!delayGraph) {
        return;
      }
      const f = Math.max(0, Math.min(0.95, Number(amount)));
      delayGraph.feedbackL.gain.value = f;
      delayGraph.feedbackR.gain.value = f;
    },

    get delayWet() {
      return delayGraph?.wetGain.gain.value ?? 0.35;
    },

    set delayWet(mix) {
      if (!delayGraph) {
        ensureGraph();
      }
      if (delayGraph) {
        delayGraph.wetGain.gain.value = Math.max(0, Math.min(1, Number(mix)));
      }
    },

    get delayDry() {
      return delayGraph?.dryGain.gain.value ?? 0.85;
    },

    set delayDry(mix) {
      if (!delayGraph) {
        ensureGraph();
      }
      if (delayGraph) {
        delayGraph.dryGain.gain.value = Math.max(0, Math.min(1, Number(mix)));
      }
    },
  };

  engineInstance = engine;
  return engine;
}