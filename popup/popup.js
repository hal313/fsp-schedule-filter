const DEFAULTS = { enabled: true, hide: [], highlight: [], show: [] };
const HIGHLIGHT_COLORS = ['#ffd54f', '#81c784', '#64b5f6', '#ff8a65', '#ba68c8', '#4dd0e1'];
const KINDS = ['show', 'hide', 'highlight'];

let settings = structuredClone(DEFAULTS);
// Set on the options page; kept out of `settings` so saving rules never overwrites it.
let useRegex = false;

const $ = (sel) => document.querySelector(sel);
const template = $('#rule-template');

// Earlier versions stored "show only" as checked names per type
// ({ aircraft: [...], instructor: [...] }); turn those into rules.
function normalizeShow(show) {
  if (Array.isArray(show)) return show;
  const rules = [];
  for (const [type, names] of Object.entries(show || {})) {
    for (const text of names || []) rules.push({ type, text });
  }
  return rules;
}

// --- Saving (chrome.storage.sync, so rules follow the user's Chrome profile) ---
//
// Only the keys changed here are written, so a popup left open never
// overwrites rules that synced in from another computer in the meantime.
// Writes are debounced (storage.sync allows ~120 writes a minute and text
// inputs fire per keystroke) and flushed when the popup closes.
const dirty = new Set();
let saveTimer;

function save(key) {
  dirty.add(key);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 250);
}

function flush() {
  clearTimeout(saveTimer);
  if (!dirty.size) return;
  const changes = {};
  for (const key of dirty) changes[key] = settings[key];
  dirty.clear();
  chrome.storage.sync.set(changes).catch((e) => {
    // e.g. QUOTA_BYTES_PER_ITEM: one list is over sync's 8 KB per-key limit.
    $('#status').textContent = `Couldn't save: ${e.message}`;
    $('#status').classList.add('text-red-600');
  });
}

// The popup can close at any moment; save whatever is pending.
addEventListener('pagehide', flush);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flush();
});

// Pick up changes made elsewhere: another computer, the options page, or
// another popup. Our own writes come back here too and are skipped.
function onStorageChanged(changes, area) {
  if (area !== 'sync') return;
  for (const [key, { newValue }] of Object.entries(changes)) {
    if (key === 'useRegex') {
      useRegex = !!newValue;
      showMatchHint();
      document.querySelectorAll('li .text').forEach(validate);
      continue;
    }
    if (!(key in DEFAULTS) || dirty.has(key)) continue; // local edits win until saved
    const value = newValue === undefined ? structuredClone(DEFAULTS[key]) : newValue;
    const next = key === 'show' ? normalizeShow(value) : value;
    if (JSON.stringify(next) === JSON.stringify(settings[key])) continue;
    settings[key] = next;
    if (key === 'enabled') $('#enabled').checked = next;
    else renderWhenIdle(key);
  }
}

// Re-rendering a list the user is typing in would steal focus, so wait until
// focus leaves that list.
const staleLists = new Set();
function renderWhenIdle(kind) {
  const list = $(`#${kind}-list`);
  if (!list.contains(document.activeElement)) return render(kind);
  if (staleLists.has(kind)) return;
  staleLists.add(kind);
  list.addEventListener('focusout', function wait(e) {
    if (list.contains(e.relatedTarget)) return;
    list.removeEventListener('focusout', wait);
    staleLists.delete(kind);
    render(kind);
  });
}

function render(kind) {
  const list = $(`#${kind}-list`);
  list.replaceChildren();
  const rules = settings[kind];
  if (!rules.length) {
    const li = document.createElement('li');
    li.className = 'text-xs text-slate-400 italic';
    li.textContent = 'No rules yet';
    list.appendChild(li);
    return;
  }
  rules.forEach((rule, i) => {
    const li = template.content.firstElementChild.cloneNode(true);
    const type = li.querySelector('.type');
    const text = li.querySelector('.text');
    const color = li.querySelector('.color');

    type.value = rule.type || 'aircraft';
    text.value = rule.text || '';
    text.setAttribute('list', `names-${type.value}`);
    color.hidden = kind !== 'highlight';
    if (kind === 'highlight') color.value = rule.color || HIGHLIGHT_COLORS[0];

    type.addEventListener('change', () => {
      rule.type = type.value;
      text.setAttribute('list', `names-${type.value}`);
      save(kind);
    });
    validate(text);
    text.addEventListener('input', () => {
      rule.text = text.value;
      validate(text);
      save(kind);
    });
    color.addEventListener('input', () => {
      rule.color = color.value;
      save(kind);
    });
    li.querySelector('.remove').addEventListener('click', () => {
      settings[kind].splice(i, 1);
      save(kind);
      render(kind);
    });
    list.appendChild(li);
  });
}

