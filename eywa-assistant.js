/* Public Chatbase agent ID only. No API key or visitor identity is sent. */
(() => {
  if (document.getElementById('eywa-assistant-launcher')) return;
  const style = document.createElement('style');
  style.textContent = `
    .eywa-assistant-launcher{position:fixed;right:84px;bottom:22px;z-index:2147483645;border:1px solid #d8dfd5;border-radius:14px;background:#faf9f5;color:#243f34;padding:10px 15px;box-shadow:0 4px 20px #17372b15;text-align:left;font:600 13px/1.4 "DM Sans",sans-serif;cursor:pointer}
    .eywa-assistant-launcher small{display:block;font-size:10px;font-weight:400;letter-spacing:.02em;margin-top:2px}
    .eywa-assistant-launcher small::before{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;background:#67805d;margin-right:5px}
    .eywa-assistant-launcher:focus-visible{outline:3px solid #67805d;outline-offset:3px}
    .eywa-assistant-launcher[hidden]{display:none}
    @media(max-width:600px){.eywa-assistant-launcher{right:80px;bottom:24px;padding:8px 11px;font-size:12px}}
  `;
  document.head.appendChild(style);
  const launcher = document.createElement('button');
  launcher.id = 'eywa-assistant-launcher';
  launcher.className = 'eywa-assistant-launcher';
  launcher.type = 'button';
  launcher.hidden = true;
  launcher.setAttribute('aria-label', 'Ouvrir l’assistant IA EYWA pour une réponse rapide');
  launcher.innerHTML = 'Réponses rapides<small>IA · Disponible maintenant</small>';
  launcher.addEventListener('click', () => document.getElementById('chatbase-bubble-button')?.click());
  document.body.appendChild(launcher);
  const sync = () => {
    const bubble = document.getElementById('chatbase-bubble-button');
    const panel = document.getElementById('chatbase-bubble-window');
    const opened = panel && getComputedStyle(panel).display !== 'none' && panel.getBoundingClientRect().height > 0;
    const hidden = !bubble || !!opened;
    if (launcher.hidden !== hidden) launcher.hidden = hidden;
  };
  new MutationObserver(sync).observe(document.body, {childList:true,subtree:true,attributes:true,attributeFilter:['style','aria-expanded']});
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
