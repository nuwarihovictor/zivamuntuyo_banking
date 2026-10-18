import { readFileSync, existsSync } from "node:fs";
import assert from "node:assert/strict";

const requiredFiles = ["index.html", "styles.css", "app.js"];
for (const file of requiredFiles) {
  assert.ok(existsSync(file), `Required application file is missing: ${file}`);
  assert.ok(readFileSync(file, "utf8").trim().length > 0, `Required application file is empty: ${file}`);
}

const html = readFileSync("index.html", "utf8");
const app = readFileSync("app.js", "utf8");
const css = readFileSync("styles.css", "utf8");

assert.match(html, /ZIVAMUNTUYO FINANCIAL SERVICES LTD/i, "Institution branding must be present");
assert.match(html, /id=["']login-form["']/, "Secure staff login form must be present");
assert.match(html, /id=["']sign-out-button["']/, "Sign-out control must be present");
assert.match(html, /src=["']app\.js["']/, "HTML must load the application JavaScript");
assert.match(html, /href=["']styles\.css["']/, "HTML must load the application stylesheet");
assert.match(app, /createClient\s*\(/, "Application must initialize the Supabase client");
assert.match(app, /switchPage/, "Application page-navigation entry point must exist");
assert.match(css, /@media\s*\(/, "Responsive layout breakpoints must be present");

const navButtons = [...html.matchAll(/class=["'][^"']*\bnav\b[^"']*["'][^>]*data-page=["']([^"']+)["']/g)];
assert.ok(navButtons.length >= 10, `Expected at least 10 navigation modules; found ${navButtons.length}`);

const localAssets = [
  ...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)
].map(match => match[1]).filter(value => !/^(?:https?:|data:|#|\/\/)/i.test(value));
for (const asset of localAssets) {
  if (/\.(?:js|css|svg|png|jpe?g|webp|ico)$/i.test(asset)) {
    assert.ok(existsSync(asset), `HTML references a missing local asset: ${asset}`);
  }
}

assert.doesNotMatch(app, /sb_secret_[A-Za-z0-9_-]{20,}/, "A Supabase secret key must never be embedded in browser code");
assert.doesNotMatch(app, /service_role\s*[:=]\s*["'][^"']{20,}["']/i, "A service-role credential must never be embedded in browser code");
assert.doesNotMatch(app, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, "Private keys must never be embedded in browser code");

console.log(`Release static guard passed: ${requiredFiles.length} core files, ${navButtons.length} navigation modules, local asset references and basic secret-exposure checks.`);
console.log("Reminder: static checks do not verify Supabase RLS/RPC behavior, ledger integrity, hardware, or deployment.");
