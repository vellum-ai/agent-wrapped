import { render } from 'preact';
import { PhoneShowcase, WrappedData } from './PhoneShowcaseSite';

const PAGES_BASE = 'https://raw.githubusercontent.com/vellum-ai/agent-wrapped/main/pages/';
const EXAMPLE = 'becky';

function boot() {
  const mount = document.getElementById('live-carousel');
  if (!mount) return;
  fetch(PAGES_BASE + EXAMPLE + '.json?v=' + Date.now())
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((w: WrappedData) => {
      render(<PhoneShowcase wrapped={w} />, mount);
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
