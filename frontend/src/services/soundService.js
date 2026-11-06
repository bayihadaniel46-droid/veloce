let audioContext;

const tones = {
  click: [{ frequency: 740, duration: 0.035, volume: 0.018 }],
  like: [
    { frequency: 784, duration: 0.05, volume: 0.025 },
    { frequency: 1046, duration: 0.07, volume: 0.025, delay: 0.035 },
  ],
  comment: [
    { frequency: 587, duration: 0.055, volume: 0.022 },
    { frequency: 740, duration: 0.07, volume: 0.022, delay: 0.045 },
  ],
  refresh: [
    { frequency: 620, duration: 0.06, volume: 0.022 },
    { frequency: 880, duration: 0.08, volume: 0.018, delay: 0.055 },
  ],
  message: [
    { frequency: 660, duration: 0.09, volume: 0.035 },
    { frequency: 990, duration: 0.12, volume: 0.03, delay: 0.09 },
  ],
};

export function playUiSound(kind = "click") {
  if (typeof window === "undefined") return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    audioContext ||= new AudioContextClass();
    const context = audioContext;
    const play = () => {
      for (const tone of tones[kind] || tones.click) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const start = context.currentTime + (tone.delay || 0);
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(tone.frequency, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(tone.volume, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.duration);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + tone.duration + 0.01);
      }
    };

    if (context.state === "suspended") {
      void context.resume().then(play).catch(() => {});
    } else {
      play();
    }
  } catch {
    // A browser may block audio before the first user gesture.
  }
}
