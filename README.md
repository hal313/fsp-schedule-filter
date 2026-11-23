# FSP Schedule Filter

A Chrome extension that hides and highlights rows on the
[Flight Schedule Pro](https://app.flightschedulepro.com/App/Schedule) schedule.

- **Show only** aircraft, instructor or resource rows whose name contains some text (e.g. `N816`,
  `Kruger`). Each type is independent: show-only rules for aircraft leave all instructors and
  resources visible, and a type with no show-only rules shows everything. An "Any" rule restricts
  every type. A row that matches a show-only rule is always shown, even if a hide rule matches it.
- **Hide** aircraft, instructor or resource rows whose name contains some text (e.g. `N816`,
  `Ground Only`, `iPad`).
- **Highlight** aircraft, instructor or resource rows with a color of your choice (e.g. `Kruger`
  in green).

Aircraft rules match the tail number (`N904RA`) or the aircraft type (`Cessna Skyhawk 172M`),
so `172M` picks out every 172M on the schedule.

Rules are case-insensitive "contains" matches (or regular expressions, see [Options](#options))
and sync across your Chrome profile.

### Syncing

Rules and options are stored in `chrome.storage.sync`, so they follow you to any computer signed
in to the same Chrome profile (with **Extensions** turned on under Chrome's sync settings).
Changes show up live in open schedule tabs, the popup and the options page. Sync limits each list
of rules to about 8 KB; the popup says so if a save is refused.

## Options

Open the options page from the ⚙ button in the popup (or **Extension options** in
`chrome://extensions`).

- **Use regular expressions in filters** (off by default): rule text is treated as a
  case-insensitive JavaScript regular expression, e.g. `^N8\d\d` or `Kruger|Smith`. A rule with
  an invalid expression matches nothing and is outlined in red in the popup.

## Install (unpacked)

1. Go to `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and choose this folder.
3. Reload the Flight Schedule Pro schedule page.
4. Click the extension icon to add rules. Name fields autocomplete from the rows on the page.

## How it works

The schedule grid is a [Bryntum Scheduler](https://bryntum.com/products/scheduler/) (v6.3).

- `src/page.js` runs in the page's main world so it can reach the scheduler instance
  (`bryntum.query('scheduler')`).
  - **Show only** and **Hide** share one filter (`fsp-ext-hide`) to the scheduler's `resourceStore`, so rows collapse
    cleanly instead of leaving gaps, and work with the grid's row virtualization.
  - **Highlight** writes a stylesheet keyed on each row's `data-id`, which colors both the name
    column and the timeline row.
  - Row type comes from `resourceTypeId`: `1` = aircraft, `2` = instructor, anything else =
    resource (iPads, ADS-B receivers…).
  - Aircraft type is `aircraftMake` + `aircraftModel` (e.g. `Cessna Skyhawk` + `172M`).
  - A watchdog re-applies rules every 1.5 s in case the app rebuilds the scheduler or reloads
    its data (changing dates or views).
- `src/content.js` is the bridge: it reads rules from `chrome.storage.sync`, posts them to the
  page script and answers the popup.
- `popup/` is the rule editor.
- `options/` is the options page.
- `styles/` holds the Tailwind source (`input.css`, including the `.switch` checkbox style) and the
  built `ui.css` that both the popup and options page use.

## Development

The popup and options page use [Tailwind CSS](https://tailwindcss.com/) via the CLI (extensions
can't load it from a CDN). The built `styles/ui.css` is committed, so the extension works without a
build step. After changing classes in `popup/` or `options/`, rebuild it:

```sh
npm install
npm run build:css   # or: npm run watch:css
```

## Layout

```
manifest.json
src/page.js       # MAIN world, talks to Bryntum
src/content.js    # isolated world, storage + messaging bridge
popup/            # rule editor UI
options/          # options page
styles/           # Tailwind source (input.css) and built ui.css
```
