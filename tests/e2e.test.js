/* End-to-end test in a real Firefox.
 *
 * Packages the extension, installs it temporarily into a throwaway profile
 * and checks that a normal web page actually gets rewritten.
 *
 * Marionette refuses to navigate to moz-extension:// pages, so the popup UI is
 * covered by tests/popup.test.js instead.
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { Builder, By } = require("selenium-webdriver");
const firefox = require("selenium-webdriver/firefox");

const ROOT = path.join(__dirname, "..");
const GECKODRIVER = path.join(ROOT, "tools", "geckodriver");
const EXTENSION_DIR = path.join(ROOT, "extension");

const PAGE = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Clanker test</title></head>
<body>
  <h1 id="heading">The robot wakes up</h1>
  <p id="mixed">robot Robot ROBOT robots Robots ROBOTS</p>
  <p id="other">robotics and Robotnik are untouched</p>
  <script id="script-tag">var robot = "robot";</script>
  <div id="late"></div>
  <input id="field" type="text" />
  <div id="editable" contenteditable="true">edit robot here</div>
</body></html>`;

function startServer() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(PAGE);
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}/` });
    });
  });
}

/* Zip a directory into an XPI. */
function zipDir(dir, outFile) {
  execFileSync("zip", ["-r", "-X", "-9", outFile, "."], { cwd: dir, stdio: "pipe" });
  return outFile;
}

/* The extension exactly as it ships. */
function buildXpi() {
  execFileSync("bash", [path.join(ROOT, "build.sh")], { cwd: ROOT, stdio: "pipe" });
  const manifest = JSON.parse(fs.readFileSync(path.join(EXTENSION_DIR, "manifest.json"), "utf8"));
  const name = manifest.name.replace(/\s+/g, "");
  const file = path.join(ROOT, "dist", `${name}-${manifest.version}.xpi`);
  assert.ok(fs.existsSync(file), "XPI was not built");
  return file;
}

/* A build whose fallback mode is mode2, used to prove in a real browser that
 * the mode is read from extension storage and not hard-coded. */
function buildMode2Variant() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "clanker-variant-"));
  const dir = path.join(tmp, "extension");
  fs.cpSync(EXTENSION_DIR, dir, { recursive: true });

  const contentPath = path.join(dir, "content.js");
  const source = fs.readFileSync(contentPath, "utf8");
  const patched = source.replace('const DEFAULT_MODE = "mode1";', 'const DEFAULT_MODE = "mode2";');
  assert.notStrictEqual(patched, source, "could not patch DEFAULT_MODE");
  fs.writeFileSync(contentPath, patched);

  return zipDir(dir, path.join(tmp, "variant.xpi"));
}

async function waitFor(driver, fn, timeout = 10000) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    last = await driver.executeScript(fn);
    if (last) return last;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`timed out waiting for condition (last value: ${JSON.stringify(last)})`);
}

async function launch(xpi) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "clanker-profile-"));

  const options = new firefox.Options();
  options.setBinary("/usr/bin/firefox");
  options.addArguments("-headless");
  options.setProfile(profile);

  const service = new firefox.ServiceBuilder(GECKODRIVER);
  const driver = await new Builder()
    .forBrowser("firefox")
    .setFirefoxOptions(options)
    .setFirefoxService(service)
    .build();

  await driver.installAddon(xpi, true);
  return { driver, profile };
}

test("the extension rewrites real pages in Firefox", { timeout: 120000 }, async t => {
  if (!fs.existsSync(GECKODRIVER)) {
    t.skip("geckodriver binary missing");
    return;
  }

  const xpi = buildXpi();
  const { server, url } = await startServer();
  const { driver, profile } = await launch(xpi);

  try {
    await driver.get(url);

    /* 1. Headings and paragraphs are rewritten in every casing. */
    await waitFor(driver, () => {
      const el = document.getElementById("heading");
      return el && el.textContent === "The clanker wakes up";
    });

    const mixed = await driver.findElement(By.id("mixed")).getText();
    assert.strictEqual(mixed, "clanker Clanker CLANKER clankers Clankers CLANKERS");

    /* 2. Words that merely contain "robot" are left alone. */
    const other = await driver.findElement(By.id("other")).getText();
    assert.strictEqual(other, "robotics and Robotnik are untouched");

    /* 3. Script contents are never touched. */
    const scriptText = await driver.executeScript(
      "return document.getElementById('script-tag').textContent;"
    );
    assert.strictEqual(scriptText, 'var robot = "robot";');

    /* 4. Content injected after load is rewritten too. */
    await driver.executeScript(`
      const p = document.createElement('p');
      p.id = 'injected';
      p.textContent = 'a late robot';
      document.getElementById('late').appendChild(p);
    `);
    await waitFor(driver, () => {
      const el = document.getElementById("injected");
      return el && el.textContent === "a late clanker";
    });

    /* 5. Typing into a form field is rewritten and the caret survives. */
    await driver.executeScript(`
      const field = document.getElementById('field');
      field.focus();
      field.value = 'say robot now';
      field.setSelectionRange(13, 13);
      field.dispatchEvent(new Event('input', { bubbles: true }));
    `);
    await waitFor(driver, () => document.getElementById("field").value === "say clanker now");
    const caret = await driver.executeScript(
      "return document.getElementById('field').selectionStart;"
    );
    assert.strictEqual(caret, 15);
  } finally {
    await driver.quit().catch(() => {});
    server.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
});

test("the mode is taken from extension storage in Firefox", { timeout: 120000 }, async t => {
  if (!fs.existsSync(GECKODRIVER)) {
    t.skip("geckodriver binary missing");
    return;
  }

  const xpi = buildMode2Variant();
  const { server, url } = await startServer();
  const { driver, profile } = await launch(xpi);

  try {
    await driver.get(url);
    await waitFor(driver, () => {
      const el = document.getElementById("mixed");
      return el && el.textContent === "clank'a Clank'a CLANK'A clank'as Clank'as CLANK'AS";
    });
  } finally {
    await driver.quit().catch(() => {});
    server.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
});
