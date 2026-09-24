(() => {
  const video = document.getElementById('eywa-film');
  const button = document.querySelector('.film-play');
  const error = document.querySelector('.film-error');
  if (!video || !button) return;
  video.controls = false;
  button.hidden = false;
  button.addEventListener('click', async () => {
    error.hidden = true;
    try {
      if (video.ended) video.currentTime = 0;
      await video.play();
    } catch {
      video.controls = true;
      error.hidden = false;
      button.hidden = false;
    }
  });
  video.addEventListener('play', () => {
    video.controls = true;
    button.hidden = true;
    video.setAttribute('tabindex', '0');
    video.focus({ preventScroll: true });
  });
  video.addEventListener('ended', () => { button.hidden = false; });
  video.addEventListener('error', () => { error.hidden = false; });
})();
