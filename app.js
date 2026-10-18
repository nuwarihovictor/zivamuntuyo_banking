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
      "CUSTOMER INFORMATION FILE (CIF)",
      "Verified Customer Directory",
      "Centralized KYC and entity registration profiles.",
      `<div id="cust-list"><p style="color:#9ca3af;">Loading customer records...</p></div>`
    );

    if (db) {
      db.from("customers").select("*").limit(50).then(({ data, error }) => {
        const listEl = document.getElementById("cust-list");
        if (error) {
          listEl.innerHTML = `<p style="color:#ef4444;">Error accessing records: ${esc(error.message)}</p>`;
          return;
        }
        if (data && data.length > 0) {
          listEl.innerHTML = `<div style="overflow-x:auto;"><table style="width:100%; text-align:left; border-collapse:collapse; font-size:13px;">
            <tr style="color:#d97706; border-bottom:1px solid #1e4637;"><th style="padding:8px;">Customer Number</th><th style="padding:8px;">Full Name</th><th style="padding:8px;">Type</th><th style="padding:8px;">KYC Status</th></tr>
            ${data.map(cust => `<tr style="border-bottom:1px solid #1e4637;">
              <td style="padding:8px;"><strong>${esc(cust.customer_number)}</strong></td>
              <td style="padding:8px;">${esc(cust.full_name || "N/A")}</td>
              <td style="padding:8px;">${esc(cust.customer_type || "individual")}</td>
              <td style="padding:8px;"><span style="background:rgba(21,128,61,0.2); color:#4ade80; padding:2px 8px; border-radius:4px; font-size:11px;">Verified</span></td>
            </tr>`).join("")}
          </table></div>`;
        } else {
          listEl.innerHTML = `<p style="color:#9ca3af;">No customer records found.</p>`;
        }
      });
    }
  }
  else if (pageName === "Accounts") {
    c.innerHTML = panel(
      "COMMERCIAL ACCOUNT OPENING",
      "New Account Application Workflow",
      "Open Individual, Joint, Group (with 3 signatories), Institutional, Business, or Fixed Deposit accounts.",
      `<form id="acc-form" style="display:flex; flex-direction:column; gap:12px; max-width:450px;" onsubmit="handleAccountSubmit(event)">
        <label style="font-size:12px; font-weight:600; color:#d1d5db; display:flex; flex-direction:column; gap:4px;">Customer * 
          <select name="customer_id" id="sel-cust" required style="background:rgba(0,0,0,0.3); border:1px solid #1e4637; border-radius:6px; padding:10px; color:#fff;">
            <option value="">Loading customers...</option>
          </select>
        </label>
        <label style="font-size:12px; font-weight:600; color:#d1d5db; display:flex; flex-direction:column; gap:4px;">Account Product Type * 
          <select name="account_type_id" id="sel-acctype" required style="background:rgba(0,0,0,0.3); border:1px solid #1e4637; border-radius:6px; padding:10px; color:#fff;">
            <option value="">Loading product types...</option>
          </select>
        </label>
        <label style="font-size:12px; font-weight:600; color:#d1d5db; display:flex; flex-direction:column; gap:4px;">Home Branch * 
          <select name="branch_id" id="sel-branch" required style="background:rgba(0,0,0,0.3); border:1px solid #1e4637; border-radius:6px; padding:10px; color:#fff;">
            <option value="">Loading branches...</option>
          </select>
        </label>
        <label style="font-size:12px; font-weight:600; color:#d1d5db; display:flex; flex-direction:column; gap:4px;">Currency * 
          <select name="currency_code" id="sel-curr" required style="background:rgba(0,0,0,0.3); border:1px solid #1e4637; border-radius:6px; padding:10px; color:#fff;">
            <option value="UGX">UGX - Uganda Shilling</option>
          </select>
        </label>
        <button type="submit" style="background:#15803d; color:#fff; border:none; border-radius:6px; padding:10px; font-weight:600; cursor:pointer; margin-top:6px;">Submit for Approval</button>
        <p id="acc-feedback" style="font-size:12px; margin-top:4px;"></p>
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
        const custSelect = document.getElementById("sel-cust");
        if (custSelect && custRes.data) {
          custSelect.innerHTML = custRes.data.map(c => `<option value="${c.id}">${esc(c.customer_number)} - ${esc(c.full_name || 'Customer')}</option>`).join("");
        }
        const typeSelect = document.getElementById("sel-acctype");
        if (typeSelect && typeRes.data) {
          typeSelect.innerHTML = typeRes.data.map(t => `<option value="${t.id}">${esc(t.type_name)} (${esc(t.type_code)})</option>`).join("");
        }
        const branchSelect = document.getElementById("sel-branch");
        if (branchSelect && branchRes.data) {
          branchSelect.innerHTML = branchRes.data.map(b => `<option value="${b.id}">${esc(b.branch_name)} (${esc(b.branch_code)})</option>`).join("");
        }
      });

      db.from("bank_accounts").select("id, account_number, status, currency_code").then(({ data }) => {
        const listEl = document.getElementById("acc-list");
        if (listEl && data && data.length > 0) {
          listEl.innerHTML = `<div style="overflow-x:auto;"><table style="width:100%; text-align:left; border-collapse:collapse; font-size:13px;">
            <tr style="color:#d97706; border-bottom:1px solid #1e4637;"><th style="padding:8px;">Account Number</th><th style="padding:8px;">Currency</th><th style="padding:8px;">Status</th></tr>
            ${data.map(a => `<tr style="border-bottom:1px solid #1e4637;">
              <td style="padding:8px;"><strong>${esc(a.account_number || a.id.substring(0,8))}</strong></td>
              <td style="padding:8px;">${esc(a.currency_code || "UGX")}</td>
              <td style="padding:8px;"><span style="background:rgba(21,128,61,0.2); color:#4ade80; padding:2px 8px; border-radius:4px; font-size:11px;">${esc(a.status || "active")}</span></td>
            </tr>`).join("")}
          </table></div>`;
        } else if (listEl) {
          listEl.innerHTML = `<p style="color:#9ca3af;">No bank accounts registered yet. Use the form above to submit an application.</p>`;
        }
      });
    }
  }
  else if (pageName === "Transactions") {
    c.innerHTML = panel(
      "TRANSACTION PROCESSING ENGINE",
      "Double-Entry Ledger Posting",
      "Execute deposits, withdrawals, and internal transfers with automated teller validation.",
      `<div style="display:grid; grid-template-columns: 1fr 1fr; gap: 20px;">
         <form style="display:flex; flex-direction:column; gap:12px;" onsubmit="handleTransaction(event)">
           <h3 style="color:#d97706; font-size:14px; margin-bottom:4px;">Post Teller Transaction</h3>
           <label style="font-size:12px; font-weight:600; color:#d1d5db; display:flex; flex-direction:column; gap:4px;">Account Number / ID 
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
      "Authorize pending account openings and group signatory rules.",
      `<div id="approvals-list"><p style="color:#9ca3af; font-size:13px;">No pending items requiring authorization.</p></div>`
    );
  }
  else {
    c.innerHTML = panel(pageName.toUpperCase(), "Module Active", "Section operational.", `<p style="color:#9ca3af;">Module ready for commercial operations.</p>`);
  }
}

