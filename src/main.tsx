import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type TouchEvent } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  Heart,
  Info,
  Menu,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { AdminPostPage } from './admin/AdminStudio';
import './styles.css';

const media = {
  hero: '/manus-storage/async-images/Foo8zOYI6bAM2cUgdpIgOy/image-1.webp',
  stride: '/manus-storage/async-images/Foo8zOYI6bAM2cUgdpIgOy/image-2.webp',
  cloud: '/manus-storage/async-images/Foo8zOYI6bAM2cUgdpIgOy/image-3.webp',
  vino: '/manus-storage/async-images/Foo8zOYI6bAM2cUgdpIgOy/image-4.webp',
  sand: '/manus-storage/async-images/Foo8zOYI6bAM2cUgdpIgOy/image-5.webp',
  pumaStadium: '/manus-storage/.tmp-puma-palermo-campaign_c9a351b1.webp',
  pumaNet: '/manus-storage/puma-palermo-net_d833beb2.jpg',
  pumaSpeedcat: '/manus-storage/puma-speedcat-campaign_c8fb936a.jpg',
  pumaSpeedcatProduct: '/manus-storage/qgC7VqnT1nFO_d452084c.jpg',
  pumaSpeedcatBlack: '/manus-storage/Gj7VLG5izFC9_8ef2cba7.jpeg',
  pumaMostro: '/manus-storage/n4hFawkiDM6d_68d4315f.jpg',
  pumaPalermoRose: '/manus-storage/J026xMeLSvJv_6b0cbcfe.jpg',
  pumaMostroCampaign: '/manus-storage/qTTcEUee3T6s_69420c33.jpg',
};

type Route = '/' | '/mens' | `/mens/${string}` | '/womens' | '/kids' | '/post';
type SectionId = 'home' | 'mens' | 'womens' | 'kids' | 'post';
type FutureCollectionRoute = '/womens' | '/kids';

type PublicProduct = {
  id: string;
  name: string;
  description: string;
  shortDescription: string;
  productType: string;
  sku: string;
  category: 'MENS' | 'WOMENS' | 'KIDS';
  originalPrice: number | null;
  salePrice: number | null;
  badges: string[];
  featured: boolean;
  trending: boolean;
  inventory: Array<{ size: string; quantity: number }>;
  imageUrl: string;
  images: Array<{ id: string; url: string; alt: string }>;
};

const navItems: Array<{ label: string; route: Route; id: SectionId }> = [
  { label: 'HOME', route: '/', id: 'home' },
  { label: 'MENS', route: '/mens', id: 'mens' },
  { label: 'WOMENS', route: '/womens', id: 'womens' },
  { label: 'KIDS', route: '/kids', id: 'kids' },
];

const shoes = [
  {
    name: 'Speedcat OG',
    category: '01 / Low-profile form',
    image: media.pumaSpeedcatBlack,
    imageClass: 'shoe-product--speedcat',
    note: 'A clean, close-to-ground line with motorsport roots.',
  },
  {
    name: 'Mostro',
    category: '02 / Textured grip',
    image: media.pumaMostro,
    imageClass: 'shoe-product--mostro',
    note: 'An offbeat profile with a sculpted, spiked sole.',
  },
  {
    name: 'Palermo 0161',
    category: '03 / Archive colour',
    image: media.pumaPalermoRose,
    imageClass: 'shoe-product--palermo',
    note: 'A classic court silhouette, delivered in bright blue.',
  },
];

function routeFromLocation(): Route {
  const candidate = window.location.pathname.replace(/\/$/, '') || '/';
  if (candidate === '/' || candidate === '/mens' || candidate === '/womens' || candidate === '/kids' || candidate === '/post') return candidate as Route;
  if (/^\/mens\/[^/]+$/.test(candidate)) return candidate as `/mens/${string}`;
  return '/';
}

