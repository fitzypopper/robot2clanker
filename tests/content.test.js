const test = require("node:test");
const assert = require("node:assert");
const { boot } = require("./harness");

test("rewrites static page text in every case", async () => {
  const { document } = await boot(`
    <p id="a">robot</p>
    <p id="b">Robot</p>
    <p id="c">ROBOT</p>
    <p id="d">robots</p>
    <p id="e">Robots</p>
    <p id="f">ROBOTS</p>
  `);

  assert.strictEqual(document.getElementById("a").textContent, "clanker");
  assert.strictEqual(document.getElementById("b").textContent, "Clanker");
  assert.strictEqual(document.getElementById("c").textContent, "CLANKER");
  assert.strictEqual(document.getElementById("d").textContent, "clankers");
  assert.strictEqual(document.getElementById("e").textContent, "Clankers");
  assert.strictEqual(document.getElementById("f").textContent, "CLANKERS");
});

test("mode 2 uses the clank'a wording", async () => {
  const { document } = await boot(
    `<p id="a">robot Robot ROBOT</p><p id="b">robots Robots ROBOTS</p>`,
    "mode2"
  );

  assert.strictEqual(document.getElementById("a").textContent, "clank'a Clank'a CLANK'A");
  assert.strictEqual(document.getElementById("b").textContent, "clank'as Clank'as CLANK'AS");
});

test("leaves script, style and noscript containers alone", async () => {
  const html = `
    <script id="s">var robot = "robot";</script>
    <style id="y">.robot { color: red }</style>
    <noscript id="n">robot</noscript>
    <p id="p">robot</p>
  `;

  const baseline = await boot(html, "mode1", { raw: true });
  const before = {
    script: baseline.document.getElementById("s").textContent,
    style: baseline.document.getElementById("y").textContent,
    noscript: baseline.document.getElementById("n").textContent
  };

  const { document } = await boot(html);

  assert.strictEqual(document.getElementById("s").textContent, before.script);
  assert.strictEqual(document.getElementById("y").textContent, before.style);
  assert.strictEqual(document.getElementById("n").textContent, before.noscript);
  assert.strictEqual(document.getElementById("p").textContent, "clanker");
});

test("does not touch words that merely contain robot", async () => {
  const { document } = await boot(`<p id="p">robotic robotica robots</p>`);
  assert.strictEqual(document.getElementById("p").textContent, "robotic robotica clankers");
});

test("rewrites input and textarea values", async () => {
  const { document, window } = await boot(`
    <input id="i" type="text" />
    <textarea id="t"></textarea>
  `);

  const input = document.getElementById("i");
  input.value = "a robot here";
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  assert.strictEqual(input.value, "a clanker here");

  const textarea = document.getElementById("t");
  textarea.value = "Robot and robots";
  textarea.dispatchEvent(new window.Event("input", { bubbles: true }));
  assert.strictEqual(textarea.value, "Clanker and clankers");
});

test("keeps the caret in place while typing in a contenteditable", async () => {
  const { document, window } = await boot(
    `<div id="ed" contenteditable="true"><b>abc</b></div>`
  );

  const editable = document.getElementById("ed");
  const textNode = editable.firstChild.firstChild;

  /* Simulate the user typing "robot" into the bold run. */
  textNode.nodeValue = "robot";
  const range = document.createRange();
  range.setStart(textNode, 5);
  range.collapse(true);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);

  editable.dispatchEvent(new window.Event("input", { bubbles: true }));

  assert.strictEqual(editable.textContent, "clanker");
  assert.strictEqual(editable.querySelectorAll("b").length, 1);
  assert.strictEqual(window.getSelection().rangeCount, 1);
  assert.strictEqual(window.getSelection().getRangeAt(0).startOffset, 7);
});

test("keeps the caret in place while typing in an input", async () => {
  const { document, window } = await boot(`<input id="i" type="text" />`);

  const input = document.getElementById("i");
  /* Simulate the user typing "robot" at the end of "abc ". */
  input.value = "abc robot";
  input.setSelectionRange(9, 9);
  input.dispatchEvent(new window.Event("input", { bubbles: true }));

  assert.strictEqual(input.value, "abc clanker");
  assert.strictEqual(input.selectionStart, 11);
  assert.strictEqual(input.selectionEnd, 11);
});

test("keeps the caret in place when it sits inside the replaced word", async () => {
  const { document, window } = await boot(`<input id="i" type="text" />`);

  const input = document.getElementById("i");
  input.value = "robot abc";
  input.setSelectionRange(4, 4);
  input.dispatchEvent(new window.Event("input", { bubbles: true }));

  assert.strictEqual(input.value, "clanker abc");
  assert.strictEqual(input.selectionStart, 7);
});

test("contenteditable keeps its child elements and formatting", async () => {
  const { document } = await boot(
    `<div id="ed" contenteditable="true"><b>robot</b> and <i>robot</i></div>`
  );

  const editable = document.getElementById("ed");
  assert.strictEqual(editable.querySelectorAll("b").length, 1);
  assert.strictEqual(editable.querySelectorAll("i").length, 1);
  assert.strictEqual(editable.innerHTML, "<b>clanker</b> and <i>clanker</i>");
});

test("switching mode re-maps the page from the original wording", async () => {
  const { document, setMode } = await boot(`<p id="p">robot and robots</p>`);

  assert.strictEqual(document.getElementById("p").textContent, "clanker and clankers");

  await setMode("mode2");
  assert.strictEqual(document.getElementById("p").textContent, "clank'a and clank'as");

  await setMode("mode1");
  assert.strictEqual(document.getElementById("p").textContent, "clanker and clankers");
});

test("rewrites content added after load", async () => {
  const { document, window } = await boot(`<div id="root"></div>`);

  const root = document.getElementById("root");
  const added = document.createElement("p");
  added.textContent = "a robot appears";
  root.appendChild(added);

  await new Promise(resolve => setTimeout(resolve, 10));
  assert.strictEqual(added.textContent, "a clanker appears");
});

test("rewrites text that a script changes in place", async () => {
  const { document, window } = await boot(`<p id="p">placeholder</p>`);

  const para = document.getElementById("p");
  para.firstChild.nodeValue = "now a robot";

  await new Promise(resolve => setTimeout(resolve, 10));
  assert.strictEqual(para.textContent, "now a clanker");
});

test("honours the data-clanker-skip escape hatch", async () => {
  const { document } = await boot(`
    <p id="skip" data-clanker-skip>robot</p>
    <p id="keep">robot</p>
  `);

  assert.strictEqual(document.getElementById("skip").textContent, "robot");
  assert.strictEqual(document.getElementById("keep").textContent, "clanker");
});

test("does not loop forever on its own replacements", async () => {
  const { document } = await boot(`<p id="p">robot robot robot</p>`);

  const para = document.getElementById("p");
  const before = para.textContent;

  await new Promise(resolve => setTimeout(resolve, 50));
  assert.strictEqual(para.textContent, before);
  assert.strictEqual(para.textContent, "clanker clanker clanker");
});

test("rescan message re-applies the current mode", async () => {
  const { document, sendMessage, setMode } = await boot(`<p id="p">robot</p>`);

  await setMode("mode2");
  await sendMessage({ type: "robot2clanker:rescan" });
  await new Promise(resolve => setTimeout(resolve, 10));

  assert.strictEqual(document.getElementById("p").textContent, "clank'a");
});

test("ignores unrelated words and empty nodes", async () => {
  const { document } = await boot(`<p id="p">robotics and <span id="s"></span></p>`);
  assert.strictEqual(document.getElementById("p").textContent, "robotics and ");
});
