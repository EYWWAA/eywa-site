'use client';
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowUpRight, ArrowLeft, ArrowRight, Check, RotateCcw, Expand, X } from 'lucide-react';
import { defaultDesign, designNames, type DesignOptions } from '@/lib/surface-design';
import { PRESETS, exampleNames } from '@/lib/presets';
import { discoverBrand } from '@/lib/brand-discovery';
import { curatedPhotos, catalogPhotos, loadPhotoCatalog } from '@/lib/photo-catalog';
import { asset, type Analysis, type Visuals, type Candidate } from '@/lib/types';
const BarViewer = dynamic(() => import('./BarViewer'), { ssr: false, loading: () => <div className="viewer viewer-placeholder"><span className="fine-spinner" /></div> });
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://eywacoffeecatering.com/';
const QUOTE = new URL('devis-instantane.html', SITE).href;
type Ready = Extract<Analysis, { status: 'ready' }>;
type Kind = 'scene' | 'cup' | 'latte';

export default function Configurator() {
  const [name, setName] = useState(''), [result, setResult] = useState<Ready | null>(null);
  const [phase, setPhase] = useState<'idle' | 'research' | 'images'>('idle');
  const [error, setError] = useState(''), [choices, setChoices] = useState<Candidate[]>([]);
  const [needsDomain, setNeedsDomain] = useState(false), [domain, setDomain] = useState('');
  const [visuals, setVisuals] = useState<Visuals>(() => curatedPhotos('Celio')!);
  const [design, setDesign] = useState<DesignOptions | null>(null);
  const [view, setView] = useState<'photo' | '3d'>('photo');
  const [apiBase, setApiBase] = useState(''), [live, setLive] = useState(false);
  const [embedded, setEmbedded] = useState(false), [ready, setReady] = useState(false);
  const [enlarged, setEnlarged] = useState<Kind>('scene');
  const dialog = useRef<HTMLDialogElement>(null), abort = useRef<AbortController | null>(null);
  const sequence = useRef(0), inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const embed = params.get('embed') === '1'; setEmbedded(embed);
    if (params.get('vue') === '3d') setView('3d');
    let disposed = false;
    void (async () => {
      let base = '', available = false;
      try {
        const cfg = await (await fetch(asset('/runtime-config.json'), { cache: 'no-store', signal: AbortSignal.timeout(8000) })).json();
        base = typeof cfg.apiBase === 'string' ? cfg.apiBase.replace(/\/$/, '') : '';
        if (base && !/^https:\/\//.test(base)) base = '';
        if (process.env.NEXT_PUBLIC_STATIC_EXPORT !== '1' || base) {
          const info = await (await fetch(`${base}/api/status`, { signal: AbortSignal.timeout(8000) })).json();
          available = info.liveEnabled === true && info.imagesReady === true;
        }
      } catch { /* The published inspiration and 3D stay accessible. */ }
      if (!disposed) { setApiBase(base); setLive(available); setReady(true); }
    })();
    const studio = document.querySelector('.studio');
    const resize = new ResizeObserver(() => {
      if (embed && studio) window.parent.postMessage({ type: 'eywa:height', height: Math.ceil(studio.getBoundingClientRect().height) }, location.origin);
    });
    resize.observe(studio || document.body);
    return () => { disposed = true; resize.disconnect(); abort.current?.abort(); };
  }, []);
  async function generateImages(r: Ready, current: number, signal: AbortSignal) {
    setPhase('images');
    try {
      const response = await fetch(`${apiBase}/api/images`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ configurationId: r.id }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(240000)]),
      });
      const data: Visuals & { message?: string } = await response.json();
      if (!response.ok) throw new Error(data.message || 'La mise en situation n’a pas pu être préparée.');
      if (current !== sequence.current) return;
      setVisuals(previous => ({ ...previous, ...data })); if (data.scene) setView('photo');
    } catch (e) {
      if (current === sequence.current && !signal.aborted) setVisuals(previous => ({ ...previous, errors: { scene: e instanceof Error ? e.message : 'La préparation a été interrompue.' } }));
    } finally { if (current === sequence.current) setPhase('idle'); }
  }
  async function submit(selectedDomain?: string, exampleName?: string) {
    const value = (exampleName || name).trim();
    if (value.length < 2) { setError('Indiquez le nom de votre marque.'); inputRef.current?.focus(); return; }
    if (exampleName) { setName(exampleName); setDomain(''); }
    const current = ++sequence.current; abort.current?.abort();
    const controller = new AbortController(); abort.current = controller;
    setPhase('research'); setError(''); setChoices([]); setNeedsDomain(false);
    try {
      let data: Analysis;
      const selected = selectedDomain || (exampleName ? '' : domain) || undefined;
      if (live) {
        const response = await fetch(`${apiBase}/api/analyze`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: value, domain: selected }),
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(240000)]),
        });
        const body = await response.json(); if (!response.ok) throw new Error(body.message || 'La proposition n’a pas pu être préparée.'); data = body;
      } else data = await discoverBrand(value, controller.signal, selected);
      if (current !== sequence.current) return;
      if (data.status === 'ambiguous') { setChoices(data.candidates); setPhase('idle'); return; }
      if (data.status === 'not_found') { setError(data.message); setNeedsDomain(true); setPhase('idle'); return; }
      const catalog = await loadPhotoCatalog(controller.signal);
      if (current !== sequence.current) return;
      setResult(data); setDesign(null);
      const photos = catalogPhotos(catalog, data.branding.brand.name, data.branding.brand.domain);
      setVisuals(photos || {}); setView(photos ? 'photo' : '3d');
      if (!photos && data.mode === 'live' && data.imagesReady) await generateImages(data, current, controller.signal);
      else setPhase('idle');
    } catch (e) {
      if (current === sequence.current && !controller.signal.aborted) { setPhase('idle'); setError(e instanceof Error ? e.message : 'La connexion a été interrompue. Réessayez.'); }
    }
  }
  function cancel() { sequence.current++; abort.current?.abort(); setPhase('idle'); }
  function imageFailed(kind: Kind) { setVisuals(v => ({ ...v, [kind]: undefined, errors: { ...v.errors, [kind]: 'Cette image n’a pas pu être chargée.' } })); }
  function openPhoto(kind: Kind) { setEnlarged(kind); dialog.current?.showModal(); }
  const brand = result?.branding || PRESETS.celio, quote = new URL(QUOTE);
  const look = design || defaultDesign(brand);
  if (design) { quote.searchParams.set('habillage', designNames[look.layout]); quote.searchParams.set('finition', look.finish); quote.searchParams.set('eclairage', look.lighting); }
  if (result || design) { quote.searchParams.set('marque', brand.brand.name); if (result) quote.searchParams.set('configuration', result.id); quote.searchParams.set('personnalisation', 'bar,gobelets,latte'); }
  const hasPhotos = !!(visuals.scene || visuals.cup || visuals.latte);
  const photoAlt = (kind: Kind) => kind === 'scene' ? `Coffee bar EYWA aux couleurs de ${brand.brand.name} dans son environnement` : kind === 'cup' ? `Gobelet personnalisé ${brand.brand.name}` : `Logo ${brand.brand.name} imprimé dans la mousse du latte`;
  return <div className={`studio ${embedded ? 'embedded' : ''}`}>
    {!embedded && <header className="studio-header"><a href={SITE} className="wordmark" aria-label="EYWA, retour au site">EYWA<span>COFFEE CATERING</span></a><a href={SITE} className="back-link"><ArrowLeft size={15} /> Retour au site</a><a href={quote.href} className="header-contact">Parlons de votre événement <ArrowUpRight size={16} /></a></header>}
    <main>
      <section className="studio-intro"><p className="overline"><span /> L’ATELIER DE PERSONNALISATION</p><h1>Visualisez votre coffee bar<br />aux couleurs de <em>votre marque.</em></h1><p className="intro-copy">Votre univers. Notre savoir-faire. Une rencontre sur mesure.</p></section>
      <section className="workspace" aria-label="Personnaliser votre coffee bar">
        <div className="brief-panel"><span className="step-label">01 — VOTRE IDENTITÉ</span><h2>Tout commence<br />par votre nom.</h2><p>Imaginez l’accueil de vos clients. Le premier café. Votre marque, jusque dans les détails.</p>
          <form onSubmit={e => { e.preventDefault(); void submit(); }}><label htmlFor="brand-name">Nom de votre marque</label>
            <div className="brand-input"><input ref={inputRef} id="brand-name" placeholder="Ex. Celio" value={name} maxLength={100} onChange={e => { setName(e.target.value); setError(''); setNeedsDomain(false); setDomain(''); }} autoComplete="organization" required minLength={2} aria-describedby={error ? 'brand-error' : undefined} />{name && <button type="button" aria-label="Effacer le nom" onClick={() => { setName(''); setDomain(''); setError(''); setChoices([]); inputRef.current?.focus(); }}>×</button>}</div>
            {needsDomain && <div className="domain-field"><label htmlFor="brand-domain">Adresse du site de votre marque</label><input id="brand-domain" value={domain} onChange={e => setDomain(e.target.value)} placeholder="exemple.fr" inputMode="url" /></div>}
            <button className="create-button" type="submit" disabled={phase !== 'idle' || !ready}>{phase !== 'idle' ? <><span className="fine-spinner" />{phase === 'research' ? 'Votre univers prend forme…' : 'Préparation des images…'}</> : <>Créer mon bar <ArrowRight size={18} /></>}</button>
          </form>
          {error && <p className="inline-error" id="brand-error" role="alert">{error}</p>}
          {choices.length > 0 && <div className="company-choices"><p>Nous avons trouvé plusieurs entreprises portant ce nom. Laquelle souhaitez-vous ?</p>{choices.map(c => <button key={c.domain} onClick={() => void submit(c.domain)}><strong>{c.name}</strong><span>{c.description}</span><small>{c.domain}</small></button>)}</div>}
          <div className="example-brands"><span>ESSAYER UNE MARQUE</span><div>{exampleNames.map(label => <button type="button" key={label} onClick={() => void submit(undefined, label)}>{label}</button>)}</div></div>
          <div className="brief-foot"><span className="tiny-rule" /><p>Le bar, les gobelets,<br />jusque dans la tasse.</p></div>
        </div>
        <div className="visual-panel">
          <div className="view-switch" role="tablist" aria-label="Choisir la vue du bar"><button role="tab" id="photo-tab" aria-selected={view === 'photo'} aria-controls="bar-photo" onClick={() => setView('photo')}>Mise en situation</button><button role="tab" id="model-tab" aria-selected={view === '3d'} aria-controls="bar-model" onClick={() => setView('3d')}>Explorer en 3D</button>{!result && <span>INSPIRATION CELIO</span>}</div>
          {view === 'photo' ? <div role="tabpanel" id="bar-photo" aria-labelledby="photo-tab" className="hero-photo">{visuals.scene ? <button className="enlarge-photo" onClick={() => openPhoto('scene')} aria-label="Agrandir la mise en situation"><img src={visuals.scene} alt={photoAlt('scene')} fetchPriority="high" onError={() => imageFailed('scene')} /><span className="enlarge-icon"><Expand size={18} /></span></button> : <div className="photo-unavailable"><span>{phase === 'images' ? 'Votre univers prend vie…' : 'Votre mise en situation.'}</span><p>{phase === 'images' ? 'La lumière, les matières et votre identité se composent dans une photographie sur mesure.' : 'Les nouvelles photographies sur mesure ne sont pas encore disponibles en ligne. Votre aperçu 3D est accessible.'}</p><button className="text-link" onClick={() => setView('3d')}>Explorer mon bar en 3D <ArrowRight size={15} /></button></div>}</div> : <div role="tabpanel" id="bar-model" aria-labelledby="model-tab"><BarViewer branding={brand} modelUrl={result?.modelUrl} look={look} onDesign={setDesign} /></div>}
          <div className="design-caption"><div><span className="step-label">{result ? 'VOTRE DIRECTION ARTISTIQUE' : 'UNE INSPIRATION SIGNÉE EYWA'}</span><h2>EYWA <span className="collab-times">×</span> {brand.brand.name}</h2></div><div className="palette" aria-label="Palette de la proposition">{[brand.bar.front_color, brand.bar.logo_color, brand.bar.accent_color, '#493020'].map((color, i) => <span key={i} style={{ background: color }} title={i === 3 ? 'Noyer foncé' : color} />)}</div></div>
          <p className="design-description">{view === '3d' && design ? ({signature:brand.rationale,graphic:"Une composition asymétrique, un aplat de couleur affirmé et une signature déclinée sur les côtés et les gobelets.",minimal:"Une signature plus discrète, des espaces généreux et des détails fins. Le noyer et les matières prennent toute leur place."}[look.layout]) : brand.rationale}</p><div className="proposal-meta"><span><Check size={13} /> Façade lisse</span><span><Check size={13} /> Plan de travail noyer</span><span><Check size={13} /> Identité sur mesure</span></div>
          {view === '3d' && <p className="preview-note">Projection 3D d’après la photo du bar, dimensions à confirmer. Les photos d’inspiration sont indépendantes des réglages 3D.{result?.logoStatus === 'wordmark' ? ' Logo officiel à confirmer.' : ''}</p>}
          {result && !hasPhotos && phase === 'idle' && <p className="photo-status" role="status">Votre habillage 3D est prêt. Les photographies du catalogue sont enrichies progressivement. Pour une image dédiée à votre marque, <a href={quote.href} target={embedded ? '_top' : undefined}>demandez votre proposition <ArrowUpRight size={13} /></a></p>}
          {result && brand.sources.length > 0 && <details className="sources"><summary>Références de cette direction artistique</summary>{brand.sources.map(s => <a key={s.url} href={s.url} target="_blank" rel="noreferrer">{s.title} <ArrowUpRight size={12} /></a>)}</details>}
        </div>
      </section>
      {phase !== 'idle' && <div className="progress-message" role="status" aria-live="polite"><span className="scan-line" /><p>{phase === 'research' ? 'Nous analysons votre univers de marque…' : 'Votre proposition photographique prend forme…'}</p><span>{phase === 'research' ? 'Identité visuelle, matières et ambiance de vos espaces.' : 'La création peut prendre quelques minutes. Votre habillage 3D reste accessible.'}</span><button onClick={cancel}>Annuler</button></div>}
      {(hasPhotos || result) && <section className="proposal" aria-label="Votre proposition personnalisée">
        {(visuals.cup || visuals.latte) && <><div className="proposal-heading"><div><p className="overline">02 — L’ATTENTION AUX DÉTAILS</p><h2>Votre signature.<br /><em>Jusqu’à la dernière tasse.</em></h2></div><p>{brand.brand.name}<br /><span>{visuals.provenance === 'curated' ? 'Inspiration photographique EYWA' : 'Votre proposition sur mesure'}</span></p></div><div className="editorial-details">{(['cup', 'latte'] as const).map((kind, i) => visuals[kind] && <figure key={kind}><button className="enlarge-photo" onClick={() => openPhoto(kind)} aria-label={kind === 'cup' ? 'Agrandir le gobelet' : 'Agrandir le latte'}><img src={visuals[kind]} alt={photoAlt(kind)} loading="lazy" onError={() => imageFailed(kind)} /><span className="enlarge-icon"><Expand size={17} /></span></button><figcaption><span>0{i + 2}</span>{kind === 'cup' ? ' LE GOBELET PERSONNALISÉ' : ' LA SIGNATURE SUR LA MOUSSE'}</figcaption></figure>)}</div></>}
        {Object.values(visuals.errors || {}).map((message, i) => <p key={i} className="preview-note" role="alert">{message}</p>)}
        {Object.keys(visuals.errors || {}).length > 0 && result?.mode === 'live' && result.imagesReady && <button className="retry-images" disabled={phase !== 'idle'} onClick={() => { const c = new AbortController(); abort.current = c; void generateImages(result, sequence.current, c.signal); }}><RotateCcw size={15} /> Réessayer les images manquantes</button>}
        <div className="reservation"><div><p>Cette idée pourrait être la vôtre.</p><h2>Donnons-lui <em>rendez-vous.</em></h2></div><a className="reservation-button" href={quote.href} target={embedded ? '_top' : undefined}>Imaginer mon événement <ArrowUpRight size={20} /></a></div>
        <p className="legal-note">Visuels de projection. Sans partenariat avec la marque représentée. L’habillage final est validé avec vous avant production.</p>
      </section>}
    </main>
    <dialog ref={dialog} className="photo-dialog" onClick={e => { if (e.target === dialog.current) dialog.current.close(); }}><button className="close-photo" aria-label="Fermer la photo" onClick={() => dialog.current?.close()}><X size={24} /></button>{visuals[enlarged] && <img src={visuals[enlarged]} alt={photoAlt(enlarged)} />}</dialog>
    {!embedded && <footer className="studio-footer"><span>EYWA — COFFEE CATERING</span><span>Charleville-Mézières · Reims · Et au-delà</span><a href="mailto:contact.eywa08@gmail.com">Un projet particulier ? Écrivez-nous <ArrowUpRight size={13} /></a></footer>}
  </div>;
}
