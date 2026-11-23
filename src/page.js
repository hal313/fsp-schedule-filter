// Runs in the page's MAIN world so it can reach the Bryntum Scheduler instance
// that Flight Schedule Pro uses for the schedule grid.
//
// Hiding uses a filter on the scheduler's resourceStore, so the grid closes up
// (no blank gaps) and it survives Bryntum's row virtualization.
// Highlighting uses a generated stylesheet keyed on each row's data-id, which
// is shared by the name column (locked subgrid) and the timeline row.
(() => {
  if (window.__fspScheduleFilter) return;
  window.__fspScheduleFilter = true;

  const SRC_PAGE = 'fsp-filter:page';
  const SRC_EXT = 'fsp-filter:ext';
  const FILTER_ID = 'fsp-ext-hide';
  const STYLE_ID = 'fsp-ext-highlight-style';
  const TYPES = { 1: 'aircraft', 2: 'instructor' };

  const DEFAULTS = { enabled: true, hide: [], highlight: [], show: { aircraft: [], instructor: [] } };
  let settings = structuredClone(DEFAULTS);
  let lastScheduler = null;
  let lastReport = '';

  const decoder = document.createElement('textarea');
  const decode = (s) => {
    decoder.innerHTML = s ?? '';
    return decoder.value;
  };

  const typeOf = (r) => TYPES[r.resourceTypeId] || 'other';
  const nameOf = (r) => decode(r.name).replace(/\s+/g, ' ').trim();

  const activeRules = (list) =>
    settings.enabled ? (list || []).filter((rule) => rule && rule.text && rule.text.trim()) : [];

  const matches = (rule, r) =>
    (rule.type === 'any' || rule.type === typeOf(r)) &&
    nameOf(r).toLowerCase().includes(rule.text.trim().toLowerCase());

  function getScheduler() {
    try {
      return window.bryntum?.query?.('scheduler') || null;
    } catch {
      return null;
    }
  }

  function hexToRgba(hex, alpha) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }

  // "Show only" lists, per type. An empty list means that type is not restricted,
  // so picking two aircraft leaves every instructor row alone (and vice versa).
  function activeShowSets() {
    const sets = {};
    if (!settings.enabled) return sets;
    for (const [type, names] of Object.entries(settings.show || {})) {
      if (Array.isArray(names) && names.length) sets[type] = new Set(names);
    }
    return sets;
  }

  const filterActive = () =>
    activeRules(settings.hide).length > 0 || Object.keys(activeShowSets()).length > 0;

  function applyHide(store) {
    const rules = activeRules(settings.hide);
    const show = activeShowSets();
    const existing = store.filters?.get?.(FILTER_ID);
    if (filterActive()) {
      store.filter({
        id: FILTER_ID,
        filterBy: (r) => {
          const allowed = show[typeOf(r)];
          if (allowed && !allowed.has(nameOf(r))) return false;
          return !rules.some((rule) => matches(rule, r));
        },
      });
    } else if (existing) {
      store.removeFilter(FILTER_ID);
    }
  }

  function applyHighlight(store) {
    const rules = activeRules(settings.highlight);
    const css = [];
    // Use allRecords so highlights are ready even for rows that are filtered/not yet rendered.
    const records = store.allRecords || store.records || [];
    for (const r of records) {
      const rule = rules.find((x) => matches(x, r));
      if (!rule) continue;
      const sel = `.b-grid-row[data-id="${CSS.escape(String(r.id))}"]`;
      const color = rule.color || '#ffd54f';
      css.push(
        `.b-grid-subgrid-locked ${sel}, .b-grid-subgrid-locked ${sel} > .b-grid-cell {` +
          `background-color: ${hexToRgba(color, 0.85)} !important; }`,
        `.b-grid-subgrid-locked ${sel} { box-shadow: inset 4px 0 0 ${color}; }`,
        `.b-grid-subgrid:not(.b-grid-subgrid-locked) ${sel} {` +
          `background-color: ${hexToRgba(color, 0.3)} !important; }`
      );
    }
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    const text = css.join('\n');
    if (style.textContent !== text) style.textContent = text;
  }

  function report(store) {
    const all = store.allRecords || store.records || [];
    const resources = all.map((r) => ({ name: nameOf(r), type: typeOf(r) }));
    const hidden = all.length - store.count;
    const payload = JSON.stringify({ resources, hidden });
    if (payload === lastReport) return;
    lastReport = payload;
    window.postMessage({ source: SRC_PAGE, type: 'status', resources, hidden }, location.origin);
  }

  function apply() {
    const s = getScheduler();
    if (!s || !s.resourceStore) return;
    lastScheduler = s;
    try {
      applyHide(s.resourceStore);
      applyHighlight(s.resourceStore);
      report(s.resourceStore);
    } catch (e) {
      console.warn('[FSP Schedule Filter]', e);
    }
  }

  // The app can rebuild the scheduler or reload/clear the store when the date
  // or view changes, so check periodically and re-apply when needed.
  function watchdog() {
    const s = getScheduler();
    if (!s || !s.resourceStore) return;
    const needsFilter = filterActive();
    const hasFilter = !!s.resourceStore.filters?.get?.(FILTER_ID);
    if (s !== lastScheduler || needsFilter !== hasFilter || !document.getElementById(STYLE_ID)) {
      apply();
    } else {
      applyHighlight(s.resourceStore); // cheap; picks up newly loaded resources
      report(s.resourceStore);
    }
  }

  window.addEventListener('message', (e) => {
    if (e.source !== window || e.data?.source !== SRC_EXT) return;
    if (e.data.type === 'settings') {
      settings = { ...structuredClone(DEFAULTS), ...e.data.settings };
      apply();
    } else if (e.data.type === 'requestStatus') {
      lastReport = '';
      watchdog();
    }
  });

  setInterval(watchdog, 1500);
  window.postMessage({ source: SRC_PAGE, type: 'ready' }, location.origin);
})();
