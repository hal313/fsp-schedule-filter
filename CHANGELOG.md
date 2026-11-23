# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **Export / Import** on the options page: save all rules and options to a JSON file, or load
  them from one.

### Fixed

- Settings now sync between computers. The extension has a fixed ID (set by a `key` in the
  manifest); before, an unpacked copy got an ID from its folder, so each computer had its own
  separate settings. The ID changes once with this update: export your settings before updating,
  then import them afterwards.

## [1.1.0] - 2026-11-23

### Changed

- Aircraft rules are tested against the row name and aircraft type as one text
  (`N904RA Cessna Skyhawk 172M`) instead of each separately, so a single regular expression can
  combine them, e.g. `^(?!.*redbird).*172` for every 172 except a Redbird. To match one tail
  exactly, use `^N904RA\b` instead of `^N904RA$`.

## [1.0.0] - 2026-11-23

### Added

- Hide and highlight rows on the Flight Schedule Pro schedule, using a filter on the schedule
  grid so hidden rows collapse without gaps.
- **Show only** rules: show just the aircraft, instructor or resource rows that match. Each type
  is restricted independently, and a show-only match wins over a hide rule.
- **Resource** rule type for rows that aren't aircraft or instructors (iPads, ADS-B receivers…),
  and an **Any** type that applies to every row type.
- Aircraft rules match the tail number (`N904RA`) or the aircraft type from its make and model
  (`Cessna Skyhawk 172M`). Name suggestions in the popup include both.
- Options page, opened from the ⚙ button in the popup, with **Use regular expressions in
  filters** (off by default). Invalid expressions are outlined in red in the popup.
- Rules and options sync across computers signed in to the same Chrome profile, and update live
  in open schedule tabs, the popup and the options page.

### Changed

- **Show only** uses text rules like Hide and Highlight instead of checklists of names. Names
  checked in the old lists are converted to rules automatically.
- Popup and options page are styled with Tailwind CSS; checkboxes appear as switches.
- Popup sections are ordered Show only, Highlight, Hide.

### Fixed

- Popup keeps its status line and name suggestions up to date while open, instead of checking the
  schedule only once.
- Rule edits made just before closing the popup are no longer lost, and saving no longer
  overwrites rules that synced in from another computer.