function navigate(route: Route) {
  if (window.location.pathname !== route) {
    window.history.pushState({}, '', route);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}

function Header({ route }: { route: Route }) {
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [isScrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 22);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [route]);

  useEffect(() => {
    document.body.classList.toggle('menu-open', isMenuOpen);
    return () => document.body.classList.remove('menu-open');
  }, [isMenuOpen]);

  const selectRoute = (nextRoute: Route) => {
    navigate(nextRoute);
    setMenuOpen(false);
  };

  const headerNav = [...navItems, { label: 'POST', route: '/post' as Route, id: 'post' as SectionId }];
  const mensRoute = route === '/mens' || route.startsWith('/mens/');

  return (
    <header className={`site-header ${isScrolled || route !== '/' ? 'site-header--solid' : ''} ${route !== '/' ? 'site-header--collection' : ''}`}>
      <button className="brand" onClick={() => selectRoute('/')} aria-label="Hollywood Shoe Home">
        <span className="brand__mark" aria-hidden="true"><i /><i /><b /></span>
        <span className="brand__type">HOLLYWOOD<br />SHOE</span>
      </button>

      <nav className="desktop-nav" aria-label="Main navigation">
        {headerNav.map((item) => (
          <button
            key={item.id}
            className={`nav-link ${route === item.route || (item.route === '/mens' && mensRoute) ? 'nav-link--active' : ''}`}
            onClick={() => selectRoute(item.route)}
            aria-current={route === item.route || (item.route === '/mens' && mensRoute) ? 'page' : undefined}
          >
            {item.label}
            {(item.route === '/womens' || item.route === '/kids') && <span className="nav-link__future" aria-label="Future chapter">SOON</span>}
          </button>
        ))}
      </nav>

      <button
        className="menu-toggle"
        aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={isMenuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        {isMenuOpen ? <X size={22} strokeWidth={1.5} /> : <Menu size={23} strokeWidth={1.5} />}
      </button>

      <div className={`mobile-menu ${isMenuOpen ? 'mobile-menu--open' : ''}`} aria-hidden={!isMenuOpen}>
        <div className="mobile-menu__inner">
          <span className="eyebrow">Navigate the house</span>
          <nav aria-label="Mobile navigation">
            {headerNav.map((item, index) => (
              <button
                key={item.id}
                className={`mobile-nav-link ${route === item.route || (item.route === '/mens' && mensRoute) ? 'mobile-nav-link--active' : ''}`}
                onClick={() => selectRoute(item.route)}
                tabIndex={isMenuOpen ? 0 : -1}
              >
                <span>0{index + 1}</span>
                {item.label}
                {(item.route === '/womens' || item.route === '/kids') && <em>FUTURE</em>}
              </button>
            ))}
          </nav>
          <p>© 2026 Hollywood Shoe</p>
        </div>
      </div>
    </header>
  );
}

function MediaImage({ src, alt, className = '', loading = 'eager', fetchPriority = 'auto' }: {
  src: string;
  alt: string;
  className?: string;
  loading?: 'eager' | 'lazy';
  fetchPriority?: 'high' | 'low' | 'auto';
}) {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={loading}
      fetchPriority={fetchPriority}
      decoding="async"
      onError={(event) => event.currentTarget.classList.add('media-failed')}
    />
  );
}

