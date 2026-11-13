// === Replacement rules based on mode ===
function getReplacements(mode) {
  if (mode === "mode2") {
    return [
      { from: /\brobots\b/g, to: "clank'as" },
      { from: /\bRobots\b/g, to: "Clank'as" },
      { from: /\bROBOTS\b/g, to: "CLANK'AS" },
      { from: /\brobot\b/g, to: "clank'a" },
      { from: /\bRobot\b/g, to: "Clank'a" },
      { from: /\bROBOT\b/g, to: "CLANK'A" }
    ];
  } else {
    return [
      { from: /\brobots\b/g, to: "clankers" },
      { from: /\bRobots\b/g, to: "Clankers" },
      { from: /\bROBOTS\b/g, to: "CLANKERS" },
      { from: /\brobot\b/g, to: "clanker" },
      { from: /\bRobot\b/g, to: "Clanker" },
      { from: /\bROBOT\b/g, to: "CLANKER" }
    ];
  }
}

// === Walk DOM and replace text ===
function walk(node, replacements) {
  let child, next;
  switch (node.nodeType) {
    case 1: case 9: case 11:
      child = node.firstChild;
      while (child) {
        next = child.nextSibling;
        walk(child, replacements);
        child = next;
      }
      break;
    case 3:
      handleText(node, replacements);
      break;
  }
}

function handleText(textNode, replacements) {
  let text = textNode.nodeValue;
  for (const rule of replacements) {
    text = text.replace(rule.from, rule.to);
  }
  textNode.nodeValue = text;
}

// === Main ===
chrome.storage.local.get("mode", (data) => {
  const mode = data.mode || "mode1";
  const replacements = getReplacements(mode);

  walk(document.body, replacements);

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach(node => walk(node, replacements));
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
});
