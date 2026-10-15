'use strict';
function smoothingConfig(settings = {}) {
  const fps = settings.smoothingFps ?? 30;
  const mode = settings.smoothingMode ?? 'fast';
  if (![24, 30].includes(fps) || !['fast', 'quality', 'blend'].includes(mode))
    throw new Error('Invalid animation smoothing settings.');
  return { fps, mode, codec: mode === 'quality' ? 'vp9' : 'vp8', version: 2 };
}
function smoothingMatches(media, settings = {}) {
  if (!media) return false;
  // Older installations keep their prepared variants until explicitly changing a profile.
  if (!media.smoothingConfig)
    return (
      (settings.smoothingFps === undefined && settings.smoothingMode === undefined) ||
      (settings.smoothingFps === 30 && settings.smoothingMode === 'quality')
    );
  const config = smoothingConfig(settings);
  return ['fps', 'mode', 'codec', 'version'].every(
    (key) => config[key] === media.smoothingConfig[key]
  );
}
function smoothingFilter(config) {
  const max = config.mode === 'quality' ? [1920, 1080] : [1280, 720];
  const interpolation =
    config.mode === 'blend'
      ? 'mi_mode=blend'
      : config.mode === 'fast'
        ? 'mi_mode=mci:mc_mode=obmc:me_mode=bidir:search_param=16:vsbmc=0'
        : 'mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1';
  return `scale=w='min(${max[0]},iw)':h='min(${max[1]},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,tpad=stop_mode=clone:stop_duration=1,minterpolate=fps=${config.fps}:${interpolation},format=yuv420p`;
}
module.exports = { smoothingConfig, smoothingMatches, smoothingFilter };
