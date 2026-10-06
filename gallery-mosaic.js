/* Keep original photo ratios; pack each tile into the shortest column. */
(() => {
  const mosaic = document.querySelector('#gallery-mosaic');
  if (!mosaic) return;
  const tiles = [...mosaic.querySelectorAll('.gallery-tile')];
  const filters = [...document.querySelectorAll('[data-gallery-filter]')];
  const status = document.querySelector('.gallery-status');
  const viewer = document.querySelector('.gallery-viewer');
  let selection = 'all', current = 0, opener;
  const visibleTiles = () => tiles.filter(tile => selection === 'all' || tile.dataset.galleryCategory === selection);
  const layout = () => {
    const columns = innerWidth > 900 ? 3 : innerWidth > 600 ? 2 : 1;
    const gap = innerWidth > 600 ? 24 : 16;
    const width = (mosaic.clientWidth - gap * (columns - 1)) / columns;
    const heights = Array(columns).fill(0);
    tiles.forEach(tile => {
      tile.hidden = selection !== 'all' && tile.dataset.galleryCategory !== selection;
      if (tile.hidden) return;
      const col = heights.indexOf(Math.min(...heights));
      const image = tile.querySelector('img');
      tile.style.width = width + 'px';
      tile.style.left = col * (width + gap) + 'px';
      tile.style.top = heights[col] + 'px';
      heights[col] += width * Number(image.getAttribute('height')) / Number(image.getAttribute('width')) + gap;
    });
    mosaic.classList.add('masonry-ready');
    mosaic.style.height = Math.max(0, Math.max(...heights) - gap) + 'px';
  };
  filters.forEach(button => button.addEventListener('click', () => {
    selection = button.dataset.galleryFilter;
    filters.forEach(item => {
      item.classList.toggle('active', item === button);
      item.setAttribute('aria-pressed', String(item === button));
    });
    layout();
    const count = visibleTiles().length;
    status.textContent = count + ' photo' + (count > 1 ? 's' : '') + ' · ' + button.firstChild.textContent.trim();
  }));
  const show = index => {
    const visible = visibleTiles();
    current = (index + visible.length) % visible.length;
    const tile = visible[current], source = tile.querySelector('img');
    const image = viewer.querySelector('img');
    image.src = source.src;
    image.alt = source.alt;
    viewer.querySelector('figcaption').textContent = tile.querySelector('figcaption').textContent;
    viewer.querySelector('.gallery-viewer-position').textContent = (current + 1) + ' / ' + visible.length;
    viewer.querySelector('.gallery-viewer-prev').hidden = visible.length < 2;
    viewer.querySelector('.gallery-viewer-next').hidden = visible.length < 2;
  };
  tiles.forEach(tile => tile.querySelector('button').addEventListener('click', event => {
    opener = event.currentTarget;
    show(visibleTiles().indexOf(tile));
    viewer.showModal();
  }));
  viewer.querySelector('.gallery-viewer-close').addEventListener('click', () => viewer.close());
  viewer.querySelector('.gallery-viewer-prev').addEventListener('click', () => show(current - 1));
  viewer.querySelector('.gallery-viewer-next').addEventListener('click', () => show(current + 1));
  viewer.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault(); show(current + (event.key === 'ArrowRight' ? 1 : -1));
    }
  });
  viewer.addEventListener('click', event => {
    if (event.target !== viewer) return;
    const box = viewer.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) viewer.close();
  });
  viewer.addEventListener('close', () => opener?.focus());
  let lastWidth;
  new ResizeObserver(() => {
    if (lastWidth === mosaic.clientWidth) return;
    lastWidth = mosaic.clientWidth; layout();
  }).observe(mosaic);
  layout();
})();
