let audioContext = null;

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

function playTone(freq, duration = 0.1, type = 'sine', startTime = 0) {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    osc.start(ctx.currentTime + startTime);
    osc.stop(ctx.currentTime + duration + startTime);
  } catch (e) {
    // audio not available, silently fail
  }
}

export const sound = {
  cardPlay: () => {
    playTone(800, 0.05);
    playTone(600, 0.05, 'sine', 0.06);
  },
  trickWin: () => {
    playTone(1047, 0.1); // C6
    playTone(1319, 0.1, 'sine', 0.12); // E6
    playTone(1568, 0.15, 'sine', 0.24); // G6
  },
  trumpChosen: () => {
    playTone(523, 0.08); // C5
    playTone(659, 0.08, 'sine', 0.1); // E5
  },
  cardDeal: () => {
    playTone(494, 0.04); // B4
  },
  gameOver: () => {
    playTone(1047, 0.2); // C6
    playTone(1047, 0.2, 'sine', 0.25);
    playTone(1047, 0.3, 'sine', 0.5);
  },
};
