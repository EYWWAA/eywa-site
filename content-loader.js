(() => {
  const getValue = (source, path) => path.split('.').reduce((value, key) => value && value[key], source);

  const replaceText = (selector, content) => {
    document.querySelectorAll(selector).forEach((element) => {
      const value = getValue(content, element.dataset.content);
      if (typeof value === 'string') element.textContent = value;
    });
  };

  const replaceImage = (selector, attribute, content) => {
    document.querySelectorAll(selector).forEach((element) => {
      const value = getValue(content, element.dataset[attribute]);
      if (typeof value === 'string' && value.trim()) element.setAttribute(attribute === 'contentImage' ? 'src' : 'alt', value);
    });
  };

  const file = document.body.dataset.contentFile;
  if (!file) return;

  fetch(`content/${file}.json`, { cache: 'no-store' })
    .then((response) => response.ok ? response.json() : null)
    .then((content) => {
      if (!content) return;
      replaceText('[data-content]', content);
      replaceImage('[data-content-image]', 'contentImage', content);
      replaceImage('[data-content-alt]', 'contentAlt', content);
    })
    .catch(() => {});
})();
