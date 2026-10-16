'use strict';
// Original instrumental composition and synthesis. No recordings, samples or borrowed melody.
const fs = require('node:fs');
const path = require('node:path');
const sampleRate = 48000,
  duration = 150,
  count = sampleRate * duration;
const left = new Float32Array(count),
  right = new Float32Array(count);
const bpm = 104,
  beat = 60 / bpm,
  bar = beat * 4;
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
let seed = 0x618bc3;
function random() {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return (seed >>> 0) / 4294967296;
}
function add(start, length, gain, pan, synth) {
  const begin = Math.max(0, Math.round(start * sampleRate)),
    end = Math.min(count, Math.round((start + length) * sampleRate));
  const l = Math.sqrt((1 - pan) / 2),
    r = Math.sqrt((1 + pan) / 2);
  for (let i = begin; i < end; i++) {
    const value = synth((i - begin) / sampleRate) * gain;
    left[i] += value * l;
    right[i] += value * r;
  }
}
function note(start, length, midi, gain, pan, kind) {
  const f = hz(midi),
    pad = kind === 'pad',
    bass = kind === 'bass';
  add(start, length, gain, pan, (t) => {
    const attack = pad ? 0.7 : bass ? 0.009 : 0.006;
    const release = pad ? 1.3 : bass ? 0.11 : 0.28;
    const edge = Math.min(1, t / attack, Math.max(0, (length - t) / release));
    if (pad)
      return (
        (Math.sin(2 * Math.PI * f * t) +
          0.3 * Math.sin(2 * Math.PI * f * 1.0015 * t) +
          0.07 * Math.sin(4 * Math.PI * f * t)) *
        0.65 *
        edge
      );
    if (bass)
      return (
        (Math.sin(2 * Math.PI * f * t) + 0.18 * Math.sin(4 * Math.PI * f * t)) *
        Math.exp(-t / 0.45) *
        edge
      );
    return (
      (Math.sin(2 * Math.PI * f * t) * Math.exp(-t / 0.6) +
        0.16 * Math.sin(4 * Math.PI * f * t) * Math.exp(-t / 0.2) +
        0.035 * Math.sin(6 * Math.PI * f * t) * Math.exp(-t / 0.1)) *
      edge
    );
  });
}
const chords = [
  [53, 57, 60, 64, 67],
  [57, 60, 64, 67, 71],
  [55, 59, 60, 64, 67],
  [55, 57, 59, 62, 67]
];
const basses = [41, 33, 36, 31];
const patterns = [
  [2, 4, 3, 2, 1, 3],
  [3, 2, 4, 1, 2, 4],
  [2, 3, 1, 4, 3, 2],
  [1, 3, 4, 2, 3, 1]
];
for (let b = 0; b * bar < duration; b++) {
  const group = Math.floor(b / 2) % 4,
    chord = chords[group];
  if (b % 2 === 0)
    chord.forEach((n, j) => note(b * bar, bar * 2 + 1.3, n, 0.011, (j - 2) * 0.15, 'pad'));
  const accents = [0.5, 1.25, 1.75, 2.5, 3.25, 3.75];
  accents.forEach((offset, j) => {
    const n = chord[patterns[b % 4][j]] + (b % 8 === 7 && j === 5 ? 12 : 0);
    note(
      b * bar + offset * beat + (random() - 0.5) * 0.01,
      1.1,
      n,
      (b < 2 ? 0.021 : 0.028) * (j % 3 === 0 ? 1 : 0.76),
      j % 2 ? 0.22 : -0.2,
      'keys'
    );
  });
}
// Short, quiet stereo reflections on the harmonic parts only, keeping the beat and bass clear.
for (const [delay, gain] of [
  [beat * 0.75, 0.13],
  [beat * 1.25, 0.065]
]) {
  const offset = Math.round(delay * sampleRate);
  for (let i = count - 1; i >= offset; i--) {
    left[i] += right[i - offset] * gain;
    right[i] += left[i - offset] * gain;
  }
}
for (let b = 0; b * bar < duration; b++) {
  const root = basses[Math.floor(b / 2) % 4],
    intro = b < 2,
    bridge = b % 32 >= 16 && b % 32 < 20;
  for (const offset of [0, 1.5, 2.5, 3.5])
    note(
      b * bar + offset * beat,
      beat * 0.7,
      root + (offset === 3.5 ? 12 : 0),
      intro ? 0.035 : 0.055,
      0,
      'bass'
    );
  if (b < 2) continue;
  for (const offset of bridge ? [0, 2] : [0, 1, 2, 3]) {
    add(
      b * bar + offset * beat,
      0.3,
      0.085,
      0,
      (t) =>
        Math.sin(2 * Math.PI * (48 * t + 57 * 0.028 * (1 - Math.exp(-t / 0.028)))) *
        Math.min(1, t / 0.003) *
        Math.exp(-t / 0.075)
    );
  }
  if (!bridge)
    for (const offset of [1, 3]) {
      let previous = 0;
      add(b * bar + offset * beat + 0.006, 0.14, 0.027, 0.05, (t) => {
        const noise = random() * 2 - 1;
        previous = previous * 0.68 + noise * 0.32;
        return (
          (previous * 1.5 + Math.sin(2 * Math.PI * 190 * t) * 0.12) *
          Math.min(1, t / 0.002) *
          Math.exp(-t / 0.035)
        );
      });
    }
  for (let n = 0; n < 8; n++) {
    let previous = 0;
    add(
      b * bar + (n * beat) / 2 + 0.003,
      0.065,
      n % 2 ? 0.009 : 0.0045,
      n % 2 ? 0.3 : -0.25,
      (t) => {
        const noise = random() * 2 - 1,
          high = noise - previous;
        previous = noise;
        return high * Math.min(1, t / 0.0015) * Math.exp(-t / 0.014);
      }
    );
  }
}
let peak = 0;
for (let i = 0; i < count; i++) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
const audio = Buffer.alloc(44 + count * 4);
audio.write('RIFF');
audio.writeUInt32LE(audio.length - 8, 4);
audio.write('WAVEfmt ', 8);
audio.writeUInt32LE(16, 16);
audio.writeUInt16LE(1, 20);
audio.writeUInt16LE(2, 22);
audio.writeUInt32LE(sampleRate, 24);
audio.writeUInt32LE(sampleRate * 4, 28);
audio.writeUInt16LE(4, 32);
audio.writeUInt16LE(16, 34);
audio.write('data', 36);
audio.writeUInt32LE(count * 4, 40);
for (let i = 0; i < count; i++) {
  const t = i / sampleRate,
    fade = Math.min(1, t / 2.5, (duration - t) / 6);
  for (let channel = 0; channel < 2; channel++)
    audio.writeInt16LE(
      Math.round(((channel ? right[i] : left[i]) / peak) * 0.6 * fade * 32767),
      44 + i * 4 + channel * 2
    );
}
const out = path.resolve(__dirname, '../dist/public-launch-v2');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'Bright-Scenes-original.wav'), audio);
console.log(
  JSON.stringify({
    title: 'Bright Scenes',
    bpm,
    duration,
    sampleRate,
    channels: 2,
    source: 'Original composition and deterministic synthesis; no third-party samples',
    license: 'CC0-1.0',
    peakDbFS: 20 * Math.log10(0.6)
  })
);
