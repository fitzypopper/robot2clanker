function updateButtons(currentMode) {
  document.getElementById("mode1").classList.toggle("active", currentMode === "mode1");
  document.getElementById("mode2").classList.toggle("active", currentMode === "mode2");
  document.getElementById("status").textContent =
    currentMode === "mode1" ? "Mode 1: Clanker" : "Mode 2: Clank’a";
}

chrome.storage.local.get("mode", (data) => {
  updateButtons(data.mode || "mode1");
});

document.getElementById("mode1").addEventListener("click", () => {
  chrome.storage.local.set({ mode: "mode1" }, () => updateButtons("mode1"));
});

document.getElementById("mode2").addEventListener("click", () => {
  chrome.storage.local.set({ mode: "mode2" }, () => updateButtons("mode2"));
});
