const test = require("node:test");
const assert = require("node:assert");
const { openPopup, click } = require("./popup-harness");

/* Values created inside the jsdom realm have a different Object.prototype,
 * so deepStrictEqual would trip over the prototype, not the content. */
const plain = value => JSON.parse(JSON.stringify(value));

test("shows mode 1 as active when nothing is stored", async () => {
  const { document } = await openPopup();

  assert.ok(document.getElementById("mode1").classList.contains("active"));
  assert.ok(!document.getElementById("mode2").classList.contains("active"));
  assert.match(document.getElementById("status").textContent, /Clanker/);
});

test("shows the stored mode as active", async () => {
  const { document } = await openPopup({ storage: { mode: "mode2" } });

  assert.ok(document.getElementById("mode2").classList.contains("active"));
  assert.ok(!document.getElementById("mode1").classList.contains("active"));
  assert.match(document.getElementById("status").textContent, /Clank'a/);
});

test("falls back to mode 1 for an unknown stored mode", async () => {
  const { document } = await openPopup({ storage: { mode: "nonsense" } });

  assert.ok(document.getElementById("mode1").classList.contains("active"));
});

test("clicking mode 2 saves the mode and updates the buttons", async () => {
  const { window, document, storage, calls } = await openPopup();

  click(window, document.getElementById("mode2"));
  await new Promise(resolve => setTimeout(resolve, 20));

  assert.deepStrictEqual(plain(calls.set), [{ mode: "mode2" }]);
  assert.strictEqual(storage.mode, "mode2");
  assert.ok(document.getElementById("mode2").classList.contains("active"));
  assert.ok(!document.getElementById("mode1").classList.contains("active"));
});

test("clicking mode 1 saves the mode and updates the buttons", async () => {
  const { window, document, storage } = await openPopup({ storage: { mode: "mode2" } });

  click(window, document.getElementById("mode1"));
  await new Promise(resolve => setTimeout(resolve, 20));

  assert.strictEqual(storage.mode, "mode1");
  assert.ok(document.getElementById("mode1").classList.contains("active"));
});

test("re-apply asks the active tab to rescan", async () => {
  const { window, document, calls } = await openPopup({
    tabs: [{ id: 42 }],
    sendMessageResult: { ok: true }
  });

  click(window, document.getElementById("rescan"));
  await new Promise(resolve => setTimeout(resolve, 20));

  assert.deepStrictEqual(plain(calls.query), [{ active: true, currentWindow: true }]);
  assert.deepStrictEqual(plain(calls.sendMessage), [
    { tabId: 42, message: { type: "robot2clanker:rescan" } }
  ]);
  assert.match(document.getElementById("status").textContent, /Re-applied/);
});

test("re-apply explains itself when the page cannot be reached", async () => {
  const { window, document } = await openPopup({
    tabs: [{ id: 42 }],
    sendMessageThrows: true
  });

  click(window, document.getElementById("rescan"));
  await new Promise(resolve => setTimeout(resolve, 20));

  assert.match(document.getElementById("status").textContent, /Reload/);
});

test("re-apply explains itself when there is no tab", async () => {
  const { window, document } = await openPopup({ tabs: [] });

  click(window, document.getElementById("rescan"));
  await new Promise(resolve => setTimeout(resolve, 20));

  assert.match(document.getElementById("status").textContent, /Reload/);
});

test("the popup markup exposes both modes and a status region", async () => {
  const { document } = await openPopup();

  assert.ok(document.getElementById("mode1"));
  assert.ok(document.getElementById("mode2"));
  assert.ok(document.getElementById("rescan"));
  assert.strictEqual(document.getElementById("status").getAttribute("role"), "status");
});
