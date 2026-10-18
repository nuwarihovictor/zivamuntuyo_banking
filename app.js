// ==========================================
// ZIVAMUNTUYO FINANCIAL SERVICES LTD - APP.JS
// ==========================================

const SUPABASE_URL = "https://hwghiezvghdqxnhcnpwk.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_uRGcpKo1-033QnltdseN7A_Kl2LFRBa"; 

const db = (window.supabase && SUPABASE_ANON_KEY) 
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
  : null;

function esc(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function panel(title, subtitle, desc, contentHtml) {
  return `
    <div class="panel">
      <h2 style="color:#fff; font-size:18px; margin-bottom:4px;">${esc(title)}</h2>
      <p style="color:#9ca3af; font-size:13px; margin-bottom:12px;"><strong>${esc(subtitle)}</strong> —${esc(desc)}</p>
      <hr style="border:0; border-top:1px solid #1e4637; margin-bottom:16px;">
      ${contentHtml}
    </div>
  `;
}

window.renderPage = function(page) {
  const c = document.getElementById("main-content");
  if (!c) return;

  if (!db) {
    c.innerHTML = panel(
      page.toUpperCase(),
      "Connection Error",
      "Supabase SDK client could not be initialized.",
      `<p style="color:#ef4444; font-size:13px;">Please verify that Supabase JS CDN library is loaded in index.html.</p>`
    );
    return;
  }

  c.innerHTML = `<p class="muted" style="color:#9ca3af; font-size:13px;">Loading ${esc(page)} module...</p>`;

  if (page === "Dashboard") {
    c.innerHTML = panel(
      "EXECUTIVE DASHBOARD",
      "System Overview & Branch Status",
      "Real-time operational metrics across Butare, Rubirizi, Buhweju, and Ntungamo branches.",
      `<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-bottom: 20px;">
         <div style="background:rgba(0,0,0,0.25); padding:16px; border-radius:8px; border:1px solid #1e4637;">
           <h3 style="font-size:11px; color:#d97706; text-transform:uppercase;">Active Branches</h3>
           <p style="font-size:24px; font-weight:bold; margin-top:6px; color:#fff;">4</p>
         </div>
         <div style="background:rgba(0,0,0,0.25); padding:16px; border-radius:8px; border:1px solid #1e4637;">
           <h3 style="font-size:11px; color:#d97706; text-transform:uppercase;">Core Ledger</h3>
           <p style="font-size:24px; font-weight:bold; margin-top:6px;
           
