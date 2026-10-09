import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import {
  ArrowLeft, ArrowRight, Check, ChevronDown, CircleAlert, Clock3, Copy, Eye, FileImage,
  ImagePlus, LogOut, Menu, PackagePlus, PanelLeftClose, Plus, RefreshCcw, Save, Search,
  ShieldCheck, Sparkles, UploadCloud, X,
} from 'lucide-react';
import { api } from './api';
import type { CopySuggestion, Product, ProductAsset, ProductStatus, Quality, Session } from './types';
import './admin.css';

type StudioTab = 'create' | 'drafts' | 'published' | 'scheduled' | 'manage';

const tabLabels: Array<{ id: StudioTab; label: string; detail: string }> = [
  { id: 'create', label: 'Create product', detail: 'New release' },
  { id: 'drafts', label: 'Drafts', detail: 'In progress' },
  { id: 'published', label: 'Published', detail: 'Live products' },
  { id: 'scheduled', label: 'Scheduled', detail: 'Future releases' },
  { id: 'manage', label: 'Product management', detail: 'All products' },
];

const pipeline = ['Upload', 'Analyze', 'Isolate', 'Match environment', 'Compose', 'Review'];
const badges = ['NEW', 'TRENDING', 'BESTSELLER', 'LIMITED', 'SALE'];
const productTypes = ['Sneakers', 'Formal', 'Loafers', 'Boots', 'Sandals', 'Casual', 'Sports', 'Other'];

const formatCurrency = (value: number | null) => value === null ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
const latest = (assets: ProductAsset[], kind: ProductAsset['kind']) => [...assets].reverse().find((asset) => asset.kind === kind);
const primaryImage = (product: Product) => product.assets.find((asset) => asset.id === product.primaryAssetId) || latest(product.assets, 'candidate') || latest(product.assets, 'original');
const localDateTime = (value: string | null) => value ? new Date(value).toISOString().slice(0, 16) : '';

function StatusPill({ status }: { status: ProductStatus }) {
  return <span className={`admin-status admin-status--${status}`}>{status.replace('_', ' ')}</span>;
}

function StudioLogin({ accessDenied, authError }: { accessDenied: boolean; authError: 'state' | 'failed' | null }) {
  const [pending, setPending] = useState(false);
  const [loginError, setLoginError] = useState('');
  const callbackError = authError === 'state'
    ? 'Secure sign-in was interrupted before it could complete. Please continue again.'
    : authError === 'failed'
      ? 'Secure sign-in could not complete. Please continue again.'
      : '';
  return (
    <main className="admin-login">
      <div className="admin-login__grain" />
      <section className="admin-login__card">
        <div className="studio-mark"><span /><b>HOLLYWOOD<br />SHOE</b></div>
        <p className="admin-kicker">Private product studio</p>
        <h1>Make the first<br /><i>impression</i> deliberate.</h1>
        <p className="admin-login__note">POST is reserved for approved Hollywood Shoe administrators. Sign in through the protected Manus workspace to continue.</p>
        {(accessDenied || loginError || callbackError) && <p className="admin-notice admin-notice--error"><CircleAlert size={16} /> {loginError || callbackError || 'This account is authenticated, but not approved for POST.'}</p>}
        <button className="admin-button admin-button--primary" onClick={async () => { setPending(true); setLoginError(''); try { await api.login(); } catch (error) { setPending(false); setLoginError(error instanceof Error ? error.message : 'Secure sign-in could not start. Please try again.'); } }} disabled={pending}>
          <ShieldCheck size={17} /> {pending ? 'Opening secure sign in…' : 'Continue with secure access'}
        </button>
        <a className="admin-login__return" href="/">Return to the public site <ArrowRight size={15} /></a>
      </section>
      <p className="admin-login__footer">Hollywood Shoe · Private operations</p>
    </main>
  );
}

