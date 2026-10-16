'use strict';
const video = document.querySelector('video');
if (video) {
  if (location.protocol === 'file:') video.src = 'Steam-Animated-Screensaver-demo.mp4';
  for (const button of document.querySelectorAll('[data-time]'))
    button.addEventListener('click', () => {
      video.currentTime = Number(button.dataset.time);
      video.play().catch(() => {});
    });
}
