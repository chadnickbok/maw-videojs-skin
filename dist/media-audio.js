// Keep the user's level independent of HTMLMediaElement.volume: on iOS that
// property stays at 1. One graph per video also survives pause, seek and skins.
export function createMediaAudio(media, { AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext, onError = () => {} } = {}) {
  let context, source, gain;
  let level = media.volume, lastAudible = level || 1;
  const effective = () => media.muted ? 0 : level;
  function report() {
    media.dataset.audioEngine = gain ? 'web-audio' : 'native';
    media.dataset.audioState = context?.state || 'native';
    media.dataset.audioLevel = String(effective());
    media.dataset.audioGain = String(gain?.gain.value ?? effective());
  }
  function apply() {
    if (gain) {
      const now = context.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(effective(), now, .012);
    } else {
      media.volume = level;
    }
    report();
  }
  // Call synchronously inside a gesture, before play(), to unlock Safari audio.
  function unlock() {
    if (!context && AudioContext) {
      let candidate;
      try {
        candidate = new AudioContext();
        const nextGain = candidate.createGain();
        nextGain.gain.value = effective();
        nextGain.connect(candidate.destination);
        const nextSource = candidate.createMediaElementSource(media);
        nextSource.connect(nextGain);
        context = candidate; source = nextSource; gain = nextGain;
        media.volume = 1; // attenuation happens exactly once, in the GainNode
        context.addEventListener('statechange', report);
      } catch (error) {
        candidate?.close().catch(() => {});
        onError(error);
      }
    }
    if (context && context.state !== 'running') {
      // Do not await: media.play() must use the same user activation.
      context.resume().then(() => { apply(); }, onError);
    }
    apply();
  }
  function changed() {
    apply();
    media.dispatchEvent(new Event('audiolevelchange'));
  }
  media.addEventListener('volumechange', () => { if (gain) apply(); });
  media.addEventListener('play', unlock);
  media.addEventListener('timeupdate', report);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !media.paused && context) unlock();
  });
  return {
    get value() { return effective(); },
    get muted() { return media.muted || level === 0; },
    unlock,
    set(value) {
      level = Math.max(0, Math.min(1, Number(value) || 0));
      if (level > 0) lastAudible = level;
      media.muted = level === 0;
      unlock(); changed();
    },
    toggleMute() {
      if (media.muted || level === 0) { level = level || lastAudible; media.muted = false; }
      else media.muted = true;
      unlock(); changed();
    }
  };
}
