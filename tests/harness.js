/* Test harness for the Robot2Clanker content script.
 *
 * Loads extension/content.js into a jsdom page with a stubbed WebExtension
 * API, then asserts the behaviour that broke in v2.2+.
 */

const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const CONTENT_SCRIPT = path.join(__dirname, "..", "extension", "content.js");
const SOURCE = fs.readFileSync(CONTENT_SCRIPT, "utf8");

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

/**
 * Boot a page with the content script running.
 * @param {string} html page markup
 * @param {string} mode starting mode
 */
async function boot(html = "", mode = "mode1", options = {}) {
  const dom = new JSDOM(html, {
    runScripts: "outside-only",
    url: "https://example.com/",
    pretendToBeVisual: true
  });
  const { window } = dom;

  const storage = { mode };
  const storageListeners = [];
  const messageListeners = [];

  window.browser = {
    storage: {
      local: {
        async get(key) {
          return typeof key === "string" ? { [key]: storage[key] } : { ...storage };
        },
        async set(values) {
          Object.assign(storage, values);
          const changes = {};
          for (const [key, newValue] of Object.entries(values)) {
            changes[key] = { oldValue: storage[key], newValue };
          }
          for (const listener of storageListeners) listener(changes, "local");
        }
      },
      onChanged: {
        addListener(fn) {
          storageListeners.push(fn);
        }
      }
    },
    runtime: {
      onMessage: {
        addListener(fn) {
          messageListeners.push(fn);
        }
      }
    }
  };

  if (options.raw !== true) {
    window.eval(SOURCE);

    /* init() is async: storage read -> apply -> observer. */
    await tick();
    await tick();
  }

  return {
    window,
    document: window.document,
    storage,
    async setMode(next) {
      await window.browser.storage.local.set({ mode: next });
      await tick();
    },
    sendMessage(message) {
      const results = messageListeners.map(fn => fn(message));
      return Promise.all(results);
    }
  };
}

module.exports = { boot, tick };
