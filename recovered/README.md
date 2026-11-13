# Recovered artefacts

Everything here was recovered on 2026-11-13 after the original source was
lost. It is kept as reference material, not as the shipping source — that
lives in [`../extension/`](../extension).

## The published Firefox builds

Downloaded from addons.mozilla.org and verified against the SHA-256 hashes
the AMO API publishes for each file.

| File | Version | SHA-256 |
|------|---------|---------|
| `robot2clanker-2.1.xpi` | 2.1 | `94a8a53f5e47058888879ed944cfddc678b3229b21a6b5d098ec0fb5f467714e` |
| `robot2clanker-2.2.xpi` | 2.2 | `03b9fbe9162b7223b0013e82446ef0230ebbe301e8b23396d087037805998fc4` |
| `robot2clanker-2.2.1.xpi` | 2.2.1 | `092cb482f2472040911ce208a55d6b58901606033ccf5f82c6e3f75d4207e90c` |
| `robot2clanker-2.3.xpi` | 2.3 | `035a263c9ad0940863a667713adf20f52c00b63478dddfb66dbefaa9dbb8259c` |

The 2.3 hash matches the `sha256` published in the AMO API response exactly,
which proves the downloaded file is the one that was reviewed and signed.

### What's inside them

`xpi/` is the unpacked 2.3 build — the version that was live on the add-on
listing.

The four versions differ only in `manifest.json` and `content.js`:

* **2.1** — Manifest V2. Has `storage`, `browser_action` and `icons`, and
  `content.js` walks the DOM and rewrites page text. This is the last
  version that actually worked.
* **2.2** — the Manifest V3 migration. `storage`, `browser_action` and
  `icons` all disappear, and the DOM walker is replaced by an `input` event
  handler. Page text is no longer rewritten at all.
* **2.2.1** — tidies up v2.2's leftover `Alt+M` keyboard shortcut. Still
  broken.
* **2.3** — adds a 20 ms debounce and a fast-path regex check. Still broken.

Unpack any of them with:

```bash
unzip -o robot2clanker-2.3.xpi -d some/where
```

## The Chrome build

`chromium/` was unpacked from `chromium.zip` in the `Hangry-studios`
repository. It is a working implementation and still contains the DOM text
walker that the Firefox build lost in v2.2 — which is how the broken feature
was identified in the first place.

It is on version 1.0 and has not received the fixes in this repository, so it
is worth porting them across.

## Signing metadata

The XPIs contain a `META-INF/` directory with Mozilla's signature
(`mozilla.rsa`, `mozilla.sf`) and the newer COSE signature (`cose.sig`).
Those are valid only for the exact files they were issued against and are
irrelevant to the rebuild — AMO re-signs every upload.
