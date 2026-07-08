import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { PhoneShowcase, WrappedData } from './PhoneShowcaseSite';
import './styles.css';

const PAGES_BASE = 'https://raw.githubusercontent.com/vellum-ai/agent-wrapped/main/pages/';
const REPO = 'https://github.com/vellum-ai/agent-wrapped';

function pageName(): string {
  return (window.location.pathname.replace(/^\/+|\/+$/g, '').split('/')[0] || '').toLowerCase();
}

function shareText(w: WrappedData): string {
  return `${w.assistant}, wrapped 🎁 ${w.conversations.toLocaleString('en-US')} conversations, ${w.daysTogether} days together, ${w.memories} memories, ${w.swears} swears. ${w.era}.`;
}

const TwitterIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const LinkedInIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.119 20.452H3.555V9h3.564zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0z" />
  </svg>
);

const ShareRow = ({ wrapped }: { wrapped: WrappedData }) => {
  const [copied, setCopied] = useState(false);
  const url = window.location.origin + '/' + pageName();
  const text = shareText(wrapped);
  const tw = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  const li = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;

  const copyLink = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };

  return (
    <div class="share-row">
      <a class="share-btn" href={tw} target="_blank" rel="noopener noreferrer">
        <TwitterIcon /> Share
      </a>
      <a class="share-btn" href={li} target="_blank" rel="noopener noreferrer">
        <LinkedInIcon /> Share
      </a>
      <button class={`share-btn ${copied ? 'copied' : ''}`} onClick={copyLink}>
        {copied ? '✓ copied' : '🔗 Copy link'}
      </button>
    </div>
  );
};

const App = () => {
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [wrapped, setWrapped] = useState<WrappedData | null>(null);
  const name = pageName();

  useEffect(() => {
    if (!name) {
      setState('missing');
      return;
    }
    fetch(PAGES_BASE + encodeURIComponent(name) + '.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: WrappedData) => {
        document.title = `${data.assistant}, wrapped — Agent Wrapped`;
        setWrapped(data);
        setState('ready');
      })
      .catch(() => setState('missing'));
  }, [name]);

  if (state === 'loading') {
    return (
      <div class="site-status">
        <div class="pulse">loading your wrapped…</div>
      </div>
    );
  }

  if (state === 'missing' || !wrapped) {
    return (
      <div class="site-status">
        <h1>404, no wrapped here</h1>
        <p>No page named "{name || '…'}" yet. Make your own in two minutes.</p>
        <a class="status-cta" href="/">get your wrapped</a>
      </div>
    );
  }

  return (
    <>
      <PhoneShowcase wrapped={wrapped} headerExtra={<ShareRow wrapped={wrapped} />} />
      <footer class="site-footer">
        <a href="/">make your own agent wrapped</a> · <a href={REPO}>github</a>
      </footer>
    </>
  );
};

render(<App />, document.getElementById('app')!);
