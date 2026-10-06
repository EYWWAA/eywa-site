/* Public Chatbase agent ID only. No API key or visitor identity is sent. */
(() => {
  if (document.getElementById('eywa-assistant-launcher')) return;
  const style = document.createElement('style');
  style.textContent = `
    :root{--eywa-help-height:60px}
    body{padding-bottom:calc(var(--eywa-help-height) + env(safe-area-inset-bottom,0px))!important}
    html{scroll-padding-bottom:calc(var(--eywa-help-height) + 16px)}
    .eywa-help-bar{position:fixed;inset:auto 0 0;z-index:2147483645;background:#e9ebe4;color:#263c30;border-top:1px solid #cfd3c8;padding-bottom:env(safe-area-inset-bottom,0px)}
    .eywa-help-inner{width:min(1180px,calc(100% - 42px));min-height:var(--eywa-help-height);margin:auto;display:flex;align-items:center;justify-content:center;gap:28px}
    .eywa-help-bar .eywa-assistant-launcher,.eywa-help-bar .eywa-help-contact{display:flex;align-items:center;gap:10px;min-height:48px;margin:0;padding:4px 8px;border:0;border-radius:0;background:transparent;color:inherit;box-shadow:none;text-decoration:none;font:400 16px/1.3 var(--sans,"DM Sans",sans-serif);cursor:pointer;text-align:left}
    .eywa-help-bar .eywa-assistant-launcher small{display:block;font-size:11px;line-height:1.4;font-weight:400;letter-spacing:.02em;margin-top:2px}
    .eywa-assistant-launcher small::before{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;background:#67805d;margin-right:5px}
    .eywa-help-bar svg{width:20px;height:20px;flex:none;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
    .eywa-help-divider{height:28px;width:1px;background:#bcc5b8}
    .eywa-help-bar :is(button,a):hover{color:#52664d}
    .eywa-help-bar :is(button,a):focus-visible{outline:2px solid #52664d;outline-offset:2px}
    .eywa-assistant-launcher:disabled{cursor:wait;opacity:.6}
    #chatbase-bubble-button{opacity:0!important;pointer-events:none!important;transform:scale(0)!important}
    #chatbase-bubble-window{left:auto!important;right:20px!important;bottom:calc(var(--eywa-help-height) + env(safe-area-inset-bottom,0px) + 12px)!important;max-height:calc(100dvh - var(--eywa-help-height) - env(safe-area-inset-bottom,0px) - 30px)!important;z-index:2147483646!important}
    @media(max-width:600px){.eywa-help-inner{width:calc(100% - 24px);gap:18px}.eywa-help-bar .eywa-assistant-launcher,.eywa-help-bar .eywa-help-contact{font-size:15px!important;gap:8px}#chatbase-bubble-window{left:8px!important;right:8px!important;top:auto!important;width:calc(100% - 16px)!important}}

    .eywa-help-avatar,.eywa-help-mobile{display:none}
    @media(max-width:600px){
      :root{--eywa-help-height:78px}
      body .eywa-help-bar{background:#fafaf8;color:#0a0a0a;border-top:1px solid #d8d7d2}
      body .eywa-help-inner{width:calc(100% - 20px);min-height:78px;box-sizing:border-box;display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px 0}
      body .eywa-help-divider,body .eywa-help-desktop{display:none}
      body .eywa-help-mobile{display:inline}
      body .eywa-help-bar .eywa-assistant-launcher,body .eywa-help-bar .eywa-help-contact{width:100%;min-width:0;min-height:60px;box-sizing:border-box;padding:8px 10px;border-radius:100px;gap:7px;font-size:13px!important;line-height:1.2;justify-content:center;white-space:nowrap}
      body .eywa-help-bar .eywa-assistant-launcher{border:1px solid #d8d7d2;background:#fafaf8;color:#0a0a0a}
      body .eywa-help-bar .eywa-assistant-launcher:disabled{opacity:1;cursor:wait}
      body .eywa-help-bar .eywa-help-contact{background:#1c8059;color:#ffffff;border:1px solid #1c8059;box-shadow:0 3px 12px #0a0a0a18;text-align:center}
      body .eywa-help-bar .eywa-help-contact:hover{background:#176b4b;color:#ffffff}
      body .eywa-help-bar .eywa-assistant-launcher:hover{color:#0a0a0a;border-color:#1c8059}
      body .eywa-help-bar .eywa-help-title{font-weight:600!important}
      body .eywa-help-bar .eywa-help-copy{min-width:0}
      body .eywa-help-bar small{display:block;margin-top:3px;font-size:10px;line-height:1.35;letter-spacing:0;color:#60605c}
      body .eywa-help-bar .eywa-help-contact small{color:#ffffff;opacity:.85}
      body .eywa-assistant-launcher small::before{display:none}
      body .eywa-help-bar .eywa-help-avatar{display:grid;place-items:center;position:relative;width:30px;height:30px;flex:none;border-radius:50%;background:#1c8059;color:#ffffff;font:600 21px/1 Georgia,serif!important}
      body .eywa-help-avatar::after{content:'✦';position:absolute;right:-3px;top:-4px;width:13px;height:13px;display:grid;place-items:center;border:2px solid #fafaf8;border-radius:50%;font:10px/1 Arial,sans-serif;color:#1c8059;background:#fafaf8}
      body .eywa-help-bar .eywa-help-mobile svg{width:16px;height:16px;display:inline-block;vertical-align:-3px;margin-right:4px}
      body .eywa-help-bar :is(button,a):focus-visible{outline:2px solid #1c8059;outline-offset:2px}
    }
    @media(max-width:350px){body .eywa-help-bar .eywa-assistant-launcher,body .eywa-help-bar .eywa-help-contact{font-size:11px!important;padding:8px 6px;gap:5px}body .eywa-help-bar .eywa-help-avatar{width:26px;height:26px}}
  `;
  document.head.appendChild(style);
  const bar = document.createElement('nav');
  bar.className = 'eywa-help-bar';
  bar.setAttribute('aria-label', 'Aide et contact');
  bar.innerHTML = '<div class="eywa-help-inner"><button id="eywa-assistant-launcher" class="eywa-assistant-launcher" type="button" aria-label="Ouvrir l’assistant IA EYWA pour une réponse rapide" aria-expanded="false" disabled><svg class="eywa-help-desktop" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11a8 8 0 0 1-8 8H7l-5 3 1.5-6A8 8 0 1 1 21 11Z"/><path d="M7 10h10M7 14h6"/></svg><span class="eywa-help-avatar" aria-hidden="true">e</span><span class="eywa-help-copy"><span class="eywa-help-title">Réponses rapides</span><small><span class="eywa-help-desktop">IA · Disponible maintenant</span><span class="eywa-help-mobile">IA · À votre écoute</span></small></span></button><span class="eywa-help-divider" aria-hidden="true"></span><a class="eywa-help-contact" href="contact.html"><svg class="eywa-help-desktop" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/></svg><span class="eywa-help-desktop">Contact</span><span class="eywa-help-mobile eywa-help-copy"><span class="eywa-help-title"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.96.36 1.9.7 2.79a2 2 0 0 1-.45 2.11L8.09 9.89a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.83.58 2.79.7A2 2 0 0 1 22 16.92z"/></svg>Appelez maintenant</span><small>Contact direct avec EYWA</small></span></a></div>';
  const launcher = bar.querySelector('button');
  const contact = bar.querySelector('.eywa-help-contact');
  const mobile = window.matchMedia('(max-width:600px)');
  const syncContact = () => {
    contact.href = mobile.matches ? 'tel:+33749902156' : 'contact.html';
    contact.setAttribute('aria-label', mobile.matches ? 'Appeler EYWA au 07 49 90 21 56' : 'Contact');
  };
  mobile.addEventListener('change', syncContact);
  syncContact();
  launcher.addEventListener('click', () => document.getElementById('chatbase-bubble-button')?.click());
  document.body.appendChild(bar);
  const sync = () => {
    const bubble = document.getElementById('chatbase-bubble-button');
    const panel = document.getElementById('chatbase-bubble-window');
    const opened = !!(panel && getComputedStyle(panel).display !== 'none' && panel.getBoundingClientRect().height > 0);
    if (launcher.disabled !== !bubble) launcher.disabled = !bubble;
    if (bubble && bubble.getAttribute('tabindex') !== '-1') { bubble.setAttribute('tabindex', '-1'); bubble.setAttribute('aria-hidden', 'true'); }
    if (launcher.getAttribute('aria-expanded') !== String(opened)) launcher.setAttribute('aria-expanded', String(opened));
    const label = opened ? 'Fermer l’assistant IA EYWA' : 'Ouvrir l’assistant IA EYWA pour une réponse rapide';
    if (launcher.getAttribute('aria-label') !== label) launcher.setAttribute('aria-label', label);
  };
  let syncPending = false;
  new MutationObserver(() => {
    if (syncPending) return;
    syncPending = true;
    requestAnimationFrame(() => { syncPending = false; sync(); });
  }).observe(document.body, {childList:true,subtree:true,attributes:true,attributeFilter:['style','aria-expanded']});
  sync();
  if (!window.chatbase || window.chatbase('getState') !== 'initialized') {
    window.chatbase = (...args) => { (window.chatbase.q ||= []).push(args); };
    window.chatbase = new Proxy(window.chatbase, {get(target, prop) {return prop === 'q' ? target.q : (...args) => target(prop, ...args);}});
  }
  const load = () => {
    const script = document.createElement('script');
    script.src = 'https://www.chatbase.co/embed.min.js';
    script.id = 'm-lS2XNMPKsG99AQcwjiW';
    script.setAttribute('domain', 'www.chatbase.co');
    document.body.appendChild(script);
  };
  if (document.readyState === 'complete') load();
  else window.addEventListener('load', load, {once:true});
})();