function HomePage() {
  const [activeShoe, setActiveShoe] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const shoeRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const revealTargets = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14, rootMargin: '0px 0px -6% 0px' },
    );
    revealTargets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let frame = 0;
    const setParallax = () => {
      frame = 0;
      document.documentElement.style.setProperty('--scroll-position', `${window.scrollY}px`);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(setParallax);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const selectShoe = (index: number, focus = false) => {
    const safeIndex = (index + shoes.length) % shoes.length;
    setActiveShoe(safeIndex);
    shoeRefs.current[safeIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    if (focus) shoeRefs.current[safeIndex]?.focus({ preventScroll: true });
  };

  const onShoeKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      selectShoe(index + 1, true);
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      selectShoe(index - 1, true);
    }
  };

  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.changedTouches[0]?.clientX ?? null;
  };

  const onTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStartX.current;
    const end = event.changedTouches[0]?.clientX;
    if (start === null || end === undefined) return;
    const difference = end - start;
    if (Math.abs(difference) > 46) selectShoe(activeShoe + (difference < 0 ? 1 : -1));
    touchStartX.current = null;
  };

  const shoe = shoes[activeShoe];

  return (
    <main>
      <section className="hero section-shell" id="home">
        <div className="hero__media" aria-hidden="true">
          <img src={media.hero} alt="" fetchPriority="high" decoding="async" onError={(event) => event.currentTarget.classList.add('media-failed')} />
          <div className="hero__wash" />
        </div>
        <div className="hero__copy" data-reveal>
          <span className="eyebrow eyebrow--light">A new perspective on movement</span>
          <h1>Leave a<br /><i>lasting</i> line.</h1>
          <button className="text-link text-link--light" onClick={() => document.querySelector('#the-edit')?.scrollIntoView({ behavior: 'smooth' })}>
            View the edit <ArrowDownRight size={17} />
          </button>
        </div>
        <div className="hero__meta">
          <span>Campaign 01 — 26</span>
          <span>Scroll to enter</span>
        </div>
      </section>

      <section className="opening section-shell" id="campaign">
        <div className="opening__rule" data-reveal />
        <div className="opening__grid">
          <p className="eyebrow" data-reveal>01 / The opening scene</p>
          <h2 data-reveal>Made for the<br />space <i>between</i><br />arrivals.</h2>
          <p className="opening__note" data-reveal>Objects in motion. A considered pace. A new standard of everyday form.</p>
        </div>
      </section>

      <section className="campaign-split section-shell">
        <div className="campaign-split__image image-frame" data-reveal>
          <MediaImage src={media.stride} alt="A poised model walking down pale stone steps in polished oxblood loafers" />
          <span className="image-frame__count">01 / 03</span>
        </div>
        <div className="campaign-split__copy" data-reveal>
          <span className="eyebrow">The pace of now</span>
          <h2>Presence,<br /><i>in practice.</i></h2>
          <p>Every line considered. Every surface made to travel.</p>
          <button className="text-link" onClick={() => document.querySelector('#the-edit')?.scrollIntoView({ behavior: 'smooth' })}>
            Meet the silhouettes <ArrowDownRight size={17} />
          </button>
        </div>
      </section>

      <section className="trending section-shell" id="the-edit" aria-label="Trending Puma footwear">
        <div className="section-heading" data-reveal>
          <div>
            <span className="eyebrow">The new edit</span>
            <h2>Trending <i>now.</i></h2>
          </div>
          <div className="reel-controls" aria-label="Trending shoe controls">
            <button onClick={() => selectShoe(activeShoe - 1)} aria-label="Show previous trending shoe"><ArrowLeft size={20} strokeWidth={1.4} /></button>
            <span aria-live="polite">0{activeShoe + 1} / 0{shoes.length}</span>
            <button onClick={() => selectShoe(activeShoe + 1)} aria-label="Show next trending shoe"><ArrowRight size={20} strokeWidth={1.4} /></button>
          </div>
        </div>

        <div className="shoe-reel" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} role="group" aria-label="Swipe through trending shoe styles">
          {shoes.map((item, index) => (
            <button
              ref={(element) => { shoeRefs.current[index] = element; }}
              key={item.name}
              className={`shoe-card ${activeShoe === index ? 'shoe-card--active' : ''}`}
              onClick={() => selectShoe(index)}
              onKeyDown={(event) => onShoeKeyDown(event, index)}
              aria-pressed={activeShoe === index}
            >
              <span className="shoe-card__image image-frame">
                <MediaImage src={item.image} alt={`${item.name} shoe`} className={item.imageClass} />
                <span className="shoe-card__number">0{index + 1}</span>
              </span>
              <span className="shoe-card__info">
                <small>{item.category}</small>
                <strong>{item.name}</strong>
                <em>Explore form <ArrowUpRight size={15} /></em>
              </span>
            </button>
          ))}
        </div>

        <div className="shoe-detail" data-reveal aria-live="polite">
          <span className="eyebrow">Selected silhouette</span>
          <p>{shoe.note}</p>
        </div>
      </section>

      <section className="statement-panel statement-panel--speedcat section-shell" data-reveal>
        <div className="statement-panel__media" aria-hidden="true"><MediaImage src={media.pumaSpeedcatProduct} alt="" fetchPriority="high" /></div>
        <div className="statement-panel__content">
          <span className="eyebrow eyebrow--light">PUMA® / SPEEDCAT</span>
          <h2>Red runs<br /><i>the city.</i></h2>
          <div className="statement-panel__foot"><span>Premium suede / low profile</span><span>Campaign 02</span></div>
        </div>
      </section>

      <section className="motion-section section-shell" aria-label="Puma Palermo premium footwear campaign">
        <div className="motion-section__top" data-reveal>
          <span className="eyebrow">Puma / Premium footwear</span>
          <h2>Palermo<br /><i>in focus.</i></h2>
          <p>A premium PUMA Palermo study: stadium light, sculptural colour and a silhouette made to hold the frame.</p>
        </div>
        <div className="motion-film puma-film image-frame" data-reveal>
          <MediaImage src={media.pumaStadium} alt="PUMA Palermo footwear campaign in a football stadium" fetchPriority="high" />
          <div className="puma-film__wash" aria-hidden="true" />
          <div className="motion-film__overlay"><span>PUMA® / PALERMO</span><span>Campaign / 01</span></div>
          <div className="puma-film__caption"><span>PREMIUM EDIT</span><strong>Archive sport,<br />reframed.</strong></div>
        </div>
      </section>

      <section className="feature-story section-shell">
        <div className="feature-story__copy" data-reveal>
          <span className="eyebrow">Puma / Archive icons</span>
          <h2>Move with<br /><i>intention.</i></h2>
          <p>Palermo and Speedcat: two PUMA classics, reintroduced through colour, texture and unmistakable sport heritage.</p>
        </div>
        <div className="feature-story__stack" data-reveal>
          <div className="feature-story__tile feature-story__tile--upper image-frame">
            <MediaImage src={media.pumaNet} alt="PUMA Palermo premium sneakers held beside a football net" fetchPriority="low" />
          </div>
          <div className="feature-story__tile feature-story__tile--lower image-frame">
            <MediaImage src={media.pumaSpeedcat} alt="Red PUMA Speedcat premium footwear campaign" fetchPriority="low" />
          </div>
        </div>
      </section>

      <section className="final-campaign section-shell" data-reveal>
        <div className="final-campaign__media" aria-hidden="true"><MediaImage src={media.pumaMostroCampaign} alt="" fetchPriority="low" /></div>
        <div className="final-campaign__content">
          <span className="eyebrow eyebrow--light">PUMA® / MOSTRO</span>
        </div>
      </section>

      <footer className="site-footer">
        <button className="footer-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>HOLLYWOOD SHOE</button>
        <p>© 2026 / A house in motion</p>
        <span>Home / Chapter One</span>
      </footer>
    </main>
  );
}

