const replacements = [
  { pattern: /\bROBOT\b/g, replace: "CLANKER" },
  { pattern: /\brobot\b/g, replace: "clanker" },
  { pattern: /\bROBOTS\b/g, replace: "CLANK'A" },
  { pattern: /\brobots\b/g, replace: "clank'a" }
];

// Debounce-funktion för att minska onödiga anrop
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// Replacerar text i input/textarea
function replaceInInput(el) {
  if (!/\brobot\b/i.test(el.value)) return; // snabbkontroll

  const start = el.selectionStart;
  let value = el.value;

  replacements.forEach(r => {
    value = value.replace(r.pattern, r.replace);
  });

  el.value = value;
  el.setSelectionRange(start, start);
}

// Replacerar text i contenteditable
function replaceInContentEditable(el) {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;

  const range = selection.getRangeAt(0);
  const startOffset = range.startOffset;

  if (!/\brobot\b/i.test(el.innerText)) return; // snabbkontroll

  let text = el.innerText;
  replacements.forEach(r => {
    text = text.replace(r.pattern, r.replace);
  });
  el.innerText = text;

  const newRange = document.createRange();
  newRange.setStart(el.firstChild || el, Math.min(startOffset, text.length));
  newRange.collapse(true);
  selection.removeAllRanges();
  selection.addRange(newRange);
}

// Lägg till listener på ett element
function attachListener(el) {
  if (el._clankerAttached) return; // redan fäst
  el._clankerAttached = true;

  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
    el.addEventListener("input", debounce(() => replaceInInput(el), 20));
  } else if (el.isContentEditable) {
    el.addEventListener("input", debounce(() => replaceInContentEditable(el), 20));
  }
}

// Kör på alla existerande element
document.querySelectorAll("input[type=text], textarea, [contenteditable=true]").forEach(attachListener);

// Observera DOM för nya element
const observer = new MutationObserver(mutations => {
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (node.nodeType !== 1) continue; // bara element
      if (node.matches && (node.matches("input[type=text], textarea, [contenteditable=true]"))) {
        attachListener(node);
      } else if (node.querySelectorAll) {
        node.querySelectorAll("input[type=text], textarea, [contenteditable=true]").forEach(attachListener);
      }
    }
  }
});
observer.observe(document.body, { childList: true, subtree: true });
