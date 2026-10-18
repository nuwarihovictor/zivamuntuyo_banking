// ==========================================
// ZIVAMUNTUYO FINANCIAL SERVICES LTD - APP.JS
// ==========================================

const SUPABASE_URL = "https://hwghiezvghdqxnhcnpwk.supabase.co";
// PASTE YOUR SUPABASE ANON PUBLIC KEY HERE:
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY_HERE"; 

const db = (window.supabase && SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY_HERE") 
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
      <p style="color:#9ca3af; font-size:13px; margin-bottom:12px;"><strong>${esc(subtitle)}</strong> — ${esc(desc)}</p>
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
      "Configuration Required",
      "Supabase connection key missing.",
      `<p style="color:#ef4444; font-size:13px;">Please paste your Supabase <strong>anon public key</strong> into <code>app.js</code> on line 8 to enable database access.</p>`
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
           <p style="font-size:24px; font-weight:bold; margin-top:6px; color:#fff;">Double-Entry</p>
         </div>
         <div style="background:rgba(0,0,0,0.25); padding:16px; border-radius:8px; border:1px solid #1e4637;">
           <h3 style="font-size:11px; color:#d97706; text-transform:uppercase;">System Status</h3>
           <p style="font-size:24px; font-weight:bold; color:#4ade80; margin-top:6px;">Online</p>
         </div>
       </div>`
    );
  } 
  else if (page === "Customers") {
    c.innerHTML = panel(
      "CUSTOMER MANAGEMENT",
      "Registered Bank Customers",
      "Directory of verified customers in the Zivamuntuyo database.",
      `<div id="cust-list"><p class="muted">Loading customers...</p></div>`
    );

    async function loadCustomers() {
      try {
        const { data, error } = await db.from("customers").select("*").limit(50);
        const listEl = document.getElementById("cust-list");
        if (error) throw error;

        if (data && data.length > 0) {
          listEl.innerHTML = `<div style="overflow-x:auto;"><table style="width:100%; text-align:left; border-collapse:collapse; font-size:13px;">
            <tr style="color:#d97706; border-bottom:1px solid #1e4637;"><th style="padding:8px;">Customer Number / ID</th><th style="padding:8px;">Status</th></tr>
            ${data.map(cust => `<tr style="border-bottom:1px solid #1e4637;">
              <td style="padding:8px;"><strong>${esc(cust.customer_number || cust.id)}</strong></td>
              <td style="padding:8px;"><span style="background:rgba(21,128,61,0.2); color:#4ade80; padding:2px 8px; border-radius:4px; font-size:11px;">Active</span></td>
            </tr>`).join("")}
          </table></div>`;
        } else {
          listEl.innerHTML = `<p style="color:#9ca3af; font-size:13px;">No customers found in database.</p>`;
        }
      } catch (err) {
        document.getElementById("cust-list").innerHTML = `<p style="color:#ef4444; font-size:13px;">Error: ${esc(err.message)}</p>`;
      }
    }
    loadCustomers();
  }
  else if (page === "Accounts") {
    c.innerHTML = panel(
      "ACCOUNT OPENING REQUEST",
      "Submit New Account Application",
      "Choose an approved customer, account type, and home branch.",
      `<form id="acc-form" style="display:flex; flex-direction:column; gap:12px; max-width:400px;">
        <label style="font-size:12px; font-weight:600; color:#d1d5db; display:flex; flex-direction:column; gap:4px;">Customer * 
          <select name="customer_id" id="sel-cust" required style="background:rgba(0,0,0,0.3); border:1px solid #1e4637; border-radius:6px; padding:10px; color:#fff;">
            <option value="">Loading customers...</option>
          </select>
        </label>
        <label style="font-size:12px; font-weight:600; color:#d1d5db; display:flex; flex-direction:column; gap:4px;">Account Type * 
          <select name="account_type_id" id="sel-acctype" required style="background:rgba(0,0,0,0.3); border:1px solid #1e4637; border-radius:6px; padding:10px; color:#fff;">
            <option value="">Loading account types...</option>
          </select>
        </label>
        <label style="font-size:12px; font-weight:600; color:#d1d5db; display:flex; flex-direction:column; gap:4px;">Branch * 
          <select name="branch_id" id="sel-branch" required style="background:rgba(0,0,0,0.3); border:1px solid #1e4637; border-radius:6px; padding:10px; color:#fff;">
            <option value="">Loading branches...</option>
          </select>
        </label>
        <label style="font-size:12px; font-weight:600; color:#d1d5db; display:flex; flex-direction:column; gap:4px;">Currency * 
          <select name="currency_code" id="sel-curr" required style="background:rgba(0,0,0,0.3); border:1px solid #1e4637; border-radius:6px; padding:10px; color:#fff;">
            <option value="UGX">UGX - Uganda Shilling</option>
          </select>
        </label>
        <button type="submit" style="background:#15803d; color:#fff; border:none; border-radius:6px; padding:10px; font-weight:600; cursor:pointer; margin-top:6px;">Submit Account Request</button>
        <p id="acc-msg" style="color:#ef4444; font-size:12px;"></p>
      </form>`
    ) + panel(
      "CUSTOMER ACCOUNTS LIST",
      "Bank Accounts Directory",
      "Real-time list of bank accounts.",
      `<div id="acc-list"><p class="muted">Loading accounts...</p></div>`
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
        console.error("Error loading dropdowns:", err);
      }
    }

    async function loadAccounts() {
      try {
        const { data, error } = await db.from("bank_accounts").select("id, account_number, status, currency_code, created_at");
        const listEl = document.getElementById("acc-list");
        if (error) throw error;

        if (data && data.length > 0) {
          listEl.innerHTML = `<div style="overflow-x:auto;"><table style="width:100%; text-align:left; border-collapse:collapse; font-size:13px;">
            <tr style="color:#d97706; border-bottom:1px solid #1e4637;"><th style="padding:8px;">Account Number</th><th style="padding:8px;">Currency</th><th style="padding:8px;">Status</th></tr>
            ${data.map(a => `<tr style="border-bottom:1px solid #1e4637;">
              <td style="padding:8px;"><strong>${esc(a.account_number || a.id.substring(0,8))}</strong></td>
              <td style="padding:8px;">${esc(a.currency_code || "UGX")}</td>
              <td style="padding:8px;"><span style="background:rgba(21,128,61,0.2); color:#4ade80; padding:2px 8px; border-radius:4px; font-size:11px;">${esc(a.status || "active")}</span></td>
            </tr>`).join("")}
          </table></div>`;
        } else {
          listEl.innerHTML = `<p style="color:#9ca3af; font-size:13px;">No bank accounts registered yet.</p>`;
        }
      } catch (err) {
        document.getElementById("acc-list").innerHTML = `<p style="color:#ef4444; font-size:13px;">Could not load accounts: ${esc(err.message)}</p>`;
      }
    }

    loadDropdowns();
    loadAccounts();
  }
  else {
    c.innerHTML = panel(page.toUpperCase(), "Module Active", "Section operational.", `<p style="color:#9ca3af; font-size:13px;">Module content ready for testing.</p>`);
  }
};

window.onload = () => {
  if (window.renderPage) window.renderPage("Dashboard");
};
