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
}

interface Slide {
  bg: string;
  label: string;
  content: preact.ReactNode;
  contentPosition?: 'center' | 'bottom';
  textColor?: string;
}

const fmt = (n: number) => (n ?? 0).toLocaleString('en-US');

function buildSlides(wrapped: WrappedData): Slide[] {
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
      label: 'Your era',
      contentPosition: 'center',
      content: (
        <>
          <div class="card-big-text">{wrapped.era}</div>
          {wrapped.tagline ? <div class="card-desc">{wrapped.tagline}</div> : null}
        </>
      ),
    },
  ];
}

/* ── 3D COVERFLOW CONSTANTS ── */
const PERSPECTIVE = 1600;
const SCALE_STEP = 0.16;
const MAX_VISIBLE = 2;
const DEPTH = 240;
const DURATION = 0.6;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const TRANSITION_CSS = `transform ${DURATION}s ${EASE}, opacity ${DURATION}s ${EASE}`;

export const PhoneShowcase: FunctionComponent<{ wrapped: WrappedData; headerExtra?: preact.ReactNode }> = ({ wrapped, headerExtra }) => {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const lockRef = useRef(false);
  const slides = buildSlides(wrapped);
  const n = slides.length;

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 600);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const lock = useCallback(() => {
    lockRef.current = true;
    window.setTimeout(() => { lockRef.current = false; }, DURATION * 1000);
  }, []);

  const step = useCallback((dir: number) => {
    if (lockRef.current) return;
    lock();
    setActive(a => (((a + dir) % n) + n) % n);
  }, [n, lock]);

  const handleCardClick = useCallback((i: number) => {
    if (lockRef.current) return;
    lock();
    setActive(a => (i === a ? (a + 1) % n : i));
  }, [n, lock]);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => step(1), 4000);
    return () => window.clearInterval(id);
  }, [step, paused]);

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  }, [step]);

  const cardWidth = isMobile ? 220 : 290;
  const cardHeight = isMobile ? 390 : 510;
  const tilt = 12;
  const sideTilt = 8;
  const gap = 8;
  const dimOpacity = 0.6;

  return (
    <section class="showcase">
      <div class="showcase-header">
        <h2>{wrapped.assistant}, wrapped</h2>
        {headerExtra}
      </div>

      <div
        class="coverflow-stage"
        style={{ perspective: `${PERSPECTIVE}px` }}
        tabIndex={0}
        role="group"
        aria-roledescription="carousel"
        onKeyDown={onKeyDown}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <button class="nav-btn side prev" onClick={() => step(-1)} aria-label="Previous">‹</button>
        <button class="nav-btn side next" onClick={() => step(1)} aria-label="Next">›</button>
        <div
          style={{
            position: 'relative',
            width: cardWidth,
            height: cardHeight,
            transformStyle: 'preserve-3d',
          }}
        >
          {slides.map((slide, i) => {
            let rel = i - active;
            if (rel > n / 2) rel -= n;
            if (rel < -n / 2) rel += n;
            const ax = Math.abs(rel);
            const visible = ax <= MAX_VISIBLE;
            const isActive = rel === 0;
            const sc = Math.max(0.4, 1 - ax * SCALE_STEP);
            const tx = rel * (gap * 30);
            const tz = -ax * DEPTH;
            const ry = -rel * tilt;
            const rz = rel * sideTilt;

            return (
              <div
                key={i}
                class="coverflow-card"
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: cardWidth,
                  height: cardHeight,
                  borderRadius: 24,
                  overflow: 'hidden',
                  transformStyle: 'preserve-3d',
                  transformOrigin: 'center center',
                  transform: `translate(-50%, -50%) translateX(${tx}px) translateZ(${tz}px) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${sc})`,
                  transition: TRANSITION_CSS,
                  opacity: visible ? 1 : 0,
                  cursor: isActive ? 'default' : 'pointer',
                  pointerEvents: visible ? 'auto' : 'none',
                  backgroundImage: `url("${slide.bg}")`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
                onClick={() => handleCardClick(i)}
                aria-label={slide.label}
                aria-hidden={!visible}
              >
                <div
                  class="card-content-coverflow"
                  style={{
                    opacity: isActive ? 1 : 0,
                    transition: `opacity ${DURATION}s ${EASE}`,
                    color: slide.textColor || '#000',
                    ...(slide.contentPosition === 'bottom' ? {
                      justifyContent: 'flex-end',
                      paddingBottom: '16px',
                    } : {}),
                  }}
                >
                  <div class="card-label">{slide.label}</div>
                  {slide.content}
                </div>

                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: '#000',
                    opacity: isActive ? 0 : dimOpacity,
                    transition: `opacity ${DURATION}s ${EASE}`,
                    pointerEvents: 'none',
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

    </section>
  );
};
