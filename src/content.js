// Isolated-world bridge: reads settings from chrome.storage, forwards them to
// the MAIN-world script (src/page.js), and answers popup requests.
(() => {
  const SRC_PAGE = 'fsp-filter:page';
  const SRC_EXT = 'fsp-filter:ext';
  const DEFAULTS = { enabled: true, hide: [], highlight: [] };

  let status = { resources: [], hidden: 0 };

  const send = (msg) => window.postMessage({ source: SRC_EXT, ...msg }, location.origin);

  async function pushSettings() {
    const settings = await chrome.storage.sync.get(DEFAULTS);
    send({ type: 'settings', settings });
  }

  window.addEventListener('message', (e) => {
    if (e.source !== window || e.data?.source !== SRC_PAGE) return;
    if (e.data.type === 'ready') pushSettings();
    if (e.data.type === 'status') status = { resources: e.data.resources, hidden: e.data.hidden };
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') pushSettings();
  });

  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg?.type === 'getStatus') {
      send({ type: 'requestStatus' });
      // give the page script a moment to post a fresh status
      setTimeout(() => reply(status), 150);
      return true;
    }
  });

  pushSettings();
})();
