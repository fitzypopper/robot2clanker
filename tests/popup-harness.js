/* Test harness for the Robot2Clanker popup.
 *
 * The popup is an extension page, and Marionette refuses to navigate to
 * moz-extension:// URLs, so it is driven here in jsdom with a stubbed
 * WebExtension API.
 */

const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const POPUP_HTML = path.join(ROOT, "extension", "popup.html");

/**
 * Open popup.html with a stubbed browser API.
 * @returns {Promise<{window: Window, document: Document, storage: object, calls: object}>}
 */
async function openPopup(options = {}) {
  const storage = options.storage || {};
  const calls = { set: [], query: [], sendMessage: [] };

  const dom = await JSDOM.fromFile(POPUP_HTML, {
    runScripts: "dangerously",
    resources: "usable",
    beforeParse(window) {
      window.browser = {
        storage: {
          local: {
            async get(key) {
              return typeof key === "string" ? { [key]: storage[key] } : { ...storage };
            },
            async set(values) {
              calls.set.push(values);
              Object.assign(storage, values);
            }
          }
        },
        tabs: {
          async query(info) {
            calls.query.push(info);
            return options.tabs || [];
          },
          async sendMessage(tabId, message) {
            calls.sendMessage.push({ tabId, message });
            if (options.sendMessageThrows) throw new Error("no receiver");
            return options.sendMessageResult;
          }
        }
      };
    }
  });

  await new Promise(resolve => {
    if (dom.window.document.readyState === "complete") return resolve();
    dom.window.addEventListener("load", resolve);
  });
  /* popup.js finishes its async init on the next microtask turn. */
  await new Promise(resolve => setTimeout(resolve, 20));

  return { window: dom.window, document: dom.window.document, storage, calls };
}

function click(window, element) {
  element.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
}

module.exports = { openPopup, click };
