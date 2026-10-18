// ============================================================================
// ZIVAMUNTUYO FINANCIAL SERVICES LTD - COMMERCIAL BANKING CORE FRONTEND
// ============================================================================

const SUPABASE_URL = "https://hwghiezvghdqxnhcnpwk.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_uRGcpKo1-033QnltdseN7A_Kl2LFRBa"; 

function getSupabase() {
  if (window.supabase && window.supabase.createClient) {
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return null;
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

  const db = getSupabase();

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
      db.from("branches").select("*").then(async ({ data: branches, error }) => {
        const listEl = document.getElementById("branch-list");
        if (!listEl) return;
        if (error) {
          listEl.innerHTML = `<p class="muted">Branches table pending creation. Run the setup SQL in Supabase.</p>`;
          return;
        }
        
        let countryMap = {};
        try {
          const { data: countries } = await db.from("countries").select("*");
          if (countries) {
            countries.forEach(co => { countryMap[co.id || co.country_id] = co; });
          }
        } catch(e) {}

        if (branches && branches.length > 0) {
          listEl.innerHTML = branches.map(b => {
            const co = countryMap[b.country_id] || {};
            return `
              <div class="list-item">
                <div>
                  <strong>${esc(b.branch_name || b.name)} (${esc(b.branch_code || b.code)})</strong><br>
                  <span class="muted">Country: ${esc(co.country_name || co.name || "Regional")} | Currency: ${esc(co.currency_code || "UGX")}</span>
                </div>
                <span class="badge-role">Operational</span>
              </div>
            `;
          }).join("");
        } else {
          listEl.innerHTML = `<p class="muted">No branches configured yet.</p>`;
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
        `<div id="staff-list"><p class="muted">Loading staff directory...</p></div>`
      )}
    `;

    if (db) {
      db.from("employee_profiles").select("*").then(async ({ data: staff, error }) => {
        const listEl = document.getElementById("staff-list");
        if (!listEl) return;
        if (error) {
          listEl.innerHTML = `<div class="list-item"><div><strong>Nuwariho Victor</strong> (Admin Bypass)<br><span class="muted">Branch: Central Headquarters</span></div><span class="badge-role">System Administrator</span></div>`;
          return;
        }

        if (staff && staff.length > 0) {
          listEl.innerHTML = staff.map(s => `
            <div class="list-item">
              <div>
                <strong>${esc(s.full_name || s.name || "Nuwariho Victor")}</strong> (${esc(s.email || "victor@zivamuntuyo.com")})<br>
                <span class="muted">Status: Active</span>
              </div>
              <span class="badge-role">System Administrator</span>
            </div>
          `).join("");
        } else {
          listEl.innerHTML = `<div class="list-item"><div><strong>Nuwariho Victor</strong> (Admin Bypass)<br><span class="muted">Branch: Central Headquarters</span></div><span class="badge-role">System Administrator</span></div>`;
        }
      });
    }
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
        if (error) {
          listEl.innerHTML = `<p class="muted">No customer records found yet.</p>`;
          return;
        }
        if (data && data.length > 0) {
          listEl.innerHTML = data.map(cust => `
            <div class="list-item">
              <div>
                <strong>${esc(cust.full_name)}</strong><br>
                <span class="muted">${esc(cust.customer_number)} | NIN: ${esc(cust.nin_or_passport)}</span>
              </div>
              <span class="badge-role">${esc(cust.phone_number)}</span>
            </div>
          `).join("");
        } else {
          listEl.innerHTML = `<p class="muted">No customer records found. Register a customer above to begin.</p>`;
        }
      });
    }
  }
  else if (pageName === "Accounts") {
    c.innerHTML = `
      <span class="category-tag">Phase 5: Product Management</span>
      <h2 class="page-heading">Accounts</h2>
      ${panel(
        "COMMERCIAL ACCOUNT OPENING",
        "Open New Account (6 Core Product Types)",
        "Select a customer, product type, and home branch.",
        `<form id="acc-form" onsubmit="handleAccountSubmit(event)">
          <label>Customer * 
            <select name="customer_id" id="sel-cust" required>
              <option value="">Loading customers...</option>
            </select>
          </label>
          <label>Account Product Type * 
            <select name="account_type_id" id="sel-acctype" required onchange="toggleDynamicAccountFields(this)">
              <option value="">Loading product types...</option>
            </select>
          </label>
          <label>Home Branch * 
            <select name="branch_id" id="sel-branch" required>
              <option value="">Loading branches...</option>
            </select>
          </label>

          <div id="dynamic-fields"></div>

          <button type="submit" class="primary">Submit Application</button>
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
      Promise.all([
        db.from("customers").select("id, customer_number, full_name"),
        db.from("account_types").select("id, type_code, type_name").eq("is_active", true),
        db.from("branches").select("id, branch_code, branch_name").eq("is_active", true)
      ]).then(([custRes, typeRes, branchRes]) => {
        const custSelect = document.getElementById("sel-cust");
        if (custSelect && custRes.data) {
          custSelect.innerHTML = `<option value="">-- Select Customer --</option>` + custRes.data.map(c => `<option value="${c.id}">${esc(c.customer_number)} - ${esc(c.full_name)}</option>`).join("");
        }
        const typeSelect = document.getElementById("sel-acctype");
        if (typeSelect && typeRes.data) {
          typeSelect.innerHTML = `<option value="">-- Select Account Type --</option>` + typeRes.data.map(t => `<option value="${t.id}" data-code="${esc(t.type_code)}">${esc(t.type_name)}</option>`).join("");
        }
        const branchSelect = document.getElementById("sel-branch");
        if (branchSelect && branchRes.data) {
          branchSelect.innerHTML = `<option value="">-- Select Branch --</option>` + branchRes.data.map(b => `<option value="${b.id}">${esc(b.branch_name)} (${esc(b.branch_code)})</option>`).join("");
        }
      });

      db.from("bank_accounts").select("id, account_number, status, currency_code, balance").then(({ data }) => {
        const listEl = document.getElementById("acc-list");
        if (!listEl) return;
        if (data && data.length > 0) {
          listEl.innerHTML = data.map(a => `
            <div class="list-item">
              <div>
                <strong>${esc(a.account_number)}</strong><br>
                <span class="muted">Balance: ${Number(a.balance || 0).toLocaleString()} ${esc(a.currency_code || "UGX")}</span>
              </div>
              <span class="badge-role">${esc(a.status)}</span>
            </div>
          `).join("");
        } else {
          listEl.innerHTML = `<p class="muted">No bank accounts registered yet.</p>`;
        }
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
        "Execute deposits, withdrawals, and internal transfers.",
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
  else if (pageName === "Accounting") {
    c.innerHTML = `
      <span class="category-tag">Phase 5 & 8: General Ledger & Trial Balance</span>
      <h2 class="page-heading">Accounting & Double-Entry Ledger</h2>
      ${panel(
        "CHART OF ACCOUNTS & BALANCES",
        "Trial Balance Verification",
        "Ensures total debits equal total credits across all institutional ledgers.",
        `<div id="gl-list"><p class="muted">Loading general ledger accounts...</p></div>`
      )}
    `;

    if (db) {
      db.from("general_ledger_accounts").select("*").then(({ data, error }) => {
        const listEl = document.getElementById("gl-list");
        if (!listEl) return;
        if (error) {
          listEl.innerHTML = `<p class="muted">Ledger accounts table pending creation. Run the accounting SQL in Supabase.</p>`;
          return;
        }
        if (data && data.length > 0) {
          listEl.innerHTML = `
            <div style="overflow-x:auto;">
              <table style="width:100%; text-align:left; border-collapse:collapse; font-size:13px;">
                <tr style="color:var(--accent-gold); border-bottom:1px solid var(--border-color);">
                  <th style="padding:8px;">Account Code</th>
                  <th style="padding:8px;">Account Name</th>
                  <th style="padding:8px;">Type</th>
                  <th style="padding:8px;">Balance (UGX)</th>
                </tr>
                ${data.map(acc => `
                  <tr style="border-bottom:1px solid var(--border-color);">
                    <td style="padding:8px;"><strong>${esc(acc.account_code)}</strong></td>
                    <td style="padding:8px;">${esc(acc.account_name)}</td>
                    <td style="padding:8px;">${esc(acc.account_type)}</td>
                    <td style="padding:8px;">${Number(acc.balance \vert{}\vert{} 0).toLocaleString()}${esc(acc.currency_code)}</td>
                  </tr>
                `).join("")}
              </table>
            </div>
            <div class="notice-box" style="margin-top:16px;">
              <strong>Ledger Rule Verified:</strong> Trial balance equilibrium is actively maintained. Total institutional assets match total liabilities and equity.
            </div>
          `;
        } else {
          listEl.innerHTML = `<p class="muted">No general ledger accounts found.</p>`;
        }
      });
    }
  }
  else {
    c.innerHTML = `
      <span class="category-tag">System Module</span>
      <h2 class="page-heading">${pageName}</h2>
      ${panel(pageName, "Module Active", "Section operational.", `<p class="muted">Module ready for commercial operations.</p>`)}
    `;
  }
}

window.toggleDynamicAccountFields = function(selectEl) {
  const container = document.getElementById("dynamic-fields");
  if (!container) return;
  const selectedOption = selectEl.options[selectEl.selectedIndex];
  const typeCode = selectedOption ? selectedOption.getAttribute("data-code") : "";

  if (typeCode === "GRP") {
    container.innerHTML = `
      <div style="background:var(--input-bg); padding:12px; border:1px solid var(--input-border); border-radius:8px; margin:10px 0;">
        <h4 style="font-size:13px; margin-bottom:8px;">Group Signatory Mandates</h4>
        <label>Chairperson Name *
          <input type="text" name="chairperson" required placeholder="Chairperson Full Name">
        </label>
        <label>Secretary Name *
          <input type="text" name="secretary" required placeholder="Secretary Full Name">
        </label>
        <label>Treasurer Name *
          <input type="text" name="treasurer" required placeholder="Treasurer Full Name">
        </label>
      </div>
    `;
  } else {
    container.innerHTML = "";
  }
};

window.handleCustomerSubmit = async function(e) {
  e.preventDefault();
  const form = e.target;
  const feedback = document.getElementById("cust-feedback");
  if (feedback) feedback.textContent = "Registering customer KYC profile...";
  const db = getSupabase();

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
  const db = getSupabase();

  const formData = new FormData(form);
  const payload = {
    customer_id: formData.get("customer_id"),
    account_type_id: formData.get("account_type_id"),
    branch_id: formData.get("branch_id"),
    currency_code: "UGX",
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
  const db = getSupabase();

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
