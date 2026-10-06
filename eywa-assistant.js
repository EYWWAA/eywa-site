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
  `;
  document.head.appendChild(style);
  const bar = document.createElement('nav');
  bar.className = 'eywa-help-bar';
  bar.setAttribute('aria-label', 'Aide et contact');
  bar.innerHTML = '<div class="eywa-help-inner"><button id="eywa-assistant-launcher" class="eywa-assistant-launcher" type="button" aria-label="Ouvrir l’assistant IA EYWA pour une réponse rapide" aria-expanded="false" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11a8 8 0 0 1-8 8H7l-5 3 1.5-6A8 8 0 1 1 21 11Z"/><path d="M7 10h10M7 14h6"/></svg><span>Réponses rapides<small>IA · Disponible maintenant</small></span></button><span class="eywa-help-divider" aria-hidden="true"></span><a class="eywa-help-contact" href="contact.html"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/></svg>Contact</a></div>';
  const launcher = bar.querySelector('button');
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
