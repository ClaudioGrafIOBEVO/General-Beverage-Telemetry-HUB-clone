// Audio feedback synthesis using Web Audio API
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// DTMF-like frequencies for standard 4x4 keypad matrix
const ROW_FREQS: Record<number, number> = {
  0: 697, // Row 1 (1, 2, 3, A)
  1: 770, // Row 2 (4, 5, 6, B)
  2: 852, // Row 3 (7, 8, 9, C)
  3: 941, // Row 4 (*, 0, #, D)
};

const COL_FREQS: Record<number, number> = {
  0: 1209, // Col 1 (1, 4, 7, *)
  1: 1336, // Col 2 (2, 5, 8, 0)
  2: 1477, // Col 3 (3, 6, 9, #)
  3: 1633, // Col 4 (A, B, C, D)
};

const KEY_MAP: Record<string, [number, number]> = {
  '1': [0, 0], '2': [0, 1], '3': [0, 2], 'A': [0, 3],
  '4': [1, 0], '5': [1, 1], '6': [1, 2], 'B': [1, 3],
  '7': [2, 0], '8': [2, 1], '9': [2, 2], 'C': [2, 3],
  '*': [3, 0], '0': [3, 1], '#': [3, 2], 'D': [3, 3],
};

export function playKeyBeep(key: string, volume: number = 0.15) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const keyUpper = key.toUpperCase();
  const coords = KEY_MAP[keyUpper];

  if (!coords) {
    // Generic click
    playGenericClick(volume);
    return;
  }

  const [rowIdx, colIdx] = coords;
  const f1 = ROW_FREQS[rowIdx] || 800;
  const f2 = COL_FREQS[colIdx] || 1300;

  try {
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(f1, now);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(f2, now);

    // Envelope
    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.exponentialRampToValueAtTime(volume, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);

    osc1.stop(now + 0.1);
    osc2.stop(now + 0.1);
  } catch (err) {
    console.debug('Audio play failed', err);
  }
}

export function playSuccessSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.setValueAtTime(880, now + 0.1); // A5
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  } catch (e) {
    console.debug(e);
  }
}

export function playErrorSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.setValueAtTime(180, now + 0.15);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  } catch (e) {
    console.debug(e);
  }
}

function playGenericClick(volume: number) {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1200, now);
    gain.gain.setValueAtTime(volume * 0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  } catch (e) {
    console.debug(e);
  }
}
