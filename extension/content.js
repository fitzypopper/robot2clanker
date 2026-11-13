/* Robot2Clanker - content script
 *
 * Rewrites the word "robot" into "clanker" / "clank'a" in:
 *   - static page text (text nodes)
 *   - <input> and <textarea> values
 *   - contenteditable regions
 *
 * The replacement table is picked from extension storage ("mode") and can be
 * switched live from the toolbar popup. When the mode changes we re-apply the
 * rules to the whole page, restoring the *original* wording first, so that
 * "robot" -> "clanker" -> "clank'a" does not leave the page stuck halfway.
 *
 * Opt-out: add data-clanker-skip to any element to leave it untouched.
 */

const MODE_RULES = {
  mode1: [
    { re: /\brobot\b/g, to: "clanker" },
    { re: /\bRobot\b/g, to: "Clanker" },
    { re: /\bROBOT\b/g, to: "CLANKER" },
    { re: /\brobots\b/g, to: "clankers" },
    { re: /\bRobots\b/g, to: "Clankers" },
    { re: /\bROBOTS\b/g, to: "CLANKERS" }
  ],
  mode2: [
    { re: /\brobot\b/g, to: "clank'a" },
    { re: /\bRobot\b/g, to: "Clank'a" },
    { re: /\bROBOT\b/g, to: "CLANK'A" },
    { re: /\brobots\b/g, to: "clank'as" },
    { re: /\bRobots\b/g, to: "Clank'as" },
    { re: /\bROBOTS\b/g, to: "CLANK'AS" }
  ]
};

const DEFAULT_MODE = "mode1";

/* Fast bail-out: does this chunk contain a standalone "robot"/"robots"? */
const ROBOT_RE = /\brobots?\b/i;

/* Elements whose text content is never user-visible page copy. */
const SKIP_TAGS = new Set([
  "SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "IFRAME", "FRAME", "FRAMESET",
  "OBJECT", "EMBED", "CANVAS", "SVG", "MATH", "HEAD", "TITLE",
  "INPUT", "TEXTAREA", "SELECT", "OPTION", "OPTGROUP", "DATALIST",
  "AUDIO", "VIDEO", "SOURCE", "TRACK"
]);

/* <input> types whose value is plain text we should rewrite. */
const TEXT_INPUT_TYPES = new Set(["text", "search", "email", "url", "tel"]);

let currentMode = DEFAULT_MODE;

/* Text node -> { original, applied }
 * `original` is the text as the page author wrote it, `applied` is what we
 * currently show. Keeping both lets us re-map between modes without needing
 * to undo the replacement by string matching. */
const nodeState = new WeakMap();

function rules() {
  return MODE_RULES[currentMode] || MODE_RULES[DEFAULT_MODE];
}

function applyRules(text, ruleList) {
  let out = text;
  for (const rule of ruleList) out = out.replace(rule.re, rule.to);
  return out;
}

/* Apply a single rule while tracking where a source offset ends up.
 * The caret can sit in the middle of the word being replaced, so a plain
 * "transform the prefix" trick is not accurate enough. */
