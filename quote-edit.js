/* Modification d'un devis par le client (Louis, 21/11/2026).
   - devis.html : bouton « Modifier mon devis » qui rouvre le simulateur prérempli,
     et lien « Demander une modification » pour une date déjà réservée.
   - devis-instantane.html?modifier=1 : préremplit chaque étape depuis le devis.
   Le prix reste recalculé par le serveur au paiement ; rien ici ne fixe un montant. */
(function () {
  'use strict';
  var KEYS = ['p', 't', 'g', 'h', 'dy', 'd', 'ti', 'l', 'options', 'qid'];

  /* --- Page devis --- */
  var edit = document.getElementById('quote-edit-link');
  if (edit) {
    var refresh = function () {
      var current = new URLSearchParams(location.search), next = new URLSearchParams();
      KEYS.forEach(function (k) { if (current.get(k)) next.set(k, current.get(k)); });
      next.set('modifier', '1');
      edit.href = 'devis-instantane.html?' + next.toString();
      var request = document.getElementById('quote-change-request');
      if (request) {
        var qid = current.get('qid') || '', ref = /^[a-f0-9-]{36}$/.test(qid) ? 'EYWA-' + qid.slice(0, 8).toUpperCase() : '';
        var date = /^\d{4}-\d{2}-\d{2}$/.test(current.get('d') || '') ? new Date(current.get('d') + 'T12:00').toLocaleDateString('fr-FR', {day: 'numeric', month: 'long', year: 'numeric'}) : '';
        var subject = 'Modification de ma réservation' + (ref ? ' ' + ref : '');
        var body = 'Bonjour,\n\nJe souhaite modifier ma réservation' + (ref ? ' ' + ref : '') + (date ? ' du ' + date : '') + '.\n\nModification souhaitée : \n\nMerci.';
        request.href = 'mailto:contact.eywa08@gmail.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      }
    };
    refresh();
    /* Les options cochées sur la page modifient l'URL : on relit au moment du clic. */
    edit.addEventListener('click', refresh);
    var req = document.getElementById('quote-change-request');
    if (req) req.addEventListener('click', refresh);
    return;
  }

  /* --- Simulateur --- */
  var p = new URLSearchParams(location.search);
  if (p.get('modifier') !== '1' || typeof A === 'undefined') return;
  try {
    var g = parseInt(p.get('g'), 10);
    if (g >= 1 && g <= 2000) setGuests(g);
    var h = parseFloat(p.get('h'));
    if (h >= 1.5 && h <= 24) { A.hrs = Math.round(h * 2) / 2; document.getElementById('dur-display').textContent = hrsLabel(A.hrs); }
    updateBaristaDisplay();
    var dy = parseInt(p.get('dy'), 10);
    if (dy >= 1 && dy <= 30) { A.days = dy; document.getElementById('days-display').textContent = dy; }

    var lieu = (p.get('l') || '').slice(0, 200);
    if (lieu && lieu !== 'Lieu à confirmer') { document.getElementById('lieu-input').value = lieu; checkS2(); }

    var d = p.get('d') || '', today = new Date(); today.setHours(0, 0, 0, 0);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d) && new Date(d + 'T12:00') >= today) {
      document.getElementById('date-input').value = d;
      document.getElementById('date-trigger').firstElementChild.textContent = new Date(d + 'T12:00').toLocaleDateString('fr-FR', {day: 'numeric', month: 'short', year: 'numeric'});
    }
    var ti = p.get('ti') || '';
    if (/^\d{2}:\d{2}$/.test(ti)) {
      document.getElementById('time-input').value = ti;
      document.getElementById('time-trigger').firstElementChild.textContent = ti.replace(':', 'h');
    }
    if (document.getElementById('date-input').value && ti) checkS3();

    var t = p.get('t') || '', custom = '';
    if (t.indexOf('Autre : ') === 0) { custom = t.slice(8); t = 'Autre'; }
    document.querySelectorAll('.type-opt').forEach(function (el) { if (el.dataset.val === t && !el.classList.contains('selected')) selectType(el); });
    if (custom) { var ai = document.getElementById('autre-input'); if (ai) ai.value = custom.slice(0, 200); }

    var opts = [];
    try { opts = JSON.parse(p.get('options') || '[]'); } catch (_) {}
    if (Array.isArray(opts)) A.personalization = opts.filter(function (o) { return typeof o === 'string'; });

    var prenom = document.getElementById('prenom-input');
    if (prenom && p.get('p')) prenom.value = p.get('p').slice(0, 100);

    var note = document.createElement('p');
    note.className = 'quote-edit-note';
    note.setAttribute('role', 'status');
    note.style.cssText = 'margin:0 0 18px;padding:12px 14px;border-radius:8px;background:#f1e5d7;color:#291817;font-size:14px;line-height:1.5';
    note.textContent = 'Vous modifiez votre devis. Vos choix sont repris : ajustez ce que vous voulez, étape par étape. Un nouveau devis vous sera envoyé.';
    var s1 = document.getElementById('s1');
    s1.insertBefore(note, s1.firstChild);
  } catch (_) { /* En cas d'échec, le simulateur reste utilisable normalement. */ }
})();