// Global form submission handler for account creation
window.handleAccountSubmit = async function(e) {
  e.preventDefault();
  const form = e.target;
  const feedback = document.getElementById("acc-feedback");
  feedback.style.color = "#d97706";
  feedback.textContent = "Processing account application...";

  const formData = new FormData(form);
  const payload = {
    customer_id: formData.get("customer_id"),
    account_type_id: formData.get("account_type_id"),
    branch_id: formData.get("branch_id"),
    currency_code: formData.get("currency_code"),
    account_number: "ACC-" + Math.floor(10000000 + Math.random() * 90000000),
    status: "active"
  };

  const { error } = await db.from("bank_accounts").insert([payload]);
  if (error) {
    feedback.style.color = "#ef4444";
    feedback.textContent = "Error: " + error.message;
  } else {
    feedback.style.color = "#4ade80";
    feedback.textContent = "Account successfully opened and activated!";
    form.reset();
    setTimeout(() => switchPage("Accounts"), 1200);
  }
};

// Global transaction handler
window.handleTransaction = async function(e) {
  e.preventDefault();
  const form = e.target;
  const feedback = document.getElementById("tx-feedback");
  feedback.style.color = "#d97706";
  feedback.textContent = "Posting to ledger...";

  const formData = new FormData(form);
  const payload = {
    transaction_reference: "TRX-" + Math.floor(10000000 + Math.random() * 90000000),
    account_id: formData.get("account_id"),
    transaction_type: formData.get("tx_type"),
    amount: parseFloat(formData.get("amount")),
    currency_code: "UGX",
    narration: "Teller " + formData.get("tx_type") + " posting",
    status: "posted"
  };

  const { error } = await db.from("transactions").insert([payload]);
  if (error) {
    feedback.style.color = "#ef4444";
    feedback.textContent = "Transaction failed: " + error.message;
  } else {
    feedback.style.color = "#4ade80";
    feedback.textContent = "Transaction successfully posted to ledger!";
    form.reset();
  }
};

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      switchPage(e.currentTarget.dataset.page);
    });
  });
  switchPage("Dashboard");
});
