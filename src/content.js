// Isolated-world bridge: reads settings from chrome.storage, forwards them to
// the MAIN-world script (src/page.js), and answers popup requests.
(() => {
  const SRC_PAGE = 'fsp-filter:page';
  const SRC_EXT = 'fsp-filter:ext';
  const DEFAULTS = { enabled: true, hide: [], highlight: [], show: [], useRegex: false };

  let status = { resources: [], hidden: 0 };
  let statusWaiters = [];

  const send = (msg) => window.postMessage({ source: SRC_EXT, ...msg }, location.origin);

  async function pushSettings() {
    const settings = await chrome.storage.sync.get(DEFAULTS);
    send({ type: 'settings', settings });
  }

  window.addEventListener('message', (e) => {
    if (e.source !== window || e.data?.source !== SRC_PAGE) return;
    if (e.data.type === 'ready') pushSettings();
    if (e.data.type === 'status') {
      status = { resources: e.data.resources, hidden: e.data.hidden };
      const waiters = statusWaiters;
      statusWaiters = [];
      waiters.forEach((done) => done());
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') pushSettings();
  });

  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg?.type === 'getStatus') {
      // Reply as soon as the page script posts a fresh status, or with the last
      // known one if it doesn't (e.g. the scheduler isn't on the page yet).
      let replied = false;
      const done = () => {
        if (replied) return;
        replied = true;
        reply(status);
      };
      statusWaiters.push(done);
      setTimeout(done, 500);
      send({ type: 'requestStatus' });
      return true;
    }
  });

  pushSettings();
})();
