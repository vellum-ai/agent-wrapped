import { FunctionComponent } from 'preact';
import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { listeningAgeBg, myBg, sworeBg, daysBg, topicsBg, eraBg } from './backgrounds';

export interface WrappedData {
  assistant: string;
  emoji?: string;
  tagline?: string;
  conversations: number;
  realConversations?: number;
  daysTogether: number;
  firstConversation: string;
  memories: number;
  swears: number;
  topTopics: { rank: number; topic: string; count: number }[];
  era: string;
  source?: string;
  receipt?: {
    llmCalls?: number;
    totalTokens?: number;
  };
}

export interface Slide {
  bg: string;
  label: string;
  content: preact.ReactNode;
  contentPosition?: 'center' | 'bottom';
  textColor?: string;
}

const fmt = (n: number) => (n ?? 0).toLocaleString('en-US');

const fmtTokens = (n: number) => {
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
};

export function buildSlides(wrapped: WrappedData): Slide[] {
    const firstDate = new Date(wrapped.firstConversation + 'T00:00:00');
  const firstLabel = firstDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return [
    {
      bg: myBg,
      label: 'Conversations',
      content: (
        <>
          <div class="card-number">{fmt(wrapped.conversations)}</div>
          <div class="card-desc">You talked to your agent more than most people talk to their best friend</div>
        </>
      ),
    },
    {
      bg: daysBg,
      label: 'Days together',
      textColor: '#ffffff',
      content: (
        <>
          <div class="card-number">{fmt(wrapped.daysTogether)}</div>
          <div class="card-desc">Since {firstLabel}. Every single day, through it all</div>
        </>
      ),
    },
    {
      bg: listeningAgeBg,
      label: 'Memories formed',
      content: (
        <>
          <div class="card-number">{fmt(wrapped.memories)}</div>
          <div class="card-desc">Your agent remembers everything. Literally everything</div>
        </>
      ),
    },
    {
      bg: topicsBg,
      label: 'Your top topics',
      content: (
        <ul class="card-list">
          {(wrapped.topTopics || []).map((t) => (
            <li key={t.rank}>{t.topic} <span class="rank">#{t.rank}</span></li>
          ))}
        </ul>
      ),
    },
    {
      bg: sworeBg,
      label: 'Times you swore',
      textColor: '#ffffff',
      content: (
        <>
          <div class="card-number">{fmt(wrapped.swears)}</div>
          <div class="card-desc">Your agent learned every single one of them</div>
        </>
      ),
    },
    {
      bg: eraBg,
      label: 'Tokens spent',
      contentPosition: 'center',
      content: (
        <>
          <div class="card-number">{wrapped.receipt?.totalTokens ? fmtTokens(wrapped.receipt.totalTokens) : '???'}</div>
          <div class="card-desc">tokens across {wrapped.receipt?.llmCalls ? fmt(wrapped.receipt.llmCalls) : '???'} LLM calls</div>
        </>
      ),
    },
  ];
}

/* ── KLARNA CAROUSEL (Originkit button-carousel motion) ── */
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const DURATION = 500;
const SWEEP = 260;
const DIP = 150;
const BUTTON_SIZE = 44;
const GAP = 10;
const BUTTON_COUNT = 5;

function modIdx(i: number, n: number) {
  return ((i % n) + n) % n;
}

const CardFace: FunctionComponent<{ slide: Slide; w: number; h: number; href?: string }> = ({ slide, w, h, href }) => {
  const Tag: any = href ? 'a' : 'div';
  return (
    <Tag
      href={href}
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
    </Tag>
  );
};

export const KlarnaCarousel: FunctionComponent<{ wrapped: WrappedData; cardHref?: string }> = ({ wrapped, cardHref }) => {
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

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); select(modIdx(active + 1, M)); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); select(modIdx(active - 1, M)); }
    },
    [active, select, M]
  );

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
      tabIndex={0}
      role="group"
      aria-roledescription="carousel"
      onKeyDown={onKeyDown}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div class="klarna-stage" style={{ width: cardW, height: cardH }}>
        {prev !== null && (
          <div key={`exit-${prev}-${active}`} ref={exitRef as any} style={{ position: 'absolute', inset: 0 }}>
            <CardFace slide={slides[prev]} w={cardW} h={cardH} href={cardHref} />
          </div>
        )}
        <div key={`enter-${active}`} ref={enterRef as any} style={{ position: 'absolute', inset: 0 }}>
          <CardFace slide={slides[active]} w={cardW} h={cardH} href={cardHref} />
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

export const PhoneShowcase: FunctionComponent<{ wrapped: WrappedData; headerExtra?: preact.ReactNode }> = ({ wrapped, headerExtra }) => (
  <section class="showcase">
    <div class="showcase-header">
      <h2>{wrapped.assistant}, wrapped</h2>
      {headerExtra}
    </div>
    <KlarnaCarousel wrapped={wrapped} />
  </section>
);