type MensLens = 'all' | 'trending' | 'new' | 'sale' | 'stock' | 'published';
type MensPriceFilter = 'all' | 'under3000' | '3000to6000' | 'over6000';
type MensSort = 'featured' | 'price-asc' | 'price-desc' | 'name';

const formatInr = (value: number | null) => value === null ? 'Price on request' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
const productPrice = (product: PublicProduct) => product.salePrice ?? product.originalPrice;
const hasStock = (product: PublicProduct) => product.inventory.some((item) => item.quantity > 0);

function readMensFilters(): { lens: MensLens; price: MensPriceFilter; sort: MensSort } {
  const params = new URLSearchParams(window.location.search);
  const lens = ['all', 'trending', 'new', 'sale', 'stock', 'published'].includes(params.get('lens') || '') ? params.get('lens') as MensLens : 'all';
  const price = ['all', 'under3000', '3000to6000', 'over6000'].includes(params.get('price') || '') ? params.get('price') as MensPriceFilter : 'all';
  const sort = ['featured', 'price-asc', 'price-desc', 'name'].includes(params.get('sort') || '') ? params.get('sort') as MensSort : 'featured';
  return { lens, price, sort };
}

function WishlistButton({ productId, productName }: { productId: string; productName: string }) {
  const storageKey = 'hollywood-shoe-wishlist';
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(storageKey) || '[]') as string[];
      setSaved(stored.includes(productId));
    } catch {
      setSaved(false);
    }
  }, [productId]);

  const toggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      const stored = JSON.parse(window.localStorage.getItem(storageKey) || '[]') as string[];
      const next = saved ? stored.filter((id) => id !== productId) : [...new Set([...stored, productId])];
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      setSaved(!saved);
    } catch {
      setSaved(!saved);
    }
  };

  return <button className={`mens-wishlist ${saved ? 'mens-wishlist--saved' : ''}`} onClick={toggle} aria-label={`${saved ? 'Remove' : 'Save'} ${productName} ${saved ? 'from' : 'to'} wishlist`} aria-pressed={saved}><Heart size={17} strokeWidth={1.4} fill={saved ? 'currentColor' : 'none'} /></button>;
}