function applyRuleWithOffset(text, offset, rule) {
  const re = new RegExp(rule.re.source, rule.re.flags);
  let out = "";
  let last = 0;
  let newOffset = null;

  let match;
  while ((match = re.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;

    const sliceStart = out.length;
    out += text.slice(last, start);
    if (newOffset === null && offset <= start) {
      newOffset = sliceStart + (offset - last);
    }

    const replacementStart = out.length;
    out += rule.to;
    if (newOffset === null && offset < end) {
      /* Caret was inside the replaced word - land it after the replacement. */
      newOffset = replacementStart + rule.to.length;
    }

    last = end;
    if (match[0].length === 0) re.lastIndex++;
  }

  const tailStart = out.length;
  out += text.slice(last);
  if (newOffset === null) {
    newOffset = tailStart + (offset - last);
  }

  return { text: out, offset: newOffset };
}

/* Replace every rule and report the new text plus the mapped offset. */
function transformWithOffset(text, offset, ruleList) {
  let currentText = text;
  let currentOffset = offset;
  for (const rule of ruleList) {
    const result = applyRuleWithOffset(currentText, currentOffset, rule);
    currentText = result.text;
    currentOffset = result.offset;
  }
  return { text: currentText, offset: currentOffset };
}

/* Rewrite one text node. Returns true when the DOM was actually changed. */
function applyToTextNode(node, ruleList) {
  const current = node.nodeValue;
  if (!current) return false;

  const state = nodeState.get(node);
  /* If the page has not touched the node since we last rewrote it, we know
   * the true original text and can re-map it into the new mode. */
  const source = state && state.applied === current ? state.original : current;

  if (!ROBOT_RE.test(source)) {
    nodeState.set(node, { original: source, applied: source });
    return false;
  }

  const next = applyRules(source, ruleList);
  nodeState.set(node, { original: source, applied: next });
  if (next === current) return false;

  node.nodeValue = next;
  return true;
}

/* Collect every visible text node under `root`. */
function collectTextNodes(root) {
  const out = [];
  if (!root) return out;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (parent.closest("[data-clanker-skip]")) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  let node;
  while ((node = walker.nextNode())) out.push(node);
  return out;
}

/* Rewrite the whole document with the current mode. */
function applyModeToDocument() {
  const ruleList = rules();
  for (const node of collectTextNodes(document.body)) {
    applyToTextNode(node, ruleList);
  }
}

/* Rewrite a freshly inserted subtree (SPA routing, lazy loading, ...). */
function applyToSubtree(root) {
  const ruleList = rules();
  if (!root) return;
  if (root.nodeType === Node.TEXT_NODE) {
    applyToTextNode(root, ruleList);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  for (const node of collectTextNodes(root)) applyToTextNode(node, ruleList);
}

function isTextField(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
  if (el.tagName === "TEXTAREA") return true;
  if (el.tagName !== "INPUT") return false;
  return TEXT_INPUT_TYPES.has(String(el.type || "text").toLowerCase());
}

/* Is this element an editable host?
 * `isContentEditable` is the authoritative answer but it is not implemented
 * everywhere, so fall back to the attribute value. */
function isEditableHost(el) {
  if (!el) return false;
  const attr = String(el.getAttribute("contenteditable") || "").toLowerCase();
  if (attr === "false") return false;
  if (typeof el.isContentEditable === "boolean") return el.isContentEditable;
  return attr === "true" || attr === "" || attr === "plaintext-only";
}

function findEditable(target) {
  if (!target) return null;
  let el = target.nodeType === Node.ELEMENT_NODE ? target : target.parentElement;
  if (!el || !el.closest) return null;
  const host = el.closest("[contenteditable]");
  return isEditableHost(host) ? host : null;
}

/* --- input / textarea ------------------------------------------------- */

function handleTextField(el) {
  const value = el.value;
  if (!value || !ROBOT_RE.test(value)) return;

  const ruleList = rules();
  const next = applyRules(value, ruleList);
  if (next === value) return;

  const start = el.selectionStart;
  const end = el.selectionEnd;
  const newStart = typeof start === "number" ? transformWithOffset(value, start, ruleList).offset : null;
  const newEnd = typeof end === "number" ? transformWithOffset(value, end, ruleList).offset : null;

  el.value = next;

  if (newStart !== null && typeof el.setSelectionRange === "function") {
    try {
      el.setSelectionRange(newStart, newEnd === null ? newStart : newEnd);
    } catch (err) {
      /* Some input types (email, number) refuse selection APIs. */
    }
  }
}

/* --- contenteditable -------------------------------------------------- */

function handleEditable(el) {
  const selection = window.getSelection();
  let anchor = null;
  let anchorOffset = 0;

  if (selection && selection.rangeCount) {
    const range = selection.getRangeAt(0);
    const container = range.startContainer;
    if (container.nodeType === Node.TEXT_NODE) {
      anchor = container;
      anchorOffset = range.startOffset;
    } else if (container.nodeType === Node.ELEMENT_NODE) {
      const child = container.childNodes[range.startOffset];
      if (child && child.nodeType === Node.TEXT_NODE) {
        anchor = child;
        anchorOffset = 0;
      }
    }
  }

  /* Snapshot the caret's text before we rewrite it, so the offset can be
   * mapped onto the new (longer or shorter) text afterwards. */
  const anchorBefore = anchor ? anchor.nodeValue : null;

  const ruleList = rules();
  let changed = false;
  for (const node of collectTextNodes(el)) {
    if (applyToTextNode(node, ruleList)) changed = true;
  }
  if (!changed) return;

  /* Put the caret back where the user left it, shifted by however much the
   * text in front of it grew or shrank. */
  if (anchor && anchor.parentNode && selection && anchorBefore !== null) {
    const newOffset = transformWithOffset(anchorBefore, anchorOffset, ruleList).offset;
    try {
      const range = document.createRange();
      range.setStart(anchor, Math.min(newOffset, anchor.nodeValue.length));
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    } catch (err) {
      /* Selection could not be restored - not fatal. */
    }
  }
}

/* --- wiring ----------------------------------------------------------- */

document.addEventListener(
  "input",
  event => {
    const target = event.target;
    if (isTextField(target)) {
      handleTextField(target);
      return;
    }
    const editable = findEditable(target);
    if (editable) handleEditable(editable);
  },
  true
);

function startObserver() {
  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        for (const node of mutation.addedNodes) applyToSubtree(node);
      } else if (mutation.type === "characterData") {
        applyToTextNode(mutation.target, rules());
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

async function init() {
  try {
    const data = await browser.storage.local.get("mode");
    if (data && data.mode && MODE_RULES[data.mode]) currentMode = data.mode;
  } catch (err) {
    /* Storage unavailable - fall back to the default mode. */
  }

  applyModeToDocument();
  startObserver();

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.mode) return;
    const next = changes.mode.newValue;
    if (!MODE_RULES[next] || next === currentMode) return;
    currentMode = next;
    applyModeToDocument();
  });
}

browser.runtime.onMessage.addListener(message => {
  if (message && message.type === "robot2clanker:rescan") {
    applyModeToDocument();
    return Promise.resolve({ ok: true });
  }
  return undefined;
});

init();
