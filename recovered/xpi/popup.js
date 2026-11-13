function setMode(mode) {
    browser.storage.local.set({ mode });
    updateButtons(mode);
}

function updateButtons(activeMode) {
    document.querySelectorAll("button").forEach(btn => {
        btn.classList.toggle("active", btn.id === activeMode);
    });
}

document.getElementById("mode1").addEventListener("click", () => setMode("mode1"));
document.getElementById("mode2").addEventListener("click", () => setMode("mode2"));

browser.storage.local.get("mode", (data) => {
    updateButtons(data.mode || "mode1");
});