function MensProductCard({ product, index }: { product: PublicProduct; index: number }) {
  const image = product.imageUrl;
  return (
    <article className="mens-product-card">
      <div className="mens-product-card__image">
        <a className="mens-product-card__image-link" href={`/mens/${product.id}`} onClick={(event) => { event.preventDefault(); navigate(`/mens/${product.id}`); }} aria-label={`Open ${product.name}`}>
          {image ? <img src={image} alt={product.name} loading={index < 4 ? 'eager' : 'lazy'} decoding="async" onError={(event) => event.currentTarget.classList.add('media-failed')} /> : <span className="mens-product-card__missing">Image coming soon</span>}
        </a>
        <WishlistButton productId={product.id} productName={product.name} />
        {product.badges[0] && <span className="mens-product-card__badge">{product.badges[0]}</span>}
      </div>
      <div className="mens-product-card__meta">
        <a href={`/mens/${product.id}`} onClick={(event) => { event.preventDefault(); navigate(`/mens/${product.id}`); }}>
          <strong>{product.name || 'Hollywood Shoe release'}</strong>
        </a>
        <div className="mens-product-card__bottom"><div className="mens-product-card__price"><b>{formatInr(productPrice(product))}</b>{product.salePrice !== null && product.originalPrice !== null && <del>{formatInr(product.originalPrice)}</del>}</div></div>
      </div>
    </article>
  );
}

