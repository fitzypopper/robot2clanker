/* Robot2Clanker - toolbar popup
 *
 * Picks the replacement mode and writes it to extension storage. The content
 * script listens for storage changes and re-maps the page immediately.
 */

const MODES = ["mode1", "mode2"];

const statusEl = document.getElementById("status");

function setActive(mode) {
  document.querySelectorAll("button.mode").forEach(button => {
    const active = button.id === mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  statusEl.textContent = mode === "mode2" ? "Mode 2 - Clank'a active" : "Mode 1 - Clanker active";
}

async function readMode() {
  try {
    const data = await browser.storage.local.get("mode");
    return MODES.includes(data.mode) ? data.mode : "mode1";
  } catch (err) {
    return "mode1";
  }
}

async function writeMode(mode) {
  try {
    await browser.storage.local.set({ mode });
    setActive(mode);
  } catch (err) {
    statusEl.textContent = "Could not save the mode.";
  }
}

async function rescanPage() {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab || typeof tab.id !== "number") throw new Error("no active tab");
    await browser.tabs.sendMessage(tab.id, { type: "robot2clanker:rescan" });
    statusEl.textContent = "Re-applied to this page.";
  } catch (err) {
    statusEl.textContent = "Reload this tab to pick up the new wording.";
  }
}

document.getElementById("mode1").addEventListener("click", () => writeMode("mode1"));
document.getElementById("mode2").addEventListener("click", () => writeMode("mode2"));
document.getElementById("rescan").addEventListener("click", rescanPage);

(async () => {
  setActive(await readMode());
})();
