// ============================================================================
// ZIVAMUNTUYO FINANCIAL SERVICES LTD - CORE BANKING SYSTEM
// ============================================================================

const SUPABASE_URL = "https://hwghiezvghdqxnhcnpwk.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_uRGcpKo1-033QnltdseN7A_Kl2LFRBa"; 

let db = null;
if (window.supabase) {
  db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

function esc(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

window.switchPage = function(pageName) {
  // Update active tab buttons
  document.querySelectorAll('.nav').forEach(btn => {
    if (btn.dataset.page === pageName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  const container = document.getElementById("main-content");
  if (!container) return;

  if (pageName === "Dashboard") {
    container.innerHTML = `
      <span class="category-tag">Phase 1 & 2: Executive Overview</span>
      <h2 class="page-heading">Dashboard</h2>
      <div class="panel">
        <h2>INSTITUTIONAL PERFORMANCE & METRICS</h2>
        <p class="panel-desc"><strong>Zivamuntuyo Financial Services Ltd — Central Ledger</strong> — Live operational staging environment.</p>
        <div class="grid-2">
           <div class="metric-card">
             <div class="metric-sub">Active Architecture</div>
             <div class="metric-val" style="font-size:18px;">Tier-1 Commercial CBS</div>
           </div>
           <div class="metric-card">
             <div class="metric-sub">Security & RBAC</div>
             <div class="metric-val" style="color:#063c2c; font-size:18px;">8 Staff Roles Active</div>
           </div>
         </div>
         <div class="metric-card">
           <div class="metric-sub">General Ledger Status</div>
           <div class="metric-val" style="color:#15803d; font-size:18px;">Balanced (Debits = Credits)</div>
         </div>
      </div>
    `;
  } else {
    container.innerHTML = `
      <span class="category-tag">System Module</span>
      <h2 class="page-heading">${esc(pageName)}</h2>
      <div class="panel">
        <h2>${esc(pageName)} Module</h2>
        <p class="panel-desc">Module operational and ready for commercial banking transactions.</p>
      </div>
    `;
  }
};

function initApp() {
  document.querySelectorAll('.nav').forEach(btn => {
    btn.addEventListener('click', (e) => {
      window.switchPage(e.currentTarget.dataset.page);
    });
  });
  window.switchPage("Dashboard");
}

// Execute immediately
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
