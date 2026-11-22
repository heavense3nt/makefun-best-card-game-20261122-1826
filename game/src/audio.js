// All sound in Ember Clash is synthesized with the Web Audio API — no audio
// files, no network. A tiny helper builds short tones and noise bursts, and each
// named sound is a few of those layered: a click, a card snap, a hit thud, a heal
// chime, a coin-like draw tick, and a win fanfare arpeggio.
let context = null;
let muted = false;

function audioContext() {
  if (!context) {
    const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextClass) return null;
    context = new AudioContextClass();
  }
  if (context.state === 'suspended') void context.resume();
  return context;
}

function tone({ frequency, endFrequency, duration, type = 'sine', gain = 0.12, when = 0 }) {
  const ctx = audioContext();
  if (!ctx || muted) return;
  const start = ctx.currentTime + when;
  const oscillator = ctx.createOscillator();
  const volume = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
  volume.gain.setValueAtTime(gain, start);
  volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(volume).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function noise({ duration, gain = 0.1, when = 0, lowpass = 1200 }) {
  const ctx = audioContext();
  if (!ctx || muted) return;
  const start = ctx.currentTime + when;
  const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = lowpass;
  const volume = ctx.createGain();
  volume.gain.setValueAtTime(gain, start);
  volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter).connect(volume).connect(ctx.destination);
  source.start(start);
}

export const sounds = {
  click() { tone({ frequency: 660, duration: 0.06, type: 'triangle', gain: 0.08 }); },
  draw() { tone({ frequency: 520, endFrequency: 880, duration: 0.09, type: 'triangle', gain: 0.07 }); },
  playCard() { noise({ duration: 0.12, gain: 0.12, lowpass: 2400 }); tone({ frequency: 220, endFrequency: 330, duration: 0.1, type: 'triangle', gain: 0.09 }); },
  hit() { noise({ duration: 0.18, gain: 0.16, lowpass: 700 }); tone({ frequency: 140, endFrequency: 60, duration: 0.2, type: 'sawtooth', gain: 0.1 }); },
  shield() { tone({ frequency: 440, endFrequency: 550, duration: 0.14, type: 'sine', gain: 0.09 }); },
  heal() { tone({ frequency: 523, duration: 0.12, gain: 0.08 }); tone({ frequency: 784, duration: 0.16, gain: 0.08, when: 0.09 }); },
  burn() { noise({ duration: 0.25, gain: 0.1, lowpass: 1600 }); },
  turn() { tone({ frequency: 392, duration: 0.1, type: 'triangle', gain: 0.08 }); tone({ frequency: 523, duration: 0.12, type: 'triangle', gain: 0.08, when: 0.08 }); },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone({ frequency: f, duration: 0.22, gain: 0.1, when: i * 0.13 })); },
  lose() { [392, 330, 262, 196].forEach((f, i) => tone({ frequency: f, duration: 0.25, type: 'triangle', gain: 0.09, when: i * 0.15 })); },
};

export function setMuted(value) {
  muted = value;
}

export function isMuted() {
  return muted;
}

/** Play the sound that matches one engine event, if it has one. */
export function playEventSound(event) {
  switch (event.type) {
    case 'card-played': sounds.playCard(); break;
    case 'damage': sounds.hit(); break;
    case 'shield': case 'shield-block': sounds.shield(); break;
    case 'heal': sounds.heal(); break;
    case 'burn': case 'burn-applied': sounds.burn(); break;
    case 'turn-start': sounds.turn(); break;
    case 'match-end': (event.playerWon ? sounds.win : sounds.lose)(); break;
    default: break;
  }
}
