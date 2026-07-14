import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { PhoneShowcase, WrappedData } from './PhoneShowcaseSite';
import './styles.css';

const PAGES_BASE = 'https://raw.githubusercontent.com/vellum-ai/agent-wrapped/main/pages/';
const REPO = 'https://github.com/vellum-ai/agent-wrapped';

function pageName(): string {
  return (window.location.pathname.replace(/^\/+|\/+$/g, '').split('/')[0] || '').toLowerCase();
}

const PLATFORM_HANDLES: Record<string, string> = {
  vellum: '@vellum_ai',
  claude: '@claudeai',
  hermes: '@NousResearch',
  openclaw: '@openclaw',
};

function shareText(w: WrappedData): string {
  const handle = w.source ? PLATFORM_HANDLES[w.source] : undefined;
  const built = handle ? ` (built on ${handle})` : '';
  if (w.receipt?.totalTokens) {
    const t = w.receipt.totalTokens;
    const fmt = t >= 1e9 ? (t / 1e9).toFixed(1).replace(/\.0$/, '') + 'B' : t >= 1e6 ? (t / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : t.toLocaleString('en-US');
    return `${w.assistant} and I burned ${fmt} tokens in ${w.daysTogether} days. show me your agent's receipt 🧾${built}`;
  }
  return `${w.assistant} and I: ${w.conversations.toLocaleString('en-US')} conversations in ${w.daysTogether} days. show me your agent's wrapped 🎁${built}`;
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

const DiscordIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.058a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

const ShareRow = ({ wrapped }: { wrapped: WrappedData }) => {
  const [copied, setCopied] = useState(false);
  const [discordCopied, setDiscordCopied] = useState(false);
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

  const shareDiscord = () => {
    navigator.clipboard.writeText(`${text} ${url}`).then(() => {
      setDiscordCopied(true);
      setTimeout(() => {
        setDiscordCopied(false);
        window.open('https://vellum.ai/community', '_blank', 'noopener,noreferrer');
      }, 900);
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
      <button class={`share-btn ${discordCopied ? 'copied' : ''}`} onClick={shareDiscord}>
        <DiscordIcon /> {discordCopied ? '✓ copied!' : 'Share'}
      </button>
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
    fetch(PAGES_BASE + encodeURIComponent(name) + '.json?v=' + Date.now())
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
