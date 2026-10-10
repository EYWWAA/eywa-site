/* Date de l'événement : les anciens liens restent consultables, sans réservation. */
(function (root) {
  'use strict';
  function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    var parsed = new Date(value + 'T12:00:00Z');
    return !isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }
  function parisDate(now) {
    var parts = new Intl.DateTimeFormat('en', {
      timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(now || new Date());
    function part(type) { return parts.find(function (p) { return p.type === type; }).value; }
    return part('year') + '-' + part('month') + '-' + part('day');
  }
  function getStatus(params, now) {
    var eventDate = params.get('d');
    return { eventDate: eventDate, expired: validDate(eventDate) && eventDate < parisDate(now) };
  }
  function applyToQuote(params) {
    var state = getStatus(params);
    document.body.classList.toggle('quote-expired', state.expired);
    document.querySelectorAll('#quote-options input').forEach(function (input) {
      input.disabled = state.expired;
    });
    var banner = document.getElementById('quote-expired-notice');
    if (!state.expired) { if (banner) banner.remove(); return state; }
    if (!banner) {
      banner = document.createElement('section');
      banner.id = 'quote-expired-notice';
      banner.className = 'quote-expired-notice';
      banner.setAttribute('aria-labelledby', 'quote-expired-title');
      var title = document.createElement('h2');
      title.id = 'quote-expired-title'; title.textContent = 'Ce devis est expiré';
      var copy = document.createElement('p');
      var date = new Date(state.eventDate + 'T12:00:00Z').toLocaleDateString('fr-FR', {
        timeZone: 'Europe/Paris', day: 'numeric', month: 'long', year: 'numeric'
      });
      copy.textContent = 'La date prévue pour votre événement, le ' + date + ', est passée. Vous pouvez consulter ce devis, mais il ne permet plus de réserver une prestation.';
      var actions = document.createElement('div'); actions.className = 'quote-expired-actions';
      [['Obtenir un nouveau devis', 'devis-instantane.html'], ['Nous contacter', 'contact.html']].forEach(function (item) {
        var link = document.createElement('a'); link.textContent = item[0]; link.href = item[1]; actions.appendChild(link);
      });
      banner.append(title, copy, actions);
      var container = document.querySelector('.container');
      if (container) container.prepend(banner);
    }
    var bottom = document.querySelector('.bottom');
    if (bottom) {
      bottom.querySelector('h2').textContent = 'Un nouvel événement en préparation ?';
      bottom.querySelector('p').textContent = 'Obtenez une nouvelle proposition avec votre nouvelle date, ou échangez avec Louis.';
      var primary = document.getElementById('btn-reserve-bottom');
      primary.textContent = 'Obtenir un nouveau devis'; primary.href = 'devis-instantane.html';
      var contact = bottom.querySelector('.btn-contact'); if (contact) contact.href = 'contact.html';
    }
    var availability = document.querySelector('.avail span:last-child');
    if (availability) availability.textContent = 'Devis expiré · date de l’événement passée.';
    return state;
  }
  function watchQuote(params) {
    function refresh() { if (getStatus(params).expired) applyToQuote(params); }
    root.addEventListener('pageshow', refresh);
    root.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(); });
    root.setInterval(refresh, 60000);
    document.addEventListener('click', function (event) {
      var link = event.target.closest && event.target.closest('a');
      if (!link || !getStatus(params).expired) return;
      if (/^btn-reserve-(main|dock)$/.test(link.id) || link.matches('.top-actions .btn-gold') || /reservation\.html(?:\?|$)/.test(link.getAttribute('href') || '')) {
        event.preventDefault();
        applyToQuote(params);
        var notice = document.getElementById('quote-expired-notice');
        if (notice) notice.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    }, true);
  }
  var api = { validDate: validDate, parisDate: parisDate, getStatus: getStatus, applyToQuote: applyToQuote, watchQuote: watchQuote };
  root.EywaQuoteValidity = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window === 'object' ? window : globalThis);