function UploadWell({ product, onUpload, busy }: { product: Product; onUpload: (files: File[], kind: 'original' | 'custom_background') => void; busy: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const originals = product.assets.filter((asset) => asset.kind === 'original');
  const useFiles = (files: FileList | null, kind: 'original' | 'custom_background' = 'original') => {
    const selected = files ? [...files] : [];
    if (selected.length) onUpload(selected, kind);
  };
  const drop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragging(false);
    useFiles(event.dataTransfer.files);
  };
  return (
    <div className="studio-upload">
      <input ref={input} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => useFiles(event.target.files)} />
      <button className={`upload-well ${dragging ? 'upload-well--dragging' : ''}`} onClick={() => input.current?.click()} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={drop} disabled={busy}>
        <UploadCloud size={27} strokeWidth={1.35} />
        <strong>{originals.length ? 'Add another source view' : 'Upload shoe photography'}</strong>
        <span>Drop JPG, PNG or WebP here · up to 12 MB each</span>
      </button>
      {originals.length > 0 && <div className="source-strip">{originals.map((asset, index) => <span className="source-thumb" key={asset.id}><img src={asset.url} alt={`Original source ${index + 1}`} /><small>Source {index + 1}</small></span>)}</div>}
    </div>
  );
}

function ImageStudio({ product, onUpdate, onUpload, setMessage, busy, setBusy }: {
  product: Product;
  onUpdate: (product: Product) => void;
  onUpload: (files: File[], kind: 'original' | 'custom_background') => void;
  setMessage: (message: string, error?: boolean) => void;
  busy: boolean;
  setBusy: (value: boolean) => void;
}) {
  const customInput = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<number | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const original = latest(product.assets, 'original');
  const isolated = latest(product.assets, 'isolated');
  const candidates = product.assets.filter((asset) => asset.kind === 'candidate');
  const candidate = candidates.find((asset) => asset.id === selectedCandidateId) || latest(product.assets, 'candidate');
  const custom = latest(product.assets, 'custom_background');
  const approvable = candidate || original;
  const localComposition = candidate?.metadata.provider === 'local-studio';
  useEffect(() => {
    if (!selectedCandidateId || !candidates.some((asset) => asset.id === selectedCandidateId)) setSelectedCandidateId(candidates.at(-1)?.id || null);
  }, [product.id, candidates.length, selectedCandidateId]);
  const processing = async () => {
    if (!original) { setMessage('Upload a source image before beginning the image studio.', true); return; }
    setBusy(true);
    setStage(1);
    const timer = window.setInterval(() => setStage((current) => current === null ? 1 : Math.min(current + 1, pipeline.length - 1)), 950);
    try {
      const { product: next } = await api.processImages(product.id);
      onUpdate(next);
      setMessage('A new premium result is ready for review. Every generation is kept as its own candidate.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The image studio could not finish this result.', true);
    } finally {
      window.clearInterval(timer);
      setStage(null);
      setBusy(false);
    }
  };
  const setMode = async (mode: 'auto' | 'custom') => {
    setBusy(true);
    try { onUpdate((await api.updateProduct(product.id, { backgroundMode: mode })).product); } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not update background mode.', true); } finally { setBusy(false); }
  };
  const approve = async () => {
    if (!approvable) return;
    setBusy(true);
    try { onUpdate((await api.approve(product.id, approvable.id)).product); setMessage(candidate ? 'The selected premium result is now approved.' : 'The original image is selected for this release.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not approve this image.', true); } finally { setBusy(false); }
  };
  return (
    <section className="admin-section admin-image-studio" aria-labelledby="image-studio-title">
      <div className="admin-section__lead">
        <div><p className="admin-kicker">01 — Image studio</p><h2 id="image-studio-title">Turn a shoe photo into a <i>considered</i> first impression.</h2></div>
        <p>The original remains untouched. Every creation is kept as a reviewable candidate until you explicitly approve one—POST sets no generation-count cap.</p>
      </div>
      <div className="pipeline-ribbon" aria-label="Image pipeline progress">
        {pipeline.map((label, index) => <span key={label} className={stage !== null && index <= stage ? 'pipeline-ribbon__step pipeline-ribbon__step--active' : 'pipeline-ribbon__step'}><b>0{index + 1}</b>{label}</span>)}
      </div>
      <div className="image-worktable">
        <div className="image-worktable__source">
          <div className="image-label"><span>Original source</span><em>Preserved</em></div>
          {original ? <div className="studio-image"><img src={original.url} alt="Original product source" /></div> : <UploadWell product={product} onUpload={onUpload} busy={busy} />}
          {original && <UploadWell product={product} onUpload={onUpload} busy={busy} />}
        </div>
        <div className="image-worktable__result">
          <div className="image-label"><span>Hollywood Shoe premium result</span>{candidate?.isApproved || (!candidate && original?.isApproved) ? <em className="approved-tag"><Check size={13} /> Approved</em> : <em>Review required</em>}</div>
          <div className="studio-result">
            {candidate ? <img src={candidate.url} alt="Premium generated product candidate" /> : <div className="studio-result__empty"><Sparkles size={24} /><strong>Ready for a more considered setting.</strong><span>Process your original to create the first review candidate.</span></div>}
            {stage !== null && <div className="studio-result__processing"><span>Preparing</span><strong>{pipeline[stage]}…</strong><i /></div>}
          </div>
          {localComposition && <p className="local-composition-note">A local studio composition was created from your source image because the external AI provider is unavailable. It is durable and reviewable, but not an AI-restyled cutout.</p>}
          {candidates.length > 1 && <div className="candidate-strip" aria-label="Premium result candidates"><span>{candidates.length} saved candidates</span><div>{candidates.map((asset, index) => <button key={asset.id} className={asset.id === candidate?.id ? 'candidate-strip__item candidate-strip__item--selected' : 'candidate-strip__item'} onClick={() => setSelectedCandidateId(asset.id)} aria-label={`Review premium candidate ${index + 1}`} aria-pressed={asset.id === candidate?.id}><img src={asset.url} alt="" /><small>{asset.isApproved ? 'Approved' : `Result ${index + 1}`}</small></button>)}</div></div>}
          <div className="image-actions">
            <button className="admin-button admin-button--quiet" onClick={processing} disabled={busy || !original}><RefreshCcw size={16} /> {candidate ? 'Create another result' : 'Create premium result'}</button>
            <button className="admin-button admin-button--primary" onClick={approve} disabled={busy || !approvable || approvable.isApproved}><Check size={16} /> {approvable?.isApproved ? 'Image approved' : candidate ? 'Approve this image' : 'Use original image'}</button>
          </div>
        </div>
      </div>
      <div className="background-control">
        <div><p className="admin-kicker">Environment direction</p><h3>Set the atmosphere, not just the background.</h3></div>
        <div className="background-control__options">
          <button className={product.backgroundMode === 'auto' ? 'mode-card mode-card--selected' : 'mode-card'} onClick={() => setMode('auto')} disabled={busy}><Sparkles size={18} /><span><b>AI Auto Match</b><small>Matched to the shoe’s color, material and visual character.</small></span><i>{product.backgroundMode === 'auto' && <Check size={14} />}</i></button>
          <button className={product.backgroundMode === 'custom' ? 'mode-card mode-card--selected' : 'mode-card'} onClick={() => setMode('custom')} disabled={busy}><ImagePlus size={18} /><span><b>Custom background</b><small>{custom ? 'A custom environment is ready for the next composition.' : 'Bring your own approved setting into the composition.'}</small></span><i>{product.backgroundMode === 'custom' && <Check size={14} />}</i></button>
          {product.backgroundMode === 'custom' && <><input className="visually-hidden" ref={customInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => event.target.files && onUpload([...event.target.files], 'custom_background')} /><button className="custom-upload" onClick={() => customInput.current?.click()}><UploadCloud size={16} /> {custom ? 'Replace custom background' : 'Upload custom background'}</button></>}
        </div>
      </div>
      {isolated && <p className="isolation-note"><Check size={15} /> An isolated shoe candidate is saved separately and remains available for future compositions.</p>}
    </section>
  );
}

