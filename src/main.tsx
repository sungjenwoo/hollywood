import { useEffect, useRef, useState, type KeyboardEvent, type TouchEvent } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Menu,
  Pause,
  Play,
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
    name: 'Cloud Runner',
    category: '01 / Soft geometry',
    image: media.cloud,
    note: 'An easy stride, drawn in light.',
  },
  {
    name: 'Vino Loafer',
    category: '02 / Polished form',
    image: media.vino,
    note: 'A familiar line, finished with intention.',
  },
  {
    name: 'Dune Mule',
    category: '03 / Quiet texture',
    image: media.sand,
    note: 'A softer way through the day.',
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
  const [videoPaused, setVideoPaused] = useState(false);
  const [videoFallback, setVideoFallback] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
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

  const toggleVideo = async () => {
    const video = videoRef.current;
    if (!video || videoFallback) return;
    if (video.paused) {
      try {
        await video.play();
        setVideoPaused(false);
      } catch {
        setVideoPaused(true);
      }
    } else {
      video.pause();
      setVideoPaused(true);
    }
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

      <section className="trending section-shell" id="the-edit" aria-label="Trending shoes">
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
                <MediaImage src={item.image} alt={`${item.name} shoe`} />
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

      <section className="statement-panel section-shell" data-reveal>
        <div className="statement-panel__content">
          <span className="eyebrow eyebrow--light">Hollywood Shoe / Chapter 02</span>
          <h2>Good form<br />goes <i>everywhere.</i></h2>
          <div className="statement-panel__foot"><span>Designed around real life</span><span>— 2026</span></div>
        </div>
      </section>

      <section className="motion-section section-shell" aria-label="Atelier motion film">
        <div className="motion-section__top" data-reveal>
          <span className="eyebrow">The moving image</span>
          <h2>Atelier<br /><i>in light.</i></h2>
          <p>A study in warm surfaces, shifting shade and the small decision to move forward.</p>
        </div>
        <div className={`motion-film image-frame ${videoFallback ? 'motion-film--fallback' : ''}`} data-reveal>
          {!videoFallback && (
            <video
              ref={videoRef}
              src="/assets/atelier-motion.mp4"
              poster={media.hero}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              onPlay={() => setVideoPaused(false)}
              onPause={() => setVideoPaused(true)}
              onError={() => setVideoFallback(true)}
              aria-label="An abstract motion study in warm ivory and stone tones"
            />
          )}
          <div className="motion-film__overlay"><span>Film / 00:08</span><span>{videoFallback ? 'Still study' : 'Muted'} </span></div>
          <button className="play-control" onClick={toggleVideo} aria-label={videoPaused ? 'Play film' : 'Pause film'}>
            {videoPaused ? <Play size={20} fill="currentColor" /> : <Pause size={19} fill="currentColor" />}
          </button>
          <div className="motion-film__fallback" aria-hidden="true" />
        </div>
      </section>

      <section className="feature-story section-shell">
        <div className="feature-story__copy" data-reveal>
          <span className="eyebrow">A closer study</span>
          <h2>Walk softly.<br /><i>Leave texture.</i></h2>
          <p>Shape meets surface in a softer, more intentional rhythm.</p>
        </div>
        <div className="feature-story__stack" data-reveal>
          <div className="feature-story__tile feature-story__tile--upper image-frame">
            <MediaImage src={media.sand} alt="Sand colored woven leather mule on a pale clay pedestal" />
          </div>
          <div className="feature-story__tile feature-story__tile--lower image-frame">
            <MediaImage src={media.vino} alt="Oxblood polished leather loafer on a sandstone pedestal" />
          </div>
          <span className="feature-story__line">Details<br />become direction.</span>
        </div>
      </section>

      <section className="final-campaign section-shell" data-reveal>
        <div className="final-campaign__media" aria-hidden="true"><MediaImage src={media.hero} alt="" loading="lazy" fetchPriority="low" /></div>
        <div className="final-campaign__content">
          <span className="eyebrow eyebrow--light">The next step starts here</span>
          <h2>Wear the<br /><i>moment.</i></h2>
          <button className="text-link text-link--light" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Return to the beginning <ArrowUpRight size={17} /></button>
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
