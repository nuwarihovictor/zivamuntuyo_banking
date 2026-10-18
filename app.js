// ============================================================================
// ZIVAMUNTUYO FINANCIAL SERVICES LTD - COMMERCIAL BANKING CORE FRONTEND
// ============================================================================

const SUPABASE_URL = "https://hwghiezvghdqxnhcnpwk.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_uRGcpKo1-033QnltdseN7A_Kl2LFRBa";
window.currentEmployeeName = "";
window.currentEmployeeRole = ""; 

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

function transactionModuleTabs(active){
  const tabs=[["Transactions","Overview","📋"],["Deposits","Deposits","⬇️"],["Withdrawals","Withdrawals","⬆️"]];
  return '<div class="transaction-module-tabs" role="navigation" aria-label="Transaction sections">'+tabs.map(([page,label,icon])=>'<button type="button" class="transaction-module-tab '+(page===active?'active':'')+'" onclick="switchPage(\''+page+'\')" '+(page===active?'aria-current="page"':'')+'><span>'+icon+'</span><span>'+label+'</span></button>').join("")+'</div>';
}

function staffModuleTabs(active){
  const tabs=[["Staff","Profiles & Roles","👥"],["Attendance","Attendance","🕒"],["StaffChat","Team Chat","💬"]];
  return '<div class="staff-module-tabs" role="navigation" aria-label="Staff module sections">'+tabs.map(([page,label,icon])=>'<button type="button" class="staff-module-tab '+(page===active?'active':'')+'" onclick="switchPage(\''+page+'\')" '+(page===active?'aria-current="page"':'')+'><span>'+icon+'</span><span>'+label+'</span></button>').join("")+'</div>';
}