function Editor({ product, onUpdate, setProduct, setMessage }: { product: Product; onUpdate: (product: Product) => void; setProduct: (product: Product) => void; setMessage: (message: string, error?: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [quality, setQuality] = useState<Quality | null>(null);
  const [suggestion, setSuggestion] = useState<CopySuggestion | null>(null);
  const [preview, setPreview] = useState(false);
  const [publishPanel, setPublishPanel] = useState(false);
  const [scheduleValue, setScheduleValue] = useState(localDateTime(product.scheduledAt));
  const [timezone, setTimezone] = useState(product.scheduleTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const update = <K extends keyof Product>(key: K, value: Product[K]) => setProduct({ ...product, [key]: value });
  const save = async (label = 'Draft saved.') => {
    setBusy(true);
    try { const { product: next } = await api.updateProduct(product.id, product); onUpdate(next); setMessage(label); } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save this product.', true); } finally { setBusy(false); }
  };
  const upload = async (files: File[], kind: 'original' | 'custom_background') => {
    setBusy(true);
    try { const { product: next } = await api.upload(product.id, files, kind); onUpdate(next); setMessage(kind === 'original' ? 'Original image safely added to the studio.' : 'Custom background ready for a fresh composition.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'The image could not be uploaded.', true); } finally { setBusy(false); }
  };
  const copy = async () => {
    setBusy(true);
    try { setSuggestion((await api.generateCopy(product.id)).suggestion); setMessage('AI suggestions are ready to review. Nothing has been applied automatically.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'The writing assistant could not create a suggestion.', true); } finally { setBusy(false); }
  };
  const applySuggestion = () => {
    if (!suggestion) return;
    setProduct({ ...product, description: suggestion.description || product.description, shortDescription: suggestion.shortDescription || product.shortDescription, aiMetadata: { ...product.aiMetadata, copySuggestion: suggestion } });
    setSuggestion(null);
    setMessage('AI copy applied to the editable draft. Save when you are ready.');
  };
  const inspect = async () => { setBusy(true); try { setQuality((await api.quality(product.id)).quality); } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not complete the quality check.', true); } finally { setBusy(false); } };
  const schedule = async () => { setBusy(true); try { const result = await api.schedule(product.id, scheduleValue, timezone); const { product: next } = await api.getProduct(product.id); onUpdate(next); setScheduleValue(localDateTime(result.scheduledAt)); setMessage(`Publishing is scheduled for ${new Date(result.scheduledAt).toLocaleString()}.`); } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not schedule this product.', true); } finally { setBusy(false); } };
  const publish = async () => { setBusy(true); try { const { product: next } = await api.publish(product.id); onUpdate(next); setPublishPanel(false); setMessage('Product published successfully.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not publish this product.', true); } finally { setBusy(false); } };
  const toggleBadge = (badge: string) => update('badges', product.badges.includes(badge) ? product.badges.filter((value) => value !== badge) : [...product.badges, badge]);
  const approved = primaryImage(product);
  return (
    <div className="studio-editor">
      <ImageStudio product={product} onUpdate={onUpdate} onUpload={upload} setMessage={setMessage} busy={busy} setBusy={setBusy} />
      <section className="admin-section detail-section">
        <div className="admin-section__lead"><div><p className="admin-kicker">02 — Product story</p><h2>Give the release a clear, <i>human</i> name.</h2></div><button className="admin-button admin-button--quiet" onClick={copy} disabled={busy}><Sparkles size={16} /> Generate with AI</button></div>
        {suggestion && <div className="ai-suggestion"><div><Sparkles size={17} /><strong>Editable AI suggestion</strong><p>{suggestion.shortDescription || suggestion.description}</p></div><div><button className="admin-button admin-button--quiet" onClick={() => setSuggestion(null)}>Discard</button><button className="admin-button admin-button--dark" onClick={applySuggestion}><Check size={15} /> Apply to draft</button></div></div>}
        <div className="form-grid form-grid--story">
          <label className="field field--wide"><span>Product name <b>*</b></span><input value={product.name} onChange={(event) => update('name', event.target.value)} placeholder="e.g. The Mercer Runner" /></label>
          <label className="field"><span>Category <b>*</b></span><select value={product.category || ''} onChange={(event) => update('category', event.target.value as Product['category'])}><option value="">Select category</option><option value="MENS">MENS</option><option value="WOMENS">WOMENS</option><option value="KIDS">KIDS</option></select></label>
          <label className="field"><span>Product type <b>*</b></span><select value={product.productType} onChange={(event) => update('productType', event.target.value)}><option value="">Select product type</option>{productTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
          <label className="field field--wide"><span>Description <b>*</b></span><textarea value={product.description} onChange={(event) => update('description', event.target.value)} placeholder="A concise, considered product story—always editable." rows={5} /></label>
          <label className="field field--wide"><span>Short description</span><input value={product.shortDescription} onChange={(event) => update('shortDescription', event.target.value)} placeholder="A short line for future collection views." /></label>
          <label className="field"><span>SKU</span><input value={product.sku} onChange={(event) => update('sku', event.target.value.toUpperCase())} placeholder="HS-MER-001" /></label>
          <div className="field form-hint"><span>Product writing</span><p>AI suggestions never replace your work automatically. Review, edit, then save.</p></div>
        </div>
      </section>
      <section className="admin-section commerce-section">
        <div className="admin-section__lead"><div><p className="admin-kicker">03 — Commercial details</p><h2>Price and availability,<br /><i>without the noise.</i></h2></div></div>
        <div className="commerce-grid">
          <div className="price-card"><p>Original price <b>*</b></p><label><span>₹</span><input type="number" min="0" value={product.originalPrice ?? ''} onChange={(event) => update('originalPrice', event.target.value === '' ? null : Number(event.target.value))} placeholder="12,999" /></label></div>
          <div className="price-card price-card--sale"><p>Sale price</p><label><span>₹</span><input type="number" min="0" value={product.salePrice ?? ''} onChange={(event) => update('salePrice', event.target.value === '' ? null : Number(event.target.value))} placeholder="8,999" /></label><small>{product.originalPrice !== null && product.salePrice !== null ? <><s>{formatCurrency(product.originalPrice)}</s> {formatCurrency(product.salePrice)}</> : 'The sale preview will appear here.'}</small></div>
          <div className="inventory-card"><div><p>Inventory <b>*</b></p><small>Sizes with zero stock are retained for future operations.</small></div><div className="inventory-list">{(product.inventory.length ? product.inventory : [{ size: '7', quantity: 0 }, { size: '8', quantity: 0 }, { size: '9', quantity: 0 }]).map((entry, index, entries) => <label key={`${entry.size}-${index}`}><input value={entry.size} aria-label={`Size ${index + 1}`} onChange={(event) => update('inventory', entries.map((item, position) => position === index ? { ...item, size: event.target.value } : item))} /><input type="number" min="0" value={entry.quantity} aria-label={`Stock for size ${entry.size}`} onChange={(event) => update('inventory', entries.map((item, position) => position === index ? { ...item, quantity: Number(event.target.value) } : item))} /></label>)}<button onClick={() => update('inventory', [...(product.inventory.length ? product.inventory : [{ size: '7', quantity: 0 }, { size: '8', quantity: 0 }, { size: '9', quantity: 0 }]), { size: '', quantity: 0 }])}><Plus size={14} /> Add size</button></div></div>
        </div>
      </section>
      <section className="admin-section visibility-section">
        <div className="admin-section__lead"><div><p className="admin-kicker">04 — Future visibility</p><h2>Prepare the edit,<br /><i>without changing Home.</i></h2></div><p>These controls save metadata for future collection integration only. They do not touch the approved public Home page.</p></div>
        <div className="visibility-grid"><div><span className="field-title">Product badges</span><div className="badge-list">{badges.map((badge) => <button className={product.badges.includes(badge) ? 'badge-choice badge-choice--selected' : 'badge-choice'} key={badge} onClick={() => toggleBadge(badge)}>{product.badges.includes(badge) && <Check size={13} />}{badge}</button>)}</div></div><div className="toggle-list">{(['showOnHome', 'trending', 'featured'] as const).map((key) => <button key={key} className="setting-toggle" onClick={() => update(key, !product[key])}><span className={product[key] ? 'setting-toggle__switch setting-toggle__switch--on' : 'setting-toggle__switch'}><i /></span><span><b>{key === 'showOnHome' ? 'Show on Home' : key === 'trending' ? 'Trending' : 'Featured'}</b><small>{key === 'showOnHome' ? 'Save future Home placement metadata.' : `Save future ${key} metadata.`}</small></span></button>)}</div></div>
      </section>
      <section className="admin-section quality-section">
        <div className="admin-section__lead"><div><p className="admin-kicker">05 — Final inspection</p><h2>Ready when every<br /><i>detail holds.</i></h2></div><button className="admin-button admin-button--quiet" onClick={inspect} disabled={busy}><ShieldCheck size={16} /> Run quality check</button></div>
        <div className={quality?.ready ? 'quality-summary quality-summary--ready' : 'quality-summary'}><div><span>{quality?.ready ? <Check size={22} /> : <ShieldCheck size={22} />}</span><div><b>{quality?.ready ? 'Ready to publish' : 'Inspection waiting'}</b><p>{quality?.ready ? 'The required image, product, price and stock details are in place.' : 'Run the inspection before publishing. Drafts can be saved at any point.'}</p></div></div>{quality && <div className="quality-groups">{quality.groups.map((group) => <div key={group.label}><small>{group.label}</small>{group.checks.map((check) => <p key={check.label} className={check.passed ? 'quality-check quality-check--pass' : 'quality-check'}>{check.passed ? <Check size={13} /> : <X size={13} />}{check.label}{check.required && <em>required</em>}</p>)}</div>)}</div>}</div>
      </section>
      <section className="admin-section release-section">
        <div className="admin-section__lead"><div><p className="admin-kicker">06 — Release</p><h2>Set the moment<br />into <i>motion.</i></h2></div></div>
        <div className="release-grid"><div className="schedule-card"><div><Clock3 size={19} /><span><b>Schedule publishing</b><small>Uses the project’s authenticated platform scheduler. Times are stored in your chosen timezone.</small></span></div><label><input type="datetime-local" value={scheduleValue} onChange={(event) => setScheduleValue(event.target.value)} /><input value={timezone} onChange={(event) => setTimezone(event.target.value)} aria-label="Timezone" /></label><button className="admin-button admin-button--quiet" onClick={schedule} disabled={busy || !scheduleValue}><Clock3 size={15} /> Schedule product</button></div>
          <div className="release-actions"><button className="admin-button admin-button--quiet" onClick={() => save()} disabled={busy}><Save size={16} /> Save draft</button><button className="admin-button admin-button--quiet" onClick={() => setPreview(true)} disabled={!approved}><Eye size={16} /> Preview</button><button className="admin-button admin-button--primary" onClick={() => { setPublishPanel(true); inspect(); }} disabled={busy}><ArrowRight size={16} /> Publish product</button></div></div>
        {publishPanel && <div className="publish-confirm"><div><span className="admin-kicker">Final confirmation</span><h3>{product.name || 'Untitled product'}</h3><p>{approved ? 'An approved premium image is selected.' : 'An approved premium image is still required.'} {product.category ? `${product.category} · ${product.productType || 'type pending'}` : 'Category pending'} · {formatCurrency(product.salePrice ?? product.originalPrice)}</p></div><div><button className="admin-button admin-button--quiet" onClick={() => setPublishPanel(false)}>Keep editing</button><button className="admin-button admin-button--primary" onClick={publish} disabled={busy || !quality?.ready}><Check size={16} /> Confirm & publish</button></div></div>}
      </section>
      {preview && <ProductPreview product={product} onClose={() => setPreview(false)} />}
    </div>
  );
}

function ProductPreview({ product, onClose }: { product: Product; onClose: () => void }) {
  const image = primaryImage(product);
  return <div className="preview-overlay" role="dialog" aria-modal="true" aria-label="Product preview"><div className="preview-modal"><button className="preview-modal__close" onClick={onClose} aria-label="Close preview"><X size={19} /></button><div className="preview-tabs"><span className="preview-tabs--active">Desktop preview</span><span>Mobile preview</span></div><div className="preview-product"><div>{image ? <img src={image.url} alt={product.name || 'Product preview'} /> : <FileImage size={38} />}</div><section><small>{product.category || 'CATEGORY'} · {product.productType || 'TYPE'}</small><h2>{product.name || 'Untitled product'}</h2><p>{product.description || 'Your complete product description will appear here.'}</p><strong>{product.salePrice !== null && <s>{formatCurrency(product.originalPrice)}</s>} {formatCurrency(product.salePrice ?? product.originalPrice)}</strong><span>Preview only — not connected to the public site</span></section></div></div></div>;
}

function ProductList({ title, products, open, action, actionLabel }: { title: string; products: Product[]; open: (product: Product) => void; action?: (product: Product) => void; actionLabel?: string }) {
  return <section className="management-view"><div className="management-view__head"><div><p className="admin-kicker">Product management</p><h1>{title}</h1></div><span>{products.length} {products.length === 1 ? 'product' : 'products'}</span></div>{products.length ? <div className="product-list">{products.map((product) => { const image = primaryImage(product); return <article key={product.id} className="product-row"><div className="product-row__image">{image ? <img src={image.url} alt="" /> : <FileImage size={21} />}</div><div className="product-row__name"><strong>{product.name || 'Untitled product'}</strong><small>{product.category || 'Category pending'} · {product.sku || 'SKU pending'}</small></div><StatusPill status={product.status} /><span className="product-row__price">{formatCurrency(product.salePrice ?? product.originalPrice)}</span><div className="product-row__actions"><button onClick={() => open(product)}>Edit</button>{action && <button onClick={() => action(product)}>{actionLabel}</button>}</div></article>; })}</div> : <div className="empty-list"><PackagePlus size={30} /><h2>No products here yet.</h2><p>When you are ready, create a fresh product draft from the studio.</p></div>}</section>;
}

export function AdminPostPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [tab, setTab] = useState<StudioTab>('create');
  const [product, setProduct] = useState<Product | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [message, setMessageState] = useState<{ text: string; error: boolean } | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const setMessage = (text: string, error = false) => { setMessageState({ text, error }); window.setTimeout(() => setMessageState(null), 5000); };
  const refresh = async (status?: ProductStatus) => { try { setProducts((await api.listProducts(status)).products); } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not load products.', true); } };
  useEffect(() => { api.session().then(setSession).catch(() => setSession({ authenticated: false, isAdmin: false, user: null })); }, []);
  useEffect(() => { if (session?.isAdmin && tab !== 'create') refresh(tab === 'drafts' ? 'draft' : tab === 'published' ? 'published' : tab === 'scheduled' ? 'scheduled' : undefined); }, [session?.isAdmin, tab]);
  if (!session) return <main className="admin-loading"><div><span className="studio-mark"><i /><b>HOLLYWOOD<br />SHOE</b></span><p>Opening private studio…</p></div></main>;
  if (!session.isAdmin) {
    const authError = new URLSearchParams(window.location.search).get('auth_error');
    return <StudioLogin accessDenied={new URLSearchParams(window.location.search).get('access') === 'denied'} authError={authError === 'state' || authError === 'failed' ? authError : null} />;
  }
  const create = async () => { try { const { product: next } = await api.createProduct(); setProduct(next); setTab('create'); setMessage('A fresh draft is ready for its first image.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not start a product draft.', true); } };
  const open = (selected: Product) => { setProduct(selected); setTab('create'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const duplicate = async (selected: Product) => { try { const { product: copy } = await api.duplicate(selected.id); open(copy); setMessage('A duplicate draft is ready to refine.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not duplicate this product.', true); } };
  const unpublish = async (selected: Product) => { try { const { product: next } = await api.unpublish(selected.id); setProducts((items) => items.map((item) => item.id === next.id ? next : item)); setMessage('Product moved out of public release status.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not unpublish this product.', true); } };
  return <main className="admin-shell"><aside className={mobileNav ? 'admin-sidebar admin-sidebar--open' : 'admin-sidebar'}><div className="admin-sidebar__brand"><span className="studio-mark"><i /><b>HOLLYWOOD<br />SHOE</b></span><button onClick={() => setMobileNav(false)} aria-label="Close studio navigation"><X size={19} /></button></div><div className="admin-sidebar__identity"><span>{session.user?.name?.slice(0, 1) || 'A'}</span><div><b>{session.user?.name}</b><small>Administrator</small></div></div><nav>{tabLabels.map((item) => <button className={tab === item.id ? 'studio-nav__item studio-nav__item--active' : 'studio-nav__item'} onClick={() => { setTab(item.id); setMobileNav(false); }} key={item.id}><span>{item.id === 'create' ? <PackagePlus size={16} /> : item.id === 'manage' ? <Search size={16} /> : item.id === 'published' ? <Check size={16} /> : <Clock3 size={16} />}</span><div><b>{item.label}</b><small>{item.detail}</small></div></button>)}</nav><div className="admin-sidebar__bottom"><a href="/">View public Home <ArrowRight size={14} /></a><button onClick={async () => { await api.logout(); window.location.assign('/post'); }}><LogOut size={15} /> Sign out</button></div></aside><div className="admin-surface"><header className="admin-header"><button className="admin-mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open studio navigation"><Menu size={20} /></button><div><span className="admin-kicker">POST / Product studio</span><p>{product ? `${product.name || 'Untitled product'} · ${product.status}` : tabLabels.find((item) => item.id === tab)?.label}</p></div><div className="admin-header__actions"><button className="admin-button admin-button--quiet" onClick={create}><Plus size={15} /> New product</button><span className="admin-header__date">{new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date())}</span></div></header>{message && <div className={message.error ? 'admin-toast admin-toast--error' : 'admin-toast'}>{message.error ? <CircleAlert size={16} /> : <Check size={16} />}{message.text}<button onClick={() => setMessageState(null)}><X size={15} /></button></div>}<div className="admin-content">{tab === 'create' ? product ? <Editor product={product} setProduct={setProduct} onUpdate={setProduct} setMessage={setMessage} /> : <section className="new-product-intro"><div><p className="admin-kicker">Product creation studio</p><h1>Begin with the<br /><i>shoe in front</i> of you.</h1><p>Bring an ordinary product photo into a deliberate Hollywood Shoe presentation—one considered stage at a time.</p><button className="admin-button admin-button--primary" onClick={create}><PackagePlus size={17} /> Create product</button></div><div className="new-product-intro__frame"><span>UPLOAD</span><i /><span>REVIEW</span><strong>01</strong></div></section> : <ProductList title={tab === 'drafts' ? 'Drafts' : tab === 'published' ? 'Published releases' : tab === 'scheduled' ? 'Scheduled releases' : 'All products'} products={products} open={open} action={tab === 'published' ? unpublish : tab === 'manage' ? duplicate : undefined} actionLabel={tab === 'published' ? 'Unpublish' : 'Duplicate'} />}</div></div></main>;
}
