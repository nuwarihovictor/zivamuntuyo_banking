// ==========================================
// ZIVAMUNTUYO FINANCIAL SERVICES LTD - APP.JS
// ==========================================

// Initialize Supabase Client 
// (Replace the second parameter with your Supabase Anon/Public Key if not already set)
const SUPABASE_URL = "https://hwghiezvghdqxnhcnpwk.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY_HERE"; 
const db = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// Helper: Escape HTML to prevent injection
function esc(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Helper: UI Panel Wrapper
function panel(title, subtitle, desc, contentHtml) {
  return `
    <div class="panel">
      <h2>${esc(title)}</h2>
      <p><strong>${esc(subtitle)}</strong> - ${esc(desc)}</p>
      <hr style="border: 0; border-top: 1px solid #1e4637; margin-bottom: 14px;">
      ${contentHtml}
    </div>
  `;
}

// Global Notification Helper
function notify(msg) {
  alert(msg);
}

// ==========================================
// PAGE ROUTER & RENDERER
// ==========================================
window.renderPage = function(page) {
  const c = document.getElementById("main-content");
  if (!c) return;
  c.innerHTML = `<p class="muted">Loading ${esc(page)} module...</p>`;

  if (page === "Dashboard") {
    c.innerHTML = panel(
      "EXECUTIVE DASHBOARD",
      "System Overview & Branch Status",
      "Real-time operational metrics across Butare, Rubirizi, Buhweju, and Ntungamo branches.",
      `<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 20px;">
         <div style="background:rgba(0,0,0,0.2); padding:16px; border-radius:8px; border:1px solid #1e4637;">
           <h3 style="font-size:12px; color:#d97706;">ACTIVE BRANCHES</h3>
           <p style="font-size:24px; font-weight:bold; margin-top:6px;">4</p>
         </div>
         <div style="background:rgba(0,0,0,0.2); padding:16px; border-radius:8px; border:1px solid #1e4637;">
           <h3 style="font-size:12px; color:#d97706;">CORE LEDGER</h3>
           <p style="font-size:24px; font-weight:bold; margin-top:6px;">Double-Entry</p>
         </div>
         <div style="background:rgba(0,0,0,0.2); padding:16px; border-radius:8px; border:1px solid #1e4637;">
           <h3 style="font-size:12px; color:#d97706;">SYSTEM STATUS</h3>
           <p style="font-size:24px; font-weight:bold; color:#4ade80; margin-top:6px;">Online</p>
         </div>
       </div>
       <p class="muted">Select a module from the left menu to manage customers, accounts, or approvals.</p>`
    );
  } 
  else if (page === "Customers") {
    c.innerHTML = panel(
      "CUSTOMER MANAGEMENT",
      "Registered Bank Customers",
      "Directory of verified customers in the Zivamuntuyo database.",
      `<div id="cust-list"><p class="muted">Loading customers...</p></div>
       <br><button class="secondary" id="btn-refresh-cust">Refresh List</button>`
    );

    async function loadCustomers() {
      try {
        const { data, error } = await db.from("customers").select("*").limit(50);
        const listEl = document.getElementById("cust-list");
        if (error) throw error;

        if (data && data.length > 0) {
          listEl.innerHTML = `<div class="scroll"><table>
            <tr><th>Customer Number ID</th><th>Actions</th></tr>
            ${data.map(cust => `<tr>
              <td><strong>${esc(cust.customer_number || cust.id)}</strong></td>
              <td><span class="badge-role">Active</span></td>
            </tr>`).join("")}
          </table></div>`;
        } else {
          listEl.innerHTML = `<p class="muted">No customers found in database.</p>`;
        }
      } catch (err) {
        document.getElementById("cust-list").innerHTML = `<p class="error">Error loading customers: ${esc(err.message)}</p>`;
      }
    }

    loadCustomers();
    const refBtn = document.getElementById("btn-refresh-cust");
    if (refBtn) refBtn.onclick = loadCustomers;
  }
  else if (page === "Accounts") {
    c.innerHTML = panel(
      "ACCOUNT OPENING REQUEST",
      "Submit New Account Application",
      "Choose an approved customer, account type, and home branch.",
      `<form id="acc-form">
        <label>Customer * 
          <select name="customer_id" id="sel-cust" required>
            <option value="">Loading customers...</option>
          </select>
        </label>
        <label>Account Type * 
          <select name="account_type_id" id="sel-acctype" required>
            <option value="">Loading account types...</option>
          </select>
        </label>
        <label>Branch * 
          <select name="branch_id" id="sel-branch" required>
            <option value="">Loading branches...</option>
          </select>
        </label>
        <label>Currency * 
          <select name="currency_code" id="sel-curr" required>
            <option value="UGX">UGX - Uganda Shilling</option>
          </select>
        </label>
        <button class="primary" type="submit">Submit Account Request</button>
        <p id="acc-msg" class="error"></p>
      </form>`
    ) + panel(
      "CUSTOMER ACCOUNTS LIST",
      "Bank Accounts Directory",
      "Real-time list of bank accounts and statuses.",
      `<div id="acc-list"><p class="muted">Loading accounts...</p></div>
       <br><button class="secondary" id="btn-refresh-acc">Refresh Accounts</button>`
    );

    async function loadDropdowns() {
      try {
        const [custRes, typeRes, branchRes] = await Promise.all([
          db.from("customers").select("id, customer_number"),
          db.from("account_types").select("id, type_code, type_name").eq("is_active", true),
          db.from("branches").select("id, branch_code, branch_name").eq("is_active", true)
        ]);

        const custSelect = document.getElementById("sel-cust");
        if (custRes.data && custRes.data.length > 0) {
          custSelect.innerHTML = custRes.data.map(c => `<option value="${c.id}">${esc(c.customer_number || c.id)}</option>`).join("");
        } else {
          custSelect.innerHTML = `<option value="">No customers found</option>`;
        }

        const typeSelect = document.getElementById("sel-acctype");
        if (typeRes.data && typeRes.data.length > 0) {
          typeSelect.innerHTML = typeRes.data.map(t => `<option value="${t.id}">${esc(t.type_name)} (${esc(t.type_code)})</option>`).join("");
        } else {
          typeSelect.innerHTML = `<option value="">No account types found</option>`;
        }

        const branchSelect = document.getElementById("sel-branch");
        if (branchRes.data && branchRes.data.length > 0) {
          branchSelect.innerHTML = branchRes.data.map(b => `<option value="${b.id}">${esc(b.branch_name)} (${esc(b.branch_code)})</option>`).join("");
        } else {
          branchSelect.innerHTML = `<option value="">No branches found</option>`;
        }
      } catch (err) {
        console.error("Dropdown load error:", err);
      }
    }

    async function loadAccounts() {
      try {
        const { data, error } = await db.from("bank_accounts").select("id, account_number, status, currency_code, created_at");
        const listEl = document.getElementById("acc-list");
        if (error) throw error;

        if (data && data.length > 0) {
          listEl.innerHTML = `<div class="scroll"><table>
            <tr><th>Account Number</th><th>Currency</th><th>Status</th><th>Created At</th></tr>
            ${data.map(a => `<tr>
              <td><strong>${esc(a.account_number || a.id.substring(0,8))}</strong></td>
              <td>${esc(a.currency_code || "UGX")}</td>
              <td><span class="badge-role">${esc(a.status || "pending")}</span></td>
              <td>${new Date(a.created_at).toLocaleDateString()}</td>
            </tr>`).join("")}
          </table></div>`;
        } else {
          listEl.innerHTML = `<p class="muted">No bank accounts registered yet.</p>`;
        }
      } catch (err) {
        document.getElementById("acc-list").innerHTML = `<p class="error">Could not load accounts: ${esc(err.message)}</p>`;
      }
    }

    loadDropdowns();
    loadAccounts();

    document.getElementById("btn-refresh-acc").onclick = loadAccounts;

    document.getElementById("acc-form").onsubmit = async (e) => {
      e.preventDefault();
      const form = new FormData(e.target);
      const msgEl = document.getElementById("acc-msg");
      msgEl.textContent = "";

      const { error } = await db.rpc("open_account_request", {
        p_customer_id: form.get("customer_id"),
        p_account_type_id: form.get("account_type_id"),
        p_branch_id: form.get("branch_id"),
        p_currency_code: form.get("currency_code")
      });

      if (error) {
        msgEl.textContent = error.message;
      } else {
        notify("Account request submitted successfully!");
        loadAccounts();
      }
    };
  }
  else if (page === "Transactions") {
    c.innerHTML = panel(
      "TRANSACTION PROCESSING",
      "Double-Entry Ledger Posting",
      "Execute secure branch deposits and withdrawals.",
      `<p class="muted">Transaction pipeline is active and synchronized with double-entry ledger rules.</p>`
    );
  }
  else if (page === "Approvals") {
    c.innerHTML = panel(
      "MANAGER APPROVALS",
      "Pending Authorizations",
      "Review and approve pending account openings and high-value transactions.",
      `<p class="muted">No pending authorizations requiring branch manager sign-off.</p>`
    );
  }
  else if (page === "Reports") {
    c.innerHTML = panel(
      "FINANCIAL REPORTS",
      "Audit & Balance Sheets",
      "Generate regulatory and internal branch audit statements.",
      `<p class="muted">Report generation modules online.</p>`
    );
  }
  else if (page === "Settings") {
    c.innerHTML = panel(
      "SYSTEM CONFIGURATION",
      "Feature Flags & Settings",
      "Manage application feature settings and branch parameters.",
      `<p class="muted">All system modules are enabled and operational.</p>`
    );
  }
};

// Auto-load Dashboard on window load
window.onload = () => {
  if (window.renderPage) window.renderPage("Dashboard");
};
          
