# Robot2Clanker

A Firefox extension that rewrites the word **robot** into **clanker** (or
**clank'a**) as you browse — in page text, in form fields and in
contenteditable regions.

Version 3.0.0 · Manifest V3 · Firefox 109+

---

## What it does

| Mode | "robot" | "Robot" | "ROBOT" | "robots" |
|------|---------|---------|---------|----------|
| **1 — Clanker** | clanker | Clanker | CLANKER | clankers |
| **2 — Clank'a** | clank'a | Clank'a | CLANK'A | clank'as |

* Whole words only — `robotics` and `Robotnik` are left alone.
* Page text is rewritten as it loads, and again for anything a page injects
  later (SPA routing, infinite scroll, lazy-loaded comments).
* Form fields are rewritten as you type, and the caret stays exactly where
  you left it.
* `contenteditable` regions are rewritten without destroying their markup, so
  bold text stays bold.
* Switching mode re-maps the page live: the original wording is restored
  first, so `robot → clanker → clank'a` works in either direction.
* Nothing leaves your machine. No network calls, no telemetry, no storage
  beyond your chosen mode.

### Escape hatch

Add `data-clanker-skip` to any element to leave it untouched:

```html
<p data-clanker-skip>this stays a robot</p>
```

---

## Layout

```
extension/          the extension itself - this is what ships
  manifest.json
  content.js        page text, form fields, contenteditable
  popup.html        toolbar popup
  popup.js
  icons/
tests/              test suite (jsdom + real Firefox)
tools/geckodriver   binary used by the end-to-end test (not in git)
dist/               built XPIs (not in git)
build.sh            packages extension/ into dist/
```

---

## Build

```bash
./build.sh
# -> dist/Robot2Clanker-3.0.0.xpi
```

The XPI is deliberately **unsigned**: addons.mozilla.org signs public
listings itself, and `about:debugging` can load an unsigned XPI directly.

## Install it temporarily (no signing needed)

1. Open `about:debugging#/runtime/this-firefox`
2. **Load Temporary Add-on…**
3. Pick `dist/Robot2Clanker-3.0.0.xpi`

## Publish to addons.mozilla.org

1. Sign in at <https://addons.mozilla.org/developers/addon/robot2clanker/editor>
2. **Upload a new version** → upload `dist/Robot2Clanker-3.0.0.xpi`
3. Fill in the release notes and submit for review.

The extension keeps its existing add-on id, `{28ec577e-0774-4134-947a-dd2cc17594e2}`,
so it updates in place for everyone who already has it.

> **Note:** the listing's *homepage* still points at
> `https://github.com/Hangry-Studios`, which 404s since that account was
> renamed to `fitzypopper`. Update it to
> `https://github.com/fitzypopper/robot2clanker` in the listing editor.

---

## Test

```bash
npm install
npm test
```

27 tests:

* `tests/content.test.js` — the content script, in jsdom
* `tests/popup.test.js` — the toolbar popup, in jsdom
* `tests/e2e.test.js` — **a real Firefox**, via geckodriver

The end-to-end test installs the built XPI into a throwaway profile, loads a
page and asserts the text really is rewritten, that the caret survives and
that the mode comes from extension storage.

The end-to-end test needs `geckodriver`:

```bash
./tools/fetch-geckodriver.sh
```

If it is missing the test skips itself rather than failing.

### Lint

```bash
npx web-ext lint --source-dir extension
```

---

## Permissions

| Permission | Why |
|------------|-----|
| `storage` | remembers which mode you picked |
| `<all_urls>` (host) | rewrites text on the pages you visit |

Nothing else. The extension has no background script and makes no network
requests.

---

## Chrome version

The Chrome/Chromium build lives in the `Hangry-studios` repository as
`chromium.zip`. It is a separate implementation and still carries the older
behaviour, so it is worth porting the same fixes across.

---

See [HISTORY.md](HISTORY.md) for how this source was recovered and exactly
what was broken.
