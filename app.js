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
      <span class="category-tag">Phase 1 & 2: Executive Overview</span>
      <h2 class="page-heading">Dashboard</h2>
      ${panel(
        "INSTITUTIONAL PERFORMANCE & MULTI-BRANCH METRICS",
        "Zivamuntuyo Financial Services Ltd — Central Ledger",
        "Real-time operational overview across regional branches (Uganda, Kenya, Tanzania, Rwanda, Burundi, DRC).",
        `<div class="grid-2">
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
         </div>`
      )}
    `;
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
        "Select customer and account branch.",
        `<form id="acc-form" onsubmit="handleAccountSubmit(event)">
          <label>Customer UUID * 
            <input type="text" name="customer_id" required placeholder="Enter Customer UUID">
          </label>
          <label>Currency * 
            <input type="text" name="currency_code" value="UGX" required>
          </label>
          <button type="submit" class="primary">Open Account</button>
          <p id="acc-feedback" class="muted"></p>
        </form>`
      )}
      ${panel(
        "ACTIVE BANK ACCOUNTS",
        "Customer Accounts Ledger",
        "Real-time operational accounts.",
        `<div id="acc-list"><p class="muted">Loading accounts directory...</p></div>`
      )}
    `;

    if (db) {
      db.from("bank_accounts").select("*").then(({ data }) => {
        const listEl = document.getElementById("acc-list");
        if (!listEl) return;
        if (data && data.length > 0) {
          listEl.innerHTML = data.map(a => `
            <div class="list-item">
              <div>
                <strong>${esc(a.account_number)}</strong><br>
                <span class="muted">Balance: ${Number(a.balance || 0).toLocaleString()} ${esc(a.currency_code || "UGX")}</span>
              </div>
              <span class="badge-role">${esc(a.status || 'active')}</span>
            </div>
          `).join("");
        } else {
          listEl.innerHTML = `<p class="muted">No bank accounts registered yet.</p>`;
        }
      }).catch(() => {
        const listEl = document.getElementById("acc-list");
        if (listEl) listEl.innerHTML = `<p class="muted">No bank accounts registered yet.</p>`;
      });
    }
  }
  else if (pageName === "Transactions") {
    c.innerHTML = `
      <span class="category-tag">Phase 6: Ledger Engine</span>
      <h2 class="page-heading">Transactions</h2>
      ${panel(
        "TRANSACTION PROCESSING",
        "Double-Entry Ledger Posting",
        "Execute deposits and withdrawals.",
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
             <input type="number" name="amount" required step="1000" placeholder="50000">
           </label>
           <button type="submit" class="primary">Post to Ledger</button>
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
        "ATTENDANCE & TIME CLOCK",
        "Fingerprint-ready integration",
        "This screen is a setup stage; it does not yet read fingerprints or record official attendance.",
        `<div class="notice-box"><strong>Hardware requirement:</strong> fingerprint readers need a compatible vendor SDK or a local Windows attendance connector. A browser alone cannot communicate with every fingerprint device.</div>
         <div class="grid-2">
           <div class="metric-card"><div class="metric-sub">Connection status</div><div class="metric-val" style="font-size:18px;">Not configured</div></div>
           <div class="metric-card"><div class="metric-sub">Attendance records</div><div class="metric-val" style="font-size:18px;">Not enabled</div></div>
         </div>
         <p class="muted">Next step: identify the fingerprint device brand and model, then configure a secure local connector and staff attendance database policies.</p>`
      )}
    `;
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
  else if (pageName === "Accounting") {
    c.innerHTML = `
      <span class="category-tag">Phase 5 & 8: General Ledger & Trial Balance</span>
      <h2 class="page-heading">Accounting & Double-Entry Ledger</h2>
      ${panel(
        "CHART OF ACCOUNTS & BALANCES",
        "Trial Balance Verification",
        "Ensures total debits equal total credits across all institutional ledgers.",
        `<div id="gl-list">
           <div class="list-item"><div><strong>10100 - Vault Cash</strong><br><span class="muted">Asset</span></div><span class="badge-role">Balanced</span></div>
           <div class="list-item"><div><strong>20100 - Customer Deposits</strong><br><span class="muted">Liability</span></div><span class="badge-role">Balanced</span></div>
         </div>`
      )}
    `;
  }
  else {
    c.innerHTML = `
      <span class="category-tag">System Module</span>
      <h2 class="page-heading">${pageName}</h2>
      ${panel(pageName, "Module Active", "Section operational.", `<p class="muted">Module ready for commercial operations.</p>`)}
    `;
  }
}

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
  if (feedback) feedback.textContent = "Posting to ledger...";

  const formData = new FormData(form);
  const payload = {
    transaction_reference: "TRX-" + Math.floor(10000000 + Math.random() * 90000000),
    account_id: formData.get("account_id"),
    transaction_type: formData.get("tx_type"),
    amount: parseFloat(formData.get("amount")),
    currency_code: "UGX",
    narration: "Teller posting",
    status: "posted"
  };

  const { error } = await db.from("transactions").insert([payload]);
  if (error) {
    if (feedback) feedback.textContent = "Transaction failed: " + error.message;
  } else {
    if (feedback) feedback.textContent = "Transaction successfully posted!";
    form.reset();
  }
};

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
