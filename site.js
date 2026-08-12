document.querySelectorAll('.mobile-menu').forEach((button) => {
  const nav = button.nextElementSibling;
  button.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    button.setAttribute('aria-expanded', String(open));
    button.textContent = open ? 'Fermer' : 'Menu';
  });
});

document.querySelectorAll('.navlinks').forEach((nav) => {
  if (nav.querySelector('.nav-places')) return;
  const places = document.createElement('div');
  places.className = 'nav-places';
  places.innerHTML = '<button class="nav-places-trigger" type="button" aria-expanded="false">Lieux</button><div class="nav-places-menu" aria-label="Villes desservies"><a href="index.html#lieux">Charleville-Mézières</a><a href="index.html#lieux">Reims</a><a href="index.html#lieux">Bruxelles</a></div>';
  const before = [...nav.children].find((item) => item.getAttribute('href') === 'index.html#faq');
  nav.insertBefore(places, before || null);
});

document.querySelectorAll('.nav-places').forEach((places) => {
  const trigger = places.querySelector('.nav-places-trigger');
  let closeTimer;
  const mobile = () => window.matchMedia('(max-width:760px)').matches;
  const open = () => {
    if (mobile()) return;
    window.clearTimeout(closeTimer);
    places.classList.add('open');
  };
  const close = () => {
    if (mobile()) return;
    closeTimer = window.setTimeout(() => places.classList.remove('open'), 220);
  };
  places.addEventListener('mouseenter', open);
  places.addEventListener('mouseleave', close);
  trigger.addEventListener('click', () => {
    if (!mobile()) {
      trigger.blur();
      return;
    }
    const isOpen = places.classList.toggle('open');
    trigger.setAttribute('aria-expanded', String(isOpen));
  });
});

document.querySelectorAll('.eywa-menu').forEach((menu) => {
  const filters = menu.querySelectorAll('[data-menu-filter]');
  const cards = menu.querySelectorAll('[data-menu-item]');
  const groups = menu.querySelectorAll('[data-menu-group]');
  filters.forEach((filter) => filter.addEventListener('click', () => {
    const category = filter.dataset.menuFilter;
    filters.forEach((item) => item.classList.toggle('active', item === filter));
    cards.forEach((card) => {
      card.hidden = category !== 'all' && card.dataset.menuItem !== category;
    });
    groups.forEach((group) => {
      group.hidden = category !== 'all' && group.dataset.menuGroup !== category;
    });
  }));
});
