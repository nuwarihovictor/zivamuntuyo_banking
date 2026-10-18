// ============================================================================
// ZIVAMUNTUYO FINANCIAL SERVICES LTD - COMMERCIAL BANKING CORE FRONTEND
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

function panel(title, subtitle, desc, contentHtml) {
  return `
    <div class="panel">
      <h2>${esc(title)}</h2>
      <p class="panel-desc"><strong>${esc(subtitle)}</strong> — ${esc(desc)}</p>
      ${contentHtml}
    </div>
  `;
}

window.switchPage = function(pageName) {
  document.querySelectorAll('.nav').forEach(btn => {
    if (btn.dataset.page === pageName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  const c = document.getElementById("main-content");
  if (!c) return;

  if (pageName === "Dashboard") {
    c.innerHTML = `
      <span class="category-tag">Executive overview</span>
      <h2 class="page-heading">Dashboard</h2>
      ${panel(
        "FINANCIAL PERFORMANCE",
        "Live general-ledger overview",
        "Charts use posted journal entries only. Amounts stay separated by currency, and no sample figures are displayed.",
        `<div class="form-grid">
           <label>Branch UUID (optional; limited to your authorized branch scope)
             <input id="dashboard-branch-id" type="text" placeholder="All authorized branches">
           </label>
           <button type="button" class="secondary" onclick="loadDashboardCharts()">Refresh dashboard</button>
         </div>
         <div id="dashboard-feedback" class="muted" aria-live="polite">Loading live accounting data…</div>
         <div id="dashboard-kpis" class="grid-2"></div>
         <div class="grid-2 dashboard-chart-grid">
           <div class="metric-card dashboard-chart-card">
             <h3>Debits vs credits by currency</h3>
             <p class="muted">Posted ledger totals; currencies are not combined.</p>
             <div class="dashboard-chart-wrap"><canvas id="dashboard-debit-credit" role="img" aria-label="Bar chart comparing posted debits and credits by currency"></canvas></div>
           </div>
           <div class="metric-card dashboard-chart-card">
             <h3>Ledger activity by account type</h3>
             <p class="muted">Absolute posted movement by ledger type, for the selected currency.</p>
             <label>Chart currency <select id="dashboard-chart-currency" onchange="renderDashboardTypeChart()"></select></label>
             <div class="dashboard-chart-wrap"><canvas id="dashboard-account-types" role="img" aria-label="Doughnut chart showing posted ledger movement by account type"></canvas></div>
           </div>
         </div>
         <p class="muted">Charts are operational summaries, not audited financial statements. A balanced total does not prove all transactions have been recorded.</p>`
      )}
    `;
    window.loadDashboardCharts();
  } 
  else if (pageName === "Branches") {
    c.innerHTML = `
      <span class="category-tag">Phase 3: Branch & Country Hierarchy</span>
      <h2 class="page-heading">Branches & Regions</h2>
      ${panel(
        "OPERATIONAL REGIONAL NETWORK",
        "Branch Directory & Currency Mapping",
        "Manage regional branches operating under the central core banking system.",
        `<div id="branch-list"><p class="muted">Loading regional branches...</p></div>`
      )}
    `;

    if (db) {
      db.from("branches").select("*").then(({ data: branches, error }) => {
        const listEl = document.getElementById("branch-list");
        if (!listEl) return;
        if (error || !branches || branches.length === 0) {
          listEl.innerHTML = `<div class="list-item"><div><strong>Kampala Central Branch</strong> (UG-001)<br><span class="muted">Country: Uganda | Currency: UGX</span></div><span class="badge-role">Headquarters</span></div>`;
          return;
        }
        listEl.innerHTML = branches.map(b => `
          <div class="list-item">
            <div>
              <strong>${esc(b.branch_name || b.name)} (${esc(b.branch_code || b.code)})</strong><br>
              <span class="muted">Currency: ${esc(b.currency_code || "UGX")}</span>
            </div>
            <span class="badge-role">Operational</span>
          </div>
        `).join("");
      }).catch(() => {
        const listEl = document.getElementById("branch-list");
        if (listEl) {
          listEl.innerHTML = `<div class="list-item"><div><strong>Kampala Central Branch</strong> (UG-001)<br><span class="muted">Country: Uganda | Currency: UGX</span></div><span class="badge-role">Headquarters</span></div>`;
        }
      });
    }
  }
  else if (pageName === "Staff") {
    c.innerHTML = `
      <span class="category-tag">Phase 2: Security & Access Control</span>
      <h2 class="page-heading">Staff & Permissions</h2>
      ${panel(
        "AUTHORIZED PERSONNEL DIRECTORY",
        "Role-Based Access Control (RBAC)",
        "Assigned employee profiles, system roles, and home branch access restrictions.",
        `<div id="staff-list">
           <div class="list-item">
             <div>
               <strong>Nuwariho Victor</strong> (victor@zivamuntuyo.com)<br>
               <span class="muted">Branch: Central Headquarters</span>
             </div>
             <span class="badge-role">System Administrator</span>
           </div>
         </div>`
      )}
    `;
  }
  else if (pageName === "Customers") {
    c.innerHTML = `
      <span class="category-tag">Phase 4: CIF & KYC Module</span>
      <h2 class="page-heading">Customers</h2>
      ${panel(
        "CUSTOMER ONBOARDING",
        "Register New Bank Customer",
        "Capture verified customer identification details before account creation.",
        `<form id="cust-form" onsubmit="handleCustomerSubmit(event)">
          <label>Full Legal Name * 
            <input type="text" name="full_name" required placeholder="e.g. Nuwariho Victor">
          </label>
          <label>National ID (NIN) or Passport * 
            <input type="text" name="nin_or_passport" required placeholder="CM12345678ABCD">
          </label>
          <label>Phone Number * 
            <input type="tel" name="phone_number" required placeholder="+256 700 000000">
          </label>
          <label>Email Address 
            <input type="email" name="email" placeholder="victor@zivamuntuyo.com">
          </label>
          <label>Physical Address * 
            <input type="text" name="address" required placeholder="Kampala, Uganda">
          </label>
          <button type="submit" class="primary">Register Customer (CIF)</button>
          <p id="cust-feedback" class="muted"></p>
        </form>`
      )}
      ${panel(
        "VERIFIED CUSTOMER DIRECTORY",
        "Active CIF Records",
        "List of all registered bank customers.",
        `<div id="cust-list"><p class="muted">Loading customer records...</p></div>`
      )}
    `;

    if (db) {
      db.from("customers").select("*").order("created_at", { ascending: false }).then(({ data, error }) => {
        const listEl = document.getElementById("cust-list");
        if (!listEl) return;
        if (error || !data || data.length === 0) {
          listEl.innerHTML = `<p class="muted">No customer records found yet. Register above to begin.</p>`;
          return;
        }
        listEl.innerHTML = data.map(cust => `
          <div class="list-item">
            <div>
              <strong>${esc(cust.full_name)}</strong><br>
              <span class="muted">${esc(cust.customer_number)} | NIN: ${esc(cust.nin_or_passport)}</span>
            </div>
            <span class="badge-role">${esc(cust.phone_number)}</span>
          </div>
        `).join("");
      }).catch(() => {
        const listEl = document.getElementById("cust-list");
        if (listEl) listEl.innerHTML = `<p class="muted">No customer records found yet.</p>`;
      });
    }
  }
  else if (pageName === "Accounts") {
    c.innerHTML = `
      <span class="category-tag">Phase 5: Product Management</span>
      <h2 class="page-heading">Accounts</h2>
      ${panel(
        "COMMERCIAL ACCOUNT OPENING",
        "Open New Account",
        "Submit an account application for a valid customer. Database permissions and approval rules determine whether it can be created.",
        `<form id="acc-form" onsubmit="handleAccountSubmit(event)">
          <label>Customer UUID *
            <input type="text" name="customer_id" required placeholder="Enter Customer UUID">
          </label>
          <label>Currency *
            <select name="currency_code" required>
              <option value="UGX">UGX — Ugandan shilling</option>
              <option value="USD">USD — US dollar</option>
              <option value="KES">KES — Kenyan shilling</option>
              <option value="TZS">TZS — Tanzanian shilling</option>
              <option value="RWF">RWF — Rwandan franc</option>
              <option value="BIF">BIF — Burundian franc</option>
              <option value="CDF">CDF — Congolese franc</option>
            </select>
          </label>
          <button type="submit" class="primary">Submit Account Request</button>
          <p id="acc-feedback" class="muted" aria-live="polite"></p>
        </form>`
      )}
      ${panel(
        "BANK ACCOUNTS DIRECTORY",
        "Account status and stored balance",
        "The balance field below is the value stored on the account record; it is not independently reconciled against double-entry ledger postings. Do not use it as an audited balance until reconciliation is implemented.",
        `<div class="notice-box">Balance integrity note: transaction requests should affect customer balances only after approved ledger posting. A stored account balance may be stale or not ledger-verified.</div>
         <div id="acc-list"><p class="muted">Loading accounts directory...</p></div>`
      )}
    `;

    if (db) {
      db.rpc("list_customer_account_balance_reconciliation")
        .then(({ data, error }) => {
          const listEl = document.getElementById("acc-list");
          if (!listEl) return;
          if (error) {
            listEl.innerHTML = `<p class="muted">Ledger reconciliation could not be loaded. Check that you are signed in, have an active employee profile, and have access to the account branch. Details: ${esc(error.message)}</p>`;
            return;
          }
          if (!data || data.length === 0) {
            listEl.innerHTML = `<p class="muted">No accounts are visible for your branch access, or no accounts have been registered.</p>`;
            return;
          }
          listEl.innerHTML = data.map(a => {
            const stored = Number(a.stored_balance);
            const ledger = a.ledger_balance === null || a.ledger_balance === undefined ? null : Number(a.ledger_balance);
            const fmt = value => Number.isFinite(value)
              ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              : "Not available";
            const currency = (a.currency_code || "UGX").trim();
            const reconciliation = !a.ledger_configured || ledger === null || !Number.isFinite(ledger)
              ? '<span class="muted">Reconciliation: NOT CONFIGURED — customer liability ledger missing</span>'
              : '<span class="muted">Difference (stored − ledger): ' + fmt(stored - ledger) + ' ' + esc(currency) + '</span>';
            return `
              <div class="list-item">
                <div>
                  <strong>${esc(a.account_number || "Account number unavailable")}</strong><br>
                  <span class="muted">Stored balance: ${fmt(stored)} ${esc(currency)}</span><br>
                  <span class="muted">Posted-ledger balance: ${ledger === null ? "Unavailable" : fmt(ledger)} ${esc(currency)}</span><br>
                  ${reconciliation}<br>
                  <span class="muted">Account UUID: ${esc(a.account_id)}</span><br>
                  <span class="muted">Branch UUID: ${esc(a.branch_id || "Not assigned")}</span>
                </div>
                <span class="badge-role">${esc(a.account_status || "unknown")}</span>
              </div>
            `;
          }).join("");
        })
        .catch(() => {
          const listEl = document.getElementById("acc-list");
          if (listEl) listEl.innerHTML = `<p class="muted">A connection error prevented account reconciliation from loading. Please refresh and check your connection.</p>`;
        });
    } else {
      const listEl = document.getElementById("acc-list");
      if (listEl) listEl.innerHTML = `<p class="muted">Database client is unavailable. No account records were loaded.</p>`;
    }
  }
  else if (pageName === "Transactions") {
    c.innerHTML = `
      <span class="category-tag">Phase 6: Ledger Engine</span>
      <h2 class="page-heading">Transactions</h2>
      ${panel(
        "TRANSACTION PROCESSING",
        "Cash transaction request",
        "Submit deposits and withdrawals for approval. Requests are not treated as posted transactions until an authorized approver completes the ledger workflow.",
        `<form onsubmit="handleTransaction(event)">
           <label>Account UUID * 
             <input type="text" name="account_id" required placeholder="Enter Account UUID">
           </label>
           <label>Transaction Type * 
             <select name="tx_type">
               <option value="deposit">Deposit (Credit)</option>
               <option value="withdrawal">Withdrawal (Debit)</option>
             </select>
           </label>
           <label>Amount (UGX) * 
             <input type="number" name="amount" required min="0.01" step="0.01" inputmode="decimal" placeholder="50000.00">
           </label>
           <button type="submit" class="primary">Submit for Approval</button>
           <p id="tx-feedback" class="muted"></p>
         </form>`
      )}
    `;
  }
  else if (pageName === "Attendance") {
    c.innerHTML = `
      <span class="category-tag">Staff Operations</span>
      <h2 class="page-heading">Staff Attendance</h2>
      ${panel(
        "DEVICE-COMPATIBLE ATTENDANCE",
        "Windows 10 / Windows 11",
        "Designed around common fingerprint terminals and USB readers. Actual compatibility depends on the exact model, firmware, vendor SDK and connection method.",
        `<div class="notice-box"><strong>Important:</strong> no fingerprint device is connected yet. This setup page does not scan fingerprints or create official attendance records. A secure Windows connector or supported terminal API must be installed and tested first.</div>
         <label for="attendance-device">Choose device family / connection method
           <select id="attendance-device" onchange="showAttendanceDeviceHelp()">
             <option value="zkteco">ZKTeco fingerprint terminals (LAN / ADMS / vendor SDK)</option>
             <option value="suprema">Suprema BioStation / BioEntry (BioStar API / SDK)</option>
             <option value="hikvision">Hikvision access-control terminals (ISAPI / vendor SDK)</option>
             <option value="secugen">SecuGen USB fingerprint reader (Windows SDK)</option>
             <option value="digitalpersona">DigitalPersona / HID USB reader (vendor SDK)</option>
             <option value="generic">Other device (vendor SDK or documented API required)</option>
           </select>
         </label>
         <div id="attendance-device-help" class="notice-box" aria-live="polite">Terminal integration is usually best through a supported LAN/API or vendor push protocol; exact model support must be verified.</div>
         <div class="grid-2">
           <div class="metric-card"><div class="metric-sub">Device connection</div><div class="metric-val" style="font-size:18px;">Not connected</div></div>
           <div class="metric-card"><div class="metric-sub">Official attendance</div><div class="metric-val" style="font-size:18px;">Not enabled</div></div>
         </div>
         <h3 style="margin:16px 0 8px;">Compatibility strategy</h3>
         <ul style="padding-left:20px;line-height:1.8;">
           <li>Use a device adapter for each supported vendor/model family.</li>
           <li>Run a signed local Windows connector for USB readers; use documented LAN/API push where supported.</li>
           <li>Store attendance events and device identifiers, not raw fingerprint images.</li>
           <li>Require authenticated staff mapping, duplicate-event protection, audit logs and restricted database policies.</li>
         </ul>
         <p class="muted">Select a family above to see the intended integration path. This is a compatibility plan, not a claim that every model has been tested.</p>
         <p><a href="https://github.com/nuwarihovictor/zivamuntuyo_banking/blob/main/docs/attendance-device-compatibility.md" target="_blank" rel="noopener noreferrer">Read device compatibility and implementation plan</a></p>`
      )}
    `;
    window.showAttendanceDeviceHelp();
  }
  else if (pageName === "StaffChat") {
    c.innerHTML = `
      <span class="category-tag">Internal Communications</span>
      <h2 class="page-heading">Staff Chat</h2>
      ${panel(
        "TEAM MESSAGES",
        "Internal staff communication",
        "Messaging is not connected to a database yet; this page does not send or store messages.",
        `<div class="notice-box">To enable real staff chat safely, the project needs a messages table, authenticated-user identity, staff-only row-level security policies, and optionally Supabase Realtime.</div>
         <label>Message preview
           <textarea id="chat-preview" rows="3" maxlength="500" placeholder="Type a draft message to preview it (not sent or saved)..."></textarea>
         </label>
         <button type="button" class="secondary" onclick="previewStaffMessage()">Preview draft</button>
         <div id="chat-preview-result" class="muted" aria-live="polite">Drafts stay in this page only.</div>`
      )}
    `;
  }
  else if (pageName === "Receipts") {
    c.innerHTML = `
      <span class="category-tag">Teller Tools</span>
      <h2 class="page-heading">Receipt Printer</h2>
      ${panel(
        "THERMAL PRINTER SETUP",
        "X printer / receipt printer",
        "Print a clearly marked test slip to check paper layout. This is not proof of a financial transaction.",
        `<div id="test-receipt" class="receipt-preview">
           <h3>ZIVAMUNTUYO FINANCIAL SERVICES LTD</h3>
           <p>PRINTER TEST — NOT A TRANSACTION</p>
           <hr>
           <p>Paper layout test</p>
           <p>Windows 10 / Windows 11</p>
           <p>Amount: UGX 0</p>
           <hr>
           <p>TEST ONLY — NO MONEY RECEIVED OR PAID</p>
         </div>
         <button type="button" class="primary" onclick="printTestReceipt()">Print test slip</button>
         <p class="muted">Printing uses your browser's print dialog. Select the connected thermal/X printer and its correct paper width.</p>`
      )}
    `;
  }
  else if (pageName === "Approvals") {
    c.innerHTML = `
      <span class="category-tag">Maker-checker controls</span>
      <h2 class="page-heading">Transaction Approvals</h2>
      ${panel(
        "PENDING CASH REQUESTS",
        "Independent authorization required",
        "Approval does not move money. A separate eligible employee must post the approved request to the ledger.",
        `<button type="button" class="secondary" onclick="loadCashApprovals()">Refresh requests</button>
         <div id="approval-feedback" class="muted" aria-live="polite">Loading transaction requests…</div>
         <div id="pending-cash-requests"></div>`
      )}
      ${panel(
        "APPROVED — AWAITING LEDGER POSTING",
        "Separate posting control",
        "Posting requires the UUID of an active asset cash ledger in the same currency and branch.",
        `<div id="ready-posting-requests"><p class="muted">Loading approved requests…</p></div>`
      )}
    `;
    window.loadCashApprovals();
  }
  else if (pageName === "Accounting") {
    c.innerHTML = `
      <span class="category-tag">General Ledger & Trial Balance</span>
      <h2 class="page-heading">Accounting & Double-Entry Ledger</h2>
      ${panel(
        "POSTED LEDGER TRIAL BALANCE",
        "Ledger-backed accounting",
        "Only posted journal entries are included. Totals are shown separately by currency; pending requests are excluded.",
        `<div class="form-grid">
           <label>Branch UUID (leave blank for all branches you are authorized to access)
             <input id="trial-branch-id" type="text" placeholder="Optional branch UUID">
           </label>
           <button type="button" class="secondary" onclick="loadTrialBalance()">Refresh trial balance</button>
         </div>
         <div id="trial-balance-feedback" class="muted" aria-live="polite">Loading posted ledger balances…</div>
         <div id="trial-balance-totals"></div>
         <div id="gl-list"></div>
         <p class="muted">A balanced trial balance does not by itself confirm that all business transactions were entered or independently audited.</p>`
      )}
    `;
    window.loadTrialBalance();
  }
  else if (pageName === "Reports") {
    c.innerHTML = `
      <span class="category-tag">Live ledger reports</span>
      <h2 class="page-heading">Financial Reports</h2>
      ${panel(
        "POSTED LEDGER SUMMARY",
        "Report totals from the general ledger",
        "This summary uses posted journal entries only and keeps each currency separate. It is not an audited financial statement.",
        `<div class="form-grid">
           <label>Branch UUID (optional; must be within your authorized scope)
             <input id="reports-branch-id" type="text" placeholder="Optional branch UUID">
           </label>
           <button type="button" class="secondary" onclick="loadFinancialReports()">Refresh reports</button>
         </div>
         <div id="reports-feedback" class="muted" aria-live="polite">Loading ledger report…</div>
         <div id="reports-summary"></div>
         <div id="reports-detail"></div>
         <p class="muted">Income statement and balance sheet classifications require a reviewed chart of accounts. No estimates or demo figures are displayed.</p>`
      )}
    `;
    window.loadFinancialReports();
  }
  else {
    c.innerHTML = `
      <span class="category-tag">System Module</span>
      <h2 class="page-heading">${pageName}</h2>
      ${panel(pageName, "Module Active", "Section operational.", `<p class="muted">Module ready for commercial operations.</p>`)}
    `;
  }
}

let dashboardDebitCreditChart = null;
let dashboardAccountTypeChart = null;
let dashboardChartRows = [];

window.loadDashboardCharts = async function() {
  const feedback = document.getElementById("dashboard-feedback");
  const kpis = document.getElementById("dashboard-kpis");
  const branchInput = document.getElementById("dashboard-branch-id");
  if (!feedback || !kpis) return;
  kpis.innerHTML = "";
  dashboardChartRows = [];
  if (!db) {
    feedback.textContent = "Database connection unavailable. Charts require live posted-ledger data.";
    return;
  }
  const branchId = branchInput ? branchInput.value.trim() : "";
  if (branchId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(branchId)) {
    feedback.textContent = "Enter a valid branch UUID or leave the field blank.";
    return;
  }
  feedback.textContent = "Loading posted ledger data…";
  const { data, error } = await db.rpc("list_trial_balance", { p_branch_id: branchId || null });
  if (error) {
    feedback.textContent = "Live charts are not available yet. Install the secure list_trial_balance function in Supabase and verify accounting permissions. Details: " + error.message;
    return;
  }
  dashboardChartRows = data || [];
  if (!dashboardChartRows.length) {
    feedback.textContent = "No active ledger account data was returned. Charts are intentionally empty rather than showing demo numbers.";
    if (dashboardDebitCreditChart) { dashboardDebitCreditChart.destroy(); dashboardDebitCreditChart = null; }
    if (dashboardAccountTypeChart) { dashboardAccountTypeChart.destroy(); dashboardAccountTypeChart = null; }
    const currencySelect = document.getElementById("dashboard-chart-currency");
    if (currencySelect) currencySelect.innerHTML = "";
    return;
  }
  const groups = {};
  dashboardChartRows.forEach(row => {
    const currency = String(row.currency_code || "UNKNOWN").trim();
    if (!groups[currency]) groups[currency] = { debit: 0, credit: 0, accounts: {} };
    const group = groups[currency];
    group.debit += Number(row.debit_total || 0);
    group.credit += Number(row.credit_total || 0);
    const type = String(row.ledger_type || "Unclassified");
    if (!group.accounts[type]) group.accounts[type] = 0;
    group.accounts[type] += Math.abs(Number(row.debit_total || 0) - Number(row.credit_total || 0));
  });
  const fmt = (n, cur) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 }) + " " + cur;
  kpis.innerHTML = Object.entries(groups).map(([currency, g]) =>
    '<div class="metric-card"><div class="metric-sub">Posted debits · ' + esc(currency) + '</div><div class="metric-val" style="font-size:18px;">' + esc(fmt(g.debit,currency)) + '</div><div class="muted">Posted credits: ' + esc(fmt(g.credit,currency)) + '</div></div>'
  ).join("");
  const currencySelect = document.getElementById("dashboard-chart-currency");
  if (currencySelect) {
    const previous = currencySelect.value;
    currencySelect.innerHTML = Object.keys(groups).map(cur => '<option value="' + esc(cur) + '">' + esc(cur) + '</option>').join("");
    if (groups[previous]) currencySelect.value = previous;
  }
  if (typeof Chart === "undefined") {
    feedback.textContent = "Ledger data loaded, but the chart library did not load. Check your internet connection and reload.";
    return;
  }
  if (dashboardDebitCreditChart) dashboardDebitCreditChart.destroy();
  const currencyNames = Object.keys(groups);
  dashboardDebitCreditChart = new Chart(document.getElementById("dashboard-debit-credit"), {
    type: "bar",
    data: { labels: currencyNames, datasets: [
      { label: "Debits", data: currencyNames.map(cur => groups[cur].debit) },
      { label: "Credits", data: currencyNames.map(cur => groups[cur].credit) }
    ]},
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } }, plugins: { legend: { position: "bottom" } } }
  });
  window.renderDashboardTypeChart();
  feedback.textContent = "Loaded " + dashboardChartRows.length + " ledger accounts from posted journals. Data refreshes when you select Refresh dashboard.";
};

window.renderDashboardTypeChart = function() {
  const canvas = document.getElementById("dashboard-account-types");
  const select = document.getElementById("dashboard-chart-currency");
  if (!canvas || !select || typeof Chart === "undefined" || !dashboardChartRows.length) return;
  const currency = select.value;
  const groups = {};
  dashboardChartRows.filter(row => String(row.currency_code || "UNKNOWN").trim() === currency).forEach(row => {
    const type = String(row.ledger_type || "Unclassified");
    groups[type] = (groups[type] || 0) + Math.abs(Number(row.debit_total || 0) - Number(row.credit_total || 0));
  });
  if (dashboardAccountTypeChart) dashboardAccountTypeChart.destroy();
  dashboardAccountTypeChart = new Chart(canvas, {
    type: "doughnut",
    data: { labels: Object.keys(groups), datasets: [{ label: "Absolute net movement", data: Object.values(groups) }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }
  });
};

window.loadFinancialReports = async function() {
  const feedback = document.getElementById("reports-feedback");
  const summary = document.getElementById("reports-summary");
  const detail = document.getElementById("reports-detail");
  const branchInput = document.getElementById("reports-branch-id");
  if (!feedback || !summary || !detail) return;
  summary.innerHTML = "";
  detail.innerHTML = "";
  if (!db) {
    feedback.textContent = "Database connection unavailable. No report figures are being shown.";
    return;
  }
  const branchId = branchInput ? branchInput.value.trim() : "";
  if (branchId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(branchId)) {
    feedback.textContent = "Enter a valid branch UUID or leave the field blank.";
    return;
  }
  feedback.textContent = "Loading posted ledger totals…";
  const { data, error } = await db.rpc("list_trial_balance", { p_branch_id: branchId || null });
  if (error) {
    feedback.textContent = "Reports could not load. Install the secure list_trial_balance SQL function in Supabase and check your accounting role. Details: " + error.message;
    return;
  }
  const rows = data || [];
  if (!rows.length) {
    feedback.textContent = "No active ledger accounts were returned for your authorized branch scope. No financial totals can be calculated.";
    return;
  }
  const currencies = {};
  rows.forEach(row => {
    const currency = String(row.currency_code || "UNKNOWN").trim();
    if (!currencies[currency]) currencies[currency] = { debit: 0, credit: 0, count: 0, accounts: {} };
    const group = currencies[currency];
    group.debit += Number(row.debit_total || 0);
    group.credit += Number(row.credit_total || 0);
    group.count++;
    const type = String(row.ledger_type || "Unclassified");
    if (!group.accounts[type]) group.accounts[type] = { debit: 0, credit: 0, count: 0 };
    group.accounts[type].debit += Number(row.debit_total || 0);
    group.accounts[type].credit += Number(row.credit_total || 0);
    group.accounts[type].count++;
  });
  const money = (n, currency) => Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + currency;
  summary.innerHTML = Object.entries(currencies).map(([currency, g]) =>
    '<div class="metric-card"><div class="metric-sub">Posted ledger • ' + esc(currency) + '</div>' +
    '<div class="metric-val" style="font-size:17px;">Debits: ' + esc(money(g.debit, currency)) + '</div>' +
    '<div class="metric-val" style="font-size:17px;">Credits: ' + esc(money(g.credit, currency)) + '</div>' +
    '<div class="muted">Difference: ' + esc(money(g.debit - g.credit, currency)) + ' | Accounts: ' + g.count + '</div></div>'
  ).join("");
  detail.innerHTML = Object.entries(currencies).map(([currency, g]) =>
    '<h3>' + esc(currency) + ' — Totals by ledger type</h3>' +
    Object.entries(g.accounts).map(([type, t]) =>
      '<div class="list-item"><div><strong>' + esc(type) + '</strong><br><span class="muted">Accounts: ' + t.count +
      ' | Debits: ' + esc(money(t.debit, currency)) + ' | Credits: ' + esc(money(t.credit, currency)) +
      ' | Net debit: ' + esc(money(t.debit - t.credit, currency)) + '</span></div></div>'
    ).join("")
  ).join("");
  feedback.textContent = "Report loaded from " + rows.length + " active ledger accounts and posted journal entries. Currency totals are not combined.";
};

window.loadTrialBalance = async function() {
  const list = document.getElementById("gl-list");
  const feedback = document.getElementById("trial-balance-feedback");
  const totalsEl = document.getElementById("trial-balance-totals");
  const branchInput = document.getElementById("trial-branch-id");
  if (!list || !feedback || !totalsEl) return;
  if (!db) {
    feedback.textContent = "Database connection unavailable. No accounting figures are being shown.";
    return;
  }
  const branchId = branchInput ? branchInput.value.trim() : "";
  if (branchId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(branchId)) {
    feedback.textContent = "Enter a valid branch UUID or leave the field blank.";
    return;
  }
  feedback.textContent = "Loading posted journal entries…";
  list.innerHTML = "";
  totalsEl.innerHTML = "";
  const { data, error } = await db.rpc("list_trial_balance", { p_branch_id: branchId || null });
  if (error) {
    feedback.textContent = "Trial balance could not be loaded. The secure list_trial_balance database function must be installed and your employee role must have accounting access. Details: " + error.message;
    return;
  }
  const rows = data || [];
  if (!rows.length) {
    feedback.textContent = "No active ledger accounts were found for your authorized branch scope. This is not a confirmation that the books are balanced.";
    return;
  }
  const grouped = {};
  rows.forEach(row => {
    const currency = String(row.currency_code || "UNKNOWN").trim();
    if (!grouped[currency]) grouped[currency] = { debit: 0, credit: 0, rows: [] };
    grouped[currency].debit += Number(row.debit_total || 0);
    grouped[currency].credit += Number(row.credit_total || 0);
    grouped[currency].rows.push(row);
  });
  const money = (amount, currency) => Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + currency;
  totalsEl.innerHTML = Object.entries(grouped).map(([currency, group]) => {
    const difference = group.debit - group.credit;
    const balanced = Math.abs(difference) < 0.005;
    return '<div class="metric-card"><div class="metric-sub">Currency: ' + esc(currency) + '</div>' +
      '<div class="metric-val" style="font-size:17px;">Debits: ' + esc(money(group.debit, currency)) + '</div>' +
      '<div class="metric-val" style="font-size:17px;">Credits: ' + esc(money(group.credit, currency)) + '</div>' +
      '<div class="muted">Difference: ' + esc(money(difference, currency)) + ' — ' + (balanced ? 'Totals match' : 'Out of balance') + '</div></div>';
  }).join("");
  list.innerHTML = Object.entries(grouped).map(([currency, group]) =>
    '<h3>' + esc(currency) + ' — Ledger accounts</h3>' +
    group.rows.map(row => {
      const net = Number(row.net_balance || 0);
      const status = Math.abs(Number(row.debit_total || 0) - Number(row.credit_total || 0)) < 0.005 ? "Account movement balanced" : "Movement differs";
      return '<div class="list-item"><div><strong>' + esc(row.ledger_code) + ' — ' + esc(row.ledger_name) + '</strong><br>' +
        '<span class="muted">' + esc(row.ledger_type) + ' | ' + esc(row.branch_name || "Branch") + ' | ' + esc(status) + '</span><br>' +
        '<span class="muted">Debit: ' + esc(money(row.debit_total, currency)) + ' | Credit: ' + esc(money(row.credit_total, currency)) +
        ' | Net (debit − credit): ' + esc(money(net, currency)) + '</span></div></div>';
    }).join("")
  ).join("");
  feedback.textContent = "Loaded " + rows.length + " active ledger account(s) using posted journals only. Figures are grouped by currency.";
};

window.handleCustomerSubmit = async function(e) {
  e.preventDefault();
  const form = e.target;
  const feedback = document.getElementById("cust-feedback");
  if (feedback) feedback.textContent = "Registering customer KYC profile...";

  const formData = new FormData(form);
  const payload = {
    customer_number: "CUST-" + Math.floor(100000 + Math.random() * 900000),
    full_name: formData.get("full_name"),
    nin_or_passport: formData.get("nin_or_passport"),
    phone_number: formData.get("phone_number"),
    email: formData.get("email"),
    address: formData.get("address"),
    status: "active"
  };

  const { error } = await db.from("customers").insert([payload]);
  if (error) {
    if (feedback) feedback.textContent = "Registration failed: " + error.message;
  } else {
    if (feedback) feedback.textContent = "Customer successfully registered!";
    form.reset();
    setTimeout(() => window.switchPage("Customers"), 1000);
  }
};

window.handleAccountSubmit = async function(e) {
  e.preventDefault();
  const form = e.target;
  const feedback = document.getElementById("acc-feedback");
  if (feedback) feedback.textContent = "Processing account application...";

  const formData = new FormData(form);
  const payload = {
    customer_id: formData.get("customer_id"),
    currency_code: formData.get("currency_code") || "UGX",
    account_number: "ACC-" + Math.floor(10000000 + Math.random() * 90000000),
    status: "active",
    balance: 0.00
  };

  const { error } = await db.from("bank_accounts").insert([payload]);
  if (error) {
    if (feedback) feedback.textContent = "Error: " + error.message;
  } else {
    if (feedback) feedback.textContent = "Account successfully opened!";
    form.reset();
    setTimeout(() => window.switchPage("Accounts"), 1200);
  }
};

window.handleTransaction = async function(e) {
  e.preventDefault();
  const form = e.target;
  const feedback = document.getElementById("tx-feedback");
  const formData = new FormData(form);
  const accountId = String(formData.get("account_id") || "").trim();
  const transactionType = String(formData.get("tx_type") || "").toLowerCase();
  const amount = Number(formData.get("amount"));

  if (!db) {
    if (feedback) feedback.textContent = "Database connection is unavailable. No transaction request was submitted.";
    return;
  }
  if (!accountId) {
    if (feedback) feedback.textContent = "Enter the bank account UUID.";
    return;
  }
  if (!["deposit", "withdrawal"].includes(transactionType)) {
    if (feedback) feedback.textContent = "Choose deposit or withdrawal.";
    return;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    if (feedback) feedback.textContent = "Enter an amount greater than zero.";
    return;
  }

  const button = form.querySelector('button[type="submit"]');
  if (button) button.disabled = true;
  if (feedback) feedback.textContent = "Submitting request for authorization…";

  try {
    // The database RPC validates staff role, branch access, active account status,
    // and amount; it creates a pending-approval journal request, not a posted transaction.
    const { data, error } = await db.rpc("create_cash_transaction_request", {
      p_account_id: accountId,
      p_transaction_type: transactionType,
      p_amount: amount,
      p_description: "Teller " + transactionType + " request"
    });

    if (error) {
      if (feedback) feedback.textContent = "Request rejected: " + error.message;
      return;
    }

    const request = Array.isArray(data) ? data[0] : data;
    if (feedback) {
      feedback.textContent = request
        ? "Request submitted for approval. Reference: " + request.journal_number + ". Status: " + request.journal_status + ". No balance was changed by this request."
        : "Request submitted, but no reference was returned. Check the pending approvals list before retrying.";
    }
    if (request) form.reset();
  } catch (err) {
    if (feedback) feedback.textContent = "Could not submit request. Check your connection and pending approvals before retrying.";
  } finally {
    if (button) button.disabled = false;
  }
};

window.loadCashApprovals = async function() {
  const pendingEl = document.getElementById("pending-cash-requests");
  const readyEl = document.getElementById("ready-posting-requests");
  const feedback = document.getElementById("approval-feedback");
  if (!pendingEl || !readyEl || !db) return;
  pendingEl.textContent = "Loading pending requests…";
  readyEl.textContent = "Loading approved requests…";
  const pending = await db.rpc("list_pending_cash_transaction_requests", { p_branch_id: null });
  if (pending.error) {
    pendingEl.textContent = "Could not load requests: " + pending.error.message;
  } else {
    const rows = (pending.data || []).filter(r => !r.approved_by);
    pendingEl.innerHTML = rows.length ? rows.map(r =>
      '<div class="list-item"><div><strong>' + esc(r.journal_number) + '</strong> — ' + esc(r.transaction_type) +
      '<br><span class="muted">Account: ' + esc(r.account_number) + ' | Branch: ' + esc(r.branch_name) +
      '</span><br><strong>' + Number(r.amount).toLocaleString() + ' ' + esc(r.currency_code) +
      '</strong></div><button type="button" class="primary" data-approve-journal="' + esc(r.journal_id) +
      '">Approve request</button></div>'
    ).join("") : '<p class="muted">No pending requests available for your access.</p>';
  }
  const ready = await db.rpc("list_cash_transactions_ready_to_post", { p_branch_id: null });
  if (ready.error) {
    readyEl.textContent = "Could not load approved requests: " + ready.error.message;
  } else {
    const rows = ready.data || [];
    readyEl.innerHTML = rows.length ? rows.map(r =>
      '<div class="list-item"><div><strong>' + esc(r.journal_number) + '</strong> — ' + esc(r.transaction_type) +
      '<br><span class="muted">Account: ' + esc(r.account_number) + ' | Branch: ' + esc(r.branch_name) +
      '</span><br><strong>' + Number(r.amount).toLocaleString() + ' ' + esc(r.currency_code) +
      '</strong></div><div><label>Cash ledger UUID<input data-cash-ledger="' + esc(r.journal_id) +
      '" type="text" placeholder="Active asset ledger UUID"></label><button type="button" class="primary" data-post-journal="' +
      esc(r.journal_id) + '">Post to ledger</button></div></div>'
    ).join("") : '<p class="muted">No approved requests are ready for posting. Requester and approver cannot post the same transaction.</p>';
  }
  if (feedback) feedback.textContent = "Lists refreshed. Money moves only after successful ledger posting.";
};

window.approveCashRequest = async function(journalId) {
  if (!db || !journalId) return;
  if (!confirm("Approve this request? You cannot approve a request you created. Posting is a separate step.")) return;
  const feedback = document.getElementById("approval-feedback");
  if (feedback) feedback.textContent = "Submitting approval…";
  const result = await db.rpc("approve_cash_transaction_request", { p_journal_id: journalId });
  if (result.error) {
    if (feedback) feedback.textContent = "Approval failed: " + result.error.message;
    return;
  }
  if (feedback) feedback.textContent = "Approved. It still requires ledger posting by another eligible employee.";
  await window.loadCashApprovals();
};

window.postApprovedCashRequest = async function(journalId) {
  if (!db || !journalId) return;
  const input = document.querySelector('[data-cash-ledger="' + journalId + '"]');
  const cashLedgerId = input ? input.value.trim() : "";
  if (!cashLedgerId) { alert("Enter the active cash ledger UUID first."); return; }
  if (!confirm("Post this approved transaction? Verify account, amount, currency, branch and ledger before continuing.")) return;
  const feedback = document.getElementById("approval-feedback");
  if (feedback) feedback.textContent = "Posting transaction…";
  const result = await db.rpc("post_approved_cash_transaction", {
    p_journal_id: journalId,
    p_cash_ledger_account_id: cashLedgerId
  });
  if (result.error) {
    if (feedback) feedback.textContent = "Posting blocked: " + result.error.message;
    return;
  }
  if (feedback) feedback.textContent = "Ledger posting completed. Verify the posted record before printing a transaction receipt.";
  await window.loadCashApprovals();
};

document.addEventListener("click", function(event) {
  const approveButton = event.target.closest("[data-approve-journal]");
  if (approveButton) window.approveCashRequest(approveButton.getAttribute("data-approve-journal"));
  const postButton = event.target.closest("[data-post-journal]");
  if (postButton) window.postApprovedCashRequest(postButton.getAttribute("data-post-journal"));
});

window.previewStaffMessage = function() {
  const input = document.getElementById("chat-preview");
  const output = document.getElementById("chat-preview-result");
  if (!input || !output) return;
  output.textContent = input.value.trim()
    ? "Draft preview only: " + input.value.trim()
    : "Enter a message to preview. Nothing has been sent or saved.";
};

window.printTestReceipt = function() {
  const receipt = document.getElementById("test-receipt");
  if (!receipt) return;
  const printWindow = window.open("", "_blank", "width=420,height=650");
  if (!printWindow) {
    alert("Please allow pop-ups for this site, then try printing again.");
    return;
  }
  printWindow.document.write(`<!doctype html><html><head><title>Printer Test</title>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <style>
      @page { size: 80mm auto; margin: 4mm; }
      body { font: 12px/1.45 monospace; color: #000; width: 72mm; margin: 0 auto; }
      h3 { font-size: 14px; text-align: center; }
      p { margin: 7px 0; text-align: center; }
      hr { border: 0; border-top: 1px dashed #000; }
      .warning { font-weight: bold; }
    </style></head><body>
    <h3>ZIVAMUNTUYO FINANCIAL SERVICES LTD</h3>
    <p class="warning">PRINTER TEST — NOT A TRANSACTION</p><hr>
    <p>Paper layout test</p><p>Windows 10 / Windows 11</p><p>Amount: UGX 0</p>
    <hr><p class="warning">TEST ONLY — NO MONEY RECEIVED OR PAID</p>
    <script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};};<\/script>
    </body></html>`);
  printWindow.document.close();
};

window.showAttendanceDeviceHelp = function() {
  const select = document.getElementById("attendance-device");
  const help = document.getElementById("attendance-device-help");
  if (!select || !help) return;
  const messages = {
    zkteco: "ZKTeco: prefer a documented ADMS/push protocol or supported SDK for the exact terminal. LAN pull protocols vary by model and firmware.",
    suprema: "Suprema: use a supported BioStar API/SDK for the installed version and configure the terminal through its authorized administrator.",
    hikvision: "Hikvision: use the documented ISAPI/API or SDK only on compatible access-control models; confirm event and biometric support for the exact firmware.",
    secugen: "SecuGen USB: requires the matching Windows driver and vendor SDK plus a local connector service; browser JavaScript alone is not enough.",
    digitalpersona: "DigitalPersona / HID: requires the supported device driver and vendor SDK/connector. Confirm the specific reader and SDK licensing before purchase.",
    generic: "Other devices: integration requires a documented vendor SDK, API, or standard event export. Devices without a supported interface cannot be guaranteed compatible."
  };
  help.textContent = messages[select.value] || messages.generic;
};

function initApp() {
  document.querySelectorAll('.nav').forEach(btn => {
    btn.addEventListener('click', (e) => {
      window.switchPage(e.currentTarget.dataset.page);
    });
  });
  window.switchPage("Dashboard");
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
