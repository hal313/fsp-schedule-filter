// Options live in chrome.storage.sync, so they follow the user's Chrome profile.
const OPTION_DEFAULTS = { useRegex: false };

const saved = document.getElementById('saved');
let savedTimer;
function flash(text, ok = true) {
  saved.textContent = text;
  saved.classList.toggle('text-emerald-700', ok);
  saved.classList.toggle('text-red-600', !ok);
  saved.classList.replace('opacity-0', 'opacity-100');
  clearTimeout(savedTimer);
  if (ok) savedTimer = setTimeout(() => saved.classList.replace('opacity-100', 'opacity-0'), 1500);
}

async function init() {
  const options = await chrome.storage.sync.get(OPTION_DEFAULTS);
  for (const [key, value] of Object.entries(options)) {
    const input = document.getElementById(key);
    input.checked = value;
    input.addEventListener('change', async () => {
      try {
        await chrome.storage.sync.set({ [key]: input.checked });
        flash('Saved');
      } catch (e) {
        flash(`Couldn't save: ${e.message}`, false);
      }
    });
  }

  // Reflect changes made on another computer or in another tab.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    for (const key of Object.keys(OPTION_DEFAULTS)) {
      if (key in changes) {
        document.getElementById(key).checked = changes[key].newValue ?? OPTION_DEFAULTS[key];
      }
    }
  });
}

// --- Export / import ---

const FORMAT = 'fsp-schedule-filter';
const SETTINGS_DEFAULTS = {
  enabled: true,
  show: [],
  highlight: [],
  hide: [],
  ...OPTION_DEFAULTS,
};
const RULE_TYPES = ['aircraft', 'instructor', 'resource', 'any'];

async function exportSettings() {
  const settings = await chrome.storage.sync.get(SETTINGS_DEFAULTS);
  const file = {
    format: FORMAT,
    version: chrome.runtime.getManifest().version,
    exportedAt: new Date().toISOString(),
    settings,
  };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(file, null, 2) + '\n'], { type: 'application/json' })
  );
  const a = Object.assign(document.createElement('a'), {
    href: url,
    download: `fsp-schedule-filter-${new Date().toISOString().slice(0, 10)}.json`,
  });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  flash('Exported');
}

function cleanRules(list, kind) {
  // Very old exports stored "show only" as { aircraft: [names], instructor: [names] }.
  if (kind === 'show' && list && !Array.isArray(list) && typeof list === 'object') {
    list = Object.entries(list).flatMap(([type, names]) =>
      (Array.isArray(names) ? names : []).map((text) => ({ type, text }))
    );
  }
  if (!Array.isArray(list)) throw new Error(`"${kind}" should be a list of rules`);
  return list
    .filter((r) => r && typeof r.text === 'string')
    .map((r) => {
      const rule = { type: RULE_TYPES.includes(r.type) ? r.type : 'aircraft', text: r.text };
      if (kind === 'highlight') rule.color = /^#[0-9a-f]{6}$/i.test(r.color) ? r.color : '#ffd54f';
      return rule;
    });
}

// Accepts an exported file, or a bare settings object.
function parseImport(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("that file isn't valid JSON");
  }
  const s = data?.format === FORMAT ? data.settings : data;
  if (!s || typeof s !== 'object' || !['show', 'highlight', 'hide'].some((k) => k in s)) {
    throw new Error("that file doesn't contain FSP Schedule Filter settings");
  }
  return {
    enabled: typeof s.enabled === 'boolean' ? s.enabled : SETTINGS_DEFAULTS.enabled,
    useRegex: typeof s.useRegex === 'boolean' ? s.useRegex : SETTINGS_DEFAULTS.useRegex,
    show: cleanRules(s.show ?? [], 'show'),
    highlight: cleanRules(s.highlight ?? [], 'highlight'),
    hide: cleanRules(s.hide ?? [], 'hide'),
  };
}

async function importFile(file) {
  try {
    const settings = parseImport(await file.text());
    const counts = ['show', 'highlight', 'hide']
      .map((k) => `${settings[k].length} ${k === 'show' ? 'show only' : k}`)
      .join(', ');
    if (!confirm(`Replace your current settings with ${counts} rules from "${file.name}"?`)) return;
    await chrome.storage.sync.set(settings);
    flash(`Imported ${counts} rules`);
  } catch (e) {
    flash(`Couldn't import: ${e.message}`, false);
  }
}

const importInput = document.getElementById('import-file');
document.getElementById('export').addEventListener('click', () =>
  exportSettings().catch((e) => flash(`Couldn't export: ${e.message}`, false))
);
document.getElementById('import').addEventListener('click', () => importInput.click());
importInput.addEventListener('change', () => {
  const [file] = importInput.files;
  importInput.value = ''; // allow importing the same file again
  if (file) importFile(file);
});

init();
