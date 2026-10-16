'use strict';
// Original instrumental composition and synthesis. No recordings, samples or third-party melody.
const fs = require('node:fs');
const path = require('node:path');
const sampleRate = 48000;
const duration = 150;
const count = sampleRate * duration;
const left = new Float32Array(count),
  right = new Float32Array(count);
const beat = 60 / 76,
  bar = beat * 4;
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
function note(start, length, midi, gain, pan, kind) {
  const begin = Math.round(start * sampleRate),
    end = Math.min(count, Math.round((start + length) * sampleRate));
  const frequency = hz(midi),
    l = Math.sqrt((1 - pan) / 2),
    r = Math.sqrt((1 + pan) / 2);
  for (let i = begin; i < end; i++) {
    const t = (i - begin) / sampleRate;
    const edge = Math.min(
      1,
      t / (kind === 'pad' ? 1.7 : 0.025),
      Math.max(0, (length - t) / (kind === 'pad' ? 2 : 0.5))
    );
    let value;
    if (kind === 'pad')
      value =
        (Math.sin(2 * Math.PI * frequency * t) +
          0.37 * Math.sin(2 * Math.PI * frequency * 1.0017 * t) +
          0.14 * Math.sin(4 * Math.PI * frequency * t)) *
        0.65 *
        edge;
    else
      value =
        (Math.sin(2 * Math.PI * frequency * t) * Math.exp(-t / 1.8) +
          0.19 * Math.sin(4 * Math.PI * frequency * t) * Math.exp(-t / 0.65) +
          0.045 * Math.sin(2 * Math.PI * frequency * 3 * t) * Math.exp(-t / 0.3)) *
        edge;
    left[i] += value * gain * l;
    right[i] += value * gain * r;
  }
}
const chords = [
  [53, 57, 60, 64, 67],
  [45, 60, 64, 67, 71],
  [48, 55, 59, 62, 64],
  [43, 55, 57, 59, 62]
];
const phrases = [
  [67, 64, 72, 69],
  [71, 67, 64, 72],
  [67, 71, 74, 64],
  [69, 67, 62, 71],
  [72, 69, 67, 64],
  [67, 71, 76, 72],
  [74, 71, 67, 64],
  [69, 62, 67, 71]
];
for (let b = 0; b * bar < duration; b++) {
  const chord = chords[Math.floor(b / 2) % 4];
  if (b % 2 === 0)
    chord.forEach((n, j) =>
      note(b * bar, bar * 2 + 2.2, n, j ? 0.02 : 0.025, (j - 2) * 0.15, 'pad')
    );
  // Sparse, soft electric-piano notes; the second half answers the first rather than repeating it.
  const phrase = phrases[b % phrases.length];
  const accents = b % 4 === 3 ? [0.5, 2.5] : [0, 1.5, 3];
  accents.forEach((offset, j) =>
    note(
      b * bar + offset * beat,
      3.0,
      phrase[(j + Math.floor(b / 8)) % 4],
      0.039,
      j % 2 ? 0.18 : -0.16,
      'piano'
    )
  );
  if (b % 2 === 0) note(b * bar + 0.05, bar * 1.8, chord[0] - 12, 0.018, 0, 'piano');
}
// A small original algorithmic stereo echo; no external impulse response.
for (const [delay, gain] of [
  [0.29, 0.12],
  [0.47, 0.085],
  [0.79, 0.045]
]) {
  const offset = Math.round(delay * sampleRate);
  for (let i = count - 1; i >= offset; i--) {
    left[i] += right[i - offset] * gain;
    right[i] += left[i - offset] * gain;
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
  const t = i / sampleRate;
  const fade = Math.min(1, t / 3, (duration - t) / 6);
  for (let channel = 0; channel < 2; channel++) {
    const value = ((channel ? right[i] : left[i]) / peak) * 0.52 * fade;
    audio.writeInt16LE(
      Math.round(Math.max(-1, Math.min(1, value)) * 32767),
      44 + i * 4 + channel * 2
    );
  }
}
const out = path.resolve(__dirname, '../dist/public-launch-v2');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'Quiet-Scenes-original.wav'), audio);
console.log(
  JSON.stringify({
    title: 'Quiet Scenes',
    duration,
    sampleRate,
    channels: 2,
    source: 'Original notes and synthesis; no third-party samples',
    license: 'CC0-1.0',
    peakDbFS: 20 * Math.log10(0.52)
  })
);