window.switchPage = function(pageName) {
  document.querySelectorAll('.nav').forEach(btn => {
    if (btn.dataset.page === pageName || (btn.dataset.page === "Staff" && ["Staff","Attendance","StaffChat"].includes(pageName)) || (btn.dataset.page === "Transactions" && ["Transactions","Deposits","Withdrawals"].includes(pageName))) {
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
      <div class="welcome-banner" id="welcome-banner"><div class="welcome-kicker">Zivamuntuyo Financial Services · Uganda</div><h2 id="welcome-title">Welcome</h2><p id="welcome-message">Your branch network and financial operations, in one place.</p></div>
      ${panel(
        "FINANCIAL PERFORMANCE",
        "Live general-ledger overview",
        "Charts use posted journal entries only. Amounts stay separated by currency, and no sample figures are displayed.",
        `<div class="form-grid">
           <label>Branch filter
             <select id="dashboard-branch-id">
               <option value="">All authorized branches</option>
             </select>
           </label>
           <button type="button" class="secondary" onclick="loadDashboardCharts();loadBranchPortfolioSummary()">Refresh dashboard</button>
         </div>
         <div id="dashboard-feedback" class="muted" aria-live="polite">Loading live accounting data…</div>
         <div id="dashboard-kpis" class="grid-2"></div>
         <h3 style="margin-top:22px;">Branch portfolio and account counts</h3>
         <p class="muted">Shows accounts, customers, active staff, loans, loan principal and recorded transactions for each authorized branch.</p>
         <div id="branch-portfolio-feedback" class="muted" aria-live="polite">Loading branch counts…</div>
         <div id="branch-portfolio-summary"></div>
         <h3 style="margin-top:18px;">Account counts by branch and product</h3>
         <div id="branch-account-type-counts"></div>
         <h3 style="margin-top:18px;">Loans by branch and status</h3>
         <div id="branch-loan-status-counts"></div>
         <label>Chart currency <select id="dashboard-chart-currency" onchange="renderDashboardAnalyticsCharts()"></select></label>
         <div class="grid-2 dashboard-chart-grid">
           <div class="metric-card dashboard-chart-card">
             <h3>Monthly transaction trend</h3>
             <p class="muted">Number of posted deposit and withdrawal requests per month.</p>
             <div class="dashboard-chart-wrap"><canvas id="dashboard-monthly-trend" role="img" aria-label="Line chart of monthly deposit and withdrawal counts"></canvas></div>
           </div>
           <div class="metric-card dashboard-chart-card">
             <h3>Deposits versus withdrawals</h3>
             <p class="muted">Posted transaction values over the last 12 months, for the selected currency.</p>
             <div class="dashboard-chart-wrap"><canvas id="dashboard-deposits-withdrawals" role="img" aria-label="Bar chart comparing monthly deposit and withdrawal amounts"></canvas></div>
           </div>
           <div class="metric-card dashboard-chart-card">
             <h3>Branch performance comparison</h3>
             <p class="muted">Posted deposit and withdrawal values by branch. Branch access is enforced by the database.</p>
             <div class="dashboard-chart-wrap"><canvas id="dashboard-branch-performance" role="img" aria-label="Bar chart comparing deposit and withdrawal values across branches"></canvas></div>
           </div>
           <div class="metric-card dashboard-chart-card">
             <h3>Ledger activity by account type</h3>
             <p class="muted">Absolute posted movement by ledger type, for the selected currency.</p>
             <div class="dashboard-chart-wrap"><canvas id="dashboard-account-types" role="img" aria-label="Doughnut chart showing posted ledger movement by account type"></canvas></div>
           </div>
         </div>
         <p class="muted">Charts are operational summaries, not audited financial statements. A balanced total does not prove all transactions have been recorded.</p>`
      )}
    `;
    setWelcomeMessage();
    window.loadDashboardBranchOptions().then(() => {
      window.loadDashboardCharts();
      window.loadBranchPortfolioSummary();
    });
  } 
  else if (pageName === "Branches") {
    c.innerHTML = `
      <span class="category-tag">Operational regional network</span>
      <h2 class="page-heading">Branches & Regions</h2>
      ${panel(
        "ZIVAMUNTUYO BRANCH DIRECTORY",
        "Main branch and outreach locations",
        "The directory shows active branches only. Superseded branch records are inactive and kept for historical references.",
        `<div id="branch-list"><p class="muted">Loading active branches…</p></div>`
      )}
    `;

    if (db) {
      db.from("branches").select("id,branch_code,branch_name,address,timezone,is_head_office,is_active")
        .eq("is_active",true)
        .order("is_head_office",{ascending:false})
        .order("branch_name",{ascending:true})
        .then(({data:branches,error})=>{
          const listEl=document.getElementById("branch-list");
          if(!listEl)return;
          if(error){listEl.innerHTML='<p class="muted">Branch directory could not be loaded: '+esc(error.message)+'</p>';return;}
          if(!branches||!branches.length){listEl.innerHTML='<p class="muted">No active branches are available to your account.</p>';return;}
          listEl.innerHTML=branches.map(b=>`
            <div class="list-item">
              <div>
                <strong>${esc(b.branch_name)} (${esc(b.branch_code)})</strong><br>
                <span class="muted">${esc(b.address||"Address not configured")} · ${esc(b.timezone||"Africa/Kampala")}</span>
              </div>
              <span class="badge-role">${b.is_head_office?"Main Branch":"Outreach"}</span>
            </div>
          `).join("");
        }).catch(()=>{
          const listEl=document.getElementById("branch-list");
          if(listEl)listEl.innerHTML='<p class="muted">Could not connect to the branch directory.</p>';
        });
    } else {
      const listEl=document.getElementById("branch-list");
      if(listEl)listEl.innerHTML='<p class="muted">Database connection unavailable. No sample branches are displayed.</p>';
    }
  }
  else if (pageName === "Staff") {
    c.innerHTML = `
      <span class="category-tag">People, accountability & access</span>
      <h2 class="page-heading">Staff & People</h2>
      ${staffModuleTabs("Staff")}
      ${panel("AUTHORIZED PERSONNEL DIRECTORY","Staff profile register","Personal information is shown only as available in the employee record and according to database permissions.",`<div id="staff-list"><p class="muted">Loading staff profiles…</p></div><div id="staff-editor-panel" hidden class="panel"><h2>Edit Staff Profile</h2><p class="panel-desc">System administrator only. Enter an HTTPS photo URL. Leave National ID blank to preserve the current value.</p><form id="staff-editor-form" class="staff-editor-form"><label>Select employee<select id="staff-edit-person" required><option value="">Choose employee</option></select></label><div class="grid-2"><label>Full name<input id="staff-edit-name" required maxlength="160"></label><label>Employee ID<input id="staff-edit-number" required maxlength="80"></label></div><div class="grid-2"><label>Sex<select id="staff-edit-sex"><option value="">Not recorded</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option><option value="prefer_not_to_say">Prefer not to say</option></select></label><label>Date of birth<input id="staff-edit-dob" type="date"></label></div><div class="grid-2"><label>Phone<input id="staff-edit-phone" type="tel" maxlength="60"></label><label>Work email<input id="staff-edit-email" type="email" maxlength="254"></label></div><div class="grid-2"><label>Branch<select id="staff-edit-branch"><option value="">Not assigned</option></select></label><label>Role<select id="staff-edit-role"><option value="">Not assigned</option></select></label></div><div class="grid-2"><label>Job title<input id="staff-edit-title" maxlength="120"></label><label>Employment status<select id="staff-edit-status"><option value="active">Active</option><option value="probation">Probation</option><option value="on_leave">On leave</option><option value="suspended">Suspended</option><option value="terminated">Terminated</option><option value="inactive">Inactive</option></select></label></div><div class="grid-2"><label>Start date<input id="staff-edit-start" type="date"></label><label>Photo HTTPS URL<input id="staff-edit-photo" type="url" placeholder="https://..."></label></div><label>National ID (optional)<input id="staff-edit-national-id" maxlength="120" autocomplete="off"></label><p id="staff-edit-feedback" class="muted" aria-live="polite"></p><button type="submit" class="primary" id="staff-edit-save">Save staff profile</button></form></div>`)}
      ${panel("ROLE RESPONSIBILITIES","Who is responsible for what","Use this directory to understand each job title's expected duties. Actual permissions remain controlled by assigned system roles.",`
        <div class="responsibility-grid">
          <article class="responsibility-card"><h3>Bank / Branch Manager</h3><p>Leads branch performance and supervises staff.</p><ul><li>Review daily cash and transaction reports</li><li>Approve transactions and account requests within authority</li><li>Monitor customer service, controls and compliance</li><li>Review staff attendance and escalate incidents</li></ul></article>
          <article class="responsibility-card"><h3>Teller / Cashier</h3><p>Handles authorized customer cash services.</p><ul><li>Verify customer identity and account details</li><li>Process deposits and withdrawals within limits</li><li>Issue receipts and balance cash at shift end</li><li>Report shortages, suspicious activity and errors</li></ul></article>
          <article class="responsibility-card"><h3>Loans Officer</h3><p>Manages loan applications and borrower follow-up.</p><ul><li>Collect and verify loan application documents</li><li>Assess affordability and repayment capacity</li><li>Track instalments, arrears and follow-up actions</li><li>Never approve their own restricted applications</li></ul></article>
          <article class="responsibility-card"><h3>Accountant / Finance Officer</h3><p>Maintains accurate financial records and reconciliations.</p><ul><li>Review ledger entries and trial balances</li><li>Reconcile cash, bank and customer balances</li><li>Prepare periodic financial reports</li><li>Investigate differences and preserve audit trails</li></ul></article>
          <article class="responsibility-card"><h3>Customer Service Officer</h3><p>Supports customers and maintains service records.</p><ul><li>Help with onboarding and account enquiries</li><li>Check application completeness and documentation</li><li>Escalate complaints and suspicious requests</li><li>Protect customer information and confidentiality</li></ul></article>
          <article class="responsibility-card"><h3>Compliance / Internal Auditor</h3><p>Independently checks compliance and control effectiveness.</p><ul><li>Review transaction samples and audit trails</li><li>Monitor KYC/AML and reporting obligations</li><li>Document findings and follow up corrective actions</li><li>Maintain independence from transactions audited</li></ul></article>
          <article class="responsibility-card"><h3>System Administrator</h3><p>Maintains secure user access and technical operations.</p><ul><li>Provision and disable staff access appropriately</li><li>Maintain settings, backups and monitoring</li><li>Apply least-privilege access and review role changes</li><li>Never share credentials or bypass financial approvals</li></ul></article>
          <article class="responsibility-card"><h3>Operations / Branch Supervisor</h3><p>Coordinates daily work and operational controls.</p><ul><li>Check opening and closing procedures</li><li>Monitor pending requests and exception queues</li><li>Coordinate staff schedules and handovers</li><li>Escalate incidents and unresolved differences</li></ul></article>
        </div>
        <p class="muted">Responsibilities are guidance, not a substitute for approved HR policies, regulatory requirements, or the permissions configured in the software.</p>`)}
    `;
    if(db){
      Promise.all([
        db.from("employee_profiles").select("user_id,employee_number,full_name,work_email,phone_number,home_branch_id,role_id,is_active,sex,date_of_birth,photo_url,employment_status,job_title,start_date").order("full_name"),
        db.from("branches").select("id,branch_name").eq("is_active",true),
        db.from("staff_roles").select("id,role_code,role_name")
      ]).then(async ([staffResult,branchResult,roleResult])=>{
        await loadCurrentEmployeeGreeting();
        const listEl=document.getElementById("staff-list");
        if(!listEl)return;
        const failed=[staffResult,branchResult,roleResult].find(x=>x.error);
        if(failed){listEl.innerHTML='<p class="muted">Staff profile details could not be loaded. Apply the staff profile database migration and verify staff-directory permissions. Details: '+esc(failed.error.message)+'</p>';return;}
        const branches=new Map((branchResult.data||[]).map(b=>[b.id,b.branch_name]));
        const roles=new Map((roleResult.data||[]).map(r=>[r.id,{name:r.role_name||r.role_code,code:r.role_code}]));
        const people=staffResult.data||[];
        if(!people.length){listEl.innerHTML='<p class="muted">No employee profiles are visible to your account.</p>';return;}
        const today=new Date();
        const ageOf=d=>{if(!d)return "Not recorded";const born=new Date(d+"T00:00:00");let age=today.getFullYear()-born.getFullYear();if(today.getMonth()<born.getMonth()||(today.getMonth()===born.getMonth()&&today.getDate()<born.getDate()))age--;return age>=0&&age<120?age+" years":"Check date";};
        const safePhoto=url=>url&&/^https:\/\//i.test(url)?'<img class="staff-photo" loading="lazy" alt="Staff profile photo" src="'+esc(url)+'">':'<div class="staff-photo-placeholder" aria-label="No profile photo"><span>👤</span></div>';
        listEl.innerHTML=people.map(s=>{
          const role=roles.get(s.role_id)||{name:"Role not assigned",code:""};
          const status=!s.is_active?"inactive":(s.employment_status||"active");
          const details=[
            ["Sex",s.sex||"Not recorded"],["Age",ageOf(s.date_of_birth)],["Employee ID",s.employee_number||"Not assigned"],
            ["National ID","Stored separately; restricted access"],
            ["Date of birth",s.date_of_birth||"Not recorded"],["Phone",s.phone_number||"Not recorded"],
            ["Work email",s.work_email||"Not recorded"],["Branch",branches.get(s.home_branch_id)||"Not assigned"],
            ["Job title",s.job_title||role.name||"Not assigned"],["Employment status",status],["Start date",s.start_date||"Not recorded"]
          ];
          return '<div class="staff-card">'+safePhoto(s.photo_url)+'<div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><strong>'+esc(s.full_name||"Name not provided")+'</strong><span class="badge-role">'+esc(role.name)+'</span><span class="staff-status">'+esc(status)+'</span></div><div class="staff-detail-grid">'+details.map(([label,value])=>'<div class="staff-detail"><small>'+esc(label)+'</small><strong>'+esc(value)+'</strong></div>').join("")+'</div></div></div>';
        }).join("");
        window.staffProfileCache=people;
        if(window.currentEmployeeRole==="system_admin"){
          const editor=document.getElementById("staff-editor-panel");
          if(editor)editor.hidden=false;
          const person=document.getElementById("staff-edit-person");
          person.innerHTML='<option value="">Choose employee</option>'+people.map(p=>'<option value="'+esc(p.user_id)+'">'+esc(p.full_name||p.employee_number)+' · '+esc(p.employee_number)+'</option>').join("");
          document.getElementById("staff-edit-branch").innerHTML='<option value="">Not assigned</option>'+(branchResult.data||[]).map(b=>'<option value="'+esc(b.id)+'">'+esc(b.branch_name)+'</option>').join("");
          document.getElementById("staff-edit-role").innerHTML='<option value="">Not assigned</option>'+(roleResult.data||[]).map(r=>'<option value="'+esc(r.id)+'">'+esc(r.role_name||r.role_code)+'</option>').join("");
          person.addEventListener("change",()=>window.fillStaffEditor(person.value));
          document.getElementById("staff-editor-form").addEventListener("submit",window.saveStaffProfile);
        }
      }).catch(()=>{
        const listEl=document.getElementById("staff-list");
        if(listEl)listEl.innerHTML='<p class="muted">A connection error prevented staff profiles from loading.</p>';
      });
    }else{
      const listEl=document.getElementById("staff-list");
      if(listEl)listEl.innerHTML='<p class="muted">Database connection unavailable. No sample profiles are displayed.</p>';
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
          <label>Find customer *
            <input type="search" id="account-customer-search" autocomplete="off" placeholder="Search by customer name or number" oninput="searchAccountOpeningCustomers(this)">
            <input type="hidden" name="customer_id" required>
            <div id="account-customer-results" class="account-search-results" role="listbox"></div>
            <p id="account-customer-selected" class="muted">Choose the verified customer before opening an account.</p>
          </label>
          <label>Branch *
            <select name="branch_id" id="account-branch-id" required>
              <option value="">Loading authorized branches…</option>
            </select>
          </label>
          <label>Account ownership type *
            <select name="account_type_id" id="account-type-id" required>
              <option value="">Loading account types…</option>
            </select>
          </label>
          <label>Account product *
            <select name="product_type" required>
              <option value="savings">Savings</option>
              <option value="current">Current</option>
              <option value="fixed_deposit">Fixed deposit</option>
              <option value="business">Business product</option>
              <option value="group">Group product</option>
              <option value="other">Other</option>
            </select>
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
          <fieldset class="document-upload-fieldset">
            <legend>Attach account-opening documents (optional)</legend>
            <p class="muted">Scanned national ID/passport, proof of address, chairperson letter, or supporting documents. PDF, JPG or PNG; maximum 10 MB each.</p>
            <label>Document category
              <select name="account_document_category">
                <option value="national-id">National ID</option><option value="passport">Passport</option><option value="proof-of-address">Proof of address</option><option value="chairperson-letter">Chairperson letter</option><option value="other">Other supporting document</option>
              </select>
            </label>
            <label>Scanned files
              <input type="file" name="account_documents" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" multiple>
            </label>
          </fieldset>
          <button type="submit" class="primary">Submit Account Request</button>
          <p id="acc-feedback" class="muted" aria-live="polite"></p>
        </form>`
      )}
      ${panel(
        "LOAN APPLICATION DOCUMENTS",
        "Attach borrower and collateral evidence",
        "Upload documents to an existing loan record. Examples: scanned IDs, land titles, chairperson letters, guarantor IDs, proof of income and valuation reports. Files are private and access is limited by staff branch permissions.",
        `<form id="loan-document-form" onsubmit="handleLoanDocumentUpload(event)">
          <label>Loan record UUID *<input type="text" name="loan_id" required placeholder="Paste the existing loan UUID"></label>
          <label>Document category *
            <select name="document_category" required>
              <option value="national-id">Borrower national ID</option><option value="passport">Passport</option><option value="land-title">Land title / collateral ownership</option><option value="chairperson-letter">LC / chairperson letter</option><option value="guarantor-id">Guarantor identification</option><option value="income-proof">Proof of income / business</option><option value="valuation-report">Collateral valuation report</option><option value="other">Other supporting document</option>
            </select>
          </label>
          <label>Scanned documents *<input type="file" name="loan_documents" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" multiple required></label>
          <p class="muted">PDF, JPG or PNG; maximum 10 MB per file. Use an existing loan UUID and only upload documents you are authorized to handle.</p>
          <button type="submit" class="primary">Upload loan documents</button>
          <p id="loan-document-feedback" class="muted" aria-live="polite"></p>
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
      Promise.all([
        db.from("branches").select("id,branch_name,branch_code").eq("is_active",true).order("branch_name"),
        db.from("account_types").select("id,type_name,type_code").eq("is_active",true).order("type_name")
      ]).then(([branchResult,typeResult])=>{
        const branchSelect=document.getElementById("account-branch-id");
        const typeSelect=document.getElementById("account-type-id");
        if(branchSelect){
          if(branchResult.error) branchSelect.innerHTML='<option value="">Branches unavailable</option>';
          else branchSelect.innerHTML='<option value="">Choose branch</option>'+(branchResult.data||[]).map(b=>'<option value="'+esc(b.id)+'">'+esc(b.branch_name)+' ('+esc(b.branch_code)+')</option>').join("");
        }
        if(typeSelect){
          if(typeResult.error) typeSelect.innerHTML='<option value="">Account types unavailable</option>';
          else typeSelect.innerHTML='<option value="">Choose ownership type</option>'+(typeResult.data||[]).map(t=>'<option value="'+esc(t.id)+'">'+esc(t.type_name)+' ('+esc(t.type_code)+')</option>').join("");
        }
      });
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
  else if (["Transactions","Deposits","Withdrawals"].includes(pageName)) {
    const transactionMode = pageName === "Deposits" ? "deposit" : pageName === "Withdrawals" ? "withdrawal" : "both";
    const isDeposit = transactionMode === "deposit";
    const isWithdrawal = transactionMode === "withdrawal";
    const heading = isDeposit ? "Customer Deposits" : isWithdrawal ? "Customer Withdrawals" : "Transactions Overview";
    const subheading = isDeposit ? "Receive money into a customer account" : isWithdrawal ? "Pay money out from a customer account" : "Choose a transaction type to get started";
    const intro = isDeposit
      ? "Use this dedicated workflow when a customer deposits funds. Confirm the account and amount with the customer before submitting. A receipt is available only after successful ledger posting."
      : isWithdrawal
        ? "Use this dedicated workflow when a customer withdraws funds. Verify identity, account, available balance and applicable approval rules before submitting. No cash is paid out by this request alone."
        : "Deposits and withdrawals have separate workflows to reduce selection errors. Requests remain pending until independently approved and posted.";
    c.innerHTML = `
      <span class="category-tag">Cash operations · Maker-checker controls</span>
      <h2 class="page-heading">${heading}</h2>
      ${transactionModuleTabs(pageName)}
      <div class="transaction-workflow-banner ${isDeposit?"deposit":isWithdrawal?"withdrawal":"overview"}">
        <div class="transaction-workflow-icon">${isDeposit?"⬇️":isWithdrawal?"⬆️":"📋"}</div>
        <div><strong>${heading}</strong><p>${subheading}</p><small>${intro}</small></div>
      </div>
      ${(!isWithdrawal ? panel("DEPOSIT ENTRY", "Receive customer funds", "The request is submitted for approval. Do not hand the customer a final receipt until ledger posting succeeds.", `
        <form id="deposit-transaction-form" class="transaction-entry-form" onsubmit="handleTransaction(event)">
          <input type="hidden" name="tx_type" value="deposit">
          <label>Find customer or account <span class="required-mark">*</span>
            <input type="search" class="account-search-input" autocomplete="off" placeholder="Type account number or customer name" oninput="searchTransactionAccounts(this)">
            <input type="hidden" name="account_id" required>
            <div class="account-search-results" role="listbox"></div>
            <p class="account-selected-summary muted">Choose an account from the search results.</p>
          </label>
          <label>Deposit amount <span class="required-mark">*</span><div class="amount-input-wrap"><input type="number" name="amount" required min="0.01" step="0.01" inputmode="decimal" placeholder="0.00"><span>Currency is taken from the account</span></div></label>
          <div class="transaction-checklist"><strong>Before submitting</strong><label><input type="checkbox" required> I verified the customer account and the amount to be deposited.</label><label><input type="checkbox" required> I understand this request is not a completed transaction until posted.</label></div>
          <button type="submit" class="primary transaction-submit">Submit deposit for approval</button>
          <p id="tx-feedback" class="muted" aria-live="polite"></p>
        </form>`):"")}
      ${(!isDeposit ? panel("WITHDRAWAL ENTRY", "Pay customer funds", "Verify customer identity and the account's available balance. The secure backend must enforce balance and approval rules before any payout.", `
        <form id="withdrawal-transaction-form" class="transaction-entry-form" onsubmit="handleTransaction(event)">
          <input type="hidden" name="tx_type" value="withdrawal">
          <label>Find customer or account <span class="required-mark">*</span>
            <input type="search" class="account-search-input" autocomplete="off" placeholder="Type account number or customer name" oninput="searchTransactionAccounts(this)">
            <input type="hidden" name="account_id" required>
            <div class="account-search-results" role="listbox"></div>
            <p class="account-selected-summary muted">Choose an account from the search results.</p>
          </label>
          <label>Withdrawal amount <span class="required-mark">*</span><div class="amount-input-wrap"><input type="number" name="amount" required min="0.01" step="0.01" inputmode="decimal" placeholder="0.00"><span>Currency is taken from the account</span></div></label>
          <div class="transaction-checklist"><strong>Before submitting</strong><label><input type="checkbox" required> I verified the customer's identity and account details.</label><label><input type="checkbox" required> I checked the amount and understand approval is required before payout.</label></div>
          <button type="submit" class="primary transaction-submit">Submit withdrawal for approval</button>
          <p id="tx-feedback" class="muted" aria-live="polite"></p>
        </form>`):"")}
      ${panel("TRANSACTION ACTIVITY", "Recent transaction records", "Review journal requests and posted activity you are authorized to see. Receipts are available only for posted deposits.", `
        <div class="form-grid transaction-filters">
          <label>Branch UUID (optional)<input id="monitor-branch-id" type="text" placeholder="All authorized branches"></label>
          <label>Status<select id="monitor-status"><option value="">All statuses</option><option value="pending_approval">Pending approval</option><option value="approved">Approved</option><option value="posted">Posted</option><option value="rejected">Rejected</option></select></label>
          <button type="button" class="secondary" onclick="loadTransactionMonitor()">Refresh activity</button>
        </div>
        <p id="transaction-monitor-feedback" class="muted" aria-live="polite">Loading transaction activity…</p>
        <div id="transaction-monitor-list" data-transaction-mode="${transactionMode}"></div><div id="transaction-receipt-status" class="muted" aria-live="polite"></div>`)}
    `;
    const transactionList = document.getElementById("transaction-monitor-list");
    if (transactionList) transactionList.dataset.transactionMode = transactionMode;
    const transactionFeedback = document.getElementById("transaction-monitor-feedback");
    if (transactionFeedback) transactionFeedback.textContent = isDeposit ? "Loading deposit activity…" : isWithdrawal ? "Loading withdrawal activity…" : "Loading transaction activity…";
    window.loadTransactionMonitor();
  }
  else if (pageName === "Attendance") {
    c.innerHTML = `
      <span class="category-tag">Staff Operations</span>
      <h2 class="page-heading">Staff Attendance</h2>
      ${staffModuleTabs("Attendance")}
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
         <hr>
         <h3 style="margin:18px 0 8px;">Work schedule & attendance rules</h3>
         <p class="muted">Default schedule: clock in at 08:30 and clock out at 17:00 (Africa/Kampala). Managers should be able to adjust these settings to match branch policy. The schedule can be saved only after the attendance_policies.sql database setup is installed. Saving requires an authorized manager and creates an audit event.</p>
         <div class="notice-box"><strong>Manager configuration</strong><br>Use the fields below to plan the schedule. Saving official rules will require a manager-authorized database action and an audit trail.</div>
         <form id="attendance-policy-form" onsubmit="previewAttendancePolicy(event)">
           <div class="grid-2">
             <label>Branch UUID (leave blank for global policy; branch managers must select an authorized branch)<input id="attendance-branch-id" type="text" placeholder="Optional branch UUID"></label>
             <label>Policy effective from<input id="attendance-effective-from" type="date" value="${new Date().toISOString().slice(0,10)}" required></label>
           </div>
           <div class="grid-2">
             <label>Standard clock-in time<input id="attendance-start" type="time" value="08:30" required></label>
             <label>Standard clock-out time<input id="attendance-end" type="time" value="17:00" required></label>
             <label>Late-arrival grace period (minutes)<input id="attendance-grace" type="number" min="0" max="180" value="5" required></label>
             <label>Unpaid break duration (minutes)<input id="attendance-break-minutes" type="number" min="0" max="240" value="60" required></label>
             <label>Break starts (optional)<input id="attendance-break-start" type="time" value="13:00"></label>
             <label>Break ends (optional)<input id="attendance-break-end" type="time" value="14:00"></label>
             <label>Overtime policy<select id="attendance-overtime"><option value="yes" selected>Manager approval required</option><option value="no">Record only</option></select></label>
             <label>Timezone<select id="attendance-timezone"><option value="Africa/Kampala" selected>Africa/Kampala (Uganda)</option><option value="UTC">UTC</option></select></label>
           </div>
           <fieldset class="attendance-days">
             <legend><strong>Working days</strong></legend>
             <label><input type="checkbox" name="attendance-day" value="Monday" checked> Monday</label>
             <label><input type="checkbox" name="attendance-day" value="Tuesday" checked> Tuesday</label>
             <label><input type="checkbox" name="attendance-day" value="Wednesday" checked> Wednesday</label>
             <label><input type="checkbox" name="attendance-day" value="Thursday" checked> Thursday</label>
             <label><input type="checkbox" name="attendance-day" value="Friday" checked> Friday</label>
             <label><input type="checkbox" name="attendance-day" value="Saturday"> Saturday</label>
             <label><input type="checkbox" name="attendance-day" value="Sunday"> Sunday</label>
           </fieldset>
           <div class="form-grid">
             <button type="submit" class="secondary">Preview schedule & timesheet rules</button>
             <button type="button" class="primary" onclick="saveAttendancePolicy()">Save policy (manager only)</button>
             <button type="button" class="secondary" onclick="loadAttendancePolicy()">Load saved policy</button>
             <button type="button" class="secondary" onclick="resetAttendancePolicy()">Reset to defaults</button>
           </div>
         </form>
         <div id="attendance-policy-feedback" class="notice-box" aria-live="polite">Default preview: 08:30–17:00, 60-minute break, Monday–Friday. Net scheduled work: 7 hours 30 minutes per day.</div>
         <h3 style="margin:18px 0 8px;">Timesheets & attendance exceptions</h3>
         <div class="grid-2">
           <div class="metric-card"><strong>Daily timesheet</strong><p class="muted">First clock-in, last clock-out, break time, net worked hours, late minutes, early departure and overtime.</p></div>
           <div class="metric-card"><strong>Manager corrections</strong><p class="muted">Require a reason, original and corrected times, who changed it, when it changed, and approval history.</p></div>
           <div class="metric-card"><strong>Absence & leave</strong><p class="muted">Track absent days, approved leave, public holidays, rest days and missing punches separately.</p></div>
           <div class="metric-card"><strong>Payroll export</strong><p class="muted">Approved timesheets can later feed payroll summaries, with overtime and deductions shown separately.</p></div>
         </div>
         <p class="muted">Schedule saving is available after the SQL setup is installed. Fingerprint capture, official attendance event capture, manager correction workflow and payroll integration are separate steps and are not enabled yet.</p>
         <h3 style="margin:18px 0 8px;">Recorded timesheets</h3>
         <div class="form-grid">
           <label>From date<input type="date" id="timesheet-from"></label>
           <label>To date<input type="date" id="timesheet-to"></label>
           <label>Branch UUID (optional)<input type="text" id="timesheet-branch" placeholder="All authorized branches"></label>
           <button type="button" class="secondary" onclick="loadStaffTimesheets()">Load timesheets</button>
         </div>
         <p id="timesheet-feedback" class="muted" aria-live="polite">Timesheets require the database SQL setup and recorded attendance events.</p>
         <div id="timesheet-list"></div>
         <p><a href="https://github.com/nuwarihovictor/zivamuntuyo_banking/blob/main/docs/attendance-device-compatibility.md" target="_blank" rel="noopener noreferrer">Read device compatibility and implementation plan</a></p>`
      )}
    `;
    window.showAttendanceDeviceHelp();
    const timesheetToday = new Date();
    const timesheetToDate = timesheetToday.toISOString().slice(0,10);
    const timesheetFromDate = new Date(timesheetToday.getTime() - 30*24*60*60*1000).toISOString().slice(0,10);
    const timesheetFromInput = document.getElementById("timesheet-from");
    const timesheetToInput = document.getElementById("timesheet-to");
    if (timesheetFromInput && !timesheetFromInput.value) timesheetFromInput.value = timesheetFromDate;
    if (timesheetToInput && !timesheetToInput.value) timesheetToInput.value = timesheetToDate;

window.loadAttendancePolicy();
  }
  else if (pageName === "StaffChat") {
    c.innerHTML = `
      <span class="category-tag">Internal Communications</span>
      <h2 class="page-heading">Team Chat</h2>
      ${staffModuleTabs("StaffChat")}
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
  else if (pageName === "Settings") {
    c.innerHTML = `
      <span class="category-tag">Personalize your workspace</span>
      <h2 class="page-heading">Settings</h2>
      ${panel("APPEARANCE & DISPLAY","Themes and fonts","Choose how the banking workspace looks on this device. Your preferences are saved locally and do not change financial data or other users' settings.",`
        <div class="settings-section">
          <div class="settings-section-heading"><span class="settings-icon">🎨</span><div><h3>Colour theme</h3><p class="muted">Seven carefully chosen themes for different working preferences.</p></div></div>
          <label for="theme-picker">Application theme</label>
          <select id="theme-picker" aria-label="Choose color theme">
            <option value="emerald">Emerald & Gold</option><option value="ocean">Ocean Blue</option><option value="midnight">Midnight</option><option value="light">Classic Light</option><option value="violet">Royal Violet</option><option value="teal">Teal</option><option value="burgundy">Burgundy</option>
          </select>
          <div class="theme-swatches">
            <button type="button" class="theme-swatch" data-theme-choice="emerald"><span class="swatch-colors emerald-swatches"></span><strong>Emerald & Gold</strong></button>
            <button type="button" class="theme-swatch" data-theme-choice="ocean"><span class="swatch-colors ocean-swatches"></span><strong>Ocean Blue</strong></button>
            <button type="button" class="theme-swatch" data-theme-choice="midnight"><span class="swatch-colors midnight-swatches"></span><strong>Midnight</strong></button>
            <button type="button" class="theme-swatch" data-theme-choice="light"><span class="swatch-colors light-swatches"></span><strong>Classic Light</strong></button>
            <button type="button" class="theme-swatch" data-theme-choice="violet"><span class="swatch-colors violet-swatches"></span><strong>Royal Violet</strong></button>
            <button type="button" class="theme-swatch" data-theme-choice="teal"><span class="swatch-colors teal-swatches"></span><strong>Teal</strong></button>
            <button type="button" class="theme-swatch" data-theme-choice="burgundy"><span class="swatch-colors burgundy-swatches"></span><strong>Burgundy</strong></button>
          </div>
          <div class="settings-divider"></div>
          <div class="settings-section-heading"><span class="settings-icon">🔤</span><div><h3>Font family</h3><p class="muted">Choose from 25 readable fonts. This preference applies across the application.</p></div></div>
          <label for="font-picker">Application font</label>
          <select id="font-picker" aria-label="Choose font family">${ZFS_FONTS.map(font => `<option value="${esc(font)}">${esc(font)}</option>`).join("")}</select>
          <div class="font-preview" id="font-preview"><strong>Preview: Zivamuntuyo Financial Services</strong><p>Account statement · Customer service · UGX 125,000.00</p><span>The quick brown fox jumps over the lazy dog. 0123456789</span></div>
          <div class="settings-actions"><button type="button" class="secondary" id="reset-appearance">Reset appearance</button><span class="muted" id="appearance-feedback" aria-live="polite">Preferences are stored on this device.</span></div>
        </div>`
      )}
      ${panel("APPLICATION INFORMATION","System environment","Use this section to confirm the product identity and key environment details.",`
        <div class="settings-info-grid"><div class="settings-info"><small>Organization</small><strong>Zivamuntuyo Financial Services Ltd</strong></div><div class="settings-info"><small>Timezone</small><strong>Africa/Kampala</strong></div><div class="settings-info"><small>Branch network</small><strong>Butare, Ntungamo, Rukungiri, Rubirizi and Mitooma</strong></div><div class="settings-info"><small>Preferences</small><strong>Device-local appearance settings</strong></div></div>
      `)}
    `;
    initAppearanceControls();
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

window.fillStaffEditor=function(userId){
  const s=(window.staffProfileCache||[]).find(p=>p.user_id===userId);if(!s)return;
  const set=(id,value)=>{const el=document.getElementById(id);if(el)el.value=value==null?"":String(value);};
  set("staff-edit-name",s.full_name);set("staff-edit-number",s.employee_number);set("staff-edit-sex",s.sex);set("staff-edit-dob",s.date_of_birth);
  set("staff-edit-phone",s.phone_number);set("staff-edit-email",s.work_email);set("staff-edit-branch",s.home_branch_id);set("staff-edit-role",s.role_id);
  set("staff-edit-title",s.job_title);set("staff-edit-status",!s.is_active?"inactive":(s.employment_status||"active"));set("staff-edit-start",s.start_date);set("staff-edit-photo",s.photo_url);set("staff-edit-national-id","");
  const f=document.getElementById("staff-edit-feedback");if(f)f.textContent="Loaded "+s.full_name+". Leave National ID blank to preserve its current value.";
};
window.saveStaffProfile=async function(event){
  event.preventDefault();
  const feedback=document.getElementById("staff-edit-feedback"),button=document.getElementById("staff-edit-save");
  const val=id=>{const el=document.getElementById(id);return el&&el.value.trim()?el.value.trim():null;};
  const userId=val("staff-edit-person");if(!userId||!db){if(feedback)feedback.textContent="Select a staff member and confirm the database connection.";return;}
  button.disabled=true;button.textContent="Saving…";if(feedback)feedback.textContent="Saving staff profile securely…";
  const {error}=await db.rpc("update_staff_profile",{
    p_user_id:userId,p_full_name:val("staff-edit-name"),p_employee_number:val("staff-edit-number"),
    p_work_email:val("staff-edit-email"),p_phone_number:val("staff-edit-phone"),p_home_branch_id:val("staff-edit-branch"),
    p_role_id:val("staff-edit-role"),p_sex:val("staff-edit-sex"),p_date_of_birth:val("staff-edit-dob"),
    p_national_id:val("staff-edit-national-id"),p_photo_url:val("staff-edit-photo"),p_employment_status:val("staff-edit-status"),
    p_job_title:val("staff-edit-title"),p_start_date:val("staff-edit-start")
  });
  button.disabled=false;button.textContent="Save staff profile";
  if(error){if(feedback)feedback.textContent="Could not save: "+error.message;return;}
  if(feedback)feedback.textContent="Saved successfully. Refreshing staff directory…";window.switchPage("Staff");
};

window.loadDashboardBranchOptions = async function() {
  const select=document.getElementById("dashboard-branch-id");
  if(!select||!db)return;
  const {data,error}=await db.from("branches").select("id,branch_name,is_head_office").eq("is_active",true).order("is_head_office",{ascending:false}).order("branch_name");
  if(error)return;
  const previous=select.value;
  select.innerHTML='<option value="">All authorized branches</option>'+(data||[]).map(b=>'<option value="'+esc(b.id)+'">'+esc(b.branch_name)+(b.is_head_office?' · Main branch':' · Outreach')+'</option>').join("");
  if((data||[]).some(b=>b.id===previous))select.value=previous;
};

window.loadBranchPortfolioSummary = async function() {
  const feedback=document.getElementById("branch-portfolio-feedback");
  const summary=document.getElementById("branch-portfolio-summary");
  const accountTypes=document.getElementById("branch-account-type-counts");
  const loanStatuses=document.getElementById("branch-loan-status-counts");
  if(!feedback||!summary||!accountTypes||!loanStatuses)return;
  const branchInput=document.getElementById("dashboard-branch-id");
  const branchId=branchInput?branchInput.value.trim():"";
  if(branchId&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(branchId)){
    feedback.textContent="Enter a valid branch UUID or leave the field blank.";return;
  }
  if(!db){feedback.textContent="Database connection unavailable.";return;}
  feedback.textContent="Loading branch portfolio…";summary.innerHTML=accountTypes.innerHTML=loanStatuses.innerHTML="";
  const {data,error}=await db.rpc("list_branch_portfolio_summary",{p_branch_id:branchId||null});
  if(error){feedback.textContent="Branch counts need the list_branch_portfolio_summary SQL function installed. Details: "+error.message;return;}
  const rows=data||[];
  const branchRows=rows.filter(r=>r.metric_type==="branch_summary");
  const typeRows=rows.filter(r=>r.metric_type==="account_type"&&Number(r.account_count||0)>0);
  const loanRows=rows.filter(r=>r.metric_type==="loan_status"&&Number(r.loan_count||0)>0);
  if(!branchRows.length){feedback.textContent="No active branches are visible in your authorized scope.";return;}
  const num=n=>Number(n||0).toLocaleString(undefined,{maximumFractionDigits:2});
  summary.innerHTML='<div class="grid-2">'+branchRows.map(r=>'<div class="metric-card"><h3>'+esc(r.branch_name)+'</h3><div class="metric-val">'+num(r.account_count)+' <span class="muted">accounts</span></div><div class="muted">Customers: '+num(r.customer_count)+' · Active staff: '+num(r.staff_count)+'</div><div class="muted">Loans: '+num(r.loan_count)+' · Loan principal total: '+num(r.loan_principal_total)+'</div><div class="muted">Transactions: '+num(r.transaction_count)+'</div></div>').join("")+'</div>';
  accountTypes.innerHTML=typeRows.length?'<div class="table-responsive"><table class="data-table"><thead><tr><th>Branch</th><th>Account product</th><th>Accounts</th></tr></thead><tbody>'+typeRows.map(r=>'<tr><td>'+esc(r.branch_name)+'</td><td>'+esc(({savings:"Savings",current:"Current",fixed_deposit:"Fixed deposit",business:"Business",group:"Group",other:"Other"})[r.account_type]||r.account_type||"Unclassified")+'</td><td>'+num(r.account_count)+'</td></tr>').join("")+'</tbody></table></div>':'<p class="muted">No bank accounts have been recorded by account type yet.</p>';
  loanStatuses.innerHTML=loanRows.length?'<div class="table-responsive"><table class="data-table"><thead><tr><th>Branch</th><th>Loan status</th><th>Loans</th><th>Principal total</th></tr></thead><tbody>'+loanRows.map(r=>'<tr><td>'+esc(r.branch_name)+'</td><td>'+esc(r.status||"Unspecified")+'</td><td>'+num(r.loan_count)+'</td><td>'+num(r.loan_principal_total)+'</td></tr>').join("")+'</tbody></table></div>':'<p class="muted">No loans have been recorded yet.</p>';
  feedback.textContent="Branch portfolio loaded from database records. Zero counts mean no records are currently registered. Account products are classified separately; loan records do not yet store a currency code.";
};

window.loadTransactionMonitor = async function() {
  const feedback=document.getElementById("transaction-monitor-feedback");
  const list=document.getElementById("transaction-monitor-list");
  if(!feedback||!list)return;
  const branchInput=document.getElementById("monitor-branch-id");
  const statusInput=document.getElementById("monitor-status");
  const branchId=branchInput?branchInput.value.trim():"";
  const status=statusInput?statusInput.value:"";
  if(branchId&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(branchId)){
    feedback.textContent="Enter a valid branch UUID or leave the field blank.";return;
  }
  if(!db){feedback.textContent="Database connection unavailable.";list.innerHTML="";return;}
  feedback.textContent="Loading recent journal activity…";list.innerHTML="";
  const {data,error}=await db.rpc("list_transaction_monitoring",{p_branch_id:branchId||null,p_status:status||null,p_limit:100});
  if(error){feedback.textContent="Transaction monitor needs the secure list_transaction_monitoring SQL function installed in Supabase. Details: "+error.message;return;}
  const mode=list.dataset.transactionMode||"both";
  const visibleRows=(data||[]).filter(r=>{
    const type=String(r.transaction_type||"").toLowerCase();
    if(mode==="deposit")return type==="deposit";
    if(mode==="withdrawal")return type==="withdrawal";
    return true;
  });
  if(!visibleRows.length){feedback.textContent=mode==="deposit"?"No deposit transactions matched this filter.":mode==="withdrawal"?"No withdrawal transactions matched this filter.":"No transactions matched this filter.";return;}
  feedback.textContent="Showing "+visibleRows.length+" "+(mode==="deposit"?"deposit":mode==="withdrawal"?"withdrawal":"transaction")+" records. Only posted entries count toward financial reports.";
  list.innerHTML=visibleRows.map(r=>{
    const amount=Number(r.amount||0).toLocaleString(undefined,{maximumFractionDigits:2})+" "+esc(r.currency_code||"");
    const status=String(r.status||"").toLowerCase();
    const type=String(r.transaction_type||"").toLowerCase();
    const isPosted=status==="posted";
    const isDeposit=type==="deposit";
    const receiptButton=(isPosted&&isDeposit)
      ? '<button type="button" class="secondary transaction-print-receipt" data-receipt-reference="'+esc(r.transaction_reference||r.journal_id||"")+'" data-receipt-date="'+esc(r.transaction_date||"")+'" data-receipt-branch="'+esc(r.branch_name||"")+'" data-receipt-account="'+esc(r.account_number||"")+'" data-receipt-type="'+esc(r.transaction_type||"deposit")+'" data-receipt-amount="'+esc(String(r.amount||0))+'" data-receipt-currency="'+esc(r.currency_code||"")+'">Print deposit receipt</button>'
      : "";
    return '<div class="list-item"><div><strong>'+esc(r.transaction_reference||r.journal_id)+'</strong><br><span class="muted">'+esc(r.transaction_date||"")+' · '+esc(r.branch_name||"Branch unavailable")+' · '+esc(r.account_number||"Account unavailable")+'</span><br><span>'+esc(r.transaction_type||"Journal")+' · '+esc(amount)+'</span></div><div class="transaction-status-actions"><span class="badge-role">'+esc(r.status||"unknown")+'</span>'+receiptButton+'</div></div>';
  }).join("");
};

window.loadStaffTimesheets = async function() {
  const feedback=document.getElementById("timesheet-feedback");
  const list=document.getElementById("timesheet-list");
  if(!feedback||!list)return;
  const from=document.getElementById("timesheet-from")?.value;
  const to=document.getElementById("timesheet-to")?.value;
  const branch=document.getElementById("timesheet-branch")?.value.trim()||"";
  if(!from||!to||to<from){feedback.textContent="Choose a valid from/to date range.";return;}
  if(branch&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(branch)){feedback.textContent="Enter a valid branch UUID or leave it blank.";return;}
  if(!db){feedback.textContent="Database connection unavailable.";return;}
  feedback.textContent="Loading recorded timesheets…";list.innerHTML="";
  const {data,error}=await db.rpc("list_staff_timesheets",{p_from_date:from,p_to_date:to,p_branch_id:branch||null,p_limit:200});
  if(error){feedback.textContent="Timesheets require list_staff_timesheets.sql and attendance_policies.sql installed in Supabase. Details: "+error.message;return;}
  if(!data||!data.length){feedback.textContent="No recorded attendance entries in this date range. Missing/absent staff with no attendance row are not inferred by this report.";return;}
  feedback.textContent="Showing "+data.length+" recorded attendance rows. Review missing punches before payroll approval.";
  list.innerHTML=data.map(r=>{
    const mins=n=>n===null||n===undefined?"—":Math.floor(Number(n)/60)+"h "+(Number(n)%60)+"m";
    return '<div class="list-item"><div><strong>'+esc(r.employee_name||"Staff member")+' · '+esc(r.work_date||"")+'</strong><br><span class="muted">'+esc(r.branch_name||"")+' · '+esc(r.employee_number||"")+'</span><br><span>In: '+esc(r.clock_in_at||"Missing")+' | Out: '+esc(r.clock_out_at||"Missing")+'</span><br><span>Worked: '+mins(r.worked_minutes)+' · Late: '+mins(r.late_minutes)+' · Early: '+mins(r.early_departure_minutes)+' · Overtime: '+mins(r.overtime_minutes)+'</span></div><span class="badge-role">'+esc(r.missing_punch?"Missing punch":(r.attendance_status||"recorded"))+'</span></div>';
  }).join("");
};


let dashboardMonthlyChart = null;
let dashboardDepositWithdrawalChart = null;
let dashboardBranchChart = null;
let dashboardAccountTypeChart = null;
let dashboardAnalyticsRows = [];

function destroyDashboardCharts() {
  [dashboardMonthlyChart,dashboardDepositWithdrawalChart,dashboardBranchChart,dashboardAccountTypeChart].forEach(chart=>{if(chart)chart.destroy();});
  dashboardMonthlyChart=dashboardDepositWithdrawalChart=dashboardBranchChart=dashboardAccountTypeChart=null;
}
window.loadDashboardCharts = async function() {
  const feedback=document.getElementById("dashboard-feedback");
  const kpis=document.getElementById("dashboard-kpis");
  const branchInput=document.getElementById("dashboard-branch-id");
  if(!feedback||!kpis)return;
  kpis.innerHTML=""; dashboardAnalyticsRows=[];
  const branchId=branchInput?branchInput.value.trim():"";
  if(branchId&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(branchId)){feedback.textContent="Enter a valid branch UUID or leave the field blank.";return;}
  if(!db){feedback.textContent="Database connection unavailable. Charts require live posted transaction data.";destroyDashboardCharts();return;}
  feedback.textContent="Loading monthly trends, deposits, withdrawals and branch performance…";
  const {data,error}=await db.rpc("list_dashboard_analytics",{p_branch_id:branchId||null,p_months:12});
  if(error){feedback.textContent="Dashboard analytics are not available until the secure list_dashboard_analytics SQL function is installed in Supabase and permissions are verified. Details: "+error.message;destroyDashboardCharts();return;}
  dashboardAnalyticsRows=data||[];
  if(!dashboardAnalyticsRows.length){feedback.textContent="No posted journal data was returned for your authorized branch scope. Charts remain empty instead of showing demo figures.";destroyDashboardCharts();const sel=document.getElementById("dashboard-chart-currency");if(sel)sel.innerHTML="";return;}
  const currencies=[...new Set(dashboardAnalyticsRows.map(r=>String(r.currency_code||"UNKNOWN").trim()))].sort();
  const sel=document.getElementById("dashboard-chart-currency");
  if(sel){const previous=sel.value;sel.innerHTML=currencies.map(cur=>'<option value="'+esc(cur)+'">'+esc(cur)+'</option>').join("");if(currencies.includes(previous))sel.value=previous;}
  const summaries=dashboardAnalyticsRows.filter(r=>r.metric_type==="currency_summary");
  const fmt=(n,cur)=>Number(n||0).toLocaleString(undefined,{maximumFractionDigits:2})+" "+cur;
  kpis.innerHTML=summaries.map(r=>'<div class="metric-card"><div class="metric-sub">Posted activity · '+esc(r.currency_code)+'</div><div class="metric-val" style="font-size:17px;">Deposits: '+esc(fmt(r.deposit_total,r.currency_code))+'</div><div class="muted">Withdrawals: '+esc(fmt(r.withdrawal_total,r.currency_code))+'</div><div class="muted">Transactions: '+Number(r.transaction_count||0)+'</div></div>').join("");
  if(typeof Chart==="undefined"){feedback.textContent="Analytics data loaded, but the chart library did not load. Check the internet connection and reload.";return;}
  window.renderDashboardAnalyticsCharts();
  feedback.textContent="Loaded "+dashboardAnalyticsRows.length+" analytics rows from posted journals. Values remain separated by currency; no sample figures are used.";
};
window.renderDashboardAnalyticsCharts=function(){
  const sel=document.getElementById("dashboard-chart-currency");
  if(!sel||typeof Chart==="undefined"||!dashboardAnalyticsRows.length)return;
  const currency=sel.value;
  const rows=dashboardAnalyticsRows.filter(r=>String(r.currency_code||"UNKNOWN").trim()===currency);
  const monthly=rows.filter(r=>r.metric_type==="monthly").sort((a,b)=>String(a.period_start).localeCompare(String(b.period_start)));
  const branches=rows.filter(r=>r.metric_type==="branch").sort((a,b)=>String(a.branch_name||"").localeCompare(String(b.branch_name||"")));
  const types=rows.filter(r=>r.metric_type==="account_type");
  destroyDashboardCharts();
  const common={responsive:true,maintainAspectRatio:false,plugins:{legend:{position:"bottom"}}};
  const moneyAxis={beginAtZero:true,ticks:{callback:value=>Number(value).toLocaleString()}};
  const monthlyLabels=monthly.map(r=>r.label||String(r.period_start||""));
  const makeChart=(id,config)=>{const canvas=document.getElementById(id);return canvas?new Chart(canvas,config):null;};
  dashboardMonthlyChart=makeChart("dashboard-monthly-trend",{type:"line",data:{labels:monthlyLabels,datasets:[
    {label:"Deposits",data:monthly.map(r=>Number(r.deposit_count||0)),tension:.25},
    {label:"Withdrawals",data:monthly.map(r=>Number(r.withdrawal_count||0)),tension:.25}
  ]},options:{...common,scales:{y:{beginAtZero:true,ticks:{precision:0}}}}});
  dashboardDepositWithdrawalChart=makeChart("dashboard-deposits-withdrawals",{type:"bar",data:{labels:monthlyLabels,datasets:[
    {label:"Deposits ("+currency+")",data:monthly.map(r=>Number(r.deposit_total||0))},
    {label:"Withdrawals ("+currency+")",data:monthly.map(r=>Number(r.withdrawal_total||0))}
  ]},options:{...common,scales:{y:moneyAxis}}});
  dashboardBranchChart=makeChart("dashboard-branch-performance",{type:"bar",data:{labels:branches.map(r=>r.branch_name||"Unnamed branch"),datasets:[
    {label:"Deposits ("+currency+")",data:branches.map(r=>Number(r.deposit_total||0))},
    {label:"Withdrawals ("+currency+")",data:branches.map(r=>Number(r.withdrawal_total||0))}
  ]},options:{...common,indexAxis:"y",scales:{x:moneyAxis}}});
  dashboardAccountTypeChart=makeChart("dashboard-account-types",{type:"doughnut",data:{labels:types.map(r=>r.ledger_type||"Unclassified"),datasets:[{label:"Absolute net movement",data:types.map(r=>Math.abs(Number(r.debit_total||0)-Number(r.credit_total||0)))}]},options:common});
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

window.searchAccountOpeningCustomers = async function(input) {
  const results=document.getElementById("account-customer-results");
  const hidden=document.querySelector('#acc-form input[name="customer_id"]');
  const selected=document.getElementById("account-customer-selected");
  if(!results||!hidden)return;
  hidden.value="";
  if(selected)selected.textContent="Choose the verified customer before opening an account.";
  const term=String(input.value||"").trim();
  if(term.length<2){results.textContent=term?"Type at least 2 characters.":"";return;}
  if(!db){results.textContent="Database connection unavailable.";return;}
  results.textContent="Searching customers you can access…";
  try{
    const {data,error}=await db.from("customers").select("id,customer_number,full_name,phone_number,status").ilike("full_name","%"+term.replace(/[%_]/g,"\\window.handleAccountSubmit = async function(e) {")+"%").limit(10);
    if(error){results.textContent="Customer search unavailable: "+error.message;return;}
    const rows=(data||[]).filter(row=>["active","approved"].includes(String(row.status||"").toLowerCase()));
    if(!rows.length){results.textContent="No matching active or approved customer found in records you can access.";return;}
    results.innerHTML=rows.map((row,i)=>'<button type="button" class="account-search-option" role="option" data-index="'+i+'"><strong>'+esc(row.full_name||"Customer")+'</strong><span>'+esc(row.customer_number||"No customer number")+'</span><small>'+esc(row.phone_number||"")+'</small></button>').join("");
    results.querySelectorAll(".account-search-option").forEach((button,i)=>button.addEventListener("click",()=>{
      const row=rows[i];hidden.value=row.id;input.value=row.full_name||row.customer_number||"";
      results.innerHTML="";
      if(selected)selected.textContent="Selected "+(row.full_name||"customer")+" · "+(row.customer_number||"customer number")+"; the server validates eligibility.";
    }));
  }catch(err){results.textContent="Customer search failed. Check the connection and try again.";}
};

window.handleAccountSubmit = async function(e) {
  e.preventDefault();
  const form=e.target;
  const feedback=document.getElementById("acc-feedback");
  if(!db){if(feedback)feedback.textContent="Database connection unavailable. No account request was submitted.";return;}
  const formData=new FormData(form);
  const customerId=String(formData.get("customer_id")||"").trim();
  const branchId=String(formData.get("branch_id")||"").trim();
  const accountTypeId=String(formData.get("account_type_id")||"").trim();
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customerId)){
    if(feedback)feedback.textContent="Enter a valid customer UUID.";return;
  }
  if(!branchId||!accountTypeId){if(feedback)feedback.textContent="Choose a branch and account ownership type.";return;}
  const button=form.querySelector('button[type="submit"]');
  if(button)button.disabled=true;
  if(feedback)feedback.textContent="Submitting account request for approval…";
  try{
    const {data,error}=await db.rpc("create_bank_account_request",{
      p_customer_id:customerId,p_branch_id:branchId,p_account_type_id:accountTypeId,
      p_product_type:formData.get("product_type")||"savings",
      p_currency_code:formData.get("currency_code")||"UGX"
    });
    if(error){if(feedback)feedback.textContent="Account request not submitted: "+error.message;return;}
    const result=Array.isArray(data)?data[0]:data;
    const files=Array.from(form.querySelector('input[name="account_documents"]')?.files||[]);
    let documentStatus="";
    if(files.length){
      const uploaded=await window.uploadApplicationDocuments("account-opening",customerId,files,String(formData.get("account_document_category")||"other"));
      documentStatus=uploaded.ok?" · Documents uploaded: "+uploaded.count:" · WARNING: account request submitted, but document upload failed: "+uploaded.error;
    }
    if(feedback)feedback.textContent="Account request submitted for approval. Reference: "+String(result?.account_number||"created")+" · Status: "+String(result?.account_status||"pending_approval")+documentStatus;
    form.reset();
    setTimeout(()=>window.switchPage("Accounts"),1200);
  }catch(err){
    if(feedback)feedback.textContent="Account request failed: "+(err?.message||"Unexpected error");
  }finally{if(button)button.disabled=false;}
};

window.uploadApplicationDocuments = async function(kind,recordId,files,category) {
  if(!db)return {ok:false,error:"Database connection unavailable."};
  if(!["loans","account-opening"].includes(kind))return {ok:false,error:"Unsupported document destination."};
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recordId))return {ok:false,error:"Invalid record UUID."};
  const allowed=["application/pdf","image/jpeg","image/png"];
  for(const file of files){
    if(!allowed.includes(file.type)||file.size>10485760)return {ok:false,error:"Each file must be PDF, JPG or PNG and no larger than 10 MB."};
  }
  let count=0;
  for(const file of files){
    const safeName=String(file.name||"document").normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g,"-").slice(-90)||"document";
    const path=kind+"/"+recordId+"/"+String(category||"other").replace(/[^a-z0-9-]/gi,"-")+"-"+Date.now()+"-"+count+"-"+safeName;
    const {error}=await db.storage.from("bank-application-documents").upload(path,file,{upsert:false,contentType:file.type});
    if(error)return {ok:false,error:error.message,count};
    count++;
  }
  return {ok:true,count};
};

window.handleLoanDocumentUpload = async function(e) {
  e.preventDefault();
  const form=e.target,feedback=document.getElementById("loan-document-feedback");
  const loanId=String(new FormData(form).get("loan_id")||"").trim();
  const category=String(new FormData(form).get("document_category")||"other");
  const files=Array.from(form.querySelector('input[name="loan_documents"]')?.files||[]);
  if(!files.length){if(feedback)feedback.textContent="Choose at least one scanned document.";return;}
  const button=form.querySelector('button[type="submit"]');if(button)button.disabled=true;
  if(feedback)feedback.textContent="Uploading private loan documents…";
  try{
    const result=await window.uploadApplicationDocuments("loans",loanId,files,category);
    if(feedback)feedback.textContent=result.ok?"Uploaded "+result.count+" document(s) to the loan file.":"Upload incomplete after "+(result.count||0)+" file(s): "+result.error;
    if(result.ok)form.reset();
  }catch(err){if(feedback)feedback.textContent="Upload failed: "+(err?.message||"Unexpected error");}
  finally{if(button)button.disabled=false;}
};

window.searchTransactionAccounts = async function(input) {
  const form=input.closest("form"),results=form?.querySelector(".account-search-results"),hidden=form?.querySelector('input[name="account_id"]'),summary=form?.querySelector(".account-selected-summary");
  if(!form||!results||!hidden)return;
  hidden.value="";
  if(summary)summary.textContent="Choose an account from the search results.";
  const term=String(input.value||"").trim().toLowerCase();
  if(term.length<2){results.textContent=term?"Type at least 2 characters.":"";return;}
  if(!db){results.textContent="Database connection unavailable.";return;}
  results.textContent="Searching active accounts in your authorized branches…";
  try{
    const {data,error}=await db.from("bank_accounts").select("id,account_number,currency_code,balance,status,account_holders(customer_id,customers(full_name,customer_number))").eq("status","active").limit(200);
    if(error){results.textContent="Account search unavailable: "+error.message;return;}
    const rows=(data||[]).filter(ac=>{
      const people=(ac.account_holders||[]).map(h=>h.customers||{});
      return [ac.account_number,...people.flatMap(p=>[p.full_name,p.customer_number])].join(" ").toLowerCase().includes(term);
    }).slice(0,10);
    if(!rows.length){results.textContent="No matching active account found in records you can access.";return;}
    results.innerHTML=rows.map((ac,i)=>{
      const people=(ac.account_holders||[]).map(h=>h.customers?.full_name).filter(Boolean);
      return '<button type="button" class="account-search-option" role="option" data-index="'+i+'"><strong>'+esc(ac.account_number||"Account")+'</strong><span>'+esc([...new Set(people)].join(", ")||"Customer name unavailable")+'</span><small>'+esc(ac.currency_code||"")+' · displayed balance '+Number(ac.balance||0).toLocaleString()+'</small></button>';
    }).join("");
    results.querySelectorAll(".account-search-option").forEach((button,i)=>button.addEventListener("click",()=>{
      const ac=rows[i];hidden.value=ac.id;input.value=ac.account_number||"";
      results.innerHTML="";
      if(summary)summary.textContent="Selected "+(ac.account_number||"account")+" · "+(ac.currency_code||"")+"; displayed balance is informational. Server-side rules still apply.";
    }));
  }catch(err){results.textContent="Account search failed. Check the connection and try again.";}
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
  if (transactionType === "withdrawal") {
    const confirmed = window.confirm("Confirm customer withdrawal\\nAccount: " + accountId + "\\nAmount: " + amount.toLocaleString() + "\\n\\nThis only submits a request for approval; do not pay cash until the approved request is posted.");
    if (!confirmed) {
      if (feedback) feedback.textContent = "Withdrawal request cancelled. No transaction was submitted.";
      return;
    }
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
      esc(r.journal_id) + '" data-receipt-reference="' + esc(r.journal_number||r.journal_id||"") +
      '" data-receipt-date="' + esc(r.transaction_date||new Date().toLocaleDateString("en-CA",{timeZone:"Africa/Kampala"})) +
      '" data-receipt-branch="' + esc(r.branch_name||"") + '" data-receipt-account="' + esc(r.account_number||"") +
      '" data-receipt-type="' + esc(r.transaction_type||"") + '" data-receipt-amount="' + esc(String(r.amount||0)) +
      '" data-receipt-currency="' + esc(r.currency_code||"") + '">Post to ledger</button></div></div>'
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
  if (feedback) feedback.textContent = "Ledger posting completed successfully. If this was a deposit, the receipt is ready to print.";
  const receiptDataButton=document.querySelector('[data-post-journal="' + journalId + '"]');
  if(receiptDataButton && String(receiptDataButton.dataset.receiptType||"").toLowerCase()==="deposit"){
    window.printTransactionReceipt(receiptDataButton);
  }
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

window.printTransactionReceipt = function(button, skipConfirmation) {
  if(!button || !button.dataset) return;
  const status=document.getElementById("transaction-receipt-status");
  const reference=button.dataset.receiptReference||"";
  const transactionDate=button.dataset.receiptDate||"";
  const branch=button.dataset.receiptBranch||"";
  const account=button.dataset.receiptAccount||"";
  const type=String(button.dataset.receiptType||"").toLowerCase();
  const amount=Number(button.dataset.receiptAmount);
  const currency=button.dataset.receiptCurrency||"";
  if(type!=="deposit"||!reference||!Number.isFinite(amount)||amount<=0){
    if(status)status.textContent="Receipt unavailable: this record is not a valid posted deposit.";
    return;
  }
  if(!skipConfirmation && !confirm("Print the receipt for posted deposit "+reference+"? Verify the transaction reference and amount."))return;
  const printWindow=window.open("","_blank","width=420,height=700");
  if(!printWindow){if(status)status.textContent="Allow pop-ups for this site, then select Print deposit receipt again.";return;}
  const safe=value=>String(value).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const money=amount.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})+" "+currency;
  printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Deposit Receipt ${safe(reference)}</title><style>@page{size:80mm auto;margin:4mm}body{font:12px/1.45 monospace;color:#000;width:72mm;margin:0 auto}h2,p{text-align:center}h2{font-size:14px;margin:0 0 5px}.muted{text-align:center;font-size:10px}.line{border:0;border-top:1px dashed #000;margin:10px 0}.row{display:flex;justify-content:space-between;gap:8px;margin:6px 0}.amount{font-size:16px;font-weight:bold;text-align:center;margin:12px 0}.label{font-weight:bold}</style></head><body><h2>ZIVAMUNTUYO FINANCIAL SERVICES LTD</h2><p class="muted">CUSTOMER DEPOSIT RECEIPT</p><hr class="line"><div class="row"><span>Receipt reference</span><span>${safe(reference)}</span></div><div class="row"><span>Date</span><span>${safe(transactionDate||"Not provided")}</span></div><div class="row"><span>Branch</span><span>${safe(branch||"Not provided")}</span></div><div class="row"><span>Account</span><span>${safe(account||"Not provided")}</span></div><div class="row"><span>Transaction</span><span>DEPOSIT</span></div><hr class="line"><p class="label">AMOUNT RECEIVED</p><p class="amount">${safe(money)}</p><hr class="line"><p>Thank you for banking with us.</p><p class="muted">This receipt is for a ledger-posted transaction.</p><script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};};<\/script></body></html>`);
  printWindow.document.close();
  if(status)status.textContent="Receipt opened for printing for posted deposit "+reference+".";
};
document.addEventListener("click",function(event){
  const receiptButton=event.target.closest(".transaction-print-receipt");
  if(receiptButton)window.printTransactionReceipt(receiptButton);
});

window.loadAttendancePolicy = async function() {
  const feedback=document.getElementById("attendance-policy-feedback");
  if(!feedback)return;
  if(!db){feedback.textContent="Database connection unavailable; saved policy cannot be loaded.";return;}
  const branchEl=document.getElementById("attendance-branch-id");
  const branchId=branchEl?branchEl.value.trim():"";
  if(branchId&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(branchId)){feedback.textContent="Enter a valid branch UUID or leave blank for the global policy.";return;}
  feedback.textContent="Loading saved attendance policy…";
  const {data,error}=await db.rpc("get_attendance_policy",{p_branch_id:branchId||null});
  if(error){feedback.textContent="Saved-policy loading requires attendance_policies.sql installed in Supabase. Details: "+error.message;return;}
  const row=data&&data[0];
  if(!row){feedback.textContent="No saved policy exists for this scope yet. Defaults remain a preview until a manager saves a policy.";return;}
  const set=(id,value)=>{const el=document.getElementById(id);if(el&&value!==null&&value!==undefined)el.value=String(value).slice(0,5);};
  set("attendance-start",row.clock_in_time);set("attendance-end",row.clock_out_time);
  set("attendance-break-start",row.break_start_time);set("attendance-break-end",row.break_end_time);
  set("attendance-break-minutes",row.unpaid_break_minutes);set("attendance-grace",row.grace_minutes);
  set("attendance-timezone",row.timezone_name);set("attendance-effective-from",row.effective_from);
  const ot=document.getElementById("attendance-overtime");if(ot)ot.value=row.overtime_requires_approval?"yes":"no";
  document.querySelectorAll('input[name="attendance-day"]').forEach(el=>{el.checked=(row.working_days||[]).includes(el.value);});
  feedback.textContent="Loaded saved policy effective "+row.effective_from+". Review it before making changes.";
};
window.saveAttendancePolicy = async function() {
  const feedback=document.getElementById("attendance-policy-feedback");
  if(!feedback)return;
  if(!db){feedback.textContent="Database connection unavailable; policy was not saved.";return;}
  const read=id=>document.getElementById(id);
  const branchId=read("attendance-branch-id").value.trim();
  if(branchId&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(branchId)){feedback.textContent="Enter a valid branch UUID or leave blank for global policy.";return;}
  if(!read("attendance-effective-from").value){feedback.textContent="Choose the policy effective date.";return;}
  window.previewAttendancePolicy();
  if(/must be later|cannot exceed|Enter both|none selected/.test(feedback.textContent)){return;}
  const days=Array.from(document.querySelectorAll('input[name="attendance-day"]:checked')).map(el=>el.value);
  if(!days.length){feedback.textContent="Select at least one working day.";return;}
  const toMinutes=t=>{const p=t.split(":").map(Number);return p[0]*60+p[1];};
  const bs=read("attendance-break-start").value||null,be=read("attendance-break-end").value||null;
  if(bs&&be&&(toMinutes(bs)<toMinutes(read("attendance-start").value)||toMinutes(be)>toMinutes(read("attendance-end").value))){feedback.textContent="Break times must fall within the scheduled shift.";return;}
  const args={
    p_branch_id:branchId||null,p_working_days:days,
    p_clock_in_time:read("attendance-start").value,p_clock_out_time:read("attendance-end").value,
    p_break_start_time:bs,p_break_end_time:be,
    p_unpaid_break_minutes:Number(read("attendance-break-minutes").value),
    p_grace_minutes:Number(read("attendance-grace").value),
    p_overtime_requires_approval:read("attendance-overtime").value==="yes",
    p_timezone_name:read("attendance-timezone").value,
    p_effective_from:read("attendance-effective-from").value
  };
  feedback.textContent="Saving attendance policy securely…";
  const {data,error}=await db.rpc("save_attendance_policy",args);
  if(error){feedback.textContent="Policy was not confirmed saved. Ensure attendance_policies.sql is installed and your account has manager permissions. Details: "+error.message;return;}
  feedback.textContent="Policy saved successfully (ID: "+String(data||"") +"). Changes were audit-logged. Official clock events and timesheets still require their separate implementation.";
};
window.previewAttendancePolicy = function(event) {
  if (event && event.preventDefault) event.preventDefault();
  const read = id => document.getElementById(id);
  const start = read("attendance-start").value, end = read("attendance-end").value;
  const breakMinutes = Number(read("attendance-break-minutes").value || 0), grace = Number(read("attendance-grace").value || 0);
  const feedback = read("attendance-policy-feedback");
  const days = Array.from(document.querySelectorAll('input[name="attendance-day"]:checked')).map(el => el.value);
  if (!start || !end || end <= start) { feedback.textContent = "Clock-out must be later than clock-in. Please correct the times."; return; }
  const toMinutes = t => { const p=t.split(":").map(Number); return p[0]*60+p[1]; };
  const span=toMinutes(end)-toMinutes(start);
  if (breakMinutes>span) { feedback.textContent="Break duration cannot exceed the scheduled shift length."; return; }
  const breakStart=read("attendance-break-start").value, breakEnd=read("attendance-break-end").value;
  if ((breakStart&&!breakEnd)||(!breakStart&&breakEnd)||(breakStart&&breakEnd&&breakEnd<=breakStart)) { feedback.textContent="Enter both break times, and ensure break end is later than break start."; return; }
  const net=span-breakMinutes, fmt=mins=>Math.floor(mins/60)+" hour(s) "+(mins%60)+" minute(s)";
  feedback.textContent="Preview only — "+start+" to "+end+"; break "+breakMinutes+" min; net scheduled work "+fmt(net)+" per day; grace period "+grace+" min; working days: "+(days.length?days.join(", "):"none selected")+"; overtime: "+(read("attendance-overtime").value==="yes"?"manager approval required":"record only")+"; timezone: "+read("attendance-timezone").value+". This has not been saved.";
};
window.resetAttendancePolicy = function() {
  const defaults={"attendance-start":"08:30","attendance-end":"17:00","attendance-grace":"5","attendance-break-minutes":"60","attendance-break-start":"13:00","attendance-break-end":"14:00"};
  Object.entries(defaults).forEach(([id,value])=>{const el=document.getElementById(id);if(el)el.value=value;});
  document.querySelectorAll('input[name="attendance-day"]').forEach(el=>{el.checked=["Monday","Tuesday","Wednesday","Thursday","Friday"].includes(el.value);});
  const ot=document.getElementById("attendance-overtime");if(ot)ot.value="yes";
  const tz=document.getElementById("attendance-timezone");if(tz)tz.value="Africa/Kampala";
  const feedback=document.getElementById("attendance-policy-feedback");if(feedback)feedback.textContent="Reset preview: 08:30–17:00, 60-minute break, Monday–Friday. Net scheduled work: 7 hours 30 minutes per day. Not saved.";
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


const ZFS_FONTS = ["Inter","Roboto","Open Sans","Lato","Montserrat","Poppins","Nunito Sans","Source Sans 3","PT Sans","Ubuntu","Raleway","Merriweather","Playfair Display","Lora","Nunito","Work Sans","DM Sans","Manrope","Fira Sans","IBM Plex Sans","Roboto Slab","Oswald","Quicksand","Cabin","Karla"];
function applyAppearance() {
  const themePicker=document.getElementById("theme-picker");
  const fontPicker=document.getElementById("font-picker");
  let theme="emerald",font="Inter";
  try { theme=localStorage.getItem("zfs-theme")||theme; font=localStorage.getItem("zfs-font")||font; } catch(e) {}
  const validThemes=["emerald","ocean","midnight","light","violet","teal","burgundy"];
  if(!validThemes.includes(theme))theme="emerald";
  if(!ZFS_FONTS.includes(font))font="Inter";
  document.body.dataset.theme=theme;
  document.documentElement.style.setProperty("--font-family",'"'+font+'", sans-serif');
  if(themePicker)themePicker.value=theme;
  if(fontPicker)fontPicker.value=font;
}
function initAppearanceControls() {
  applyAppearance();
  const themePicker=document.getElementById("theme-picker");
  const fontPicker=document.getElementById("font-picker");
  if(themePicker){
    themePicker.value=document.body.dataset.theme||"emerald";
    themePicker.onchange=()=>applySelectedTheme(themePicker.value);
  }
  if(fontPicker){
    fontPicker.value=(document.documentElement.style.getPropertyValue("--font-family").match(/"([^"]+)"/)||[])[1]||"Inter";
    fontPicker.onchange=()=>applySelectedFont(fontPicker.value);
  }
  document.querySelectorAll("[data-theme-choice]").forEach(btn=>{
    btn.onclick=()=>{if(themePicker)themePicker.value=btn.dataset.themeChoice;applySelectedTheme(btn.dataset.themeChoice);};
  });
  const reset=document.getElementById("reset-appearance");
  if(reset)reset.onclick=()=>{
    applySelectedTheme("emerald");applySelectedFont("Inter");
    if(themePicker)themePicker.value="emerald";if(fontPicker)fontPicker.value="Inter";
    const feedback=document.getElementById("appearance-feedback");if(feedback)feedback.textContent="Appearance reset to Emerald & Gold and Inter.";
  };
}
function applySelectedTheme(theme){
  const valid=["emerald","ocean","midnight","light","violet","teal","burgundy"];
  if(!valid.includes(theme))return;
  document.body.dataset.theme=theme;
  try{localStorage.setItem("zfs-theme",theme);}catch(e){}
  const picker=document.getElementById("theme-picker");if(picker)picker.value=theme;
  const feedback=document.getElementById("appearance-feedback");if(feedback)feedback.textContent="Theme saved on this device.";
}
function applySelectedFont(font){
  if(!ZFS_FONTS.includes(font))return;
  document.documentElement.style.setProperty("--font-family",'"'+font+'", sans-serif');
  try{localStorage.setItem("zfs-font",font);}catch(e){}
  const preview=document.getElementById("font-preview");if(preview)preview.style.fontFamily='"'+font+'", sans-serif';
  const feedback=document.getElementById("appearance-feedback");if(feedback)feedback.textContent="Font saved on this device.";
}

async function loadCurrentEmployeeGreeting() {
  if(!db)return;
  try {
    const {data:{user}}=await db.auth.getUser();
    if(!user)return;
    const {data,error}=await db.from("employee_profiles").select("full_name,role_id").eq("user_id",user.id).maybeSingle();
    if(error||!data)return;
    window.currentEmployeeName=data.full_name||"";
    const {data:role}=await db.from("staff_roles").select("role_code").eq("id",data.role_id).maybeSingle();
    window.currentEmployeeRole=role?.role_code||"";
    const userEl=document.getElementById("signed-in-user");
    if(userEl)userEl.textContent=window.currentEmployeeName||"Zivamuntuyo Staff";
    setWelcomeMessage();
  } catch(e) {}
}

function setWelcomeMessage() {
  const title=document.getElementById("welcome-title");
  const message=document.getElementById("welcome-message");
  if(!title||!message)return;
  const hour=Number(new Intl.DateTimeFormat("en-GB",{hour:"2-digit",hourCycle:"h23",timeZone:"Africa/Kampala"}).format(new Date()));
  const greeting=hour<12?"Good morning":hour<17?"Good afternoon":"Good evening";
  const name=(window.currentEmployeeName||"").trim();
  title.textContent=greeting+(name?", "+name:"");
  message.textContent="Welcome to Zivamuntuyo Financial Services. Review branch activity, customer accounts, staffing, savings, loans and financial controls from one secure workspace.";
}

function initApp() {
  initAppearanceControls();
  loadCurrentEmployeeGreeting();
  document.querySelectorAll('.nav').forEach(btn => {
    btn.addEventListener('click', (e) => {
      window.switchPage(e.currentTarget.dataset.page);
    });
  });
  window.switchPage("Dashboard");
  setTimeout(setWelcomeMessage,100);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
