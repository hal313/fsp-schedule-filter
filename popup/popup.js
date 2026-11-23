const DEFAULTS = { enabled: true, hide: [], highlight: [] };
const HIGHLIGHT_COLORS = ['#ffd54f', '#81c784', '#64b5f6', '#ff8a65', '#ba68c8', '#4dd0e1'];

let settings = structuredClone(DEFAULTS);

const $ = (sel) => document.querySelector(sel);
const template = $('#rule-template');

// Debounced: storage.sync limits writes per minute, and text inputs fire per keystroke.
let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => chrome.storage.sync.set(settings), 250);
}

function render(kind) {
  const list = $(`#${kind}-list`);
  list.replaceChildren();
  const rules = settings[kind];
  if (!rules.length) {
    const li = document.createElement('li');
    li.className = 'empty';
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
    if (kind === 'highlight') color.value = rule.color || HIGHLIGHT_COLORS[0];

    type.addEventListener('change', () => {
      rule.type = type.value;
      text.setAttribute('list', `names-${type.value}`);
      save();
    });
    text.addEventListener('input', () => {
      rule.text = text.value;
      save();
    });
    color.addEventListener('input', () => {
      rule.color = color.value;
      save();
    });
    li.querySelector('.remove').addEventListener('click', () => {
      settings[kind].splice(i, 1);
      save();
      render(kind);
    });
    list.appendChild(li);
  });
}

function addRule(kind) {
  const rule = { type: 'aircraft', text: '' };
  if (kind === 'highlight') {
    rule.color = HIGHLIGHT_COLORS[settings.highlight.length % HIGHLIGHT_COLORS.length];
  }
  settings[kind].push(rule);
  save();
  render(kind);
  $(`#${kind}-list`).lastElementChild?.querySelector('.text')?.focus();
}

function fillDatalists(resources) {
  const byType = { aircraft: [], instructor: [], any: [] };
  for (const r of resources) {
    // Aircraft names often carry notes like "N816RA (NO 141)"; suggest just the tail number.
    const name = r.type === 'aircraft' ? r.name.split(/\s+/)[0] : r.name;
    (byType[r.type] || []).push(name);
    byType.any.push(name);
  }
  for (const [type, names] of Object.entries(byType)) {
    const dl = $(`#names-${type}`);
    dl.replaceChildren(
      ...[...new Set(names)].map((n) => Object.assign(document.createElement('option'), { value: n }))
    );
  }
}

async function loadStatus() {
  const status = $('#status');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url?.startsWith('https://app.flightschedulepro.com/')) {
    status.textContent = 'Open the Flight Schedule Pro schedule to apply rules.';
    return;
  }
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'getStatus' });
    if (res?.resources?.length) {
      fillDatalists(res.resources);
      status.textContent = `${res.resources.length} rows on the schedule, ${res.hidden} hidden.`;
    } else {
      status.textContent = 'Waiting for the schedule to load…';
    }
  } catch {
    status.textContent = 'Reload the schedule page to activate the extension.';
  }
}

async function init() {
  settings = await chrome.storage.sync.get(DEFAULTS);
  $('#enabled').checked = settings.enabled;
  $('#enabled').addEventListener('change', (e) => {
    settings.enabled = e.target.checked;
    save();
  });
  $('#add-hide').addEventListener('click', () => addRule('hide'));
  $('#add-highlight').addEventListener('click', () => addRule('highlight'));
  render('hide');
  render('highlight');
  loadStatus();
}

init();
