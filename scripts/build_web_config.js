#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const productionUrl = "https://hwghiezvghdqxnhcnpwk.supabase.co";
const target = String(process.env.VERCEL_ENV || "development").toLowerCase();
let supabaseUrl = String(process.env.SUPABASE_URL || "").trim();
let publishableKey = String(process.env.SUPABASE_PUBLISHABLE_KEY || "").trim();
let legacyAnonKey = String(process.env.SUPABASE_ANON_KEY || "").trim();

// Preview builds may render the static interface without a backend. Never let malformed
// or incomplete preview-only configuration leak into the browser bundle. Production remains strict.
function disablePreviewBackend(reason) {
  supabaseUrl = "";
  publishableKey = "";
  legacyAnonKey = "";
  process.stdout.write("Preview backend disabled (" + reason + "); generating an empty, fail-closed browser config.\\n");
}
if (target !== "production") {
  if (supabaseUrl === "DISABLED" && publishableKey === "DISABLED" && !legacyAnonKey) {
    disablePreviewBackend("explicit sentinel");
  } else if (supabaseUrl && supabaseUrl !== productionUrl) {
    let candidate;
    try { candidate = new URL(supabaseUrl); } catch {}
    const validPreviewOrigin = candidate &&
      candidate.protocol === "https:" &&
      candidate.hostname.endsWith(".supabase.co") &&
      candidate.pathname === "/" && !candidate.search && !candidate.hash &&
      !candidate.username && !candidate.password;
    if (!validPreviewOrigin) disablePreviewBackend("invalid preview URL");
  }
  if (Boolean(supabaseUrl) !== Boolean(publishableKey || legacyAnonKey)) {
    disablePreviewBackend("incomplete preview configuration");
  }
}

function fail(message) {
  process.stderr.write("Web config build refused: " + message + "\n");
  process.exit(1);
}

if (publishableKey && legacyAnonKey && publishableKey !== legacyAnonKey) {
  fail("SUPABASE_PUBLISHABLE_KEY and SUPABASE_ANON_KEY disagree; configure only one public key.");
}
const supabaseAnonKey = publishableKey || legacyAnonKey;
if (Boolean(supabaseUrl) !== Boolean(supabaseAnonKey)) {
  fail("SUPABASE_URL and one public publishable/anon key must be supplied together.");
}

if (supabaseUrl) {
  let parsed;
  try {
    parsed = new URL(supabaseUrl);
  } catch {
    fail("SUPABASE_URL is not a valid URL.");
  }
  if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".supabase.co") ||
      parsed.pathname !== "/" || parsed.search || parsed.hash || parsed.username || parsed.password) {
    fail("SUPABASE_URL must be an HTTPS Supabase project origin.");
  }
  if (target === "production" && parsed.origin !== productionUrl) {
    fail("Production deployment must use the approved production Supabase project.");
  }
  if (target !== "production" && parsed.origin === productionUrl) {
    fail("Preview/local builds may not connect to the production Supabase project.");
  }
  if (supabaseAnonKey.startsWith("sb_secret_")) {
    fail("A Supabase secret key is forbidden in browser configuration.");
  }
  if (supabaseAnonKey.startsWith("eyJ")) {
    const parts = supabaseAnonKey.split(".");
    if (parts.length < 2) fail("JWT-style public key could not be inspected safely.");
    let payload;
    try {
      payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    } catch {
      fail("JWT-style key payload is invalid.");
    }
    if (["service_role", "supabase_admin"].includes(payload.role)) {
      fail("A privileged service key is forbidden in browser configuration.");
    }
    if (payload.role !== "anon") {
      fail("JWT-style browser key must carry the anon role.");
    }
  } else if (!supabaseAnonKey.startsWith("sb_publishable_")) {
    fail("Only a Supabase publishable key or legacy anon JWT is allowed in browser configuration.");
  }
}

const config = { supabaseUrl, supabaseAnonKey };
const output = "window.ZIVAMUNTUYO_CONFIG = Object.freeze(" + JSON.stringify(config) + ");\n";
const outputDirectory = path.join(process.cwd(), "public");
const sourceRoot = path.resolve(__dirname, "..");
const publicAssets = ["index.html", "app.js", "styles.css", "logo.svg"];
fs.mkdirSync(outputDirectory, { recursive: true });
for (const asset of publicAssets) {
  fs.copyFileSync(path.join(sourceRoot, asset), path.join(outputDirectory, asset));
}
fs.writeFileSync(path.join(outputDirectory, "app-config.js"), output, { encoding: "utf8", mode: 0o644 });
process.stdout.write("Generated browser configuration for " + (target || "development") +
  " target. " + (supabaseUrl ? "Public key configured; no secret key emitted." : "No backend configured; app will fail closed.") + "\n");
