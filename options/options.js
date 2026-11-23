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

init();
