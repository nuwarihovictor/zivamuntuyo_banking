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
    <div class="panel" style="background:#112d23; border:1px solid #1e4637; border-radius:8px; padding:20px; margin-bottom:20px;">
      <h2 style="color:#fff; font-size:18px; margin-bottom:4px;">${esc(title)}</h2>
      <p style="color:#9ca3af; font-size:13px; margin-bottom:12px;"><strong>${esc(subtitle)}</strong> — ${esc(desc)}</p>
      <hr style="border:0; border-top:1px solid #1e4637; margin-bottom:16px;">
      ${contentHtml}
    </div>
  `;
}

function switchPage(pageName) {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    if (btn.dataset.page === pageName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  const c = document.getElementById("main-content");
  if (!c) return;

  if (pageName === "Dashboard") {
    c.innerHTML = panel(
      "EXECUTIVE COMMERCIAL DASHBOARD",
      "Institutional Overview & Portfolio Health",
      "Real-time metrics across all regional branches and core ledgers.",
      `<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px;">
         <div style="background:rgba(0,0,0,0.25); padding:16px; border-radius:8px; border:1px solid #1e4637;">
           <h3 style="font-size:11px; color:#d97706; text-transform:uppercase;">Core Architecture</h3>
           <p style="font-size:18px; font-weight:bold; margin-top:6px; color:#fff;">Tier-1 Commercial</p>
         </div>
         <div style="background:rgba(0,0,0,0.25); padding:16px; border-radius:8px; border:1px solid #1e4637;">
           <h3 style="font-size:11px; color:#d97706; text-transform:uppercase;">Account Profiles</h3>
           <p style="font-size:18px; font-weight:bold; margin-top:6px; color:#fff;">6 Standard Types</p>
         </div>
         <div style="background:rgba(0,0,0,0.25); padding:16px; border-radius:8px; border:1px solid #1e4637;">
           <h3 style="font-size:11px; color:#d97706; text-transform:uppercase;">Ledger Status</h3>
           <p style="font-size:18px; font-weight:bold; color:#4ade80; margin-top:6px;">Balanced & Online</p>
         </div>
       </div>`
    );
  } 
  else if (pageName === "Customers") {
    c.innerHTML = panel(
      "CUSTOMER ONBOARDING (CIF & KYC)",
      "Register New Bank Customer",
      "Capture verified customer identification details before account creation.",
      `<form id="cust-form" style="display:flex; flex-direction:column; gap:12px; max-width:500px;" onsubmit="handleCustomerSubmit(event)">
        <label style="font-size:12px; font-weight:600; color:#d1d5db; display:flex; flex-direction:column; gap:4px;">Full Legal Name * 
          <input type="text" name="full_name" required placeholder="e.g. Nuwariho Victor" style="background:rgba(0,0,0,0.3); border:1px solid #1e4637; border-radius:6px; padding:10px; color:#fff;">
        </label>
        <label style="font-size:12px; font-weight:600; color:#d1d5db; display:flex; flex-direction:column; gap:4px;">National ID (NIN) or Passport * 
          <input type="text" name="nin_or_passport" required placeholder="CM12345678ABCD" style="background:rgba(0,0,0,0.3); border:1px solid #1e4637; border-radius:6px; padding:10px; color:#fff;">
        </label>
        <label style="font-size:12px; font-weight:600; color:#d1d5db; display:flex; flex-direction:column; gap:4px;">Phone Number * 
          <input type="tel" name="phone_number" required placeholder="+256 700 000000" style="background:rgba(0,0,0,0.3); border:1px solid #1e4637; border-radius:6px; padding:10px; color:#fff;">
        </label>
        <label style="font-size:12px; font-weight:600; color:#d1d5db; display:flex; flex-direction:column; gap:4px;">Email Address 
          <input type="email" name="email" placeholder="victor@zivamuntuyo.com" style="background:rgba(0,0,0,0.3); border:1px solid #1e4637; border-radius:6px; padding:10px; color:#fff;">
        </label>
        <label style="font-size:12px; font-weight:600; color:#d1d5db; display:flex; flex-direction:column; gap:4px;">Physical Address * 
          <input type="text" name="address" required placeholder="Kampala, Uganda" style="background:rgba(0,0,0,0.3); border:1px solid #1e4637; border-radius:6px; padding:10px; color:#fff;">
        </label>
        <button type="submit" style="background:#15803d; color:#fff; border:none; border-radius:6px; padding:10px; font-weight:600; cursor:pointer; margin-top:6px;">Register Customer (CIF)</button>
        <p id="cust-feedback" style="font-size:12px;"></p>
      </form>`
    ) + panel(
      "VERIFIED CUSTOMER DIRECTORY",
      "Active CIF Records",
      "List of all registered bank customers.",
      `<div id="cust-list"><p style="color:#9ca3af;">Loading customer records...</p></div>`
    );

    if (db) {
      db.from("customers").select("*").order("created_at", { ascending: false }).then(({ data, error }) => {
        const listEl = document.getElementById("cust-list");
        if (error) {
          listEl.innerHTML = `<p style="color:#ef4444;">Error accessing records: ${esc(error.message)}</p>`;
          return;
        }
        if (data && data.length > 0) {
          listEl.innerHTML = `<div style="overflow-x:auto;"><table style="width:100%; text-align:left; border-collapse:collapse; font-size:13px;">
            <tr style="color:#d97706; border-bottom:1px solid #1e4637;"><th style="padding:8px;">Customer Number</th><th style="padding:8px;">Full Name</th><th style="padding:8px;">NIN / ID</th><th style="padding:8px;">Phone</th></tr>
            ${data.map(cust => `<tr style="border-bottom:1px solid #1e4637;">
              <td style="padding:8px;"><strong>${esc(cust.customer_number)}</strong></td>
              <td style="padding:8px;">${esc(cust.full_name)}</td>
              <td style="padding:8px;">${esc(cust.nin_or_passport)}</td>
              <td style="padding:8px;">${esc(cust.phone_number)}</td>
            </tr>`).join("")}
          </table></div>`;
        } else {
          listEl.innerHTML = `<p style="color:#9ca3af;">No customer records found. Register a customer above to begin.</p>`;
        }
      });
    }
  }
  else if (pageName === "Accounts") {
    c.innerHTML = panel(
      "COMMERCIAL ACCOUNT OPENING WORKFLOW",
      "Open New Account (6 Core Product Types)",
      "Select a customer and product type. Dynamic fields will adapt for Group Signatories or Fixed Deposits.",
      `<form id="acc-form" style="display:flex; flex-direction:column; gap:12px; max-width:500px;" onsubmit="handleAccountSubmit(event)">
        <label style="font-size:12px; font-weight:600; color:#d1d5db; display:flex; flex-direction:column; gap:4px;">Customer * 
          <select name="customer_id" id="sel-cust" required style="background:rgba(0,0,0,0.3); border:1px solid #1e4637; border-radius:6px; padding:10px; color:#fff;">
            <option value="">Loading customers...</option>
          </select>
        </label>
        <label style="font-size:12px; font-weight:600; color:#d1d5db; display:flex; flex-direction:column; gap:4px;">Account Product Type * 
          <select name="account_type_id" id="sel-acctype" required onchange="toggleDynamicAccountFields(this)" style="background:rgba(0,0,0,0.3); border:1px solid #1e4637; border-radius:6px; padding:10px; color:#fff;">
            <option value="">Loading product types...</option>
          </select>
        </label>
        <label style="font-size:12px; font-weight:600; color:#d1d5db; display:flex; flex-direction:column; gap:4px;">Home Branch * 
          <select name="branch_id" id="sel-branch" required style="background:rgba(0,0,0,0.3); border:1px solid #1e4637; border-radius:6px; padding:10px; color:#fff;">
            <option value="">Loading branches...</option>
          </select>
        </label>

        <!-- Dynamic Container for Group Signatories or Fixed Deposit Terms -->
        <div id="dynamic-fields" style="display:flex; flex-direction:column; gap:12px;"></div>

        <button type="submit" style="background:#15803d; color:#fff; border:none; border-radius:6px; padding:10px; font-weight:600; cursor:pointer; margin-top:6px;">Submit Account Application</button>
        <p id="acc-feedback" style="font-size:12px;"></p>
      </form>`
    ) + panel(
      "ACTIVE BANK ACCOUNTS DIRECTORY",
      "Customer Accounts Ledger",
      "Real-time operational accounts.",
      `<div id="acc-list"><p style="color:#9ca3af;">Loading accounts directory...</p></div>`
    );

    if (db) {
      Promise.all([
        db.from("customers").select("id, customer_number, full_name"),
        db.from("account_types").select("id, type_code, type_name").eq("is_active", true),
        db.from("branches").select("id, branch_code, branch_name").eq("is_active", true)
      ]).then(([custRes, typeRes, branchRes]) => {
        window._accountTypesCache = typeRes.data || [];

        const custSelect = document.getElementById("sel-cust");
        if (custSelect && custRes.data) {
          custSelect.innerHTML = `<option value="">-- Select Customer --</option>` + custRes.data.map(c => `<option value="${c.id}">${esc(c.customer_number)} - ${esc(c.full_name)}</option>`).join("");
        }
        const typeSelect = document.getElementById("sel-acctype");
        if (typeSelect && typeRes.data) {
          typeSelect.innerHTML = `<option value="">-- Select Account Type --</option>` + typeRes.data.map(t => `<option value="${t.id}" data-code="${t.type_code}">${esc(t.type_name)}</option>`).join("");
        }
        const branchSelect = document.getElementById("sel-branch");
        if (branchSelect && branchRes.data) {
          branchSelect.innerHTML = `<option value="">-- Select Branch --</option>` + branchRes.data.map(b => `<option value="${b.id}">${esc(b.branch_name)} (${esc(b.branch_code)})</option>`).join("");
        }
      });

      db.from("bank_accounts").select("id, account_number, status, currency_code, balance").then(({ data }) => {
        const listEl = document.getElementById("acc-list");
        if (listEl && data && data.length > 0) {
          listEl.innerHTML = `<div style="overflow-x:auto;"><table style="width:100%; text-align:left; border-collapse:collapse; font-size:13px;">
            <tr style="color:#d97706; border-bottom:1px solid #1e4637;"><th style="padding:8px;">Account Number</th><th style="padding:8px;">Currency</th><th style="padding:8px;">Balance (UGX)</th><th style="padding:8px;">Status</th></tr>
            ${data.map(a => `<tr style="border-bottom:1px solid #1e4637;">
              <td style="padding:8px;"><strong>${esc(a.account_number)}</strong></td>
              <td style="padding:8px;">${esc(a.currency_code || "UGX")}</td>
              <td style="padding:8px;">${Number(a.balance || 0).toLocaleString()}</td>
              <td style="padding:8px;"><span style="background:rgba(21,128,61,0.2); color:#4ade80; padding:2px 8px; border-radius:4px; font-size:11px;">${esc(a.status)}</span></td>
            </tr>`).join("")}
          </table></div>`;
        } else if (listEl) {
          listEl.innerHTML = `<p style="color:#9ca3af;">No bank accounts registered yet.</p>`;
        }
      });
    }
  }
  else if (pageName === "Transactions") {
    c.innerHTML = panel(
      "TRANSACTION PROCESSING ENGINE",
      "Double-Entry Ledger Posting",
      "Execute deposits, withdrawals, and internal transfers.",
      `<div style="display:grid; grid-template-columns: 1fr 1fr; gap: 20px;">
         <form style="display:flex; flex-direction:column; gap:12px;" onsubmit="handleTransaction(event)">
           <h3 style="color:#d97706; font-size:14px; margin-bottom:4px;">Post Teller Transaction</h3>
           <label style="font-size:12px; font-weight:600; color:#d1d5db; display:flex; flex-direction:column; gap:4px;">Account ID / UUID 
             <input type="text" name="account_id" required placeholder="Enter Account UUID" style="background:rgba(0,0,0,0.3); border:1px solid #1e4637; border-radius:6px; padding:10px; color:#fff;">
           </label>
           <label style="font-size:12px; font-weight:600; color:#d1d5db; display:flex; flex-direction:column; gap:4px;">Transaction Type 
             <select name="tx_type" style="background:rgba(0,0,0,0.3); border:1px solid #1e4637; border-radius:6px; padding:10px; color:#fff;">
               <option value="deposit">Deposit (Credit)</option>
               <option value="withdrawal">Withdrawal (Debit)</option>
             </select>
           </label>
           <label style="font-size:12px; font-weight:600; color:#d1d5db; display:flex; flex-direction:column; gap:4px;">Amount (UGX) 
             <input type="number" name="amount" required step="1000" placeholder="50000" style="background:rgba(0,0,0,0.3); border:1px solid #1e4637; border-radius:6px; padding:10px; color:#fff;">
           </label>
           <button type="submit" style="background:#15803d; color:#fff; border:none; border-radius:6px; padding:10px; font-weight:600; cursor:pointer; margin-top:6px;">Post to Ledger</button>
           <p id="tx-feedback" style="font-size:12px;"></p>
         </form>
         <div style="background:rgba(0,0,0,0.25); padding:16px; border-radius:8px; border:1px solid #1e4637;">
           <h3 style="color:#fff; font-size:14px; margin-bottom:8px;">Ledger Rules</h3>
           <p style="color:#9ca3af; font-size:12px; line-height:1.5;">All transactions enforce double-entry validation. Withdrawals verify available balance and active signatory mandates prior to posting.</p>
         </div>
       </div>`
    );
  }
  else if (pageName === "Approvals") {
    c.innerHTML = panel(
      "OFFICER APPROVALS & SIGNATORIES",
      "Pending Authorizations",
      "Review account creation requests and group signatory configurations.",
      `<p style="color:#9ca3af; font-size:13px;">No pending items requiring authorization.</p>`
    );
  }
  else {
    c.innerHTML = panel(pageName.toUpperCase(), "Module Active", "Section operational.", `<p style="color:#9ca3af;">Module ready for commercial operations.</p>`);
  }
}

// Dynamic field switcher for Group Accounts and Fixed Deposits
window.toggleDynamicAccountFields = function(selectEl) {
  const container = document.getElementById("dynamic-fields");
  const selectedOption = selectEl.options[selectEl.selectedIndex];
  const typeCode = selectedOption ? selectedOption.getAttribute("data-code") : "";

  if (typeCode === "GRP") {
    container.innerHTML = `
      <div style="background:rgba(0,0,0,0.2); padding:12px; border:1px solid #1e4637; border-radius:6px;">
        <h4 style="color:#d97706; font-size:13px; margin-bottom:8px;">Group Signatory Mandates</h4>
        <label style="font-size:12px; color:#d1d5db; display:flex; flex-direction:column; gap:4px; margin-bottom:8px;">Chairperson Name *
          <input type="text" name="chairperson" required placeholder="Chairperson Full Name" style="background:rgba(0,0,0,0.3); border:1px solid #1e4637; border-radius:6px; padding:8px; color:#fff;">
        </label>
        <label style="font-size:12px; color:#d1d5db; display:flex; flex-direction:column; gap:4px; margin-bottom:8px;">Secretary Name *
          <input type="text" name="secretary" required placeholder="Secretary Full Name" style="background:rgba(0,0,0,0.3); border:1px solid #1e4637; border-radius:6px; padding:8px; color:#fff;">
        </label>
        <label style="font-size:12px; color:#d1d5db; display:flex; flex-direction:column; gap:4px; margin-bottom:8px;">Treasurer Name *
          <input type="text" name="treasurer" required placeholder="Treasurer Full Name" style="background:rgba(0,0,0,0.3); border:1px solid #1e4637; border-radius:6px; padding:8px; color:#fff;">
        </label>
        <label style="font-size:12px; color:#d1d5db; display:flex; flex-direction:column; gap:4px;">Withdrawal Approval Rule *
          <select name="signatory_rule" style="background:rgba(0,0,0,0.3); border:1px solid #1e4637; border-radius:6px; padding:8px; color:#fff;">
            <option value="any_one">Any One Signatory</option>
            <option value="any_two">Any Two Signatories</option>
            <option value="all_three">All Three Signatories Required</option>
          </select>
        </label>
      </div>
    `;
  } else if (typeCode === "FIX") {
    container.innerHTML = `
      <div style="background:rgba(0,0,0,0.2); padding:12px; border:1px solid #1e4637; border-radius:6px;">
        <h4 style="color:#d97706; font-size:13px; margin-bottom:8px;">Fixed Deposit Terms</h4>
        <label style="font-size:12px; color:#d1d5db; display:flex; flex-direction:column; gap:4px; margin-bottom:8px;">Tenure Period *
          <select name="tenure_months" style="background:rgba(0,0,0,0.3); border:1px solid #1e4637; border-radius:6px; padding:8px; color:#fff;">
            <option value="6">6 Months</option>
            <option value="12" selected>12 Months</option>
            <option value="24">24 Months</option>
          </select>
        </label>
        <label style="font-size:12px; color:#d1d5db; display:flex; flex-direction:column; gap:4px;">Agreed Interest Rate (% p.a.) *
          <input type="number" name="interest_rate" value="12.5" step="0.1" style="background:rgba(0,0,0,0.3); border:1px solid #1e4637; border-radius:6px; padding:8px; color:#fff;">
        </label>
      </div>
    `;
  } else {
    container.innerHTML = "";
  }
};

// Customer Registration Handler
window.handleCustomerSubmit = async function(e) {
  e.preventDefault();
  const form = e.target;
  const feedback = document.getElementById("cust-feedback");
  feedback.style.color = "#d97706";
  feedback.textContent = "Registering customer KYC profile...";

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
    feedback.style.color = "#ef4444";
    feedback.textContent = "Registration failed: " + error.message;
  } else {
    feedback.style.color = "#4ade80";
    feedback.textContent = "Customer successfully registered!";
    form.reset();
    setTimeout(() => switchPage("Customers"), 1000);
  }
};

// Account Opening Handler
window.handleAccountSubmit = async function(e) {
  e.preventDefault();
  const form = e.target;
  const feedback = document.getElementById("acc-feedback");
  feedback.style.color = "#d97706";
  feedback.textContent = "Processing account application...";

  const formData = new FormData(form);
  const metadata = {};
  
  // Collect dynamic fields if present
  if (formData.get("chairperson")) {
    metadata.signatories = {
      chairperson: formData.get("chairperson"),
      secretary: formData.get("secretary"),
      treasurer: formData.get("treasurer"),
      rule: formData.get("signatory_rule")
    };
  }
  if (formData.get("tenure_months")) {
    metadata.fixed_deposit = {
      tenure_months: formData.get("tenure_months"),
      interest_rate: formData.get("interest_rate")
    };
  }

  const payload = {
    customer_id: formData.get("customer_id"),
    account_type_id: formData.g
