import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
const code = await readFile(new URL('../dist/media-audio.js', import.meta.url), 'utf8');
const { createMediaAudio } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
globalThis.document = new EventTarget();
class Media extends EventTarget {
  dataset = {}; muted = false; paused = false;
  // Safari ignores writes, including while the video is playing.
  get volume() { return 1; }
  set volume(_) {}
}
class Context extends EventTarget {
  static instances = [];
  state = 'suspended'; currentTime = 10; destination = {};
  sourceCount = 0;
  constructor() { super(); Context.instances.push(this); }
  createGain() {
    const param = { value: 1, cancelScheduledValues() {}, setTargetAtTime(v) { this.value = v; } };
    return this.gain = { gain: param, connect() {} };
  }
  createMediaElementSource(media) { this.sourceCount++; this.media = media; return { connect() {} }; }
  async resume() { this.state = 'running'; this.dispatchEvent(new Event('statechange')); }
}
test('gain controls an iOS-style fixed native volume throughout playback', async () => {
  const media = new Media(), audio = createMediaAudio(media, { AudioContext: Context });
  audio.unlock(); audio.set(.25);
  for (let i = 0; i < 10; i++) media.dispatchEvent(new Event('timeupdate'));
  assert.equal(media.volume, 1);
  assert.equal(audio.value, .25);
  assert.equal(Context.instances.at(-1).gain.gain.value, .25);
  audio.toggleMute(); assert.equal(audio.value, 0);
  assert.equal(Context.instances.at(-1).gain.gain.value, 0);
  audio.toggleMute(); assert.equal(audio.value, .25);
  audio.set(0); audio.toggleMute(); assert.equal(audio.value, .25);
  media.paused = true; audio.set(.8); media.paused = false;
  media.dispatchEvent(new Event('play'));
  assert.equal(audio.value, .8);
  assert.equal(Context.instances.at(-1).sourceCount, 1);
  Context.instances.at(-1).state = 'interrupted'; audio.unlock();
  await Promise.resolve();
  assert.equal(media.dataset.audioState, 'running');
  assert.equal(Context.instances.at(-1).gain.gain.value, .8);
});
test('native fallback preserves level and restores mute when Web Audio is absent', () => {
  const media = new EventTarget(); Object.assign(media, { volume: 1, muted: false, dataset: {} });
  const audio = createMediaAudio(media, { AudioContext: null });
  audio.set(.4); assert.equal(media.volume, .4);
  audio.toggleMute(); assert.equal(audio.value, 0);
  audio.toggleMute(); assert.equal(audio.value, .4);
});
