/* Equalize the sticky bottom edge so the completed stack leaves as one group. */
(() => {
  const list = document.querySelector('.personal-catalog-list');
  if (!list) return;
  const cards = [...list.querySelectorAll('.personal-project')];
  const px = value => parseFloat(value) || 0;
  let frame;
  const measure = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const heights = cards.map(card => {
        const style = getComputedStyle(card);
        const content = [...card.children].reduce((height, child) => {
          const css = getComputedStyle(child);
          return height + child.getBoundingClientRect().height + px(css.marginTop) + px(css.marginBottom);
        }, 0);
        return content + px(style.paddingTop) + px(style.paddingBottom) + px(style.borderTopWidth) + px(style.borderBottomWidth) + px(style.getPropertyValue('--stack-offset'));
      });
      list.style.setProperty('--stack-height', Math.ceil(Math.max(...heights)) + 'px');
    });
  };
  const observer = new ResizeObserver(measure);
  cards.forEach(card => [...card.children].forEach(child => observer.observe(child)));
  window.addEventListener('resize', measure, { passive: true });
  document.fonts.ready.then(measure);
  measure();
})();