function regexError(pattern) {
  try {
    new RegExp(pattern.trim(), 'i');
    return '';
  } catch (e) {
    return e.message;
  }
}

// Outline rules whose regular expression won't compile (they match nothing).
function validate(input) {
  const error = useRegex ? regexError(input.value) : '';
  // Red outline for a regex that won't compile.
  for (const c of ['border-red-500', 'ring-1', 'ring-red-500']) input.classList.toggle(c, !!error);
  input.title = error ? `Invalid regular expression: ${error}` : '';
}

function showMatchHint() {
  $('#match-hint').innerHTML = useRegex
    ? 'Rules are case-insensitive regular expressions on the row name, e.g. <code>^N8\\d\\d</code> or <code>Kruger|Smith</code>.'
    : 'Matches are case-insensitive "contains" on the row name, e.g. <code>N816</code> or <code>Kruger</code>.';
}

function addRule(kind) {
  const rule = { type: 'aircraft', text: '' };
  if (kind === 'highlight') {
    rule.color = HIGHLIGHT_COLORS[settings.highlight.length % HIGHLIGHT_COLORS.length];
  }
  settings[kind].push(rule);
  save(kind);
  render(kind);
  $(`#${kind}-list`).lastElementChild?.querySelector('.text')?.focus();
}

function fillDatalists(resources) {
  const byType = { aircraft: [], instructor: [], resource: [], any: [] };
  for (const r of resources) {
    // Aircraft names often carry notes like "N816RA (NO 141)"; suggest just the tail number.
    const name = r.type === 'aircraft' ? r.name.split(/\s+/)[0] : r.name;
    // Aircraft rules also match the type ("Cessna Skyhawk 172M"), so suggest those too.
    const names = r.model ? [name, r.model] : [name];
    (byType[r.type] || []).push(...names);
    byType.any.push(...names);
  }
  for (const [type, names] of Object.entries(byType)) {
    const dl = $(`#names-${type}`);
    dl.replaceChildren(
      ...[...new Set(names)].map((n) => Object.assign(document.createElement('option'), { value: n }))
    );
  }
}

let lastResourcesKey = '';

async function loadStatus() {
  const status = $('#status');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url?.startsWith('https://app.flightschedulepro.com/')) {
    status.textContent = 'Open the Flight Schedule Pro schedule to apply rules.';
    return false;
  }
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'getStatus' });
    if (res?.resources?.length) {
      const key = JSON.stringify(res.resources);
      if (key !== lastResourcesKey) {
        lastResourcesKey = key;
        fillDatalists(res.resources);
      }
      status.textContent = `${res.resources.length} rows on the schedule, ${res.hidden} hidden.`;
    } else {
      status.textContent = 'Waiting for the schedule to load…';
    }
  } catch {
    status.textContent = 'Reload the schedule page to activate the extension.';
  }
  return true;
}

// Keep the status line and name suggestions current while the popup is open.
async function pollStatus() {
  if (await loadStatus()) setTimeout(pollStatus, 1500);
}

async function init() {
  settings = await chrome.storage.sync.get(DEFAULTS);
  settings.show = normalizeShow(settings.show);
  ({ useRegex } = await chrome.storage.sync.get({ useRegex: false }));
  showMatchHint();
  $('#open-options').addEventListener('click', () => chrome.runtime.openOptionsPage());
  $('#enabled').checked = settings.enabled;
  $('#enabled').addEventListener('change', (e) => {
    settings.enabled = e.target.checked;
    save('enabled');
  });
  for (const kind of KINDS) {
    $(`#add-${kind}`).addEventListener('click', () => addRule(kind));
    render(kind);
  }
  chrome.storage.onChanged.addListener(onStorageChanged);
  pollStatus();
}

init();
