(() => {
  const variant = new URLSearchParams(location.search).get('logo');
  const variants = ['jost', 'sans', 'playfair', 'classic'];
  document.body.dataset.eywaLogo = variants.includes(variant) ? variant : 'jost';
})();
