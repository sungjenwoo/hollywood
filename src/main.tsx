import { useEffect, useRef, useState, type KeyboardEvent, type TouchEvent } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Menu,
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
  pumaMostro: '/manus-storage/wiylwmeC0RMj_406b15d9.jpg',
  pumaPalermoRose: '/manus-storage/J026xMeLSvJv_6b0cbcfe.jpg',
  pumaMostroCampaign: '/manus-storage/qTTcEUee3T6s_69420c33.jpg',
};

type Route = '/' | '/mens' | '/womens' | '/kids' | '/post';
type SectionId = 'home' | 'mens' | 'womens' | 'kids' | 'post';

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
  return (['/', '/mens', '/womens', '/kids', '/post'] as string[]).includes(candidate)
    ? (candidate as Route)
    : '/';
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

  return (
    <header className={`site-header ${isScrolled || route !== '/' ? 'site-header--solid' : ''}`}>
      <button className="brand" onClick={() => selectRoute('/')} aria-label="Hollywood Shoe Home">
        <span className="brand__mark" aria-hidden="true"><i /><i /><b /></span>
        <span className="brand__type">HOLLYWOOD<br />SHOE</span>
      </button>

      <nav className="desktop-nav" aria-label="Main navigation">
        {headerNav.map((item) => (
          <button
            key={item.id}
            className={`nav-link ${route === item.route ? 'nav-link--active' : ''}`}
            onClick={() => selectRoute(item.route)}
            aria-current={route === item.route ? 'page' : undefined}
          >
            {item.label}
            {item.route !== '/' && item.route !== '/post' && <span className="nav-link__future" aria-label="Future chapter">SOON</span>}
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
                className={`mobile-nav-link ${route === item.route ? 'mobile-nav-link--active' : ''}`}
                onClick={() => selectRoute(item.route)}
                tabIndex={isMenuOpen ? 0 : -1}
              >
                <span>0{index + 1}</span>
                {item.label}
                {item.route !== '/' && item.route !== '/post' && <em>FUTURE</em>}
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

function FuturePage({ route }: { route: Exclude<Route, '/' | '/post'> }) {
  const label = route.slice(1).toUpperCase();
  return (
    <main className="future-page">
      <section className="future-page__content">
        <span className="eyebrow">Hollywood Shoe / Future chapter</span>
        <p className="future-page__counter">0{navItems.findIndex((item) => item.route === route) + 1}</p>
        <h1>{label}<br /><i>is next.</i></h1>
        <p>We’re preparing this part of the house with the same attention to form. The collection experience is not open yet.</p>
        <button className="text-link" onClick={() => navigate('/')}>Return Home <ArrowDownRight size={17} /></button>
      </section>
      <div className="future-page__orb" aria-hidden="true" />
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
    document.title = route === '/' ? 'Hollywood Shoe — In Motion' : route === '/post' ? 'Hollywood Shoe — POST' : `Hollywood Shoe — ${route.slice(1)} / Future`;
  }, [route]);

  if (route === '/post') return <AdminPostPage />;

  return (
    <>
      <Header route={route} />
      {route === '/' ? <HomePage /> : <FuturePage route={route} />}
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
