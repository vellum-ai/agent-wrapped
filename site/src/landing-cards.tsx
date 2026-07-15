import { render, FunctionComponent } from 'preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { buildSlides, WrappedData, Slide } from './PhoneShowcaseSite';

const PAGES_BASE = 'https://raw.githubusercontent.com/vellum-ai/agent-wrapped/main/pages/';
const EXAMPLE = 'becky';

/* Klarna button-carousel motion (Originkit port), rendering the real wrapped cards */
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const DURATION = 500;
const SWEEP = 260;
const DIP = 150;

/* Button strip geometry, curve 0 = flat strip */
const BUTTON_SIZE = 44;
const GAP = 10;
const BUTTON_COUNT = 5;

function modIdx(i: number, n: number) {
  return ((i % n) + n) % n;
}

const CardFace: FunctionComponent<{ slide: Slide; w: number; h: number }> = ({ slide, w, h }) => (
  <a
    href={'/' + EXAMPLE}
    style={{
      position: 'absolute',
      inset: 0,
      width: w,
      height: h,
      borderRadius: 24,
      overflow: 'hidden',
      backgroundImage: `url("${slide.bg}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundColor: '#1a1a1a',
      boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      color: slide.textColor || '#111',
      textDecoration: 'none',
      display: 'block',
      willChange: 'transform, opacity',
    }}
  >
    <div class="card-content-coverflow">
      <div class="card-label">{slide.label}</div>
      {slide.content}
    </div>
  </a>
);

const KlarnaWrapped: FunctionComponent<{ wrapped: WrappedData }> = ({ wrapped }) => {
  const slides = buildSlides(wrapped);
  const M = slides.length;
  const [active, setActive] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [dir, setDir] = useState(1);
  const [paused, setPaused] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const animatingRef = useRef(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 600);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const cardW = isMobile ? 220 : 290;
  const cardH = isMobile ? 390 : 510;

  const select = useCallback(
    (idx: number) => {
      if (animatingRef.current) return;
      setActive((a) => {
        if (idx === a) return a;
        let delta = modIdx(idx - a, M);
        if (delta > M / 2) delta -= M;
        setDir(Math.sign(delta) || 1);
        setPrev(a);
        animatingRef.current = true;
        return idx;
      });
    },
    [M]
  );

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => select(modIdx(active + 1, M)), 4000);
    return () => window.clearInterval(id);
  }, [active, paused, select, M]);

  const enterRef = useCallback(
    (el: HTMLElement | null) => {
      if (!el) return;
      el.animate(
        [
          { transform: `translate(${dir * SWEEP}px, ${DIP}px) rotate(${dir * 8}deg) scale(0.82)`, opacity: 0 },
          { transform: 'translate(0px, 0px) rotate(0deg) scale(1)', opacity: 1 },
        ],
        { duration: DURATION, easing: EASE, fill: 'both' }
      );
    },
    [dir]
  );

  const exitRef = useCallback(
    (el: HTMLElement | null) => {
      if (!el) return;
      const anim = el.animate(
        [
          { transform: 'translate(0px, 0px) rotate(0deg) scale(1)', opacity: 1 },
          { transform: `translate(${-dir * SWEEP}px, ${DIP}px) rotate(${-dir * 8}deg) scale(0.82)`, opacity: 0 },
        ],
        { duration: DURATION, easing: EASE, fill: 'both' }
      );
      anim.onfinish = () => {
        animatingRef.current = false;
        setPrev(null);
      };
    },
    [dir]
  );

  /* Flat button strip with slot-based scale + fade, Klarna math at curve 0 */
  const half = Math.floor(Math.min(Math.max(1, BUTTON_COUNT), M) / 2);
  const fadeInner = Math.max(0, half - 0.4);
  const fadeEnd = half + 0.6;
  const step = BUTTON_SIZE + GAP;

  function slotOf(i: number) {
    let slot = i - active;
    slot = slot % M;
    if (slot > M / 2) slot -= M;
    if (slot < -M / 2) slot += M;
    return slot;
  }

  return (
    <div
      class="klarna-wrap"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div class="klarna-stage" style={{ width: cardW, height: cardH }}>
        {prev !== null && (
          <div key={`exit-${prev}-${active}`} ref={exitRef as any} style={{ position: 'absolute', inset: 0 }}>
            <CardFace slide={slides[prev]} w={cardW} h={cardH} />
          </div>
        )}
        <div key={`enter-${active}`} ref={enterRef as any} style={{ position: 'absolute', inset: 0 }}>
          <CardFace slide={slides[active]} w={cardW} h={cardH} />
        </div>
      </div>

      <div class="klarna-strip" style={{ height: BUTTON_SIZE + 12 }}>
        {slides.map((slide, i) => {
          const slot = slotOf(i);
          const ax = Math.abs(slot);
          const depth = Math.max(0, 1 - (0.55 * ax) / Math.max(1, half));
          const scale = 0.55 + 0.45 * depth;
          const opacity = ax <= fadeInner ? 1 : ax >= fadeEnd ? 0 : 1 - (ax - fadeInner) / (fadeEnd - fadeInner);
          const isActive = i === active;
          return (
            <button
              key={i}
              aria-label={slide.label}
              onClick={() => select(i)}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: BUTTON_SIZE,
                height: BUTTON_SIZE,
                marginLeft: -BUTTON_SIZE / 2,
                marginTop: -BUTTON_SIZE / 2,
                transform: `translateX(${slot * step}px) scale(${scale})`,
                opacity,
                pointerEvents: opacity < 0.05 ? 'none' : 'auto',
                transition: `transform 0.32s ${EASE}, opacity 0.32s ${EASE}, box-shadow 0.2s ease`,
                borderRadius: '50%',
                border: 'none',
                padding: 0,
                overflow: 'hidden',
                cursor: 'pointer',
                backgroundImage: `url("${slide.bg}")`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundColor: '#1a1a1a',
                boxShadow: isActive ? '0 0 0 2px rgba(255,255,255,0.95)' : '0 0 0 1px rgba(255,255,255,0.2)',
                willChange: 'transform, opacity',
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

function boot() {
  const mount = document.getElementById('live-carousel');
  if (!mount) return;
  fetch(PAGES_BASE + EXAMPLE + '.json?v=' + Date.now())
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((w: WrappedData) => {
      render(<KlarnaWrapped wrapped={w} />, mount);
    })
    .catch(() => {
      mount.innerHTML =
        '<div class="live-fallback"><a class="btn" href="/' + EXAMPLE + '">see becky\u2019s wrapped \u2192</a></div>';
    });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