function MensCollectionPage() {
  const initial = readMensFilters();
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [lens, setLens] = useState<MensLens>(initial.lens);
  const [price, setPrice] = useState<MensPriceFilter>(initial.price);
  const [sort, setSort] = useState<MensSort>(initial.sort);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    fetch('/api/products?category=MENS')
      .then((response) => { if (!response.ok) throw new Error('Collection unavailable'); return response.json() as Promise<{ products: PublicProduct[] }>; })
      .then((data) => { if (active) setProducts(data.products); })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const updateFromUrl = () => {
      if (window.location.pathname !== '/mens') return;
      const next = readMensFilters();
      setLens(next.lens); setPrice(next.price); setSort(next.sort);
    };
    window.addEventListener('popstate', updateFromUrl);
    return () => window.removeEventListener('popstate', updateFromUrl);
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    lens === 'all' ? url.searchParams.delete('lens') : url.searchParams.set('lens', lens);
    price === 'all' ? url.searchParams.delete('price') : url.searchParams.set('price', price);
    sort === 'featured' ? url.searchParams.delete('sort') : url.searchParams.set('sort', sort);
    window.history.replaceState({}, '', `${url.pathname}${url.search}`);
  }, [lens, price, sort]);

  const visibleProducts = useMemo(() => products.filter((product) => {
    const currentPrice = productPrice(product);
    const lensPass = lens === 'all' || lens === 'published' || (lens === 'trending' && product.trending) || (lens === 'new' && product.badges.includes('NEW')) || (lens === 'sale' && product.salePrice !== null) || (lens === 'stock' && hasStock(product));
    const pricePass = price === 'all' || (currentPrice !== null && ((price === 'under3000' && currentPrice < 3000) || (price === '3000to6000' && currentPrice >= 3000 && currentPrice <= 6000) || (price === 'over6000' && currentPrice > 6000)));
    return lensPass && pricePass;
  }).sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name);
    const aPrice = productPrice(a) ?? Number.POSITIVE_INFINITY;
    const bPrice = productPrice(b) ?? Number.POSITIVE_INFINITY;
    if (sort === 'price-asc') return aPrice - bPrice;
    if (sort === 'price-desc') return bPrice - aPrice;
    return Number(b.featured) - Number(a.featured) || Number(b.trending) - Number(a.trending);
  }), [lens, price, products, sort]);

  const clearFilters = () => { setLens('all'); setPrice('all'); setSort('featured'); };

  return (
    <main className="mens-collection-page mens-grid-page">
      <section className="mens-grid-heading">
        <div><span className="eyebrow">Hollywood Shoe / Men&apos;s collection</span><h1>Men&apos;s footwear</h1></div>
        <div className="mens-grid-heading__count"><span className="eyebrow">Published edit</span><strong>{products.length} styles</strong></div>
      </section>
      <section className="mens-toolbar" aria-label="Collection filters">
        <div className="mens-toolbar__count"><strong>{visibleProducts.length}</strong><span>of {products.length} styles</span></div>
        <div className="mens-toolbar__controls">
          <label><span>View</span><select value={lens} onChange={(event) => setLens(event.target.value as MensLens)}><option value="all">All sneakers</option><option value="trending">Trending</option><option value="new">New arrivals</option><option value="sale">Sale edit</option><option value="stock">In stock</option><option value="published">Published edit</option></select><ChevronDown size={14} /></label>
          <label><span>Price</span><select value={price} onChange={(event) => setPrice(event.target.value as MensPriceFilter)}><option value="all">All prices</option><option value="under3000">Under ₹3,000</option><option value="3000to6000">₹3,000 – ₹6,000</option><option value="over6000">Over ₹6,000</option></select><ChevronDown size={14} /></label>
          <label><span>Sort by</span><select value={sort} onChange={(event) => setSort(event.target.value as MensSort)}><option value="featured">Featured</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="name">Name</option></select><ChevronDown size={14} /></label>
          {(lens !== 'all' || price !== 'all' || sort !== 'featured') && <button className="mens-clear" onClick={clearFilters}><SlidersHorizontal size={14} /> Clear filters</button>}
        </div>
      </section>
      <p className="mens-data-note"><Info size={14} /> Color variants are not stored for the current published Men&apos;s inventory, so no fictional swatches are shown.</p>
      {loading ? <div className="mens-state"><span className="eyebrow">Loading the Men&apos;s edit…</span></div> : failed ? <div className="mens-state"><span className="eyebrow">The collection is temporarily unavailable.</span><button className="text-link" onClick={() => window.location.reload()}>Try again <ArrowRight size={17} /></button></div> : visibleProducts.length ? <section className="mens-product-grid" aria-label="Men’s shoes">{visibleProducts.map((product, index) => <MensProductCard key={product.id} product={product} index={index} />)}</section> : <section className="mens-state mens-state--empty"><span className="eyebrow">No styles in this lens</span><h2>The edit is<br /><i>quiet here.</i></h2><button className="text-link" onClick={clearFilters}>Return to all sneakers <ArrowRight size={17} /></button></section>}
    </main>
  );
}

