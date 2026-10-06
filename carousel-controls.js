(() => {
  const region = document.querySelector('.photo-carousel');
  const stage = region?.querySelector('.carousel-stage');
  if (!stage) return;
  const slides = [...region.querySelectorAll('.carousel-slide')];
  const thumbs = [...region.querySelectorAll('.carousel-thumb')];
  if (!slides.length) return;
  let active = Math.max(0, slides.findIndex(slide => slide.classList.contains('active')));
  const status = document.createElement('span');
  status.className = 'carousel-announcement';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  region.append(status);
  const show = (next, announce = true) => {
    active = (next + slides.length) % slides.length;
    slides.forEach((slide, index) => {
      slide.classList.toggle('active', index === active);
      slide.setAttribute('aria-hidden', String(index !== active));
    });
    thumbs.forEach((thumb, index) => {
      const selected = index === active;
      thumb.classList.toggle('active', selected);
      thumb.setAttribute('aria-selected', String(selected));
      thumb.tabIndex = selected ? 0 : -1;
    });
    if (announce) status.textContent = `Photo ${active + 1} sur ${slides.length}`;
  };
  region.querySelector('.prev')?.addEventListener('click', () => show(active - 1));
  region.querySelector('.next')?.addEventListener('click', () => show(active + 1));
  thumbs.forEach((thumb, index) => thumb.addEventListener('click', () => show(index)));
  region.addEventListener('keydown', event => {
    const next = { ArrowRight: active + 1, ArrowLeft: active - 1, Home: 0, End: slides.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    show(next);
    if (event.target.closest('.carousel-thumb')) thumbs[active]?.focus({ preventScroll: true });
  });
  // Le défilement vertical et le zoom restent disponibles. Un geste
  // horizontal entier, y compris son inertie, ne change qu’une photo.
  let wheelDistance = 0;
  let wheelFired = false;
  let wheelTimer;
  stage.addEventListener('wheel', event => {
    if (event.ctrlKey || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
    event.preventDefault();
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => { wheelDistance = 0; wheelFired = false; }, 220);
    if (wheelFired) return;
    const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? stage.clientWidth : 1;
    wheelDistance += event.deltaX * scale;
    if (Math.abs(wheelDistance) >= 60) {
      show(active + (wheelDistance > 0 ? 1 : -1));
      wheelFired = true;
    }
  }, { passive: false });
  let pointerStart;
  stage.querySelectorAll('img').forEach(img => { img.draggable = false; });
  stage.addEventListener('pointerdown', event => {
    if (event.target.closest('button') || (event.pointerType === 'mouse' && event.button !== 0)) return;
    pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
    try { stage.setPointerCapture(event.pointerId); } catch {}
  });
  stage.addEventListener('pointerup', event => {
    if (!pointerStart || pointerStart.id !== event.pointerId) return;
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    pointerStart = undefined;
    if (Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) * 1.2) show(active + (dx < 0 ? 1 : -1));
  });
  stage.addEventListener('pointercancel', () => { pointerStart = undefined; });
  show(active, false);
})();
