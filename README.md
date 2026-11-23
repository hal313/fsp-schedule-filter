# FSP Schedule Filter

A Chrome extension that hides and highlights rows on the
[Flight Schedule Pro](https://app.flightschedulepro.com/App/Schedule) schedule.

- **Hide** aircraft or instructor rows whose name contains some text (e.g. `N816`, `Ground Only`).
- **Highlight** aircraft or instructor rows with a color of your choice (e.g. `Kruger` in green).

Rules are case-insensitive "contains" matches and sync across your Chrome profile.

## Install (unpacked)

1. Go to `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and choose this folder.
3. Reload the Flight Schedule Pro schedule page.
4. Click the extension icon to add rules. Name fields autocomplete from the rows on the page.

## How it works

The schedule grid is a [Bryntum Scheduler](https://bryntum.com/products/scheduler/) (v6.3).

- `src/page.js` runs in the page's main world so it can reach the scheduler instance
  (`bryntum.query('scheduler')`).
  - **Hide** adds a filter (`fsp-ext-hide`) to the scheduler's `resourceStore`, so rows collapse
    cleanly instead of leaving gaps, and work with the grid's row virtualization.
  - **Highlight** writes a stylesheet keyed on each row's `data-id`, which colors both the name
    column and the timeline row.
  - Row type comes from `resourceTypeId`: `1` = aircraft, `2` = instructor.
  - A watchdog re-applies rules every 1.5 s in case the app rebuilds the scheduler or reloads
    its data (changing dates or views).
- `src/content.js` is the bridge: it reads rules from `chrome.storage.sync`, posts them to the
  page script and answers the popup.
- `popup/` is the rule editor.

## Layout

```
manifest.json
src/page.js       # MAIN world, talks to Bryntum
src/content.js    # isolated world, storage + messaging bridge
popup/            # rule editor UI
```
