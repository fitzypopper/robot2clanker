# History

## 2026-11 - Source recovered, extension rebuilt as 3.0.0

### What was lost

The Firefox source was never committed to git. The GitHub account it pointed at
(`Hangry-Studios`) was renamed to `fitzypopper`, and the Firefox build was
never pushed to the renamed repository — only a Chrome build and a landing
page were.

### How it was recovered

Nothing was lost permanently. Three independent sources were enough to
rebuild the extension byte-for-byte and then fix it:

1. **The published XPIs.** addons.mozilla.org still serves every published
   version. All four were downloaded and their SHA-256 hashes verified
   against the API:

   | Version | File id | Size |
   |---------|---------|------|
   | 2.1 | 4600889 | 11928 |
   | 2.2 | 4620271 | 12001 |
   | 2.2.1 | 4620275 | 11865 |
   | 2.3 | 4620282 | 12199 |

   The 2.3 hash matched AMO's published `sha256` exactly, which proves the
   downloaded artefact is the one that was reviewed and signed.

2. **The Chrome build.** `Hangry-studios/chromium.zip` in the repository
   still contained a working `content.js`, including the DOM text walker that
   had vanished from the Firefox build.

3. **Diffing the four versions against each other**, which is what pinned down
   the exact commit that broke the extension.

All of it is kept under `recovered/` in this repository.

### Root cause

The **2.1 → 2.2 migration from Manifest V2 to Manifest V3** dropped three
things from `manifest.json` and deleted the core feature from `content.js`.

| | v2.1 (MV2, worked) | v2.2+ (MV3, broken) |
|---|---|---|
| `storage` permission | present | **dropped** |
| `browser_action` (toolbar button) | present | **dropped** |
| `icons` | present | **dropped** |
| page text rewritten | yes | **no** |
| mode read from storage | yes | **no** |

The consequences were:

* **No toolbar button at all.** `popup.html` and `popup.js` were still in the
  package but nothing referenced them, so the popup was unreachable.
* **The popup could not have worked anyway.** Without the `storage`
  permission, `browser.storage.local.get()` / `.set()` throw, and the popup
  does nothing but read and write storage.
* **The advertised feature was gone.** v2.1 walked the DOM and rewrote page
  text. v2.2 replaced that with a handler that only fired on `input` events
  in form fields, so the extension no longer touched normal page text — while
  the listing still advertised *"replaces the word 'robot' … on all
  websites"*.
* **The mode toggle did nothing.** From v2.2 onwards the replacement table
  was hard-coded, so Mode 1 and Mode 2 produced identical results.

v2.2.1 and v2.3 were clean-ups on top of the broken v2.2 (v2.3 added a
debounce and a fast-path check), so the regression persisted to the end.

### Everything fixed in 3.0.0

**Manifest**

* Restored the toolbar button (`action` → `popup.html`).
* Restored the `storage` permission.
* Restored `icons`, and added a 128px icon.
* Replaced the unused `activeTab` and `scripting` permissions with the
  `storage` permission that is actually needed, plus a `<all_urls>` host
  permission.
* Pointed `homepage_url` at the renamed account
  (`fitzypopper/robot2clanker`); the old URL 404s.
* Declared `data_collection_permissions: { required: ["none"] }`, which AMO
  now expects on new submissions.
* Enabled `all_frames` so embedded frames are rewritten too.

**Content script**

* Page text is rewritten again, using a `TreeWalker` instead of the old
  recursive walk.
* The mode is read from storage and reacts to `storage.onChanged`, so
  switching modes updates open pages immediately.
* Mode changes re-map the page from the *original* wording rather than
  re-replacing the already-replaced text. Each text node remembers its
  original text in a `WeakMap`.
* `Robot`, `Robots` and `ROBOTS` are now matched. v2.3 only handled
  `robot` and `ROBOT`, so the capitalised singular was never replaced.
* `contenteditable` regions are rewritten node by node instead of via
  `el.innerText = text`, which used to **delete every child element** and
  all formatting.
* The caret is tracked exactly, including when it sits in the middle of the
  word being replaced.
* Text injected by scripts is rewritten too (character-level mutations were
  previously ignored).
* `<script>`, `<style>`, `<noscript>` and form widgets are skipped, and
  `data-clanker-skip` opts an element out.
* Added `data-clanker-skip` as an escape hatch.
* The rewrite is idempotent, so the `MutationObserver` cannot spin.

**Popup**

* Rewritten with working mode buttons, a status line, keyboard focus
  styling, dark-mode support and a **Re-apply to this page** button for tabs
  that were already open when the extension was installed.

**Tests**

Added 27 tests that did not exist before:

* `tests/content.test.js` — 16 jsdom tests
* `tests/popup.test.js` — 8 jsdom tests
* `tests/e2e.test.js` — 3 tests in a real Firefox 160, installing the built
  XPI into a throwaway profile

---

## Older versions

| Version | Date | State |
|---------|------|-------|
| 2.1 | 2025-10 | Last working version. Manifest V2, page text rewritten, popup worked. |
| 2.2 | 2025-10 | MV3 migration. Toolbar button, storage permission, icons and page-text rewriting all lost. |
| 2.2.1 | 2025-10 | Cleanup of v2.2. Still broken. |
| 2.3 | 2025-11 | Added debounce + fast-path check. Still broken. |
| 3.0.0 | 2026-11 | This rebuild. Fixes everything above. |
