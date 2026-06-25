const ACCENT = '#7c5cff';
const ACCENT_DIM = 'rgba(124, 92, 255, 0.35)';
const BG_FILL = '#161b26';
const CENTER_LINE = 'rgba(42, 51, 72, 0.9)';

/**
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLElement} container
 */
function sizeCanvasToContainer(canvas, container) {
  const width = container.clientWidth;
  const height = container.clientHeight;
  if (width <= 0 || height <= 0) {
    return;
  }
  const dpr = Math.min(globalThis.devicePixelRatio ?? 1, 2);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
}

/**
 * @param {import('../audio/AudioEngine.js').AudioEngine} engine
 * @param {string | HTMLCanvasElement} canvasOrSelector
 * @returns {() => void} stop / cleanup
 */
export function startWaveform(engine, canvasOrSelector) {
  const canvas =
    typeof canvasOrSelector === 'string'
      ? document.querySelector(canvasOrSelector)
      : canvasOrSelector;

  if (!(canvas instanceof HTMLCanvasElement)) {
    return () => {};
  }

  const container = canvas.closest('.wave-canvas') ?? canvas.parentElement;
  if (!container) {
    return () => {};
  }

  const ctx2d = canvas.getContext('2d');
  if (!ctx2d) {
    return () => {};
  }

  sizeCanvasToContainer(canvas, container);

  const resizeObserver = new ResizeObserver(() => {
    sizeCanvasToContainer(canvas, container);
  });
  resizeObserver.observe(container);

  let timeData = new Uint8Array(2048);
  let rafId = 0;

  const draw = () => {
    rafId = requestAnimationFrame(draw);

    const analyser = engine.analyser;
    if (!analyser) {
      return;
    }

    const bufferLength = analyser.fftSize;
    if (timeData.length !== bufferLength) {
      timeData = new Uint8Array(bufferLength);
    }

    analyser.getByteTimeDomainData(timeData);

    const cssW = container.clientWidth;
    const cssH = container.clientHeight;
    const dpr = Math.min(globalThis.devicePixelRatio ?? 1, 2);

    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx2d.fillStyle = BG_FILL;
    ctx2d.fillRect(0, 0, cssW, cssH);

    ctx2d.strokeStyle = CENTER_LINE;
    ctx2d.lineWidth = 1;
    ctx2d.beginPath();
    ctx2d.moveTo(0, cssH / 2);
    ctx2d.lineTo(cssW, cssH / 2);
    ctx2d.stroke();

    ctx2d.strokeStyle = ACCENT;
    ctx2d.lineWidth = 2;
    ctx2d.beginPath();

    const sliceWidth = cssW / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i += 1) {
      const v = timeData[i] / 128.0;
      const y = (v * cssH) / 2;

      if (i === 0) {
        ctx2d.moveTo(x, y);
      } else {
        ctx2d.lineTo(x, y);
      }
      x += sliceWidth;
    }

    ctx2d.stroke();

    ctx2d.strokeStyle = ACCENT_DIM;
    ctx2d.lineWidth = 1;
    ctx2d.stroke();
  };

  rafId = requestAnimationFrame(draw);

  return () => {
    cancelAnimationFrame(rafId);
    resizeObserver.disconnect();
  };
}