function MensProductDetailPage({ productId }: { productId: string }) {
  const [product, setProduct] = useState<PublicProduct | null>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    fetch(`/api/products/${encodeURIComponent(productId)}`)
      .then((response) => { if (!response.ok) throw new Error('Product unavailable'); return response.json() as Promise<{ product: PublicProduct }>; })
      .then((data) => { if (active) setProduct(data.product); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [productId]);

  if (failed) return <main className="mens-detail-page mens-state"><span className="eyebrow">This release could not be found.</span><h1>Return to the<br /><i>Men&apos;s edit.</i></h1><a className="text-link" href="/mens">Back to Men&apos;s shoes <ArrowLeft size={17} /></a></main>;
  if (!product) return <main className="mens-detail-page mens-state"><span className="eyebrow">Loading the release…</span></main>;
  const images = product.images.length ? product.images : [{ id: 'primary', url: product.imageUrl, alt: product.name }];
  const image = images[Math.min(imageIndex, images.length - 1)];
  const totalStock = product.inventory.reduce((sum, item) => sum + Math.max(0, item.quantity), 0);
  const availableSizes = product.inventory.filter((item) => item.quantity > 0);
  return (
    <main className="mens-detail-page">
      <div className="mens-detail-breadcrumb"><a href="/mens">Men&apos;s shoes</a><span>/</span><span>{product.name}</span></div>
      <section className="mens-detail-layout">
        <div className="mens-detail-gallery">
          <div className="mens-detail-image"><img src={image.url} alt={image.alt} decoding="async" /></div>
          {images.length > 1 && <div className="mens-detail-thumbnails">{images.map((entry, index) => <button key={entry.id} className={index === imageIndex ? 'mens-detail-thumb mens-detail-thumb--active' : 'mens-detail-thumb'} onClick={() => setImageIndex(index)} aria-label={`Show product image ${index + 1}`} aria-pressed={index === imageIndex}><img src={entry.url} alt="" /></button>)}</div>}
        </div>
        <div className="mens-detail-info">
          <span className="eyebrow">Hollywood Shoe / Men&apos;s collection</span>
          <div className="mens-detail-title"><h1>{product.name}</h1><div className="mens-detail-price"><strong>{formatInr(productPrice(product))}</strong>{product.salePrice !== null && product.originalPrice !== null && <del>{formatInr(product.originalPrice)}</del>}</div></div>
          <div className="mens-detail-badges">{product.badges.map((badge) => <span key={badge}>{badge}</span>)}</div>
          <p className="mens-detail-lede">{product.shortDescription || product.description}</p>
          <div className="mens-detail-rule" />
          <div className="mens-detail-size-heading"><strong>Select a size</strong><span>{totalStock ? `${totalStock} units across ${availableSizes.length} sizes` : product.inventory.length ? 'Currently unavailable' : 'Size data not provided'}</span></div>
          {product.inventory.length ? <div className="mens-size-grid">{product.inventory.map((item) => <button key={item.size} disabled={item.quantity <= 0} className={selectedSize === item.size ? 'mens-size mens-size--selected' : 'mens-size'} onClick={() => setSelectedSize(item.size)} aria-label={`Size ${item.size}${item.quantity <= 0 ? ', unavailable' : ''}`} aria-pressed={selectedSize === item.size}>{item.size}</button>)}</div> : <p className="mens-detail-muted">This release does not have size inventory recorded yet.</p>}
          <details className="mens-size-guide"><summary>Size guide <ChevronDown size={15} /></summary><p>Sizes are shown exactly as stored for this release. Hollywood Shoe does not have a verified conversion chart for this product yet, so no conversion is implied.</p></details>
          <div className="mens-detail-rule" />
          <div className="mens-detail-section"><span className="eyebrow">Description</span><p>{product.description || product.shortDescription || 'No additional description has been provided for this release.'}</p></div>
          <div className="mens-detail-facts"><div><span>Product type</span><strong>{product.productType || 'Footwear'}</strong></div><div><span>SKU</span><strong>{product.sku || 'Not provided'}</strong></div><div><span>Availability</span><strong>{totalStock ? 'In stock' : product.inventory.length ? 'Unavailable' : 'Not provided'}</strong></div></div>
          <div className="mens-detail-note"><Info size={16} /><span>{selectedSize ? `Size ${selectedSize} selected.` : 'Select an available size to mark your preferred fit.'} Online cart and checkout are not connected in this release.</span></div>
        </div>
      </section>
    </main>
  );
}

function CollectionPage({ route }: { route: FutureCollectionRoute }) {
  const label = route.slice(1).toUpperCase();
  const category = label === 'MENS' ? 'MENS' : label === 'WOMENS' ? 'WOMENS' : 'KIDS';
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    fetch(`/api/products?category=${category}`)
      .then((response) => { if (!response.ok) throw new Error('Collection unavailable'); return response.json() as Promise<{ products: PublicProduct[] }>; })
      .then((data) => { if (active) setProducts(data.products); })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [category]);

  const formatPrice = (value: number | null) => value === null ? 'Price on request' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

  return (
    <main className="collection-page">
      <section className="collection-hero">
        <div>
          <span className="eyebrow">Hollywood Shoe / Collection</span>
          <p className="collection-page__counter">0{navItems.findIndex((item) => item.route === route) + 1}</p>
          <h1>{label}<br /><i>in motion.</i></h1>
        </div>
        <p className="collection-hero__note">Published releases, considered for the next chapter of the house.</p>
      </section>
      {loading ? <div className="collection-state"><span className="eyebrow">Loading the edit…</span></div> : failed ? <div className="collection-state"><span className="eyebrow">The collection is temporarily unavailable.</span><button className="text-link" onClick={() => window.location.reload()}>Try again <ArrowRight size={17} /></button></div> : products.length ? (
        <section className="collection-grid" aria-label={`${label} published products`}>
          {products.map((product, index) => <article className="collection-card" key={product.id}>
            <div className="collection-card__image image-frame"><img src={product.imageUrl} alt={product.name} loading={index < 2 ? 'eager' : 'lazy'} decoding="async" /></div>
            <div className="collection-card__meta"><span>{product.productType || 'Footwear'} {product.trending ? '· Trending' : ''}</span><strong>{product.name || 'Hollywood Shoe release'}</strong><p>{product.description}</p><b>{formatPrice(product.salePrice ?? product.originalPrice)}</b></div>
          </article>)}
        </section>
      ) : <section className="collection-empty"><span className="eyebrow">The next edit is being prepared.</span><h2>{label}<br /><i>is next.</i></h2><p>Published releases for this collection will appear here once they are approved in POST.</p><button className="text-link" onClick={() => navigate('/')}>Return Home <ArrowDownRight size={17} /></button></section>}
    </main>
  );
}

function App() {
  const [route, setRoute] = useState<Route>(routeFromLocation());

  useEffect(() => {
    const onPopState = () => setRoute(routeFromLocation());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    document.title = route === '/' ? 'Hollywood Shoe — In Motion' : route === '/post' ? 'Hollywood Shoe — POST' : `Hollywood Shoe — ${route.slice(1).toUpperCase()}`;
  }, [route]);

  if (route === '/post') return <AdminPostPage />;
  if (route.startsWith('/mens/')) return <><Header route={route} /><MensProductDetailPage productId={decodeURIComponent(route.slice('/mens/'.length))} /></>;

  return (
    <>
      <Header route={route} />
      {route === '/' ? <HomePage /> : route === '/mens' ? <MensCollectionPage /> : <CollectionPage route={route === '/womens' ? '/womens' : '/kids'} />}
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
