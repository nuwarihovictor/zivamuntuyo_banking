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
  const tabs=[["Staff","Profiles & Roles","👥"],["Attendance","Attendance","🕒"],["StaffChat","VIC LINE platform 2026","✦"]];
  return '<div class="staff-module-tabs" role="navigation" aria-label="Staff module sections">'+tabs.map(([page,label,icon])=>'<button type="button" class="staff-module-tab '+(page===active?'active':'')+'" onclick="switchPage(\''+page+'\')" '+(page===active?'aria-current="page"':'')+'><span>'+icon+'</span><span>'+label+'</span></button>').join("")+'</div>';
}

window.renderBranchManagementPage = function() {
  return `
    <span class="category-tag">Operational regional network</span>
    <h2 class="page-heading">Branches & Regions</h2>
    ${panel("BRANCH DIRECTORY & MANAGEMENT","Authorized branch administration","System administrators can add, edit, activate, or archive branches. Database permissions remain the final security control.",`
      <div id="branch-management-feedback" class="muted" role="status" aria-live="polite">Loading branch directory…</div>
      <div id="branch-management-list"></div>
      <details id="branch-create-panel" class="panel branch-admin-controls" style="margin-top:18px">
        <summary style="cursor:pointer;font-weight:700">＋ Add a branch</summary>
        <form id="branch-create-form" class="form-grid" style="margin-top:14px" onsubmit="window.createBranch(event)">
          <label>Branch code<input name="branch_code" maxlength="30" required pattern="[A-Za-z0-9_-]+" placeholder="e.g. KASESE"></label>
          <label>Branch name<input name="branch_name" maxlength="120" required placeholder="e.g. Kasese Branch"></label>
          <label>Country<select name="country_id" id="branch-create-country" required><option value="">Loading countries…</option></select></label>
          <label>Address<input name="address" maxlength="250" placeholder="Street / town"></label>
          <label>Time zone<select name="timezone"><option value="Africa/Kampala">Africa/Kampala</option><option value="Africa/Nairobi">Africa/Nairobi</option><option value="Africa/Kigali">Africa/Kigali</option></select></label>
          <label style="display:flex;align-items:center;gap:8px"><input type="checkbox" name="is_head_office"> Mark as head office</label>
          <button class="primary" type="submit">Create branch</button>
        </form>
      </details>
      <p class="muted">Branches with linked financial records are archived rather than deleted, preserving transaction history. A successful screen update does not bypass database role policies.</p>
    `)}
  `;
};

window.loadBranchManagement = async function() {
  const feedback=document.getElementById("branch-management-feedback");
  const list=document.getElementById("branch-management-list");
  const countrySelect=document.getElementById("branch-create-country");
  if(!db){if(feedback)feedback.textContent="Database connection unavailable.";return;}
  const [roleResult,branchResult,countryResult]=await Promise.all([
    db.rpc("current_employee_role_code"),
    db.from("branches").select("id,country_id,branch_code,branch_name,address,timezone,is_head_office,is_active").order("is_active",{ascending:false}).order("is_head_office",{ascending:false}).order("branch_name"),
    db.from("countries").select("id,name").eq("is_active",true).order("name")
  ]);
  const canManageBranches=!roleResult.error && roleResult.data==="system_admin";
  document.querySelectorAll(".branch-admin-controls").forEach(el=>{el.hidden=!canManageBranches;});
  if(branchResult.error){if(feedback)feedback.textContent="Branch directory could not be loaded: "+branchResult.error.message;return;}
  if(countrySelect){
    if(countryResult.error){countrySelect.innerHTML='<option value="">Countries unavailable</option>';}
    else countrySelect.innerHTML='<option value="">Choose country</option>'+((countryResult.data||[]).map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join(""));
  }
  if(feedback)feedback.textContent=canManageBranches?((branchResult.data||[]).length+" branch records visible. Branch changes use administrator-only database functions. Buhwenju and historical duplicates cannot be reactivated."):((branchResult.data||[]).length+" branch records visible. Branch editing is available only to an active system administrator.");
  if(!list)return;
  list.innerHTML=(branchResult.data||[]).map(b=>`
    <details class="list-item" style="display:block;margin-top:10px" ${b.is_active?"":" "}>
      <summary style="cursor:pointer;display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">
        <span><strong>${esc(b.branch_name)} (${esc(b.branch_code)})</strong><br><span class="muted">${esc(b.address||"Address not configured")} · ${esc(b.timezone||"Africa/Kampala")}</span></span>
        <span class="branch-status-stack"><span class="badge-role">${b.is_head_office?"Head Office":"Branch"}</span><span class="branch-state ${b.is_active?"branch-state-active":"branch-state-inactive"}">${b.is_active?"Active":"Archived / inactive"}</span></span>
      </summary>
      <form class="form-grid branch-admin-controls" style="margin-top:14px" onsubmit="window.updateBranch(event,'${esc(b.id)}')">
        <label>Branch code<input name="branch_code" maxlength="30" required pattern="[A-Za-z0-9_-]+" value="${esc(b.branch_code)}"></label>
        <label>Branch name<input name="branch_name" maxlength="120" required value="${esc(b.branch_name)}"></label>
        <label>Country<select name="country_id" required>${(countryResult.data||[]).map(x=>'<option value="'+esc(x.id)+'" '+(x.id===b.country_id?'selected':'')+'>'+esc(x.name)+'</option>').join("")}</select></label>
        <label>Address<input name="address" maxlength="250" value="${esc(b.address||"")}"></label>
        <label>Time zone<select name="timezone">${["Africa/Kampala","Africa/Nairobi","Africa/Kigali"].map(t=>'<option '+(t===(b.timezone||"Africa/Kampala")?'selected':'')+'>'+t+'</option>').join("")}</select></label>
        <label style="display:flex;align-items:center;gap:8px"><input type="checkbox" name="is_head_office" ${b.is_head_office?"checked":""}> Head office</label>
        <button class="primary" type="submit">Save changes</button>
        <button class="secondary" type="button" onclick="window.setBranchActive('${esc(b.id)}',${!b.is_active})">${b.is_active?"Archive branch":"Reactivate branch"}</button>
      </form>
    </details>
  `).join("")||'<p class="muted">No branch records are visible to your account.</p>';
};

window.createBranch = async function(event) {
  event.preventDefault();
  const form=event.currentTarget, feedback=document.getElementById("branch-management-feedback");
  if(!db||!form.reportValidity())return;
  const data=new FormData(form);
  const payload={branch_code:String(data.get("branch_code")||"").trim().toUpperCase(),branch_name:String(data.get("branch_name")||"").trim(),country_id:data.get("country_id"),address:String(data.get("address")||"").trim()||null,timezone:data.get("timezone")||"Africa/Kampala",is_head_office:data.get("is_head_office")==="on",is_active:true};
  if(feedback)feedback.textContent="Creating branch…";
  const {error}=await db.rpc("admin_create_branch",{p_branch_code:payload.branch_code,p_branch_name:payload.branch_name,p_country_id:payload.country_id,p_address:payload.address,p_timezone:payload.timezone,p_is_head_office:payload.is_head_office});
  if(error){if(feedback)feedback.textContent="Branch was not created: "+error.message;return;}
  form.reset();await window.loadBranchManagement();
};

window.updateBranch = async function(event,id) {
  event.preventDefault();
  const form=event.currentTarget, feedback=document.getElementById("branch-management-feedback");
  if(!db||!form.reportValidity())return;
  const data=new FormData(form);
  const payload={branch_code:String(data.get("branch_code")||"").trim().toUpperCase(),branch_name:String(data.get("branch_name")||"").trim(),country_id:data.get("country_id"),address:String(data.get("address")||"").trim()||null,timezone:data.get("timezone")||"Africa/Kampala",is_head_office:data.get("is_head_office")==="on"};
  if(feedback)feedback.textContent="Saving branch changes…";
  const {error}=await db.rpc("admin_update_branch",{p_branch_id:id,p_branch_code:payload.branch_code,p_branch_name:payload.branch_name,p_country_id:payload.country_id,p_address:payload.address,p_timezone:payload.timezone,p_is_head_office:payload.is_head_office});
  if(error){if(feedback)feedback.textContent="Branch changes were not saved: "+error.message;return;}
  await window.loadBranchManagement();
};

window.setBranchActive = async function(id,active) {
  const action=active?"reactivate":"archive";
  if(!confirm("Are you sure you want to "+action+" this branch? Existing financial history will be preserved."))return;
  const feedback=document.getElementById("branch-management-feedback");
  if(!db)return;
  if(feedback)feedback.textContent=(active?"Reactivating":"Archiving")+" branch…";
  const {error}=await db.rpc("admin_set_branch_active",{p_branch_id:id,p_is_active:active});
  if(error){if(feedback)feedback.textContent="Branch status was not changed: "+error.message;return;}
  await window.loadBranchManagement();
};


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
    c.innerHTML = renderBranchManagementPage();
    window.loadBranchManagement();
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
        "MEMBERS & CUSTOMER REGISTER",
        "Excel-style member directory",
        "Search, filter and export authorized customer records. Handle NIN/passport details as confidential financial data.",
        `<div class="register-toolbar"><label for="customer-register-search">Search members<input id="customer-register-search" type="search" placeholder="Name, CIF, phone, email, address…" oninput="window.filterCustomerRegister()"></label><label for="customer-register-status">Status<select id="customer-register-status" onchange="window.filterCustomerRegister()"><option value="">All records</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label><button type="button" class="secondary" onclick="window.exportCustomerRegister()">Export visible rows to Excel (CSV)</button></div><p id="customer-register-count" class="muted" aria-live="polite">Loading member records…</p><div id="cust-list" class="table-wrap"><p class="muted">Loading customer records…</p></div><p class="register-privacy-note">Exports contain confidential member information. Store and share them only with authorized staff.</p>`
      )}
    `;

    if (db) {
      db.from("customers").select("*").order("created_at", { ascending: false }).then(({ data, error }) => {
        const listEl = document.getElementById("cust-list");
        if (!listEl) return;
        if (error) { listEl.innerHTML = `<p class="muted">Member register could not be loaded. Check your staff access and connection.</p>`; return; }
        window.customerRegisterRows = data || [];
        window.filterCustomerRegister();
      }).catch(() => {
        const listEl = document.getElementById("cust-list");
        if (listEl) listEl.innerHTML = `<p class="muted">A connection error prevented member records from loading.</p>`;
      });
    } else {
      const listEl=document.getElementById("cust-list");
      if(listEl)listEl.innerHTML='<p class="muted">Database connection unavailable. No member records were loaded.</p>';
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
            <select name="account_type_id" id="account-type-id" required onchange="window.toggleJointHolderFields()">
              <option value="">Loading account types…</option>
            </select>
            <p class="muted">Individual ownership allows one individual account per customer. Joint accounts can be held in addition to that individual account.</p>
          </label>
          <fieldset id="joint-holder-fieldset" class="document-upload-fieldset" hidden>
            <legend>Joint account holders</legend>
            <p class="muted">A joint account requires at least two different active customers. The selected customer above is the primary holder. Add at least one additional holder; every holder is verified again by the database.</p>
            <div id="joint-holder-fields"></div>
            <button type="button" class="secondary" onclick="window.addJointAccountHolderField()">+ Add another holder</button>
            <p id="joint-holder-feedback" class="muted" role="status" aria-live="polite"></p>
          </fieldset>
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
          <div class="account-opening-pricing"><h3>Account-opening package — UGX 30,000</h3><ul><li>One cheque book included</li><li>One transaction log book included</li><li>Account-opening form included</li><li>UGX 10,000 buys one share</li><li>UGX 8,500 restricted security reserve</li><li>UGX 11,500 bundled opening costs</li></ul><p>Replacement cheque book: UGX 2,500 · Replacement transaction log book: UGX 1,500.</p><label class="fs-check-row"><input type="checkbox" name="opening_package_received" required> I confirm that the teller has received UGX 30,000 and I am recording this collection against the account request.</label></div><button type="submit" class="primary">Submit Account Request and Record Teller Collection</button>
          <p id="acc-feedback" class="muted" aria-live="polite"></p>
        </form>`
      )}
      ${panel(
        "BANK ACCOUNTS DIRECTORY",
        "Account status and stored balance",
        "The balance field below is the value stored on the account record; it is not independently reconciled against double-entry ledger postings. Do not use it as an audited balance until reconciliation is implemented.",
        `<div class="notice-box">Balances below distinguish stored values from posted-ledger values. A difference or missing ledger configuration must be investigated; exports are for authorized staff only.</div><div class="register-toolbar"><label for="account-register-search">Search accounts<input id="account-register-search" type="search" placeholder="Account number, member, phone, address…" oninput="window.filterAccountRegister()"></label><label for="account-register-status">Status<select id="account-register-status" onchange="window.filterAccountRegister()"><option value="">All records</option><option value="active">Active</option><option value="dormant">Dormant</option><option value="closed">Closed</option></select></label><button type="button" class="secondary" onclick="window.exportAccountRegister()">Export visible rows to Excel (CSV)</button></div><p id="account-register-count" class="muted" aria-live="polite">Loading account records…</p><div id="acc-list" class="table-wrap"><p class="muted">Loading accounts directory...</p></div><p class="register-privacy-note">Account exports include customer and balance information. Keep files secure and share only with authorized staff.</p>`
      )}
    `;

    c.insertAdjacentHTML("beforeend", '<section class="panel account-shareholding-callout"><h2>SHAREHOLDING — SEPARATE FROM DEPOSIT ACCOUNTS</h2><p class="panel-desc"><strong>UGX 10,000 per share.</strong> Shares are non-withdrawable and are not savings or fixed deposits. They are reported separately as share capital and are not customer deposit balances.</p><button type="button" class="primary" onclick="switchPage(\'Shares\')">Open Shares & Charges</button></section>');

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
          else typeSelect.innerHTML='<option value="">Choose ownership type</option>'+(typeResult.data||[]).map(t=>'<option value="'+esc(t.id)+'" data-type-code="'+esc(t.type_code)+'">'+esc(t.type_name)+' ('+esc(t.type_code)+')</option>').join("");
        }
      });
      db.rpc("list_customer_account_balance_reconciliation")
        .then(async ({ data, error }) => {
          const listEl = document.getElementById("acc-list");
          if (!listEl) return;
          if (error) {
            listEl.innerHTML = `<p class="muted">Ledger reconciliation could not be loaded. Check that you are signed in, have an active employee profile, and have access to the account branch. Details: ${esc(error.message)}</p>`;
            return;
          }
          if (!data || data.length === 0) {
            window.accountRegisterRows=[];
            window.renderAccountRegister([]);
            return;
          }
          const [customersResult,branchesResult,accountDetailsResult]=await Promise.all([
            db.from("customers").select("id,customer_number,full_name,phone_number,email,address,nin_or_passport"),
            db.from("branches").select("id,branch_name,branch_code"),
            db.from("bank_accounts").select("id,account_number,currency_code,balance,status,branch_id,account_holders(customer_id,customers(id,full_name,customer_number,phone_number,email,address,nin_or_passport))").limit(1000)
          ]);
          window.accountRegisterCustomers=customersResult.error?[]:(customersResult.data||[]);
          window.accountRegisterBranches=branchesResult.error?[]:(branchesResult.data||[]);
          const accountDetails=accountDetailsResult.error?[]:(accountDetailsResult.data||[]);
          window.accountRegisterRows=data.map(row=>{
            const detail=accountDetails.find(a=>String(a.id)===String(row.account_id))||{};
            const holder=(detail.account_holders||[]).map(h=>h.customers).filter(Boolean);
            return {...detail,...row,customer_id:row.customer_id||holder[0]?.id||holder[0]?.customer_id||detail.customer_id,customer_name:row.customer_name||holder.map(h=>h.full_name).filter(Boolean).join(", "),customer_number:row.customer_number||holder.map(h=>h.customer_number).filter(Boolean).join(", "),phone_number:row.phone_number||holder.map(h=>h.phone_number).filter(Boolean).join(", "),email:row.email||holder.map(h=>h.email).filter(Boolean).join(", "),address:row.address||holder.map(h=>h.address).filter(Boolean).join(" · "),account_status:row.account_status||detail.status,stored_balance:row.stored_balance??detail.balance,currency_code:row.currency_code||detail.currency_code,branch_id:row.branch_id||detail.branch_id};
          });
          window.renderAccountRegister(window.accountRegisterRows);
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
         <section class="attendance-clock-card" aria-labelledby="attendance-clock-title">
           <h3 id="attendance-clock-title">Manual web attendance — fallback</h3>
           <p class="muted">This records a web clock-in/out with an audit trail. It is not a fingerprint scan. Use the device workflow only after the exact fingerprint terminal or reader has been connected and tested.</p>
           <label>Attendance branch<select id="attendance-clock-branch"><option value="">My home branch</option></select></label>
           <div class="attendance-clock-actions">
             <button type="button" class="primary" id="attendance-clock-in" onclick="window.clockInMyAttendance()">Clock in</button>
             <button type="button" class="secondary" id="attendance-clock-out" onclick="window.clockOutMyAttendance()" disabled>Clock out</button>
             <button type="button" class="secondary" onclick="window.loadMyAttendanceStatus()">Refresh status</button>
           </div>
           <p id="my-attendance-feedback" class="muted" role="status" aria-live="polite">Checking today's attendance…</p>
           <div id="my-attendance-status"></div>
         </section>
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
    window.loadMyAttendanceStatus();
  }
  else if (pageName === "StaffChat") {
    c.innerHTML = `
      <div class="vicline-page">
        ${staffModuleTabs("StaffChat")}
        <section class="vicline-shell" aria-label="VIC LINE staff messaging">
          <header class="vicline-topbar">
            <div class="vicline-brand">
              <div class="vicline-logo" aria-hidden="true"><span>✦</span></div>
              <div class="vicline-brand-copy">
                <span class="vicline-eyebrow">ZIVAMUNTUYO STAFF NETWORK</span>
                <h2>VIC LINE <span>2026</span></h2>
                <p>Stay connected with your team</p>
              </div>
            </div>
            <div class="vicline-top-actions">
              <span class="vicline-secure-pill"><span></span> Private staff chat</span>
              <button type="button" class="vicline-icon-button" title="Refresh messages" aria-label="Refresh messages" onclick="window.loadStaffChat()">↻</button>
            </div>
          </header>
          <div class="vicline-toolbar">
            <div class="vicline-channel-title"><span class="vicline-channel-icon" aria-hidden="true">◎</span><div><strong>Messages</strong><small>Keep 10+ branch and team conversations within reach</small></div></div>
            <div class="vicline-toolbar-actions">
              <button type="button" class="vicline-settings-button" onclick="window.toggleVicLineSettings()" aria-expanded="false" id="vicline-settings-toggle"><span aria-hidden="true">⚙</span> Settings</button>
              <label class="vicline-channel-picker">CONVERSATION TYPE<select id="vicline-mode" onchange="window.toggleVicLineMode()"><option value="channel">Team / branch channel</option><option value="direct">Private direct message</option></select></label><label class="vicline-channel-picker" id="vicline-channel-picker-wrap">OPEN CHANNEL<select id="staff-chat-branch" onchange="window.loadStaffChat()"><option value="">Bank-wide messages</option></select></label><label class="vicline-channel-picker" id="vicline-dm-picker-wrap" hidden>MESSAGE TO STAFF<select id="vicline-dm-recipient" onchange="window.loadStaffChat()"><option value="">Choose staff member</option></select></label>
            </div>
          </div>
          <section class="vicline-settings-panel" id="vicline-settings-panel" hidden aria-labelledby="vicline-settings-title">
            <div class="vicline-settings-heading"><div><h3 id="vicline-settings-title">VIC LINE settings</h3><p>Customize alerts and the look of your workspace on this device.</p></div><button type="button" class="vicline-close-settings" onclick="window.toggleVicLineSettings(false)" aria-label="Close settings">×</button></div>
            <div class="vicline-settings-grid">
              <label class="vicline-setting-row"><span><strong>Notification sounds</strong><small>Play a tone when a new message arrives while VIC LINE is open.</small></span><input type="checkbox" id="vicline-sound-enabled" checked onchange="window.saveVicLineSettings()"></label>
              <label class="vicline-setting-row"><span><strong>Notification tone</strong><small>Choose the sound you prefer.</small></span><select id="vicline-sound-tone" onchange="window.saveVicLineSettings()"><option value="chime">Soft chime</option><option value="bell">Bell</option><option value="pop">Pop</option><option value="double">Double tone</option></select></label>
              <label class="vicline-setting-row"><span><strong>Sound volume</strong><small>Set notification loudness.</small></span><input type="range" id="vicline-sound-volume" min="0" max="100" value="55" oninput="window.updateVicLineVolumeLabel()" onchange="window.saveVicLineSettings()"><output id="vicline-volume-label">55%</output></label>
              <label class="vicline-setting-row"><span><strong>Desktop notifications</strong><small>Ask permission to show browser alerts for new messages.</small></span><button type="button" class="secondary" id="vicline-notification-permission" onclick="window.enableVicLineDesktopNotifications()">Enable alerts</button></label>
              <label class="vicline-setting-row"><span><strong>Appearance</strong><small>Choose a comfortable chat background.</small></span><select id="vicline-appearance" onchange="window.saveVicLineSettings()"><option value="light">Light</option><option value="soft">Soft lavender</option><option value="dark">Dark</option></select></label>
              <label class="vicline-setting-row"><span><strong>Message density</strong><small>Choose how compact the conversation looks.</small></span><select id="vicline-density" onchange="window.saveVicLineSettings()"><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label>
            </div>
            <div class="vicline-settings-footer"><button type="button" class="secondary" onclick="window.testVicLineNotificationTone()">▶ Test tone</button><span id="vicline-settings-feedback" role="status" aria-live="polite">Settings are saved on this device.</span></div>
          </section>
          <div class="vicline-inbox-layout">
            <aside class="vicline-inbox-sidebar" aria-label="Available conversations"><div class="vicline-inbox-sidebar-heading"><strong>Conversations</strong><span id="vicline-conversation-count">Loading…</span></div><div id="vicline-conversation-list" class="vicline-conversation-list"><p class="muted">Loading conversations…</p></div><p class="vicline-sidebar-note">Each conversation follows bank-wide or branch access permissions.</p></aside>
            <div class="vicline-chat-column">
          <div class="vicline-conversation-heading">
            <div class="vicline-conversation-avatar" aria-hidden="true">✦</div>
            <div class="vicline-conversation-copy"><strong id="vicline-current-channel">VIC LINE team</strong><span>Internal communication space</span></div>
            <span class="vicline-conversation-mark" title="Authorized staff channels">•••</span>
          </div>
          <p id="staff-chat-feedback" class="vicline-feedback" role="status" aria-live="polite">Loading secure messages…</p>
          <div id="staff-chat-messages" class="staff-chat-messages vicline-messages" aria-live="polite"></div>
          <div class="vicline-composer-wrap">
            <form id="staff-chat-form" class="vicline-composer" onsubmit="window.sendStaffChatMessage(event)">
              <label class="vicline-message-label" for="staff-chat-input">Message</label>
              <textarea id="staff-chat-input" rows="1" maxlength="1000" required placeholder="Write a message…" aria-label="Write a staff message"></textarea>
              <button type="submit" class="vicline-send-button" aria-label="Send message" title="Send message">➤</button>
            </form>
            <section class="staff-voice-note-tools vicline-voice-tools" aria-labelledby="staff-voice-note-heading">
              <div class="vicline-voice-heading"><span class="vicline-mic-badge" aria-hidden="true">♫</span><div><h3 id="staff-voice-note-heading">Voice note</h3><p>Record a quick update for your team</p></div></div>
              <div class="staff-voice-controls">
                <button type="button" class="secondary" id="staff-voice-record" onclick="window.startStaffVoiceRecording()">🎙️ Record</button>
                <button type="button" class="secondary" id="staff-voice-stop" onclick="window.stopStaffVoiceRecording()" disabled>Stop</button>
                <button type="button" class="secondary" id="staff-voice-discard" onclick="window.discardStaffVoiceRecording()" disabled>Discard</button>
                <button type="button" class="primary" id="staff-voice-send" onclick="window.sendStaffVoiceNote()" disabled>Send voice note</button>
              </div>
              <p id="staff-voice-feedback" class="muted" role="status" aria-live="polite">Microphone access is requested only when you press Record.</p>
              <audio id="staff-voice-preview" controls hidden preload="metadata"></audio>
              <p class="vicline-voice-note">Maximum 120 seconds and 3 MB. Preview before sending; audio never plays automatically.</p>
            </section>
            <p class="vicline-safety-note">Keep passwords, PINs and customer credentials out of chat. Live calls are planned for a later phase.</p>
          </div>
            </div>
          </div>
        </section>
      </div>
    `;
    window.applyVicLineSettings();
    window.loadStaffChat().then(() => { if (!window.vicLinePollHandle) window.vicLineStartPolling(); });
  }
  else if (pageName === "Shares") {
    c.innerHTML = '<h2 class="page-heading">Shares & Charges</h2><p class="page-intro">Account opening: UGX 30,000. Includes one cheque book, one transaction log book and the account-opening form. UGX 10,000 buys one share, UGX 8,500 is a restricted security reserve, and UGX 11,500 covers bundled opening costs. Replacement cheque book: UGX 2,500. Replacement log book: UGX 1,500. Loan-processing form: UGX 10,000.</p>' +
      panel("Share purchase","Record additional shares","Each share costs UGX 10,000.", '<form id="share-purchase-form" onsubmit="handleSharePurchase(event)"><label>Customer<select name="customer_id" id="share-customer" required></select></label><label>Branch<select name="branch_id" id="share-branch" required></select></label><label>Number of shares<input name="share_count" type="number" min="1" step="1" value="1" required oninput="updateSharePurchaseTotal()"></label><p id="share-total-preview">Total payable to teller: UGX 10,000</p><label class="fs-check-row"><input type="checkbox" required> I confirm the teller has received this share payment.</label><button type="submit" class="primary">Record purchase</button><p id="share-purchase-feedback" class="muted"></p></form>') +
      panel("Monthly security charge","Deduct UGX 1,000","Each account can be charged once per month. When the reserve is exhausted, it must be topped up.", '<form id="security-fee-form" onsubmit="handleSecurityMonthlyFee(event)"><label>Account<select name="account_id" id="security-fee-account" required></select></label><label>Month<input type="month" name="period_month" required></label><button class="primary" type="submit">Apply monthly charge</button><p id="security-fee-feedback" class="muted"></p></form>') +
      panel("Security reserve top-up","Cash received by teller","Record a top-up receipt.", '<form id="security-topup-form" onsubmit="handleSecurityTopUp(event)"><label>Account<select name="account_id" id="security-topup-account" required></select></label><label>Amount UGX<input name="amount" type="number" min="1" step="1" required></label><label>Teller receipt<input name="receipt_number"></label><label class="fs-check-row"><input type="checkbox" required> I confirm the teller has received this top-up.</label><button class="primary" type="submit">Record top-up</button><p id="security-topup-feedback" class="muted"></p></form>') +
      panel("Loan-processing form fee","UGX 10,000","Record the fee after the teller receives payment.", '<form id="loan-fee-form" onsubmit="handleLoanFeeCollection(event)"><label>Loan application<select name="application_id" id="loan-fee-application" required></select></label><label class="fs-check-row"><input type="checkbox" required> I confirm the teller has received UGX 10,000.</label><button class="primary" type="submit">Record fee received</button><p id="loan-fee-feedback" class="muted"></p></form>') +
      panel("Replacement stationery","Replacement cheque books and log books","Only charge for replacements; the first of each is included in the opening package.", '<form id="stationery-form" onsubmit="handleStationeryCollection(event)"><label>Customer<select name="customer_id" id="stationery-customer" required></select></label><label>Branch<select name="branch_id" id="stationery-branch" required></select></label><label>Replacement item<select name="item_type" required><option value="replacement_cheque_book">Cheque book — UGX 2,500</option><option value="replacement_transaction_logbook">Transaction log book — UGX 1,500</option></select></label><label class="fs-check-row"><input type="checkbox" required> I confirm the teller has received the replacement-book payment.</label><button class="primary" type="submit">Record teller collection</button><p id="stationery-feedback" class="muted"></p></form>') +
      panel("Share register","Customer shareholding","Real records from the database.", '<div id="share-register">Loading…</div>') + panel("Security reserve register","Reserve balances","Real records from the database.", '<div id="security-register">Loading…</div>') + panel("Teller collection register","Recorded collections","Reconcile receipts to teller cash-up.", '<div id="collection-register">Loading…</div>');
    window.loadSharesAndCharges();
  }
  else if (pageName === "Loans") {
    c.innerHTML = `
      <span class="category-tag">Credit operations</span>
      <h2 class="page-heading">Loans & Credit</h2>
      <p class="muted">Register a loan application, attach evidence, and track independent review decisions. Approval here records a credit decision; it does not disburse funds or create a posted loan ledger.</p>
      ${panel("LOAN REPAYMENT SCHEDULE PREVIEW","Estimate instalments and due dates","Planning calculator only. It does not approve, book, disburse or post a loan. Final schedules must be generated and stored by the secured database workflow using the approved product terms.",`
        <form id="loan-schedule-preview-form" onsubmit="previewLoanRepaymentSchedule(event)">
          <div class="form-grid">
            <label>Principal amount *<input type="number" name="principal" min="1" step="0.01" required placeholder="e.g. 1000000"></label>
            <label>Annual interest rate (%) *<input type="number" name="annual_rate" min="0" max="100" step="0.01" required value="24"></label>
            <label>Term (months) *<input type="number" name="term_months" min="1" max="360" step="1" required value="12"></label>
            <label>Interest method *<select name="method" required><option value="reducing_emi">Reducing balance — equal instalments</option><option value="reducing_equal_principal">Reducing balance — equal principal</option><option value="flat">Flat rate on original principal</option></select></label>
            <label>First instalment due date *<input type="date" name="first_due_date" required></label>
            <label>Grace period (days)<input type="number" name="grace_days" min="0" max="365" step="1" value="0"></label>
          </div>
          <p class="muted">Preview assumptions: monthly instalments; annual rate divided by 12; no fees, insurance, penalties, holiday adjustment or payment rounding policy included. Confirm the legally approved product method before quoting a borrower.</p>
          <button type="submit" class="primary">Calculate repayment schedule</button>
          <button type="button" class="secondary" onclick="document.getElementById('loan-schedule-preview').innerHTML='';document.getElementById('loan-schedule-preview-form').reset()">Clear preview</button>
        </form>
        <div id="loan-schedule-preview" aria-live="polite"></div>
      `)}
      ${panel("LOAN DUE-DATE CONTROL","Repayment due and arrears dashboard","Status is calculated from approved saved schedules and posted repayment allocations. If the database servicing schema is not installed, this panel will report that rather than inventing balances.",`
        <div class="form-grid">
          <label>Branch filter<select id="loan-due-branch"><option value="">All authorized branches</option></select></label>
          <button type="button" class="secondary" onclick="window.loadLoanDueDashboard()">Refresh due dates</button>
        </div>
        <div class="loan-due-legend" aria-label="Loan servicing status legend"><span>🟢 Upcoming</span><span>🔵 Due today</span><span>🟠 Grace period</span><span>🔴 Overdue</span><span>⚫ Settled</span></div>
        <div id="loan-due-feedback" class="muted" role="status" aria-live="polite">Loading saved loan schedules…</div>
        <div id="loan-due-summary" class="grid-2"></div>
        <div id="loan-due-list" class="table-wrap"></div>
        <p class="muted">Days past due are measured from the contractual due date. Grace-period status is shown separately. Alert delivery and collection notes require the reviewed servicing database setup.</p>
      `)}
      ${panel("NEW LOAN APPLICATION","Capture request and supporting evidence","Use an active customer and the branch responsible for the application. Attach ID, land title, chairperson letter and other supporting documents.",`
        <form id="loan-application-form" onsubmit="handleLoanApplicationSubmit(event)">
          <label>Customer *
            <input type="search" id="loan-customer-search" autocomplete="off" placeholder="Search customer name or number" oninput="searchLoanCustomers(this)" required>
            <input type="hidden" name="customer_id" required>
            <div id="loan-customer-results" class="account-search-results" role="listbox"></div>
            <p id="loan-customer-selected" class="muted">Choose a customer from the results.</p>
          </label>
          <label>Branch *<select name="branch_id" id="loan-branch-select" required><option value="">Loading active branches…</option></select></label>
          <div class="form-grid">
            <label>Requested amount *<input type="number" name="requested_amount" min="0.01" step="0.01" required oninput="refreshLoanShareRequirement()"></label>
            <label>Currency *<select name="currency_code" id="loan-currency-select" required><option value="">Loading currencies…</option></select></label>
            <label>Loan product *<select name="loan_type" id="loan-type-select" onchange="updateSelectedLoanRate()" required><option value="">Loading loan products…</option></select></label><label>Tenure (months) *<input type="number" name="tenure_months" min="1" max="360" step="1" value="12" required></label>
          </div>
          <div class="loan-rate-notice" id="loan-rate-notice" aria-live="polite">The approved product rate will be applied automatically.</div><div class="loan-share-guidance" id="loan-share-guidance">UGX 100,000 requested loan corresponds to 1 share as a guideline. Select a customer to see recorded shareholding. Shareholding does not guarantee loan approval.</div>
          <label>Loan purpose *<textarea name="loan_purpose" rows="3" minlength="3" maxlength="2000" required placeholder="Explain how the funds will be used"></textarea></label>
          <label>Collateral / land title details<textarea name="collateral_description" rows="2" maxlength="2000" placeholder="Describe collateral if applicable"></textarea></label>
          <div class="form-grid">
            <label>Guarantor name<input name="guarantor_name" maxlength="200"></label>
            <label>Guarantor phone<input name="guarantor_phone" maxlength="40" inputmode="tel"></label>
          </div>
          <label>Document category
            <select name="document_category">
              <option value="national-id">Borrower national ID</option><option value="passport">Borrower passport</option>
              <option value="chairperson-letter">LC / chairperson letter</option><option value="land-title">Land title / Kibanja evidence</option>
              <option value="vehicle-logbook">Vehicle logbook / ownership evidence</option><option value="business-registration">Business registration / trading licence</option>
              <option value="agriculture-evidence">Agriculture / farm evidence</option><option value="school-fees-invoice">School fees invoice / admission evidence</option>
              <option value="guarantor-id">Guarantor identification</option><option value="income-evidence">Income / bank statement evidence</option>
              <option value="valuation-report">Collateral valuation report</option><option value="other">Other supporting document</option>
            </select>
          </label>
          <label>Scanned supporting documents (optional)
            <input type="file" name="loan_documents" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" multiple>
          </label>
          <p class="muted">PDF, JPG or PNG, up to 10 MB each. Files are stored privately and branch-scoped.</p>
          <button type="submit" class="primary">Submit loan application</button>
          <p id="loan-application-feedback" class="muted" aria-live="polite"></p>
        </form>
      `)}
      ${window.currentEmployeeRole==="general_manager" ? panel("LOAN PRODUCT RATE SETTINGS","General Manager controls","Set the rate and period for new applications. Overdraft is permanently fixed at 5% per month.",'<div id="loan-product-rate-settings">Loading loan product rates…</div>') : ""}
      <section class="loan-applications-section">
        <div class="section-heading-row"><div><h3>Loan application register</h3><p class="muted">Real applications from the database; no sample figures.</p></div><button type="button" class="secondary" onclick="loadLoanApplications()">Refresh</button></div>
        <div id="loan-application-list" class="loan-application-list">Loading authorized loan applications…</div>
      </section>
    `;
    window.loadLoanApplicationFormOptions();
    window.loadLoanApplications();
    window.loadLoanDueDashboard();
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
      <section id="approval-limit-admin-panel" class="panel" hidden>
        <h2>APPROVAL LIMITS & DELEGATED AUTHORITY</h2>
        <p class="panel-desc">General Manager / System Administrator only. Database-enforced starter limits: teller cash approvals up to UGX 5,000,000; branch-manager cash/loan approvals up to UGX 10,000,000; overdrafts up to UGX 5,000,000. Adjust these to the approved bank policy.</p>
        <form id="approval-limit-form" onsubmit="saveApprovalLimitSettings(event)"><div class="form-grid">
          <label>Staff role<select id="approval-limit-role" required><option value="teller">Teller</option><option value="branch_manager">Branch Manager</option><option value="bank_admin">Bank Administrator</option><option value="accountant">Accountant</option><option value="loan_officer">Loan Officer</option><option value="general_manager">General Manager</option><option value="system_admin">System Administrator</option></select></label>
          <label>Approval action<select id="approval-limit-action" required><option value="cash_transaction">Cash transaction</option><option value="loan">Loan approval</option><option value="overdraft">Overdraft approval</option><option value="account_opening">Account opening</option></select></label>
          <label>Currency<select id="approval-limit-currency" required><option value="UGX">UGX</option></select></label>
          <label>Branch-specific override (optional)<select id="approval-limit-branch"><option value="">All branches (default)</option></select></label>
          <label>Maximum amount (UGX)<input id="approval-limit-amount" type="number" min="0" step="1" placeholder="e.g. 5000000"></label>
          <label class="checkbox-label"><input id="approval-limit-unlimited" type="checkbox"> Unlimited authority for this action</label>
          <label>Reason for change<input id="approval-limit-reason" maxlength="500" minlength="3" required placeholder="Approved policy or management decision"></label>
          <button type="submit" class="primary">Save approval policy</button>
        </div></form><p id="approval-limit-feedback" class="muted" role="status" aria-live="polite"></p><div id="approval-limit-table"></div>
      </section>
    `;
    initAppearanceControls();
    window.loadApprovalLimitSettings();
  }
  else if (pageName === "FormStudio") {
    c.innerHTML = `
      <span class="category-tag">Document design workspace</span><h2 class="page-heading">Form Studio</h2>
      <p class="page-intro">Create professional account-opening, loan-processing and overdraft forms. Edit fields, preview the layout, save a template on this device, and print or save as PDF. Templates do not submit accounts or approve loans.</p>
      <section class="panel"><h2>FORM DESIGNER</h2><p class="panel-desc"><strong>Create a reusable blank form</strong> — customize headings, field labels, requirements and signatures.</p>
      <div class="form-studio-layout"><section class="form-studio-editor">
      <label>Template type<select id="fs-type" onchange="fsChange(this.value)"><option value="account">Account opening</option><option value="loan">Loan processing</option><option value="overdraft">Overdraft facility</option></select></label>
      <label>Form title<input id="fs-title" value="Account Opening Form" maxlength="120" oninput="fsRender()"></label><label>Reference / version<input id="fs-ref" value="ZFS-ACC-01 · Version 1.0" maxlength="100" oninput="fsRender()"></label>
      <label>Instructions<textarea id="fs-instructions" rows="3" maxlength="800" oninput="fsRender()">Complete all required fields. Staff must verify original supporting documents before processing.</textarea></label>
      <h3>Editable fields</h3><p class="muted">Rename fields, choose field types, and mark required items.</p><div id="fs-fields" class="fs-fields-editor"></div>
      <div class="fs-add-field"><label>New field label<input id="fs-new-label" maxlength="100" placeholder="e.g. Next of kin contact"></label><label>Field type<select id="fs-new-type"><option value="text">Short text</option><option value="date">Date</option><option value="number">Number / amount</option><option value="textarea">Long text</option><option value="checkbox">Tick box</option></select></label><button type="button" class="secondary" onclick="fsAdd()">+ Add field</button></div>
      <label class="fs-check-row"><input type="checkbox" id="fs-logo" checked onchange="fsRender()"> Show organization branding</label><label class="fs-check-row"><input type="checkbox" id="fs-sign" checked onchange="fsRender()"> Include signature sections</label><label class="fs-check-row"><input type="checkbox" id="fs-checklist" checked onchange="fsRender()"> Include document checklist</label>
      <div class="form-studio-actions"><button type="button" class="primary" onclick="fsSave()">Save template</button><button type="button" class="secondary" onclick="fsLoad()">Load saved template</button><button type="button" class="secondary" onclick="fsChange(document.getElementById('fs-type').value)">Reset</button></div><p id="fs-feedback" class="muted" aria-live="polite">Sign in to sync saved templates across devices. Offline drafts remain on this device.</p></section>
      <section class="form-studio-preview-column"><div class="form-studio-preview-head"><h3>Live print preview</h3><button type="button" class="primary" onclick="fsPrint()">Print / Save PDF</button></div><div id="fs-preview" class="form-studio-paper"></div></section></div></section>`;
    fsChange("account");
  }

  else if (pageName === "Payroll") {
    c.innerHTML = '<span class="category-tag">Institutional banking · bulk salary payments</span><h2 class="page-heading">Institutional Payroll</h2><p class="page-intro">Pay salaries from an institution account in one controlled batch. Each employee is charged a flat UGX 1,000 commission on the payment date; the remaining salary is credited to their own active UGX account.</p>' +
      panel("PAYROLL FUNDING","Select the institution account","The account must have enough available balance for the full gross payroll.",'<div class="form-grid"><label>Institution funding account *<select id="payroll-source-account" required><option value="">Loading active UGX accounts…</option></select></label><label>Payroll reference *<input id="payroll-reference" required minlength="4" placeholder="e.g. SCHOOL-OCT-2026"></label><label>Payment date *<input id="payroll-date" type="date" required></label></div><p id="payroll-account-feedback" class="muted" aria-live="polite">Loading active accounts…</p>') +
      panel("EMPLOYEE SALARY LIST","Paste or enter payroll rows","Use one employee per line in this format: account number | employee name | gross salary | employee number (optional). The account number must match an active UGX account in the same branch.",'<label>Employee payroll rows *<textarea id="payroll-rows" rows="9" placeholder="0012345678 | Amina N. | 500000 | EMP-001&#10;0012345679 | David K. | 420000 | EMP-002" required></textarea></label><p class="muted">Commission is fixed at UGX 1,000 per employee. Gross salary must exceed UGX 1,000. Duplicate accounts, invalid accounts, future dates and insufficient funding are rejected.</p><div class="button-row"><button type="button" class="primary" onclick="previewInstitutionPayroll()">Preview payroll totals</button><button type="button" class="primary" onclick="processInstitutionPayroll()">Confirm &amp; pay salaries</button></div><div id="payroll-preview" class="panel" aria-live="polite"><p class="muted">Preview totals before confirming payment.</p></div><p id="payroll-feedback" class="muted" aria-live="polite"></p>') +
      panel("POSTED PAYROLL RECEIPT","Batch confirmation","Print the summary after a successful posting.",'<div id="payroll-receipt" class="receipt-preview"><p class="muted">No payroll has been posted in this session.</p></div><button type="button" class="secondary" onclick="printInstitutionPayrollReceipt()">Print payroll summary</button>') +
      panel("SIGNED PAYROLL RECORDS","Archive the signed payroll list and withdrawal slip","Upload scans signed by at least two responsible institution leaders. The documents remain private and are linked to the posted payroll batch for audit and future reference.",'<div class="form-grid"><label>Posted payroll batch ID *<input id="payroll-evidence-batch" required placeholder="Filled automatically after payroll posting"></label><label>Signed payroll list scan (PDF/JPG/PNG) *<input id="payroll-evidence-list" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" required></label><label>Signed withdrawal slip scan (PDF/JPG/PNG) *<input id="payroll-evidence-slip" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" required></label></div><h3>Institution signatories (2 required, 3 maximum)</h3><div class="form-grid"><label>Signer 1 full name *<input id="payroll-signer-1-name" required maxlength="160"></label><label>Signer 1 position *<input id="payroll-signer-1-role" required maxlength="120" placeholder="e.g. Head Teacher / Director"></label><label>Signer 2 full name *<input id="payroll-signer-2-name" required maxlength="160"></label><label>Signer 2 position *<input id="payroll-signer-2-role" required maxlength="120"></label><label>Signer 3 full name (optional)<input id="payroll-signer-3-name" maxlength="160"></label><label>Signer 3 position (optional)<input id="payroll-signer-3-role" maxlength="120"></label></div><label class="fs-check-row"><input id="payroll-signers-confirmed" type="checkbox" required> I confirm the names above are the people who signed the payroll list and withdrawal slip.</label><button type="button" class="primary" onclick="attachInstitutionPayrollEvidence()">Upload scans &amp; archive with payroll</button><p id="payroll-evidence-feedback" class="muted" aria-live="polite">Documents must be signed before scanning. Keep the original signed papers according to the institution retention policy.</p>');
    const dateEl=document.getElementById("payroll-date"); if(dateEl)dateEl.value=new Date().toLocaleDateString("en-CA");
    window.loadInstitutionPayrollAccounts();
  }

  else if (pageName === "Performance") {
    c.innerHTML = '<span class="category-tag">Management accounts · recorded activity</span><h2 class="page-heading">Bank Performance</h2><p class="page-intro">Recorded income, expenses, operating surplus or deficit, non-withdrawable share capital, restricted reserves and cash movement. These management figures are not an audited profit-and-loss statement.</p>' +
      panel("PERIOD & BRANCH FILTERS","Review performance","Choose a branch and period.",'<div class="form-grid performance-filters"><label>Branch<select id="performance-branch"><option value="">All authorized branches</option></select></label><label>From date<input type="date" id="performance-start"></label><label>To date<input type="date" id="performance-end"></label><button type="button" class="primary" onclick="loadBankPerformance()">Refresh performance</button></div><p id="performance-feedback" class="muted" aria-live="polite">Loading…</p>') +
      '<div id="performance-summary" class="performance-summary-grid"></div>' +
      panel("INCOME, EXPENSES & CAPITAL","Category breakdown","Share capital and security reserves are separate from income and expenses.",'<div id="performance-categories">Loading…</div>') +
      panel("MONTHLY PERFORMANCE","Trend over time","Monthly recorded income less recorded expenses.",'<div id="performance-monthly">Loading…</div>') +
      panel("RECORD INCOME OR EXPENSE","Controlled finance entry","Use only for amounts received or expenses supported by a receipt/voucher. Other fee collection workflows are captured automatically. Loan interest and late-payment penalties are entered here until repayments are integrated.",'<form id="performance-entry-form" onsubmit="handleFinancialActivitySubmit(event)"><div class="form-grid"><label>Category *<select name="category" required onchange="toggleFinanceLoanReference()"><option value="loan_interest_income">Loan interest received</option><option value="late_loan_penalty">Late loan-payment penalty received</option><option value="other_income">Other income received</option><option value="operating_expense">Operating expense paid</option></select></label><label>Amount (UGX) *<input name="amount" type="number" min="1" step="1" required></label><label>Receipt / voucher reference *<input name="receipt_number" maxlength="100" required></label><label>Event date *<input type="date" name="event_date" required></label><label>Loan application (optional)<select id="performance-loan-application" name="loan_application_id"><option value="">Not linked to a loan</option></select></label><label class="performance-description-field">Description *<input name="description" minlength="4" maxlength="250" required></label></div><label class="fs-check-row"><input type="checkbox" name="confirm_evidence" required> I confirm the entry is supported by a receipt or approved voucher and has not already been recorded.</label><button class="primary" type="submit">Record financial activity</button><p id="performance-entry-feedback" class="muted" aria-live="polite"></p></form>') +
      panel("RECENT FINANCIAL ACTIVITY","Audit trail view","Recent entries in your authorized scope.",'<div id="performance-activity">Loading…</div>') +
      '<p class="muted performance-caveat">Share purchases are retained as non-withdrawable share capital, not operating profit. Savings and fixed deposits remain customer liabilities, not income. Financial statements should be reviewed by the bank accountant under applicable Ugandan accounting rules. Interest and penalties are manually recorded here until linked to loan repayments.</p>';
    window.loadPerformanceBranchOptions();
    window.loadBankPerformance();
  }
  else if (pageName === "DormantAccounts") {
    c.innerHTML = '<span class="category-tag">Account lifecycle · risk & customer servicing</span><h2 class="page-heading">Dormant Accounts</h2><p class="page-intro">An account is considered dormant after 18 months without a posted transaction. Review the list, verify the customer, collect the UGX 22,000 reactivation fee, then reactivate. The fee is automatically posted to bank income.</p>' +
      panel("DORMANCY REVIEW","Find accounts inactive for 18 months","This review marks eligible active accounts as dormant using their last posted transaction date, falling back to the opening/creation date. Review before communicating with customers.",'<div class="form-grid"><label>Branch filter (optional)<select id="dormant-branch"><option value="">All authorized branches</option></select></label><button type="button" class="primary" onclick="refreshDormantAccountReview()">Run 18-month dormancy review</button></div><p id="dormant-review-feedback" class="muted" aria-live="polite">Run a review to refresh account status.</p>') +
      panel("DORMANT ACCOUNT REGISTER","Reactivation queue","The fee is UGX 22,000. Choose whether the customer pays cash at the teller or authorizes a deduction from their available account balance. A unique receipt/reference is required.",'<div id="dormant-account-list"><p class="muted">Loading dormant accounts…</p></div>');
    window.loadDormantAccountList();
    window.loadDormantBranchOptions();
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
    const isReceiptEligible=isDeposit||type==="withdrawal";
    const receiptButton=(isPosted&&isReceiptEligible)
      ? '<button type="button" class="secondary transaction-print-receipt" data-receipt-reference="'+esc(r.transaction_reference||r.journal_id||"")+'" data-receipt-date="'+esc(r.transaction_date||"")+'" data-receipt-branch="'+esc(r.branch_name||"")+'" data-receipt-account="'+esc(r.account_number||"")+'" data-receipt-type="'+esc(type)+'" data-receipt-amount="'+esc(String(r.amount||0))+'" data-receipt-currency="'+esc(r.currency_code||"")+'">Print '+(type==="withdrawal"?"withdrawal":"deposit")+' receipt</button>'
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

window.toggleFinanceLoanReference=function(){const category=document.querySelector('#performance-entry-form select[name="category"]')?.value,loan=document.getElementById("performance-loan-application");if(loan){loan.required=category==="loan_interest_income"||category==="late_loan_penalty";const label=loan.closest("label");if(label)label.firstChild.textContent=loan.required?"Loan application *":"Loan application (optional)";}};
window.loadPerformanceBranchOptions=async function(){
 const sel=document.getElementById("performance-branch");if(!sel||!db)return;
 const {data,error}=await db.from("branches").select("id,branch_name,branch_code").eq("is_active",true).order("branch_name");
 if(error){sel.innerHTML='<option value="">Branch list unavailable</option>';return;}
 const selected=sel.value;sel.innerHTML='<option value="">All authorized branches</option>'+(data||[]).map(b=>'<option value="'+esc(b.id)+'">'+esc(b.branch_name)+' ('+esc(b.branch_code)+')</option>').join("");
 if(selected)sel.value=selected;
 const loanSelect=document.getElementById("performance-loan-application");if(loanSelect){const {data:loanRows,error:loanError}=await db.rpc("list_loan_applications",{p_branch_id:null});if(!loanError){loanSelect.innerHTML='<option value="">Not linked to a loan</option>'+(loanRows||[]).map(l=>'<option value="'+esc(l.id)+'">'+esc(l.application_number||"Application")+' · '+esc(l.customer_name||"Customer")+' · '+esc(l.status||"")+'</option>').join("");}}window.toggleFinanceLoanReference();
};
window.loadBankPerformance=async function(){
 const feedback=document.getElementById("performance-feedback"),summary=document.getElementById("performance-summary"),categories=document.getElementById("performance-categories"),monthly=document.getElementById("performance-monthly"),activity=document.getElementById("performance-activity");
 if(!feedback||!summary||!categories||!monthly||!activity||!db)return;
 const branch=document.getElementById("performance-branch")?.value||null,start=document.getElementById("performance-start")?.value||null,end=document.getElementById("performance-end")?.value||null;
 if(start&&end&&start>end){feedback.textContent="Start date must not be after end date.";return;}
 feedback.textContent="Loading recorded activity…";summary.innerHTML="";categories.innerHTML="";monthly.innerHTML="";activity.innerHTML="";
 const {data,error}=await db.rpc("get_financial_performance",{p_branch_id:branch,p_start_date:start,p_end_date:end});
 if(error){feedback.textContent="Performance report unavailable: "+error.message;return;}
 const d=Array.isArray(data)?data[0]:data;if(!d){feedback.textContent="No report data returned.";return;}
 const money=n=>"UGX "+Number(n||0).toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:2});
 const metric=(title,value,sub,cls)=>'<div class="performance-metric '+cls+'"><span>'+esc(title)+'</span><strong>'+esc(money(value))+'</strong><small>'+esc(sub)+'</small></div>';
 summary.innerHTML=metric("Recorded income",d.income_total,"Fees, interest and penalties","income")+metric("Recorded expenses",d.expense_total,"Recorded operating costs","expense")+metric(Number(d.operating_surplus||0)<0?"Operating deficit":"Operating surplus",Math.abs(Number(d.operating_surplus||0)),Number(d.operating_surplus||0)<0?"Income less expenses is negative":"Income less expenses is positive",Number(d.operating_surplus||0)<0?"loss":"surplus")+metric("Non-withdrawable share capital",d.share_capital_total,"Retained share funds; not profit","capital")+metric("Restricted security reserve",d.restricted_reserve_total,"Customer-linked reserve movements","reserve")+metric("Net cash movement",Number(d.cash_in_total||0)-Number(d.cash_out_total||0),"Cash in "+money(d.cash_in_total)+" · out "+money(d.cash_out_total),"cash");
 const labels={share_capital:"Share capital (non-withdrawable)",account_opening_fees:"Account-opening package fees",loan_processing_fee:"Loan-processing form fees",replacement_cheque_book:"Replacement cheque books",replacement_transaction_logbook:"Replacement transaction log books",account_security_fee:"Monthly account security charges",security_reserve:"Restricted security reserve/top-ups",loan_interest_income:"Loan interest income",late_loan_penalty:"Late loan-payment penalties",other_income:"Other income",operating_expense:"Operating expenses"};
 const rows=d.by_category||[];categories.innerHTML=rows.length?'<div class="table-scroll"><table class="data-table"><thead><tr><th>Category</th><th>Classification</th><th>Amount</th><th>Cash in</th><th>Cash out</th><th>Entries</th></tr></thead><tbody>'+rows.map(x=>'<tr><td>'+esc(labels[x.category]||x.category)+'</td><td>'+esc(x.profit_loss_type)+'</td><td>'+money(x.amount)+'</td><td>'+money(x.cash_in)+'</td><td>'+money(x.cash_out)+'</td><td>'+Number(x.count||0)+'</td></tr>').join("")+'</tbody></table></div>':'<p class="muted">No financial activity is recorded for the selected period.</p>';
 const months=d.monthly_trend||[];monthly.innerHTML=months.length?'<div class="table-scroll"><table class="data-table"><thead><tr><th>Month</th><th>Income</th><th>Expenses</th><th>Surplus / deficit</th><th>Share capital</th></tr></thead><tbody>'+months.map(x=>'<tr><td>'+esc(x.month)+'</td><td>'+money(x.income)+'</td><td>'+money(x.expenses)+'</td><td class="'+(Number(x.surplus)<0?"performance-negative":"")+'">'+(Number(x.surplus)<0?"−":"")+money(Math.abs(Number(x.surplus||0)))+'</td><td>'+money(x.share_capital)+'</td></tr>').join("")+'</tbody></table></div>':'<p class="muted">No monthly trend data for this period.</p>';
 let query=db.from("financial_activity_ledger").select("event_date,category,profit_loss_type,amount,cash_in,cash_out,description,receipt_number,branch_id,source_table,created_at").order("created_at",{ascending:false}).limit(50);
 if(branch)query=query.eq("branch_id",branch);if(start)query=query.gte("event_date",start);if(end)query=query.lte("event_date",end);
 const {data:events,error:eventError}=await query;
 activity.innerHTML=eventError?'<p class="muted">Recent activity could not load: '+esc(eventError.message)+'</p>':(events||[]).length?'<div class="table-scroll"><table class="data-table"><thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Classification</th><th>Amount</th><th>Receipt / source</th></tr></thead><tbody>'+(events||[]).map(x=>'<tr><td>'+esc(x.event_date)+'</td><td>'+esc(x.description)+'</td><td>'+esc(labels[x.category]||x.category)+'</td><td>'+esc(x.profit_loss_type)+'</td><td>'+money(x.amount)+'</td><td>'+esc(x.receipt_number||x.source_table||"—")+'</td></tr>').join("")+'</tbody></table></div>':'<p class="muted">No recorded activity in the selected period.</p>';
 feedback.textContent="Loaded "+Number(d.event_count||0)+" recorded entries. Figures exclude unrecorded activity and do not replace the general-ledger trial balance.";
};
window.handleFinancialActivitySubmit=async function(e){
 e.preventDefault();const f=e.target,feedback=document.getElementById("performance-entry-feedback"),button=f.querySelector('button[type="submit"]');if(button)button.disabled=true;
 try{const branch=document.getElementById("performance-branch")?.value;if(!branch)throw new Error("Choose a branch first so the entry is assigned correctly.");
 const category=f.category.value;if(category==="operating_expense"&&!(["system_admin","bank_admin","branch_manager","accountant","general_manager"].includes(String(window.currentEmployeeRole||""))))throw new Error("Your role cannot record operating expenses.");
 const {data,error}=await db.rpc("record_financial_activity",{p_branch_id:branch,p_category:category,p_amount:Number(f.amount.value),p_description:f.description.value.trim(),p_receipt_number:f.receipt_number.value.trim()||null,p_customer_id:null,p_loan_application_id:f.loan_application_id?.value||null,p_event_date:f.event_date.value||null});
 if(error)throw error;const x=Array.isArray(data)?data[0]:data;if(feedback)feedback.textContent="Financial activity recorded: "+category.replaceAll("_"," ")+" · UGX "+Number(x.amount).toLocaleString()+". Reference "+(x.receipt_number||x.id)+".";
 const chosenBranch=branch;f.reset();window.toggleFinanceLoanReference();document.getElementById("performance-branch").value=chosenBranch;await window.loadBankPerformance();
 }catch(err){if(feedback)feedback.textContent="Entry not recorded: "+err.message;}finally{if(button)button.disabled=false;}
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

window.normalizeCustomerIdentity = function(value) {
  return String(value || "").normalize("NFKC").trim().toUpperCase().replace(/[\\s-]+/g, "");
};


window.previewLoanRepaymentSchedule = function(event) {
  event.preventDefault();
  const form=event.target, host=document.getElementById("loan-schedule-preview");
  if(!host)return;
  const fd=new FormData(form), principal=Number(fd.get("principal")), annualRate=Number(fd.get("annual_rate"))/100;
  const months=Number(fd.get("term_months")), grace=Number(fd.get("grace_days")||0), method=String(fd.get("method"));
  const firstDate=String(fd.get("first_due_date")||"");
  if(!(principal>0)||!(months>=1&&months<=360&&Number.isInteger(months))||annualRate<0||annualRate>1||!/^\d{4}-\d{2}-\d{2}$/.test(firstDate)||!(grace>=0&&grace<=365)){
    host.textContent="Check principal, rate, term, first due date and grace period.";return;
  }
  const monthly=annualRate/12;
  const money2=n=>Number(n).toLocaleString("en-UG",{minimumFractionDigits:2,maximumFractionDigits:2});
  const dueDate=(iso,offset)=>{
    const [y,m,d]=iso.split("-").map(Number), targetMonth=m-1+offset, targetYear=y+Math.floor(targetMonth/12), monthIndex=((targetMonth%12)+12)%12;
    const lastDay=new Date(targetYear,monthIndex+1,0).getDate();
    return new Date(targetYear,monthIndex,Math.min(d,lastDay));
  };
  let balance=principal,totalInterest=0,totalPrincipal=0,totalDue=0;
  const emi=monthly===0?principal/months:(principal*monthly)/(1-Math.pow(1+monthly,-months));
  const rows=[];
  for(let i=1;i<=months;i++){
    let interest,principalDue,payment;
    if(method==="flat"){
      interest=principal*monthly;
      principalDue=principal/months;
      payment=interest+principalDue;
    }else if(method==="reducing_equal_principal"){
      principalDue=i===months?balance:principal/months;
      interest=balance*monthly;
      payment=principalDue+interest;
    }else{
      interest=balance*monthly;
      payment=i===months?balance+interest:emi;
      principalDue=Math.min(balance,Math.max(0,payment-interest));
      if(i===months)payment=principalDue+interest;
    }
    principalDue=Math.min(balance,principalDue);
    if(i===months && method!=="flat" && method!=="reducing_equal_principal"){
      principalDue=balance;
      payment=principalDue+interest;
    }
    balance=Math.max(0,balance-principalDue);
    totalInterest+=interest;totalPrincipal+=principalDue;totalDue+=payment;
    const date=dueDate(firstDate,i-1);
    const graceEnd=new Date(date.getTime());graceEnd.setDate(graceEnd.getDate()+grace);
    rows.push({n:i,date:date.toISOString().slice(0,10),graceEnd:graceEnd.toISOString().slice(0,10),principal:principalDue,interest,payment,balance});
  }
  const methodName={flat:"Flat rate",reducing_emi:"Reducing balance — equal instalments",reducing_equal_principal:"Reducing balance — equal principal"}[method];
  host.innerHTML='<div class="grid-2"><div class="metric-card"><h3>Estimated instalment</h3><div class="metric-val">'+money2(rows[0]?.payment||0)+'</div><p class="muted">UGX-equivalent in selected loan currency; amount may vary in final period.</p></div><div class="metric-card"><h3>Total estimated interest</h3><div class="metric-val">'+money2(totalInterest)+'</div><p class="muted">Method: '+esc(methodName)+'</p></div><div class="metric-card"><h3>Total scheduled payments</h3><div class="metric-val">'+money2(totalDue)+'</div></div><div class="metric-card"><h3>Final due date</h3><div class="metric-val">'+esc(rows[rows.length-1]?.date||"—")+'</div></div></div><div class="table-responsive"><table class="data-table"><thead><tr><th>#</th><th>Due date</th><th>Grace period ends</th><th>Principal</th><th>Interest</th><th>Instalment</th><th>Balance after payment</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+r.n+'</td><td>'+esc(r.date)+'</td><td>'+esc(r.graceEnd)+'</td><td>'+money2(r.principal)+'</td><td>'+money2(r.interest)+'</td><td>'+money2(r.payment)+'</td><td>'+money2(r.balance)+'</td></tr>').join("")+'</tbody></table></div><p class="muted">PREVIEW ONLY — not a repayment demand or binding offer. Confirm rate basis, exact date rules, rounding, fees, holidays, grace treatment and approval before using with a borrower.</p>';
};

window.handleCustomerSubmit = async function(e) {
  e.preventDefault();
  const form = e.target;
  const feedback = document.getElementById("cust-feedback");
  if (!db) { if (feedback) feedback.textContent = "Database connection unavailable. No customer was registered."; return; }
  if (feedback) feedback.textContent = "Checking identity uniqueness before registration…";

  const formData = new FormData(form);
  const identity = window.normalizeCustomerIdentity(formData.get("nin_or_passport"));
  const fullName = String(formData.get("full_name") || "").trim().replace(/\\s+/g, " ");
  if (!identity || identity.length < 5) {
    if (feedback) feedback.textContent = "Enter a valid National ID (NIN) or passport number. The identifier is required.";
    return;
  }
  if (!fullName) { if (feedback) feedback.textContent = "Enter the customer's full legal name."; return; }

  // UX pre-check only. The database's normalized unique index is the authoritative
  // protection against duplicate identities and concurrent registration attempts.
  const { data: existing, error: lookupError } = await db.from("customers")
    .select("id,customer_number,full_name,nin_or_passport")
    .limit(10000);
  if (lookupError) {
    if (feedback) feedback.textContent = "Identity check failed. Registration was stopped; check database access and try again.";
    return;
  }
  const duplicate = (existing || []).find(row =>
    window.normalizeCustomerIdentity(row.nin_or_passport) === identity
  );
  if (duplicate) {
    if (feedback) feedback.textContent = "This National ID/passport is already registered to an existing customer. Do not create a second customer profile; verify the existing record and use it for eligible joint accounts.";
    return;
  }

  const payload = {
    customer_number: "CUST-" + Math.floor(100000 + Math.random() * 900000),
    full_name: fullName,
    nin_or_passport: identity,
    phone_number: String(formData.get("phone_number") || "").trim(),
    email: String(formData.get("email") || "").trim() || null,
    address: String(formData.get("address") || "").trim(),
    status: "active"
  };

  const { error } = await db.from("customers").insert([payload]);
  if (error) {
    const message = /unique|duplicate|customers_identity_normalized_uidx/i.test(error.message || "")
      ? "This National ID/passport is already registered. Search for the existing customer instead of creating another profile."
      : "Registration failed. Check the required fields, your permissions and the database connection.";
    if (feedback) feedback.textContent = message;
  } else {
    if (feedback) feedback.textContent = "Customer registered. This customer profile can be linked to one individual account and to joint accounts; a second individual account is not permitted.";
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
    const safeTerm=term.replace(/[\\%_]/g, "\\$&");
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

window.toggleJointHolderFields = function() {
  const select=document.getElementById("account-type-id");
  const fieldset=document.getElementById("joint-holder-fieldset");
  if(!select||!fieldset)return;
  const code=String(select.selectedOptions?.[0]?.dataset?.typeCode||"").toUpperCase();
  fieldset.hidden=code!=="JNT";
  if(code==="JNT"&&!document.querySelector("#joint-holder-fields .joint-holder-row"))window.addJointAccountHolderField();
  const feedback=document.getElementById("joint-holder-feedback");
  if(feedback)feedback.textContent=code==="JNT"?"Add at least one additional active customer. The account cannot be approved until two or more distinct holders are recorded.":"";
};

window.jointHolderFieldSequence=window.jointHolderFieldSequence||0;
window.addJointAccountHolderField = function() {
  const host=document.getElementById("joint-holder-fields");if(!host)return;
  const index=++window.jointHolderFieldSequence;
  const row=document.createElement("div");
  row.className="joint-holder-row";
  row.id="joint-holder-row-"+index;
  row.dataset.index=String(index);
  row.innerHTML='<label>Additional joint holder '+index+' *<input type="search" autocomplete="off" class="joint-holder-search" placeholder="Search active customer by name" oninput="window.searchJointAccountHolder(this)" required><input type="hidden" name="joint_holder_customer_id" required><div class="account-search-results joint-holder-results" role="listbox"></div><small class="joint-holder-selected muted">Choose a customer from the results.</small></label><button type="button" class="secondary joint-holder-remove" aria-label="Remove holder '+index+'">Remove</button>';
  row.querySelector(".joint-holder-remove").addEventListener("click",()=>{row.remove();});
  host.appendChild(row);
};

window.searchJointAccountHolder = async function(input) {
  const row=input?.closest(".joint-holder-row"),results=row?.querySelector(".joint-holder-results"),hidden=row?.querySelector('input[name="joint_holder_customer_id"]'),selected=row?.querySelector(".joint-holder-selected");
  if(!row||!results||!hidden)return;
  hidden.value="";
  if(selected)selected.textContent="Choose a customer from the results.";
  const term=String(input.value||"").trim();
  if(term.length<2){results.textContent=term?"Type at least 2 characters.":"";return;}
  if(!db){results.textContent="Database connection unavailable.";return;}
  results.textContent="Searching active customers…";
  try{
    const safe=term.replace(/[\\%_]/g,"\\$&");
    const [names,numbers]=await Promise.all([
      db.from("customers").select("id,full_name,customer_number,phone_number,status").eq("status","active").ilike("full_name","%"+safe+"%").limit(8),
      db.from("customers").select("id,full_name,customer_number,phone_number,status").eq("status","active").ilike("customer_number","%"+safe+"%").limit(8)
    ]);
    if(names.error||numbers.error){results.textContent="Customer search unavailable. Check staff access.";return;}
    const rows=[...(names.data||[]),...(numbers.data||[])].filter((item,index,all)=>all.findIndex(other=>other.id===item.id)===index).slice(0,10);
    if(!rows.length){results.textContent="No active customer found in records you can access.";return;}
    results.innerHTML=rows.map((item,i)=>'<button type="button" class="account-search-option" role="option" data-index="'+i+'"><strong>'+esc(item.full_name||"Customer")+'</strong><span>'+esc(item.customer_number||"No customer number")+'</span><small>'+esc(item.phone_number||"")+'</small></button>').join("");
    results.querySelectorAll(".account-search-option").forEach((button,i)=>button.addEventListener("click",()=>{
      const item=rows[i];hidden.value=item.id;input.value=item.full_name||item.customer_number||"";
      results.innerHTML="";
      if(selected)selected.textContent="Selected "+(item.full_name||"customer")+" · "+(item.customer_number||"customer number");
    }));
  }catch(_){results.textContent="Customer search failed. Check the connection and try again.";}
};

window.handleAccountSubmit = async function(e) {
  e.preventDefault();
  const form=e.target,feedback=document.getElementById("acc-feedback");
  if(!db){if(feedback)feedback.textContent="Database connection unavailable. No account request was submitted.";return;}
  const formData=new FormData(form);
  const customerId=String(formData.get("customer_id")||"").trim();
  const branchId=String(formData.get("branch_id")||"").trim();
  const accountTypeId=String(formData.get("account_type_id")||"").trim();
  const typeCode=String(document.getElementById("account-type-id")?.selectedOptions?.[0]?.dataset?.typeCode||"").toUpperCase();
  const jointHolderIds=formData.getAll("joint_holder_customer_id").map(value=>String(value||"").trim()).filter(Boolean);
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customerId)){
    if(feedback)feedback.textContent="Select the primary customer from the search results.";return;
  }
  if(!branchId||!accountTypeId){if(feedback)feedback.textContent="Choose a branch and account ownership type.";return;}
  if(form.dataset.createdAccountId && (customerId!==form.dataset.createdPrimaryCustomerId || branchId!==form.dataset.createdBranchId || accountTypeId!==form.dataset.createdAccountTypeId || typeCode!==form.dataset.createdTypeCode)){
    if(feedback)feedback.textContent="A previous account request is awaiting joint-holder completion. Restore its original primary customer, branch and ownership type before retrying; do not create another request.";return;
  }
  if(typeCode==="JNT"){
    if(!jointHolderIds.length){if(feedback)feedback.textContent="A joint account needs at least one additional holder.";return;}
    const all=[customerId,...jointHolderIds];
    if(all.some(id=>!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))||new Set(all).size!==all.length){
      if(feedback)feedback.textContent="Choose at least two different customers. The same customer cannot be added twice.";return;
    }
  }
  if(typeCode==="IND"&&jointHolderIds.length){
    if(feedback)feedback.textContent="Additional holders are only allowed for joint accounts. Select the joint ownership type or remove the extra holders.";return;
  }
  const button=form.querySelector('button[type="submit"]');
  if(button)button.disabled=true;
  let result=null;
  try{
    const existingAccountId=String(form.dataset.createdAccountId||"");
    if(existingAccountId){
      result={account_id:existingAccountId,account_number:String(form.dataset.createdAccountNumber||""),account_status:"pending_approval"};
      if(feedback)feedback.textContent="Finishing the existing pending account request and retrying holder registration…";
    }else{
      if(feedback)feedback.textContent="Submitting account request and recording the opening package…";
      const {data,error}=await db.rpc("create_bank_account_request_with_opening_package",{
        p_customer_id:customerId,p_branch_id:branchId,p_account_type_id:accountTypeId,
        p_product_type:formData.get("product_type")||"savings",
        p_currency_code:formData.get("currency_code")||"UGX"
      });
      if(error)throw error;
      result=Array.isArray(data)?data[0]:data;
      if(!result?.account_id)throw new Error("The server did not return the account request ID.");
      form.dataset.createdAccountId=String(result.account_id);
      form.dataset.createdAccountNumber=String(result.account_number||"");
      form.dataset.createdPrimaryCustomerId=customerId;
      form.dataset.createdBranchId=branchId;
      form.dataset.createdAccountTypeId=accountTypeId;
      form.dataset.createdTypeCode=typeCode;
      window.lastAccountOpeningReceipt={
        receipt_number:String(result.receipt_number||""),
        account_number:String(result.account_number||""),
        date:new Date().toLocaleString("en-UG"),
        amount:Number(result.amount||0),
        share_amount:Number(result.share_amount||0),
        shares_issued:Number(result.shares_issued||0),
        security_reserve:Number(result.security_reserve||0),
        bundled_opening_costs:Number(result.bundled_opening_costs||0),
        collection_status:String(result.collection_status||"")
      };
    }
    if(typeCode==="JNT"){
      const holderFeedback=document.getElementById("joint-holder-feedback");
      if(holderFeedback)holderFeedback.textContent="Recording joint holders securely…";
      for(const holderId of jointHolderIds){
        const {error}=await db.rpc("add_joint_account_holder_to_pending_request",{
          p_account_id:String(result.account_id),p_customer_id:holderId,p_holder_role:"joint_owner"
        });
        if(error)throw new Error("Account request "+String(result.account_number||result.account_id)+" exists but holder registration is incomplete. It must remain pending. "+error.message+" Correct the holder selections and submit again to retry this same request.");
      }
      if(holderFeedback)holderFeedback.textContent="All selected holders were accepted by the database. Approval still requires at least two distinct holders.";
    }
    const files=Array.from(form.querySelector('input[name="account_documents"]')?.files||[]);
    let documentStatus="";
    if(files.length){
      const uploaded=await window.uploadApplicationDocuments("account-opening",customerId,files,String(formData.get("account_document_category")||"other"));
      documentStatus=uploaded.ok?" · Documents uploaded: "+uploaded.count:" · WARNING: account request submitted, but document upload failed: "+uploaded.error;
    }
    const receipt=window.lastAccountOpeningReceipt;
    const hasReceipt=receipt&&receipt.receipt_number&&Number.isFinite(receipt.amount)&&receipt.amount>0&&receipt.collection_status==="received";
    const holderSummary=typeCode==="JNT"?" · Joint holders recorded: "+(new Set([customerId,...jointHolderIds]).size):"";
    if(feedback)feedback.textContent="Account request submitted. Reference: "+String(result.account_number||"created")+" · Status: "+String(result.account_status||"pending_approval")+holderSummary+documentStatus+(hasReceipt?" · Opening package collection confirmed by the server.":" · No paid receipt was returned by the server; do not print a payment receipt.");
    if(hasReceipt)feedback.insertAdjacentHTML("beforeend",' <button type="button" class="secondary" onclick="printAccountOpeningReceipt()">Print receipt '+esc(receipt.receipt_number)+'</button>');
    delete form.dataset.createdAccountId;delete form.dataset.createdAccountNumber;delete form.dataset.createdPrimaryCustomerId;delete form.dataset.createdBranchId;delete form.dataset.createdAccountTypeId;delete form.dataset.createdTypeCode;
    form.reset();
    const holderHost=document.getElementById("joint-holder-fields");if(holderHost)holderHost.innerHTML="";
    window.toggleJointHolderFields();
    setTimeout(()=>window.switchPage("Accounts"),1200);
  }catch(err){
    if(feedback)feedback.textContent="Account request could not be fully completed: "+(err?.message||"Unexpected error");
  }finally{if(button)button.disabled=false;}
};

window.uploadApplicationDocuments = async function(kind,recordId,files,category) {
  if(!db)return {ok:false,error:"Database connection unavailable."};
  if(!["loans","loan-applications","account-opening"].includes(kind))return {ok:false,error:"Unsupported document destination."};
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

window.loadLoanApplicationFormOptions = async function() {
  if(!db)return;
  const branchSelect=document.getElementById("loan-branch-select"),currencySelect=document.getElementById("loan-currency-select"),typeSelect=document.getElementById("loan-type-select");
  try{
    const [branches,currencies,rates]=await Promise.all([
      db.from("branches").select("id,branch_name").eq("is_active",true).order("branch_name"),
      db.from("currencies").select("code").eq("is_active",true).order("code"),
      db.rpc("list_loan_product_rates")
    ]);
    if(branchSelect)branchSelect.innerHTML=branches.error?'<option value="">Branches unavailable</option>':'<option value="">Choose branch</option>'+(branches.data||[]).map(b=>'<option value="'+esc(b.id)+'">'+esc(b.branch_name)+'</option>').join("");
    if(currencySelect)currencySelect.innerHTML=currencies.error?'<option value="">Currencies unavailable</option>':'<option value="">Choose currency</option>'+(currencies.data||[]).map(x=>'<option value="'+esc(x.code)+'">'+esc(x.code)+'</option>').join("");
    if(rates.error){if(typeSelect)typeSelect.innerHTML='<option value="">Loan products unavailable</option>';const n=document.getElementById("loan-rate-notice");if(n)n.textContent="Loan product rates could not be loaded. Contact the General Manager.";}
    else{
      window.loanProductRateCache=rates.data||[];
      if(typeSelect)typeSelect.innerHTML='<option value="">Choose loan product</option>'+window.loanProductRateCache.map(x=>'<option value="'+esc(x.product_code)+'">'+esc(x.product_name)+'</option>').join("");
      window.updateSelectedLoanRate();await window.loadLoanProductRateSettings();
    }
  }catch(e){if(branchSelect)branchSelect.innerHTML='<option value="">Unable to load branches</option>';if(currencySelect)currencySelect.innerHTML='<option value="">Unable to load currencies</option>';const n=document.getElementById("loan-rate-notice");if(n)n.textContent="Unable to load loan products. Check the connection.";}
};
window.updateSelectedLoanRate=function(){
 const select=document.getElementById("loan-type-select"),notice=document.getElementById("loan-rate-notice");if(!select||!notice)return;
 const p=(window.loanProductRateCache||[]).find(x=>x.product_code===select.value);
 if(!p){notice.textContent="The approved product rate will be applied automatically.";return;}
 if(p.product_code==="overdraft"){notice.textContent="Fixed overdraft rate: 5% per month. This rate cannot be changed.";return;}
 notice.textContent=p.rate_percent==null?"Interest rate not yet configured. The General Manager must set it before applications can be submitted.":("Current approved rate: "+p.rate_percent+"% "+(p.rate_period==="monthly"?"per month":"per year")+". Applied automatically.");
};
window.loadLoanProductRateSettings=async function(){
 const host=document.getElementById("loan-product-rate-settings");if(!host||!db)return;
 if(window.currentEmployeeRole!=="general_manager"){host.innerHTML="";return;}
 const {data,error}=await db.rpc("list_loan_product_rates");
 if(error){host.textContent="Unable to load product rates: "+error.message;return;}
 host.innerHTML='<div class="loan-rate-settings-list">'+(data||[]).map(p=>'<article class="loan-rate-setting"><div><strong>'+esc(p.product_name)+'</strong><p class="muted">'+esc(p.description)+'</p></div>'+(p.product_code==="overdraft"?'<div class="fixed-rate-label">5% per month · permanently locked</div>':'<form class="loan-rate-edit-form" onsubmit="saveLoanProductRate(event)" data-product-code="'+esc(p.product_code)+'"><label>Interest rate (%)<input type="number" name="rate_percent" min="0" max="100" step="0.01" value="'+(p.rate_percent==null?"":esc(p.rate_percent))+'" required></label><label>Rate period<select name="rate_period"><option value="annual" '+(p.rate_period==="annual"?"selected":"")+'>Per year</option><option value="monthly" '+(p.rate_period==="monthly"?"selected":"")+'>Per month</option></select></label><label>Reason for change<input name="reason" minlength="8" maxlength="500" required placeholder="Reason for changing policy"></label><button type="submit" class="secondary">Save rate</button><small class="rate-save-status muted" aria-live="polite"></small></form>')+'<small class="muted">'+(p.rate_percent==null?"Not configured":"Current rate: "+p.rate_percent+"% "+(p.rate_period==="monthly"?"monthly":"annual"))+'</small></article>').join("")+'</div>';
};
window.saveLoanProductRate=async function(event){
 event.preventDefault();const form=event.target,button=form.querySelector('button[type="submit"]'),status=form.querySelector(".rate-save-status"),fd=new FormData(form),code=form.dataset.productCode,value=Number(fd.get("rate_percent")),period=String(fd.get("rate_period")||"annual"),reason=String(fd.get("reason")||"");
 if(window.currentEmployeeRole!=="general_manager"){if(status)status.textContent="Only the General Manager may change rates.";return;}
 if(code==="overdraft"){if(status)status.textContent="Overdraft is permanently fixed at 5% per month.";return;}
 if(!Number.isFinite(value)||value<0||value>100){if(status)status.textContent="Enter a rate between 0 and 100.";return;}
 if(reason.trim().length<8){if(status)status.textContent="Give a reason of at least 8 characters.";return;}
 if(button)button.disabled=true;if(status)status.textContent="Saving rate and audit record…";
 try{
  const {error}=await db.rpc("update_loan_product_rate",{p_product_code:code,p_interest_rate:value,p_rate_period:period,p_reason:reason.trim()});
  if(error)throw error;
  if(status)status.textContent="Rate saved. New applications use the new rate; existing applications retain their recorded terms.";
  await window.loadLoanApplicationFormOptions();
 }catch(e){if(status)status.textContent="Rate not changed: "+(e?.message||"Check General Manager access.");}
 finally{if(button)button.disabled=false;}
};

window.loadSharesAndCharges = async function(){
 if(!db)return;
 const setOptions=(el,rows,label)=>{if(el)el.innerHTML='<option value="">Choose…</option>'+rows.map(x=>'<option value="'+esc(x.id)+'">'+esc(label(x))+'</option>').join("");};
 try{
 const [cust,branches,accounts,loanApps,shares,security,opening,loanFees,stationery]=await Promise.all([
 db.from("customers").select("id,full_name,customer_number,status").in("status",["active","approved"]).order("full_name").limit(1000),
 db.from("branches").select("id,branch_name,branch_code").eq("is_active",true).order("branch_name"),
 db.from("bank_accounts").select("id,account_number,branch_id,status,product_type").in("status",["pending_approval","active"]).order("account_number").limit(1000),
 db.rpc("list_loan_applications",{p_branch_id:null}),
 db.from("customer_share_transactions").select("id,customer_id,share_count,total_amount,source,receipt_number,created_at,customers(full_name,customer_number)").order("created_at",{ascending:false}).limit(500),
 db.from("account_security_ledger").select("id,customer_id,account_id,entry_type,amount,fee_due,shortfall,period_month,created_at,customers(full_name),bank_accounts(account_number)").order("created_at",{ascending:false}).limit(1000),
 db.from("account_opening_collections").select("id,customer_id,receipt_number,amount,created_at,customers(full_name)").eq("collection_status","received").order("created_at",{ascending:false}).limit(300),
 db.from("loan_processing_fee_collections").select("id,loan_application_id,customer_id,receipt_number,amount,created_at,customers(full_name)").eq("collection_status","received").order("created_at",{ascending:false}).limit(300),
 db.from("stationery_collections").select("id,customer_id,item_type,receipt_number,amount,created_at,customers(full_name)").eq("collection_status","received").order("created_at",{ascending:false}).limit(300)
 ]);
 const bad=[cust,branches,accounts,shares,security,opening,loanFees,stationery].find(x=>x.error);if(bad)throw bad.error;
 const customers=cust.data||[],br=branches.data||[],acc=accounts.data||[],apps=loanApps?.data||[];
 setOptions(document.getElementById("share-customer"),customers,x=>(x.full_name||"Customer")+" · "+(x.customer_number||""));setOptions(document.getElementById("share-branch"),br,x=>x.branch_name+" ("+x.branch_code+")");setOptions(document.getElementById("stationery-customer"),customers,x=>(x.full_name||"Customer")+" · "+(x.customer_number||""));setOptions(document.getElementById("stationery-branch"),br,x=>x.branch_name+" ("+x.branch_code+")");
 const accountOptions=acc.map(x=>({...x,display:x.account_number+" · "+x.product_type+" · "+x.status}));setOptions(document.getElementById("security-fee-account"),accountOptions,x=>x.display);setOptions(document.getElementById("security-topup-account"),accountOptions,x=>x.display);
 const feeIds=new Set((loanFees.data||[]).map(x=>x.loan_application_id));setOptions(document.getElementById("loan-fee-application"),apps.filter(x=>!feeIds.has(x.id)&&!["rejected","cancelled"].includes(x.status)),x=>x.application_number+" · "+x.customer_name+" · UGX "+Number(x.requested_amount).toLocaleString());
 const totals={};for(const x of shares.data||[]){if(!totals[x.customer_id])totals[x.customer_id]={name:x.customers?.full_name||"Customer",number:x.customers?.customer_number||"",shares:0,value:0};totals[x.customer_id].shares+=Number(x.share_count||0);totals[x.customer_id].value+=Number(x.total_amount||0);}
 const sh=document.getElementById("share-register");if(sh){const rows=Object.values(totals).sort((a,b)=>b.shares-a.shares);sh.innerHTML=rows.length?'<div class="table-scroll"><table class="data-table"><thead><tr><th>Customer</th><th>Shares</th><th>Share value</th></tr></thead><tbody>'+rows.map(x=>'<tr><td>'+esc(x.name)+'<small>'+esc(x.number)+'</small></td><td>'+x.shares.toLocaleString()+'</td><td>UGX '+x.value.toLocaleString()+'</td></tr>').join("")+'</tbody></table></div>'+(shares.data||[]).slice(0,10).map(x=>'<div class="list-item"><div><strong>'+esc(x.customers?.full_name||"Customer")+'</strong><br><span class="muted">'+esc(x.receipt_number)+' · '+esc(x.source.replaceAll("_"," "))+'</span></div><span class="badge-role">+'+x.share_count+' share(s) · UGX '+Number(x.total_amount).toLocaleString()+'</span></div>').join(""):'<p class="muted">No shares recorded yet.</p>';}
 const sr=document.getElementById("security-register"),secRows=security.data||[],balances={};for(const x of secRows){if(!balances[x.account_id])balances[x.account_id]={account:x.bank_accounts?.account_number||x.account_id,customer:x.customers?.full_name||"Customer",balance:0};balances[x.account_id].balance+=x.entry_type==="monthly_deduction"?-Number(x.amount):Number(x.amount);}
 if(sr){const rows=Object.values(balances);sr.innerHTML=rows.length?'<div class="table-scroll"><table class="data-table"><thead><tr><th>Customer / account</th><th>Reserve balance</th></tr></thead><tbody>'+rows.map(x=>'<tr><td>'+esc(x.customer)+'<small>'+esc(x.account)+'</small></td><td>UGX '+Math.max(0,x.balance).toLocaleString()+'</td></tr>').join("")+'</tbody></table></div>'+secRows.slice(0,10).map(x=>'<div class="list-item"><div><strong>'+esc(x.customers?.full_name||"Customer")+' · '+esc(x.bank_accounts?.account_number||"")+'</strong><br><span class="muted">'+esc(x.entry_type.replaceAll("_"," "))+" · "+esc(x.period_month||x.created_at?.slice(0,10)||"")+"</span></div><span class=\"badge-role\">"+(x.entry_type==="monthly_deduction"?"−":"+")+"UGX "+Number(x.amount).toLocaleString()+(Number(x.shortfall||0)>0?" · shortfall "+Number(x.shortfall).toLocaleString():"")+"</span></div>").join(""):'<p class="muted">No security reserve entries yet.</p>';}
 const ch=document.getElementById("collection-register");if(ch){const rows=[...(opening.data||[]).map(x=>({...x,kind:"Account opening package"})),...(loanFees.data||[]).map(x=>({...x,kind:"Loan-processing form"})),...(stationery.data||[]).map(x=>({...x,kind:x.item_type==="replacement_cheque_book"?"Replacement cheque book":"Replacement transaction log book"}))].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));ch.innerHTML=rows.length?rows.slice(0,25).map(x=>'<div class="list-item"><div><strong>'+esc(x.kind)+" · "+esc(x.customers?.full_name||"Customer")+'</strong><br><span class="muted">'+esc(x.receipt_number)+" · "+esc(x.created_at?.slice(0,10)||"")+"</span></div><span class=\"badge-role\">UGX "+Number(x.amount).toLocaleString()+"</span></div>").join(""):'<p class="muted">No teller collection receipts recorded yet.</p>';}
 }catch(e){["share-register","security-register","collection-register"].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent="Could not load records: "+(e.message||"database error");});}
};
window.updateSharePurchaseTotal=function(){const n=Number(document.querySelector('#share-purchase-form input[name="share_count"]')?.value||0),el=document.getElementById("share-total-preview");if(el)el.textContent="Total payable to teller: UGX "+Math.max(0,n*10000).toLocaleString();};
window.handleSharePurchase=async function(e){e.preventDefault();const f=e.target,feedback=document.getElementById("share-purchase-feedback"),button=f.querySelector('button[type="submit"]');if(button)button.disabled=true;try{const {data,error}=await db.rpc("record_additional_share_purchase",{p_customer_id:f.customer_id.value,p_branch_id:f.branch_id.value,p_share_count:Number(f.share_count.value)});if(error)throw error;const x=Array.isArray(data)?data[0]:data;if(feedback)feedback.textContent="Share purchase recorded. Receipt "+x.receipt_number+" · "+x.share_count+" share(s) · UGX "+Number(x.total_amount).toLocaleString()+". Reconcile during teller cash-up.";f.reset();window.updateSharePurchaseTotal();await window.loadSharesAndCharges();}catch(err){if(feedback)feedback.textContent="Share purchase not recorded: "+err.message;}finally{if(button)button.disabled=false;}};
window.handleSecurityMonthlyFee=async function(e){e.preventDefault();const f=e.target,feedback=document.getElementById("security-fee-feedback"),button=f.querySelector('button[type="submit"]');if(button)button.disabled=true;try{const [y,m]=f.period_month.value.split("-").map(Number);const {data,error}=await db.rpc("apply_monthly_account_security_fee",{p_account_id:f.account_id.value,p_period_month:y+"-"+String(m).padStart(2,"0")+"-01"});if(error)throw error;const x=Array.isArray(data)?data[0]:data;if(feedback)feedback.textContent="Monthly charge applied: UGX "+Number(x.deducted).toLocaleString()+". Shortfall: UGX "+Number(x.shortfall).toLocaleString()+(x.top_up_required?". Security top-up required.":".");await window.loadSharesAndCharges();}catch(err){if(feedback)feedback.textContent="Charge not applied: "+err.message;}finally{if(button)button.disabled=false;}};
window.handleSecurityTopUp=async function(e){e.preventDefault();const f=e.target,feedback=document.getElementById("security-topup-feedback"),button=f.querySelector('button[type="submit"]');if(button)button.disabled=true;try{const {data,error}=await db.rpc("record_account_security_top_up",{p_account_id:f.account_id.value,p_amount:Number(f.amount.value),p_receipt_number:f.receipt_number.value||null});if(error)throw error;const x=Array.isArray(data)?data[0]:data;if(feedback)feedback.textContent="Top-up recorded. Receipt "+x.receipt_number+" · UGX "+Number(x.amount).toLocaleString()+". Reconcile during teller cash-up.";f.reset();await window.loadSharesAndCharges();}catch(err){if(feedback)feedback.textContent="Top-up not recorded: "+err.message;}finally{if(button)button.disabled=false;}};
window.handleStationeryCollection=async function(e){e.preventDefault();const f=e.target,feedback=document.getElementById("stationery-feedback"),button=f.querySelector('button[type="submit"]');if(button)button.disabled=true;try{const {data,error}=await db.rpc("record_stationery_collection",{p_customer_id:f.customer_id.value,p_branch_id:f.branch_id.value,p_item_type:f.item_type.value});if(error)throw error;const x=Array.isArray(data)?data[0]:data;if(feedback)feedback.textContent="Collection recorded: UGX "+Number(x.amount).toLocaleString()+" · receipt "+x.receipt_number+". Reconcile during teller cash-up.";await window.loadSharesAndCharges();}catch(err){if(feedback)feedback.textContent="Collection not recorded: "+err.message;}finally{if(button)button.disabled=false;}};
window.handleLoanFeeCollection=async function(e){e.preventDefault();const f=e.target,feedback=document.getElementById("loan-fee-feedback"),button=f.querySelector('button[type="submit"]');if(button)button.disabled=true;try{const {data,error}=await db.rpc("record_loan_processing_fee_collection",{p_loan_application_id:f.application_id.value});if(error)throw error;const x=Array.isArray(data)?data[0]:data;if(feedback)feedback.textContent="Loan-processing fee recorded: UGX "+Number(x.amount).toLocaleString()+" · receipt "+x.receipt_number+". Reconcile during teller cash-up.";await window.loadSharesAndCharges();}catch(err){if(feedback)feedback.textContent="Fee not recorded: "+err.message;}finally{if(button)button.disabled=false;}};
window.refreshLoanShareRequirement=async function(){const customerId=document.querySelector('#loan-application-form input[name="customer_id"]')?.value,amount=Number(document.querySelector('#loan-application-form input[name="requested_amount"]')?.value||0),host=document.getElementById("loan-share-guidance");if(!host)return;if(!customerId){host.textContent="Select a customer to check recorded shares. UGX 100,000 requested loan corresponds to 1 share as a guideline.";return;}try{const {data,error}=await db.rpc("get_customer_share_eligibility",{p_customer_id:customerId,p_requested_amount:amount});if(error)throw error;const x=Array.isArray(data)?data[0]:data;host.textContent="Recorded shares: "+x.shares_owned+". Guideline for this amount: "+x.shares_suggested_for_amount+" share(s); additional shares suggested: "+x.additional_shares_suggested+". Shareholding improves consideration but does not guarantee approval.";}catch(e){host.textContent="Share guidance unavailable: "+e.message;}};
window.searchLoanCustomers = async function(input) {
  const results=document.getElementById("loan-customer-results"),hidden=document.querySelector('#loan-application-form input[name="customer_id"]'),summary=document.getElementById("loan-customer-selected");
  if(!results||!hidden)return;
  hidden.value="";
  if(summary)summary.textContent="Choose a customer from the results.";
  const term=String(input.value||"").trim();
  if(term.length<2){results.textContent=term?"Type at least 2 characters.":"";return;}
  if(!db){results.textContent="Database connection unavailable.";return;}
  results.textContent="Searching customers available to your staff account…";
  try{
    const safe=term.replace(/[,%_]/g," ");
    const {data,error}=await db.from("customers").select("id,customer_number,full_name,phone_number,status").or("full_name.ilike.%"+safeTerm+"%,customer_number.ilike.%"+safeTerm+"%").limit(10);
    if(error){results.textContent="Customer search unavailable: "+error.message;return;}
    if(!data?.length){results.textContent="No active or approved matching customers found.";return;}
    results.innerHTML=data.map((x,i)=>'<button type="button" class="account-search-option" role="option" data-index="'+i+'"><strong>'+esc(x.full_name||"Customer")+'</strong><span>'+esc(x.customer_number||"No customer number")+'</span><small>'+esc(x.phone_number||"")+'</small></button>').join("");
    results.querySelectorAll(".account-search-option").forEach((btn,i)=>btn.addEventListener("click",()=>{
      const x=data[i];hidden.value=x.id;input.value=(x.full_name||"Customer")+" · "+(x.customer_number||"");
      results.innerHTML="";if(summary)summary.textContent="Selected "+(x.full_name||"customer")+". The server rechecks eligibility.";window.refreshLoanShareRequirement();
    }));
  }catch(e){results.textContent="Customer search failed. Check your connection.";}
};

window.handleLoanApplicationSubmit = async function(e) {
  e.preventDefault();
  const form=e.target,feedback=document.getElementById("loan-application-feedback"),button=form.querySelector('button[type="submit"]');
  const fd=new FormData(form),files=Array.from(form.querySelector('input[name="loan_documents"]')?.files||[]);
  const customerId=String(fd.get("customer_id")||"");
  if(!customerId){if(feedback)feedback.textContent="Select a customer from the search results.";return;}
  if(!db){if(feedback)feedback.textContent="Database connection unavailable.";return;}
  if(button)button.disabled=true;if(feedback)feedback.textContent="Submitting application…";
  try{
    const {data,error}=await db.rpc("create_loan_application",{
      p_customer_id:customerId,p_branch_id:String(fd.get("branch_id")||""),p_loan_type:String(fd.get("loan_type")||""),p_requested_amount:Number(fd.get("requested_amount")),
      p_currency_code:String(fd.get("currency_code")||""),p_tenure_months:Number(fd.get("tenure_months")),p_loan_purpose:String(fd.get("loan_purpose")||""),
      p_collateral_description:String(fd.get("collateral_description")||""),p_guarantor_name:String(fd.get("guarantor_name")||""),p_guarantor_phone:String(fd.get("guarantor_phone")||"")
    });
    if(error)throw error;
    const result=Array.isArray(data)?data[0]:data;
    let docsText="";
    if(files.length){
      const uploaded=await window.uploadApplicationDocuments("loan-applications",result.id,files,String(fd.get("document_category")||"supporting"));
      docsText=uploaded.ok?" "+uploaded.count+" document(s) uploaded.":" WARNING: application created but document upload failed: "+uploaded.error;
    }
    if(feedback)feedback.textContent="Application "+result.application_number+" submitted with status "+result.status+"."+docsText;
    form.reset();
    const hidden=form.querySelector('input[name="customer_id"]');if(hidden)hidden.value="";
    await window.loadLoanApplications();
  }catch(err){if(feedback)feedback.textContent="Loan application failed: "+(err?.message||"Unexpected error");}
  finally{if(button)button.disabled=false;}
};

window.loadLoanDueDashboard = async function(){
  const feedback=document.getElementById("loan-due-feedback"),host=document.getElementById("loan-due-list"),summary=document.getElementById("loan-due-summary"),branchSelect=document.getElementById("loan-due-branch");
  if(!feedback||!host)return;
  if(!db){feedback.textContent="Database connection unavailable. No due-date figures are being shown.";return;}
  feedback.textContent="Loading approved schedules and posted repayment allocations…";
  try{
    if(branchSelect&&branchSelect.options.length<=1){
      const branches=await db.from("branches").select("id,branch_name,branch_code").eq("is_active",true).order("branch_name");
      if(!branches.error)branchSelect.innerHTML='<option value="">All authorized branches</option>'+(branches.data||[]).map(b=>'<option value="'+esc(b.id)+'">'+esc(b.branch_name)+' ('+esc(b.branch_code)+')</option>').join("");
    }
    const branchId=branchSelect?.value||null;
    const {data,error}=await db.rpc("list_loan_due_alert_dashboard",{p_branch_id:branchId,p_limit:250});
    if(error){
      feedback.textContent="Live loan servicing is not yet available: "+error.message+". Review and apply the loan servicing schema and dashboard RPC in a non-production database before enabling this feature.";
      host.innerHTML="";if(summary)summary.innerHTML="";return;
    }
    const rows=data||[];
    const fmt=(value,currency="UGX")=>currency+" "+Number(value||0).toLocaleString("en-UG",{minimumFractionDigits:2,maximumFractionDigits:2});
    const meta={
      upcoming:{label:"🟢 Upcoming",className:"loan-due-upcoming"},
      due_today:{label:"🔵 Due today",className:"loan-due-today"},
      grace_period:{label:"🟠 Grace period",className:"loan-due-grace"},
      overdue:{label:"🔴 Overdue",className:"loan-due-overdue"},
      settled:{label:"⚫ Settled",className:"loan-due-settled"}
    };
    const counts={upcoming:0,due_today:0,grace_period:0,overdue:0,settled:0};
    rows.forEach(row=>{if(Object.hasOwn(counts,row.servicing_status))counts[row.servicing_status]++;});
    if(summary)summary.innerHTML=[
      ["Overdue instalments",counts.overdue,"loan-due-overdue"],
      ["Due today",counts.due_today,"loan-due-today"],
      ["Within grace period",counts.grace_period,"loan-due-grace"],
      ["Upcoming instalments",counts.upcoming,"loan-due-upcoming"]
    ].map(([label,count,cls])=>'<div class="metric-card '+cls+'"><div class="metric-sub">'+label+'</div><div class="metric-val">'+count+'</div></div>').join("");
    if(!rows.length){host.innerHTML='<p class="muted">No unpaid instalments were returned for your authorized scope. This is not proof that loan servicing is configured unless the RPC succeeded.</p>';feedback.textContent="Servicing query completed successfully. No unpaid instalments returned.";return;}
    host.innerHTML='<table class="data-table"><thead><tr><th>Loan / customer</th><th>Instalment</th><th>Due / grace end</th><th>Outstanding</th><th>DPD</th><th>Status</th><th>Branch</th></tr></thead><tbody>'+rows.map(row=>{
      const state=meta[row.servicing_status]||{label:esc(row.servicing_status||"Unknown"),className:""};
      const currency="UGX";
      return '<tr><td><strong>'+esc(row.loan_account_number||"Loan")+'</strong><br><span class="muted">'+esc(row.customer_name||"Customer")+'</span></td><td>#'+esc(row.installment_no)+'<br><span class="muted">Due '+fmt(row.total_due,currency)+' · Paid '+fmt(row.total_paid,currency)+'</span></td><td>'+esc(row.due_date||"—")+'<br><span class="muted">Grace ends '+esc(row.grace_end_date||"—")+'</span></td><td><strong>'+fmt(row.outstanding_amount,currency)+'</strong></td><td>'+Number(row.days_past_due||0)+'</td><td><span class="loan-servicing-status '+state.className+'">'+state.label+'</span></td><td>'+esc(row.branch_name||"Unassigned")+'</td></tr>';
    }).join("")+'</tbody></table>';
    feedback.textContent=rows.length+" unpaid instalment(s) loaded from approved schedules and posted allocations. Figures are database-derived.";
  }catch(_){feedback.textContent="A connection error prevented the loan servicing dashboard from loading.";}
};

window.loadLoanApplications = async function() {
  const host=document.getElementById("loan-application-list");if(!host||!db)return;
  host.textContent="Loading authorized loan applications…";
  try{
    const {data,error}=await db.rpc("list_loan_applications",{p_branch_id:null});
    if(error)throw error;
    if(!data?.length){host.innerHTML='<p class="muted">No loan applications are available to your account yet.</p>';return;}
    host.innerHTML=data.map((x,i)=>{
      const final=["approved","rejected","cancelled"].includes(x.status);
      return '<article class="loan-application-card"><div class="loan-card-top"><div><strong>'+esc(x.application_number)+'</strong><p>'+esc(x.customer_name||"Customer")+' · '+esc(x.branch_name||"Branch")+'</p></div><span class="loan-status status-'+esc(x.status)+'">'+esc(String(x.status).replaceAll("_"," "))+'</span></div><div class="loan-card-amount">'+esc(x.currency_code)+' '+Number(x.requested_amount).toLocaleString(undefined,{maximumFractionDigits:2})+'</div><p>'+esc(x.tenure_months)+' months · '+esc(x.interest_rate_period==="monthly"?x.interest_rate_monthly+"% monthly":x.interest_rate_annual+"% annual")+"</p><p>"+esc(x.loan_purpose||"")+'</p>'+(x.collateral_description?'<p><strong>Collateral:</strong> '+esc(x.collateral_description)+'</p>':"")+(x.review_note?'<p><strong>Review note:</strong> '+esc(x.review_note)+'</p>':"")+
      '<div class="loan-documents-actions"><button type="button" class="secondary" data-application-id="'+esc(x.id)+'" onclick="loadLoanApplicationDocuments(this)">View attached documents</button><div class="loan-documents-list" data-documents-for="'+esc(x.id)+'"></div></div><form class="loan-document-inline" onsubmit="handleLoanApplicationDocumentUpload(event)" data-application-id="'+esc(x.id)+'"><label>Attach ID, land title, chairperson letter or other evidence<select name="document_category"><option value="national-id">National ID</option><option value="passport">Passport</option><option value="land-title">Land title</option><option value="chairperson-letter">Chairperson letter</option><option value="guarantor-id">Guarantor ID</option><option value="income-proof">Income proof</option><option value="valuation-report">Valuation report</option><option value="other">Other</option></select></label><input type="file" name="loan_documents" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" multiple required><button type="submit" class="secondary">Upload documents</button><p class="muted" aria-live="polite"></p></form>'+
      (final?"":'<form class="loan-review-form" onsubmit="handleLoanApplicationReview(event)" data-application-id="'+esc(x.id)+'"><label>Review decision<select name="decision"><option value="under_review">Move to review</option><option value="more_information_required">Request more information</option><option value="approved">Approve application</option><option value="rejected">Reject application</option></select></label><label>Review note<textarea name="review_note" rows="2" maxlength="2000" placeholder="Reason, conditions or missing documents"></textarea></label><button type="submit" class="primary">Save review decision</button><p class="muted" aria-live="polite"></p></form>')+
      '</article>';
    }).join("");
  }catch(err){host.textContent="Unable to load loan applications: "+(err?.message||"Check role and branch access.");}
};

window.loadLoanApplicationDocuments = async function(button) {
  const id=String(button?.dataset?.applicationId||"");
  const host=document.querySelector('.loan-documents-list[data-documents-for="'+id+'"]');
  if(!host||!db)return;
  button.disabled=true;host.textContent="Loading private documents…";
  try{
    const folder="loan-applications/"+id;
    const {data,error}=await db.storage.from("bank-application-documents").list(folder,{limit:100,sortBy:{column:"name",order:"desc"}});
    if(error)throw error;
    const files=(data||[]).filter(x=>x.name&&x.id);
    if(!files.length){host.textContent="No attached documents found yet.";return;}
    const links=await Promise.all(files.map(async file=>{
      const path=folder+"/"+file.name;
      const {data:signed,error:signedError}=await db.storage.from("bank-application-documents").createSignedUrl(path,120);
      if(signedError||!signed?.signedUrl)return null;
      return {name:file.name,url:signed.signedUrl};
    }));
    const valid=links.filter(Boolean);
    host.innerHTML=valid.length?valid.map(file=>'<p><a href="'+esc(file.url)+'" target="_blank" rel="noopener noreferrer">'+esc(file.name)+'</a> <small>(private link expires in 2 minutes)</small></p>').join(""):"Could not create access links. Check your branch permissions.";
  }catch(err){host.textContent="Unable to load attachments: "+(err?.message||"Check access and connection.");}
  finally{button.disabled=false;}
};

window.handleLoanApplicationDocumentUpload = async function(e) {
  e.preventDefault();const form=e.target,feedback=form.querySelector("p"),button=form.querySelector('button[type="submit"]');
  const files=Array.from(form.querySelector('input[name="loan_documents"]')?.files||[]);
  if(!files.length){if(feedback)feedback.textContent="Choose at least one document.";return;}
  if(button)button.disabled=true;if(feedback)feedback.textContent="Uploading privately…";
  try{
    const result=await window.uploadApplicationDocuments("loan-applications",form.dataset.applicationId,files,String(new FormData(form).get("document_category")||"other"));
    if(feedback)feedback.textContent=result.ok?"Uploaded "+result.count+" document(s).":"Upload failed: "+result.error;
    if(result.ok)form.reset();
  }catch(err){if(feedback)feedback.textContent="Upload failed: "+(err?.message||"Unexpected error");}
  finally{if(button)button.disabled=false;}
};

window.handleLoanApplicationReview = async function(e) {
  e.preventDefault();const form=e.target,feedback=form.querySelector("p"),button=form.querySelector('button[type="submit"]'),fd=new FormData(form);
  if(!db)return;
  if(button)button.disabled=true;if(feedback)feedback.textContent="Saving review…";
  try{
    const {data,error}=await db.rpc("review_loan_application",{p_application_id:form.dataset.applicationId,p_decision:String(fd.get("decision")||""),p_review_note:String(fd.get("review_note")||"")});
    if(error)throw error;
    if(feedback)feedback.textContent="Review saved: "+(data?.status||String(fd.get("decision")));
    await window.loadLoanApplications();
  }catch(err){if(feedback)feedback.textContent="Review failed: "+(err?.message||"Unexpected error");}
  finally{if(button)button.disabled=false;}
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

window.staffVoiceRecorder = null;
window.staffVoiceStream = null;
window.staffVoiceChunks = [];
window.staffVoiceBlob = null;
window.staffVoiceMimeType = "";
window.staffVoiceStartedAt = 0;
window.staffVoiceTimer = null;
window.staffVoiceChannelAtStart = null;
window.staffVoicePreviewUrl = null;

function staffVoiceFormatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
}

function staffVoiceSetButtons(state) {
  const record = document.getElementById("staff-voice-record");
  const stop = document.getElementById("staff-voice-stop");
  const discard = document.getElementById("staff-voice-discard");
  const send = document.getElementById("staff-voice-send");
  if (!record || !stop || !discard || !send) return;
  record.disabled = state === "recording" || state === "ready" || state === "uploading";
  stop.disabled = state !== "recording";
  discard.disabled = state !== "ready";
  send.disabled = state !== "ready";
}

window.startStaffVoiceRecording = async function() {
  const feedback = document.getElementById("staff-voice-feedback");
  const preview = document.getElementById("staff-voice-preview");
  if (!db || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
    if (feedback) feedback.textContent = "Voice recording is not supported in this browser. Try a current Chrome or Edge browser over HTTPS.";
    return;
  }
  if (window.staffVoiceRecorder && window.staffVoiceRecorder.state === "recording") return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const supported = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", "audio/ogg"];
    const mime = supported.find(type => MediaRecorder.isTypeSupported(type)) || "";
    const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    window.staffVoiceStream = stream;
    window.staffVoiceRecorder = recorder;
    window.staffVoiceChunks = [];
    window.staffVoiceBlob = null;
    window.staffVoiceMimeType = (recorder.mimeType || mime || "audio/webm").split(";")[0].toLowerCase();
    window.staffVoiceChannelAtStart = (document.getElementById("staff-chat-branch") || {}).value || "";
    window.staffVoiceStartedAt = Date.now();
    if (window.staffVoicePreviewUrl) URL.revokeObjectURL(window.staffVoicePreviewUrl);
    window.staffVoicePreviewUrl = null;
    if (preview) { preview.pause(); preview.removeAttribute("src"); preview.hidden = true; }
    recorder.ondataavailable = event => { if (event.data && event.data.size) window.staffVoiceChunks.push(event.data); };
    recorder.onerror = () => {
      if (feedback) feedback.textContent = "The browser could not record audio. Stop and try again.";
      window.stopStaffVoiceRecording();
    };
    recorder.onstop = () => {
      const duration = Math.ceil((Date.now() - window.staffVoiceStartedAt) / 1000);
      const blob = new Blob(window.staffVoiceChunks, { type: window.staffVoiceMimeType });
      window.staffVoiceBlob = blob;
      if (window.staffVoiceStream) window.staffVoiceStream.getTracks().forEach(track => track.stop());
      window.staffVoiceStream = null;
      if (window.staffVoiceTimer) clearInterval(window.staffVoiceTimer);
      window.staffVoiceTimer = null;
      if (blob.size > 3145728) {
        window.staffVoiceBlob = null;
        staffVoiceSetButtons("idle");
        if (feedback) feedback.textContent = "This recording is larger than 3 MB. Record a shorter note.";
        return;
      }
      if (!blob.size || duration < 1) {
        staffVoiceSetButtons("idle");
        if (feedback) feedback.textContent = "The recording was too short or empty. Please record again.";
        return;
      }
      window.staffVoiceDuration = Math.min(duration, 120);
      window.staffVoicePreviewUrl = URL.createObjectURL(blob);
      if (preview) { preview.src = window.staffVoicePreviewUrl; preview.hidden = false; }
      staffVoiceSetButtons("ready");
      if (feedback) feedback.textContent = "Preview the recording before sending (" + staffVoiceFormatTime(window.staffVoiceDuration) + ", " + Math.ceil(blob.size / 1024) + " KB).";
    };
    recorder.start(500);
    staffVoiceSetButtons("recording");
    if (feedback) feedback.textContent = "Recording… 00:00 / 02:00";
    window.staffVoiceTimer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - window.staffVoiceStartedAt) / 1000);
      if (feedback) feedback.textContent = "Recording… " + staffVoiceFormatTime(elapsed) + " / 02:00";
      if (elapsed >= 120) window.stopStaffVoiceRecording();
    }, 500);
  } catch (error) {
    if (window.staffVoiceStream) window.staffVoiceStream.getTracks().forEach(track => track.stop());
    window.staffVoiceStream = null;
    staffVoiceSetButtons("idle");
    if (feedback) feedback.textContent = error && error.name === "NotAllowedError"
      ? "Microphone permission was denied. Allow microphone access in your browser settings and try again."
      : "Microphone unavailable. Check that it is connected and not being used by another app.";
  }
};

window.stopStaffVoiceRecording = function() {
  if (window.staffVoiceRecorder && window.staffVoiceRecorder.state === "recording") {
    try { window.staffVoiceRecorder.stop(); } catch (error) {}
  }
};

window.discardStaffVoiceRecording = function() {
  const preview = document.getElementById("staff-voice-preview");
  if (window.staffVoicePreviewUrl) URL.revokeObjectURL(window.staffVoicePreviewUrl);
  window.staffVoicePreviewUrl = null;
  window.staffVoiceBlob = null;
  window.staffVoiceChunks = [];
  if (preview) { preview.pause(); preview.removeAttribute("src"); preview.hidden = true; }
  staffVoiceSetButtons("idle");
  const feedback = document.getElementById("staff-voice-feedback");
  if (feedback) feedback.textContent = "Recording discarded.";
};

window.sendStaffVoiceNote = async function() {
  const feedback = document.getElementById("staff-voice-feedback");
  const selector = document.getElementById("staff-chat-branch");
  const blob = window.staffVoiceBlob;
  if (!db || !blob) return;
  const branchId = selector && selector.value ? selector.value : null;
  if ((branchId || "") !== (window.staffVoiceChannelAtStart || "")) {
    if (feedback) feedback.textContent = "The conversation changed after recording. Discard this note and record it in the intended channel.";
    return;
  }
  if (blob.size > 3145728 || !window.staffVoiceDuration || window.staffVoiceDuration > 120) {
    if (feedback) feedback.textContent = "This recording exceeds the allowed size or duration.";
    return;
  }
  const sendButton = document.getElementById("staff-voice-send");
  staffVoiceSetButtons("uploading");
  if (sendButton) sendButton.disabled = true;
  if (feedback) feedback.textContent = "Uploading voice note securely…";
  let uploadedPath = null;
  try {
    const { data: userData, error: userError } = await db.auth.getUser();
    if (userError || !userData || !userData.user) throw new Error("Your signed-in user could not be verified. Sign in again.");
    const ext = window.staffVoiceMimeType === "audio/mp4" ? "m4a"
      : window.staffVoiceMimeType === "audio/ogg" ? "ogg"
      : window.staffVoiceMimeType === "audio/mpeg" ? "mp3"
      : window.staffVoiceMimeType === "audio/wav" ? "wav" : "webm";
    const channelKey = branchId || "global";
    uploadedPath = userData.user.id + "/" + channelKey + "/" + crypto.randomUUID() + "." + ext;
    const { error: uploadError } = await db.storage.from("staff-voice-notes").upload(uploadedPath, blob, {
      contentType: window.staffVoiceMimeType,
      cacheControl: "300",
      upsert: false
    });
    if (uploadError) throw uploadError;
    const { error: registerError } = await db.rpc("register_staff_voice_note", {
      p_branch_id: branchId,
      p_storage_path: uploadedPath,
      p_mime_type: window.staffVoiceMimeType,
      p_byte_size: blob.size,
      p_duration_seconds: window.staffVoiceDuration
    });
    if (registerError) throw registerError;
    window.discardStaffVoiceRecording();
    if (feedback) feedback.textContent = "Voice note sent. Refreshing conversation…";
    await window.loadStaffChat();
  } catch (error) {
    if (uploadedPath) {
      try { await db.storage.from("staff-voice-notes").remove([uploadedPath]); } catch (cleanupError) {}
    }
    if (feedback) feedback.textContent = "Voice note was not confirmed as sent. " + (error && error.message ? error.message : "Check your connection and try again.");
    staffVoiceSetButtons("ready");
  }
};

window.vicLineSeenMessages = window.vicLineSeenMessages || {};
window.vicLineSeenTimestamps = window.vicLineSeenTimestamps || {};
window.vicLineSettingsDefaults = { soundEnabled:true, tone:"chime", volume:55, appearance:"light", density:"comfortable" };
window.getVicLineSettings = function() {
  try { return { ...window.vicLineSettingsDefaults, ...JSON.parse(localStorage.getItem("zfs-vic-line-settings") || "{}") }; }
  catch (_) { return { ...window.vicLineSettingsDefaults }; }
};
window.applyVicLineSettings = function() {
  const settings=window.getVicLineSettings(), shell=document.querySelector(".vicline-shell");
  if(shell){shell.dataset.appearance=settings.appearance;shell.dataset.density=settings.density;}
  const set=(id,value)=>{const el=document.getElementById(id);if(el&&value!==undefined)el.value=String(value);};
  const sound=document.getElementById("vicline-sound-enabled");if(sound)sound.checked=!!settings.soundEnabled;
  set("vicline-sound-tone",settings.tone);set("vicline-sound-volume",settings.volume);set("vicline-appearance",settings.appearance);set("vicline-density",settings.density);
  window.updateVicLineVolumeLabel();
  const button=document.getElementById("vicline-notification-permission");
  if(button&&"Notification" in window)button.textContent=Notification.permission==="granted"?"Alerts enabled":"Enable alerts";
};
window.saveVicLineSettings = function() {
  const el=id=>document.getElementById(id);
  const existing=window.getVicLineSettings();const settings={soundEnabled:!!el("vicline-sound-enabled")?.checked,tone:el("vicline-sound-tone")?.value||"chime",volume:Math.max(0,Math.min(100,Number(el("vicline-sound-volume")?.value||55))),desktopNotifications:existing.desktopNotifications===true,appearance:el("vicline-appearance")?.value||"light",density:el("vicline-density")?.value||"comfortable"};
  try{localStorage.setItem("zfs-vic-line-settings",JSON.stringify(settings));}catch(_){}
  window.applyVicLineSettings();
  const feedback=el("vicline-settings-feedback");if(feedback)feedback.textContent="Your VIC LINE preferences have been saved on this device.";
};
window.updateVicLineVolumeLabel=function(){const slider=document.getElementById("vicline-sound-volume"),label=document.getElementById("vicline-volume-label");if(slider&&label)label.textContent=slider.value+"%";};
window.toggleVicLineSettings=function(force){const panel=document.getElementById("vicline-settings-panel"),button=document.getElementById("vicline-settings-toggle");if(!panel)return;const open=typeof force==="boolean"?force:panel.hidden;panel.hidden=!open;if(button)button.setAttribute("aria-expanded",String(open));};
window.enableVicLineDesktopNotifications=async function(){
  const feedback=document.getElementById("vicline-settings-feedback");
  if(!("Notification" in window)){if(feedback)feedback.textContent="This browser does not support desktop notifications.";return;}
  let permission=Notification.permission;
  if(permission==="default")permission=await Notification.requestPermission();
  if(feedback)feedback.textContent=permission==="granted"?"Browser notifications enabled.":"Notifications were not enabled. Check this site's browser permissions.";
  if(permission==="granted"){const settings=window.getVicLineSettings();settings.desktopNotifications=true;try{localStorage.setItem("zfs-vic-line-settings",JSON.stringify(settings));}catch(_){}}
  const button=document.getElementById("vicline-notification-permission");if(button)button.textContent=permission==="granted"?"Alerts enabled":"Enable alerts";
};
window.playVicLineTone=function(toneOverride){
  const settings=window.getVicLineSettings();if(!settings.soundEnabled&&!toneOverride)return;
  const AudioContextClass=window.AudioContext||window.webkitAudioContext;if(!AudioContextClass)return;
  try{
    const ctx=new AudioContextClass();if(ctx.state==="suspended")ctx.resume();
    const tone=toneOverride||settings.tone,volume=Math.max(0,Math.min(1,Number(settings.volume)/100))*.14;
    const notes=tone==="bell"?[880]:tone==="pop"?[520]:tone==="double"?[660,880]:[740,988];
    notes.forEach((frequency,index)=>{const start=ctx.currentTime+index*(tone==="double"?.15:.1),osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=tone==="pop"?"triangle":"sine";osc.frequency.setValueAtTime(frequency,start);gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),start+.018);gain.gain.exponentialRampToValueAtTime(.0001,start+(tone==="pop"?.12:.24));osc.connect(gain);gain.connect(ctx.destination);osc.start(start);osc.stop(start+.27);});
    setTimeout(()=>ctx.close().catch(()=>{}),650);
  }catch(_){}
};
window.testVicLineNotificationTone=function(){window.playVicLineTone(window.getVicLineSettings().tone);const f=document.getElementById("vicline-settings-feedback");if(f)f.textContent="Playing a preview of your selected tone.";};
window.notifyVicLineNewMessage=function(message,channelName){
  const settings=window.getVicLineSettings();if(settings.soundEnabled)window.playVicLineTone();
  if(settings.desktopNotifications&&"Notification" in window&&Notification.permission==="granted"&&document.hidden){try{const n=new Notification("VIC LINE · "+channelName,{body:String(message||"New staff message").slice(0,140),tag:"vic-line-"+channelName});n.onclick=()=>{window.focus();n.close();};}catch(_){}}
};
window.toggleVicLineMode=function(){
  const mode=document.getElementById("vicline-mode")?.value||"channel";
  const channelWrap=document.getElementById("vicline-channel-picker-wrap"),dmWrap=document.getElementById("vicline-dm-picker-wrap"),voice=document.querySelector(".vicline-voice-tools"),sidebarNote=document.querySelector(".vicline-sidebar-note");
  if(channelWrap)channelWrap.hidden=mode==="direct";
  if(dmWrap)dmWrap.hidden=mode!=="direct";
  if(voice)voice.hidden=mode==="direct";
  if(sidebarNote)sidebarNote.textContent=mode==="direct"?"Private conversations are visible only to their participants.":"Each conversation follows bank-wide or branch access permissions.";
  window.loadStaffChat();
};
window.renderVicLineConversationList=function(branches){
  const list=document.getElementById("vicline-conversation-list"),count=document.getElementById("vicline-conversation-count"),selector=document.getElementById("staff-chat-branch");if(!list||!selector)return;
  const current=selector.value||"",conversations=[{id:"",name:"Bank-wide messages",short:"All staff",icon:"✦"}].concat((branches||[]).map(b=>({id:b.id,name:b.branch_name,short:"Branch conversation",icon:"◎"})));
  selector.innerHTML=conversations.map(item=>'<option value="'+esc(item.id)+'">'+esc(item.name)+'</option>').join("");
  if(conversations.some(item=>String(item.id)===String(current)))selector.value=current;
  list.innerHTML=conversations.map(item=>'<button type="button" class="vicline-conversation-item '+(String(item.id)===String(selector.value||"")?"active":"")+'" data-conversation-id="'+esc(item.id)+'" onclick="window.openVicLineConversation(this.dataset.conversationId)"><span class="vicline-list-avatar">'+item.icon+'</span><span class="vicline-list-copy"><strong>'+esc(item.name)+'</strong><small>'+esc(item.short)+'</small></span><span class="vicline-list-arrow">›</span></button>').join("");
  if(count)count.textContent=conversations.length+" conversation"+(conversations.length===1?"":"s");
};
window.openVicLineConversation=function(id){const selector=document.getElementById("staff-chat-branch");if(!selector)return;selector.value=id||"";window.loadStaffChat();};
window.loadStaffChat=async function(options={}){
  const feedback=document.getElementById("staff-chat-feedback"),list=document.getElementById("staff-chat-messages"),selector=document.getElementById("staff-chat-branch");if(!feedback||!list||!selector)return;
  if(!db){feedback.textContent="Database connection unavailable. Messages were not loaded.";return;}
  const mode=document.getElementById("vicline-mode")?.value||"channel";
  if(mode==="direct"){
    feedback.textContent="Loading private staff conversations…";
    try{
      const staffSelect=document.getElementById("vicline-dm-recipient");
      if(!staffSelect){feedback.textContent="Direct-message selector is unavailable.";return;}
      const previousRecipient=staffSelect.value||"";
      const directory=await db.rpc("list_vic_line_staff_directory");
      if(directory.error){feedback.textContent="Private messaging is not installed or staff directory access was denied: "+directory.error.message;list.innerHTML="";return;}
      const staff=(directory.data||[]).filter(item=>item.user_id&&item.user_id!==window.currentUserId);
      staffSelect.innerHTML='<option value="">Choose staff member</option>'+staff.map(item=>'<option value="'+esc(item.user_id)+'">'+esc(item.full_name||item.employee_number||"Staff member")+(item.branch_name?' · '+esc(item.branch_name):"")+'</option>').join("");
      if(staff.some(item=>String(item.user_id)===String(previousRecipient)))staffSelect.value=previousRecipient;
      else if(staff.length)staffSelect.value=String(staff[0].user_id);
      const recipientId=staffSelect.value;
      const recipient=staff.find(item=>String(item.user_id)===String(recipientId));
      const title=document.getElementById("vicline-current-channel");
      if(title)title.textContent=recipient?"Private · "+recipient.full_name:"Private direct messages";
      if(!recipientId){list.innerHTML='<p class="muted">No other active staff members are available for private messaging.</p>';feedback.textContent="Staff directory loaded.";return;}
      const result=await db.rpc("list_vic_line_direct_messages",{p_recipient_user_id:recipientId,p_limit:100});
      if(result.error){feedback.textContent="Private messages could not be loaded. Apply the reviewed VIC LINE private-message SQL in the test database first. "+result.error.message;list.innerHTML="";return;}
      const messages=(result.data||[]).slice().reverse();
      list.innerHTML=messages.map(m=>{
        const sent=String(m.direction)==="sent",sender=sent?"You":(m.sender_name||"Staff member");
        const when=m.sent_at?new Date(m.sent_at).toLocaleString():"";
        return '<article class="staff-chat-message '+(sent?'vicline-direct-sent':'vicline-direct-received')+'"><div class="vicline-message-avatar" aria-hidden="true">'+(sent?'Y':esc(String(sender).trim().charAt(0).toUpperCase()||'S'))+'</div><div class="vicline-message-body"><div class="staff-chat-message-heading"><strong>'+esc(sender)+'</strong><span class="muted">'+esc(when)+(sent?'':(m.read_at?' · Read':' · Delivered'))+'</span></div><div class="vicline-bubble"><p class="staff-chat-text">'+esc(m.message_text)+'</p></div></div></article>';
      }).join("")||'<p class="muted">No private messages with this colleague yet. Send the first message below.</p>';
      const unread=messages.filter(m=>m.direction==="received"&&!m.read_at);
      await Promise.all(unread.map(m=>db.rpc("mark_vic_line_direct_message_read",{p_message_id:m.message_id})));
      feedback.textContent=messages.length+" private message"+(messages.length===1?"":"s")+" loaded. Messages are visible only to the sender and recipient.";
      list.scrollTop=list.scrollHeight;
    }catch(error){feedback.textContent="A connection error prevented private messages from loading. Check the database functions and try again.";}
    return;
  }
  feedback.textContent="Loading messages and voice notes…";
  try{
    const currentValue=selector.value||"";
    const [branchResult,messageResult,voiceResult]=await Promise.all([
      db.from("branches").select("id,branch_name").eq("is_active",true).order("branch_name"),
      db.rpc("list_staff_channel_messages",{p_branch_id:currentValue||null,p_limit:100}),
      db.rpc("list_staff_voice_notes",{p_branch_id:currentValue||null,p_limit:100})
    ]);
    if(branchResult.error){feedback.textContent="Branch channels could not be loaded: "+branchResult.error.message;return;}
    window.renderVicLineConversationList(branchResult.data||[]);selector.value=currentValue;
    const selected=[...selector.options].find(o=>o.value===currentValue),channelName=selected?selected.textContent:"Bank-wide messages";
    const title=document.getElementById("vicline-current-channel");if(title)title.textContent=currentValue?channelName:"VIC LINE team";
    const conversationList=document.getElementById("vicline-conversation-list");if(conversationList)conversationList.querySelectorAll("[data-conversation-id]").forEach(b=>b.classList.toggle("active",b.dataset.conversationId===currentValue));
    if(messageResult.error){feedback.textContent="Messages could not be loaded: "+messageResult.error.message;list.innerHTML="";return;}
    if(voiceResult.error)feedback.textContent="Text messages loaded, but voice notes are unavailable until the voice-note database setup is applied: "+voiceResult.error.message;
    const items=(messageResult.data||[]).map(m=>({kind:"text",data:m,at:new Date(m.created_at).getTime()||0}));
    const notes=voiceResult.error?[]:(voiceResult.data||[]);
    const noteItems=await Promise.all(notes.map(async note=>{const {data,error}=await db.storage.from("staff-voice-notes").createSignedUrl(note.storage_path,300);return{kind:"voice",data:note,url:error||!data?"":data.signedUrl,at:new Date(note.created_at).getTime()||0};}));
    const merged=items.concat(noteItems).sort((a,b)=>a.at-b.at),newest=merged.length?merged[merged.length-1].data:null,newestId=newest&&(newest.id||newest.message_id||newest.storage_path||newest.created_at),seenKey=currentValue||"bankwide",previous=window.vicLineSeenMessages[seenKey];
    if(options.polling&&newestId&&previous&&String(newestId)!==String(previous)){
      const newItems=merged.filter(item=>item.at>(window.vicLineSeenTimestamps[seenKey]||0));
      const incoming=newItems.filter(item=>{const sender=String(item.data.sender_name||item.data.sender_employee_number||"");return !sender||sender!==String(window.currentEmployeeName||"");}).pop();
      if(incoming)window.notifyVicLineNewMessage(incoming.kind==="voice"?"New voice note received":incoming.data.message_text,channelName);
    }
    window.vicLineSeenMessages[seenKey]=newestId;window.vicLineSeenTimestamps[seenKey]=newest?(new Date(newest.created_at).getTime()||0):0;
    list.innerHTML=merged.map(item=>{
      const m=item.data,sender=m.sender_name||m.sender_employee_number||"Staff member",initials=sender.trim().split(/\\s+/).slice(0,2).map(part=>part.charAt(0)).join("").toUpperCase()||"S",time=m.created_at?new Date(m.created_at).toLocaleString():"";
      if(item.kind==="voice"){const player=item.url?'<audio controls preload="none" aria-label="Voice note from '+esc(sender)+'" src="'+esc(item.url)+'"></audio>':'<p class="muted">Audio playback unavailable. Refresh and check your channel access.</p>';return '<article class="staff-chat-message staff-voice-message"><div class="vicline-message-avatar" aria-hidden="true">'+esc(initials)+'</div><div class="vicline-message-body"><div class="staff-chat-message-heading"><strong>'+esc(sender)+'</strong><span class="muted">'+esc(time)+'</span></div><div class="vicline-bubble vicline-audio-bubble"><p class="staff-voice-label">🎙️ Voice note · '+esc(staffVoiceFormatTime(m.duration_seconds))+'</p>'+player+'</div></div></article>';}
      return '<article class="staff-chat-message"><div class="vicline-message-avatar" aria-hidden="true">'+esc(initials)+'</div><div class="vicline-message-body"><div class="staff-chat-message-heading"><strong>'+esc(sender)+'</strong><span class="muted">'+esc(time)+'</span></div><div class="vicline-bubble"><p class="staff-chat-text">'+esc(m.message_text)+'</p></div></div></article>';
    }).join("")||'<p class="muted">No messages in this conversation yet. You can send the first message.</p>';
    feedback.textContent=merged.length+" item"+(merged.length===1?"":"s")+" loaded. New-message checks run while VIC LINE is open.";
  }catch(error){feedback.textContent="A connection error prevented messages and voice notes from loading.";}
};
window.pollVicLineAllConversations=async function(){
  if(!db||!document.getElementById("staff-chat-branch"))return;
  try{
    const branchResult=await db.from("branches").select("id,branch_name").eq("is_active",true).order("branch_name");
    if(branchResult.error)return;
    const channels=[{id:"",name:"Bank-wide messages"}].concat((branchResult.data||[]).map(b=>({id:b.id,name:b.branch_name})));
    await Promise.all(channels.map(async channel=>{
      const key=channel.id||"bankwide";
      const [messages,voices]=await Promise.all([
        db.rpc("list_staff_channel_messages",{p_branch_id:channel.id||null,p_limit:1}),
        db.rpc("list_staff_voice_notes",{p_branch_id:channel.id||null,p_limit:1})
      ]);
      if(messages.error)return;
      const latestText=(messages.data||[]).map(m=>({kind:"text",data:m,at:new Date(m.created_at).getTime()||0})).sort((a,b)=>b.at-a.at)[0];
      const latestVoice=!voices.error?(voices.data||[]).map(m=>({kind:"voice",data:m,at:new Date(m.created_at).getTime()||0})).sort((a,b)=>b.at-a.at)[0]:null;
      const latest=[latestText,latestVoice].filter(Boolean).sort((a,b)=>b.at-a.at)[0];
      if(!latest){if(window.vicLineSeenTimestamps[key]===undefined)window.vicLineSeenTimestamps[key]=0;return;}
      const previous=window.vicLineSeenTimestamps[key];
      if(previous!==undefined&&previous>0&&latest.at>previous){
        const sender=String(latest.data.sender_name||latest.data.sender_employee_number||"");
        if(!sender||sender!==String(window.currentEmployeeName||""))window.notifyVicLineNewMessage(latest.kind==="voice"?"New voice note received":latest.data.message_text,channel.name);
      }
      window.vicLineSeenMessages[key]=latest.data.id||latest.data.message_id||latest.data.storage_path||latest.data.created_at;
      window.vicLineSeenTimestamps[key]=latest.at;
    }));
    if(!document.hidden&&document.getElementById("staff-chat-branch"))await window.loadStaffChat();
  }catch(_){}
};
window.vicLineStartPolling=function(){if(window.vicLinePollHandle)clearInterval(window.vicLinePollHandle);window.vicLinePollHandle=setInterval(()=>{window.pollVicLineAllConversations();},30000);};
window.sendStaffChatMessage = async function(event) {
  event.preventDefault();
  const form=event.currentTarget,input=document.getElementById("staff-chat-input"),feedback=document.getElementById("staff-chat-feedback"),selector=document.getElementById("staff-chat-branch"),mode=document.getElementById("vicline-mode")?.value||"channel";
  const submitButton=form?.querySelector('button[type="submit"]'),message=input?input.value.trim():"";
  if(!db||!form||!input||!form.reportValidity()||!message)return;
  if(submitButton)submitButton.disabled=true;
  if(feedback)feedback.textContent="Sending "+(mode==="direct"?"private message…":"channel message…");
  try{
    let error=null;
    if(mode==="direct"){
      const recipientId=document.getElementById("vicline-dm-recipient")?.value||"";
      if(!recipientId){if(feedback)feedback.textContent="Choose a staff member before sending a private message.";return;}
      const result=await db.rpc("send_vic_line_direct_message",{p_recipient_user_id:recipientId,p_message_text:message});
      error=result.error;
    }else{
      const result=await db.rpc("send_staff_channel_message",{p_message:message,p_branch_id:selector&&selector.value?selector.value:null});
      error=result.error;
    }
    if(error){if(feedback)feedback.textContent="Message was not sent: "+error.message;return;}
    input.value="";
    if(feedback)feedback.textContent="Message sent. Refreshing conversation…";
    await window.loadStaffChat();
  }catch(error){if(feedback)feedback.textContent="A connection error prevented the message from being sent. Check the conversation before retrying.";}
  finally{if(submitButton)submitButton.disabled=false;}
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
  if(!["deposit","withdrawal"].includes(type)||!reference||!Number.isFinite(amount)||amount<=0){
    if(status)status.textContent="Receipt unavailable: this record is not a valid posted deposit or withdrawal.";
    return;
  }
  const label=type==="withdrawal"?"WITHDRAWAL":"DEPOSIT";
  const amountLabel=type==="withdrawal"?"AMOUNT PAID OUT":"AMOUNT RECEIVED";
  if(!skipConfirmation && !confirm("Print the receipt for posted "+type+" "+reference+"? Verify the transaction reference and amount."))return;
  const printWindow=window.open("","_blank","width=420,height=700");
  if(!printWindow){if(status)status.textContent="Allow pop-ups for this site, then select Print "+type+" receipt again.";return;}
  const safe=value=>String(value).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const money=amount.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})+" "+currency;
  printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${label} Receipt ${safe(reference)}</title><style>@page{size:80mm auto;margin:4mm}body{font:12px/1.45 monospace;color:#000;width:72mm;margin:0 auto}h2,p{text-align:center}h2{font-size:14px;margin:0 0 5px}.muted{text-align:center;font-size:10px}.line{border:0;border-top:1px dashed #000;margin:10px 0}.row{display:flex;justify-content:space-between;gap:8px;margin:6px 0}.amount{font-size:16px;font-weight:bold;text-align:center;margin:12px 0}.label{font-weight:bold}</style></head><body><h2>ZIVAMUNTUYO FINANCIAL SERVICES LTD</h2><p class="muted">CUSTOMER ${label} RECEIPT</p><hr class="line"><div class="row"><span>Receipt reference</span><span>${safe(reference)}</span></div><div class="row"><span>Date</span><span>${safe(transactionDate||"Not provided")}</span></div><div class="row"><span>Branch</span><span>${safe(branch||"Not provided")}</span></div><div class="row"><span>Account</span><span>${safe(account||"Not provided")}</span></div><div class="row"><span>Transaction</span><span>${label}</span></div><hr class="line"><p class="label">${amountLabel}</p><p class="amount">${safe(money)}</p><hr class="line"><p>Thank you for banking with us.</p><p class="muted">This receipt is for a ledger-posted transaction.</p><script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};};<\\/script></body></html>`);
  printWindow.document.close();
  if(status)status.textContent="Receipt opened for printing for posted "+type+" "+reference+".";
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
window.loadMyAttendanceStatus=async function(){
  const feedback=document.getElementById("my-attendance-feedback"),host=document.getElementById("my-attendance-status"),branchSelect=document.getElementById("attendance-clock-branch"),clockIn=document.getElementById("attendance-clock-in"),clockOut=document.getElementById("attendance-clock-out");
  if(!feedback||!host)return;
  if(!db){feedback.textContent="Database connection unavailable. No attendance action was recorded.";return;}
  try{
    if(branchSelect&&branchSelect.options.length<=1){
      const branches=await db.from("branches").select("id,branch_name,branch_code").eq("is_active",true).order("branch_name");
      if(!branches.error)branchSelect.innerHTML='<option value="">My home branch</option>'+(branches.data||[]).map(b=>'<option value="'+esc(b.id)+'">'+esc(b.branch_name)+' ('+esc(b.branch_code)+')</option>').join("");
    }
    const {data,error}=await db.rpc("get_my_attendance_status",{p_branch_id:branchSelect?.value||null});
    if(error){feedback.textContent="Attendance clock RPC is not installed or access was denied. Review staff_attendance_clock_rpc_draft.sql in a non-production database first. "+error.message;host.innerHTML="";return;}
    const row=Array.isArray(data)?data[0]:data;
    if(!row){
      feedback.textContent="No attendance record returned for today. Clock in when you begin work.";
      host.innerHTML='<div class="notice-box">Status: Not clocked in today. Method: not recorded.</div>';
      if(clockIn)clockIn.disabled=false;if(clockOut)clockOut.disabled=true;return;
    }
    const method=value=>String(value||"not recorded").replaceAll("_"," ");
    host.innerHTML='<div class="notice-box"><strong>'+esc(row.attendance_status||"recorded")+'</strong><br>Branch: '+esc(row.branch_name||"")+'<br>Date: '+esc(row.work_date||"")+'<br>Clock in: '+esc(row.clock_in_at?new Date(row.clock_in_at).toLocaleString():"Missing")+' ('+esc(method(row.clock_in_method))+')<br>Clock out: '+esc(row.clock_out_at?new Date(row.clock_out_at).toLocaleString():"Not yet recorded")+(row.clock_out_method?' ('+esc(method(row.clock_out_method))+')':"")+'</div>';
    if(row.clock_out_at){feedback.textContent="Today's attendance is closed. Ask an authorized supervisor to correct an error.";if(clockIn)clockIn.disabled=true;if(clockOut)clockOut.disabled=true;}
    else{feedback.textContent="Clock-in is recorded. Clock out when your shift ends.";if(clockIn)clockIn.disabled=true;if(clockOut)clockOut.disabled=false;}
  }catch(_){feedback.textContent="A connection error prevented attendance status from loading.";}
};
window.clockInMyAttendance=async function(){
  const feedback=document.getElementById("my-attendance-feedback"),branchId=document.getElementById("attendance-clock-branch")?.value||null;
  if(!db||!feedback)return;
  const button=document.getElementById("attendance-clock-in");if(button)button.disabled=true;
  feedback.textContent="Recording web clock-in…";
  try{
    const {data,error}=await db.rpc("clock_in_my_attendance",{p_branch_id:branchId});
    if(error)throw error;
    const row=Array.isArray(data)?data[0]:data;
    feedback.textContent="Clock-in recorded by the database at "+(row?.clock_in_at?new Date(row.clock_in_at).toLocaleString():"the server time")+". Method: web, not fingerprint.";
    await window.loadMyAttendanceStatus();
  }catch(error){feedback.textContent="Clock-in was not recorded: "+(error?.message||"connection error");if(button)button.disabled=false;}
};
window.clockOutMyAttendance=async function(){
  const feedback=document.getElementById("my-attendance-feedback");if(!db||!feedback)return;
  const button=document.getElementById("attendance-clock-out");if(button)button.disabled=true;
  feedback.textContent="Recording web clock-out…";
  try{
    const {data,error}=await db.rpc("clock_out_my_attendance");
    if(error)throw error;
    const row=Array.isArray(data)?data[0]:data;
    feedback.textContent="Clock-out recorded by the database at "+(row?.clock_out_at?new Date(row.clock_out_at).toLocaleString():"the server time")+". Method: web, not fingerprint.";
    await window.loadMyAttendanceStatus();
  }catch(error){feedback.textContent="Clock-out was not recorded: "+(error?.message||"connection error");if(button)button.disabled=false;}
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



const FS_BASE={account:[["Customer full legal name","text",true],["Date of birth","date",true],["National ID / passport","text",true],["Mobile phone","text",true],["Residential address / village","textarea",true],["Occupation / business","text",true],["Account product","text",true],["Currency","text",true],["Branch","text",true],["Opening deposit","number",true],["Source of funds","textarea",true],["Next of kin","textarea",false]],loan:[["Applicant full legal name","text",true],["Customer / account number","text",true],["Loan product","text",true],["Amount requested","number",true],["Currency","text",true],["Tenure in months","number",true],["Loan purpose","textarea",true],["Monthly income / cash flow","number",true],["Existing obligations","textarea",false],["Collateral details","textarea",false],["Guarantor details","textarea",false],["Processing branch","text",true]],overdraft:[["Customer / business name","text",true],["Current account number","text",true],["Overdraft limit requested","number",true],["Currency","text",true],["Purpose","textarea",true],["Expected monthly turnover","number",true],["Security / collateral","textarea",true],["Review date","date",true],["Interest rate (5% per month)","text",true],["Branch","text",true]]};
let fsFields=[];
function fsEsc(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");}
window.fsChange=function(type){if(!FS_BASE[type])type="account";document.getElementById("fs-type").value=type;const meta={account:["Account Opening Form","ZFS-ACC-01 · Version 1.0"],loan:["Loan Processing Application","ZFS-CRD-01 · Version 1.0"],overdraft:["Overdraft Facility Application","ZFS-OD-01 · Version 1.0"]}[type];document.getElementById("fs-title").value=meta[0];document.getElementById("fs-ref").value=meta[1];document.getElementById("fs-instructions").value=type==="loan"?"Attach supporting evidence. Approval is subject to independent credit assessment and delegated authority.":type==="overdraft"?"Terms must follow approved bank policy. The configured overdraft rate is 5% per month.":"Complete all required fields. Staff must verify original supporting documents before processing.";fsFields=FS_BASE[type].map((f,i)=>({id:"base"+i,label:f[0],type:f[1],required:f[2],enabled:true,custom:false}));try{const s=JSON.parse(localStorage.getItem("zfs-form-"+type)||"null");if(s){document.getElementById("fs-title").value=s.title;document.getElementById("fs-ref").value=s.ref;document.getElementById("fs-instructions").value=s.instructions;fsFields=s.fields;document.getElementById("fs-logo").checked=s.logo;document.getElementById("fs-sign").checked=s.sign;document.getElementById("fs-checklist").checked=s.checklist;}}catch(e){}fsEdit();fsRender();};
function fsEdit(){const host=document.getElementById("fs-fields");if(!host)return;host.innerHTML=fsFields.map((f,i)=>'<div class="fs-field-row"><label class="fs-field-enabled"><input type="checkbox" data-i="'+i+'" data-k="enabled" '+(f.enabled?'checked':'')+'> On</label><label>Field label<input data-i="'+i+'" data-k="label" value="'+fsEsc(f.label)+'"></label><label>Type<select data-i="'+i+'" data-k="type"><option value="text" '+(f.type==="text"?"selected":"")+'>Text</option><option value="date" '+(f.type==="date"?"selected":"")+'>Date</option><option value="number" '+(f.type==="number"?"selected":"")+'>Number</option><option value="textarea" '+(f.type==="textarea"?"selected":"")+'>Long text</option><option value="checkbox" '+(f.type==="checkbox"?"selected":"")+'>Tick box</option></select></label><label class="fs-field-required"><input type="checkbox" data-i="'+i+'" data-k="required" '+(f.required?'checked':'')+'> Required</label>'+(f.custom?'<button type="button" data-remove="'+i+'" class="fs-remove-field">Remove</button>':'')+'</div>').join("");host.querySelectorAll("[data-i]").forEach(el=>{el.addEventListener(el.type==="checkbox"||el.tagName==="SELECT"?"change":"input",()=>{const f=fsFields[Number(el.dataset.i)],k=el.dataset.k;f[k]=el.type==="checkbox"?el.checked:el.value;fsRender();});});host.querySelectorAll("[data-remove]").forEach(el=>el.addEventListener("click",()=>{fsFields.splice(Number(el.dataset.remove),1);fsEdit();fsRender();}));}
window.fsAdd=function(){const e=document.getElementById("fs-new-label");if(!e.value.trim()){e.focus();return;}fsFields.push({id:"custom"+Date.now(),label:e.value.trim(),type:document.getElementById("fs-new-type").value,required:false,enabled:true,custom:true});e.value="";fsEdit();fsRender();};
function fsSnapshot(){return {type:document.getElementById("fs-type").value,title:document.getElementById("fs-title").value,ref:document.getElementById("fs-ref").value,instructions:document.getElementById("fs-instructions").value,fields:fsFields,logo:document.getElementById("fs-logo").checked,sign:document.getElementById("fs-sign").checked,checklist:document.getElementById("fs-checklist").checked};}
function fsDocument(s){const logo=s.logo?'<div class="fs-print-brand"><span class="fs-print-mark">Z</span><div><strong>ZIVAMUNTUYO FINANCIAL SERVICES LTD</strong><small>COMMERCIAL BANKING SERVICES · UGANDA</small></div></div>':'';const rows=s.fields.filter(f=>f.enabled).map(f=>'<div class="fs-print-field"><label>'+fsEsc(f.label)+(f.required?' <b>*</b>':'')+'</label>'+(f.type==="textarea"?'<div class="fs-write-area"></div>':f.type==="checkbox"?'<div class="fs-tick">☐ Yes &nbsp; ☐ No</div>':'<div class="fs-write-line"></div>')+'</div>').join("");const check=s.checklist?'<h3 class="fs-print-section">Supporting document verification</h3><div class="fs-print-checklist">☐ National ID verified　 ☐ Address verified　 ☐ Collateral checked　 ☐ Originals returned</div>':'';const sign=s.sign?'<div class="fs-print-signatures"><div>Applicant signature / thumbprint<div></div><small>Name and date</small></div><div>Received / checked by staff<div></div><small>Staff name and date</small></div><div>Authorized reviewer<div></div><small>Name, signature and date</small></div></div>':'';return '<article class="fs-print-page">'+logo+'<header class="fs-print-title"><h1>'+fsEsc(s.title)+'</h1><p>'+fsEsc(s.ref)+'</p></header><p class="fs-print-instructions">'+fsEsc(s.instructions)+'</p><div class="fs-print-fields">'+rows+'</div>'+check+sign+'<footer>CONFIDENTIAL · Follow organizational document retention and privacy procedures.</footer></article>';}
window.fsRender=function(){const p=document.getElementById("fs-preview");if(p)p.innerHTML=fsDocument(fsSnapshot());};
window.fsSave=async function(){const s=fsSnapshot(),feedback=document.getElementById("fs-feedback");try{localStorage.setItem("zfs-form-"+s.type,JSON.stringify(s));}catch(e){}if(!db){if(feedback)feedback.textContent="Saved on this device. Sign in with a connected session to sync templates across devices.";return;}try{const {data:{user},error:userError}=await db.auth.getUser();if(userError||!user){if(feedback)feedback.textContent="Saved on this device. Sign in to sync this template across devices.";return;}const {error}=await db.from("form_studio_templates").upsert({created_by:user.id,template_type:s.type,template_name:s.title,template_data:s,updated_at:new Date().toISOString()},{onConflict:"created_by,template_type"});if(error)throw error;if(feedback)feedback.textContent="Template saved securely to your account and this device. You can load it on another signed-in device.";}catch(e){if(feedback)feedback.textContent="Saved locally, but cloud sync failed. Check your connection and try Save again.";}};
window.fsLoad=async function(){const t=document.getElementById("fs-type").value,feedback=document.getElementById("fs-feedback");let s=null;if(db){try{const {data:{user}}=await db.auth.getUser();if(user){const {data,error}=await db.from("form_studio_templates").select("template_data,updated_at").eq("created_by",user.id).eq("template_type",t).maybeSingle();if(error)throw error;if(data?.template_data){s=data.template_data;try{localStorage.setItem("zfs-form-"+t,JSON.stringify(s));}catch(e){}}}}catch(e){if(feedback)feedback.textContent="Cloud template lookup failed; checking this device's saved draft.";}}if(!s){try{s=JSON.parse(localStorage.getItem("zfs-form-"+t)||"null");}catch(e){s=null;}}if(!s){if(feedback)feedback.textContent="No saved template found in your account or on this device.";return;}document.getElementById("fs-title").value=s.title||"";document.getElementById("fs-ref").value=s.ref||"";document.getElementById("fs-instructions").value=s.instructions||"";fsFields=(s.fields||[]).map(f=>({...f}));document.getElementById("fs-logo").checked=!!s.logo;document.getElementById("fs-sign").checked=!!s.sign;document.getElementById("fs-checklist").checked=!!s.checklist;fsEdit();fsRender();if(feedback)feedback.textContent="Saved template loaded"+(db?" from your account or device.":".");};
window.fsPrint=function(){const s=fsSnapshot(),w=window.open("","_blank","width=900,height=900");if(!w){alert("Allow pop-ups, then try Print / Save PDF again.");return;}const css='@page{size:A4;margin:14mm}*{box-sizing:border-box}body{font:11px Arial;color:#17251e;margin:0}.fs-print-page{max-width:190mm;margin:auto}.fs-print-brand{display:flex;gap:10px;align-items:center;border-bottom:2px solid #0a4935;padding-bottom:12px}.fs-print-mark{width:40px;height:40px;display:grid;place-items:center;background:#0a4935;color:#e6c77f;font-weight:bold;font-size:22px}.fs-print-brand strong,.fs-print-brand small{display:block}.fs-print-brand small{font-size:8px;margin-top:4px}.fs-print-title{text-align:center;margin:18px 0 12px}.fs-print-title h1{font-size:19px;margin:0 0 5px}.fs-print-title p,.fs-print-instructions{font-size:10px;color:#5b665f;line-height:1.5}.fs-print-instructions{padding:9px;background:#f5f7f4;border:1px solid #dce5dd}.fs-print-fields{display:grid;grid-template-columns:1fr 1fr;gap:13px 18px;margin-top:15px}.fs-print-field label{display:block;font-weight:bold;margin-bottom:7px}.fs-write-line{height:23px;border-bottom:1px solid #8c9890}.fs-write-area{height:52px;border:1px solid #b7c1b9}.fs-print-section{margin-top:18px;border-bottom:1px solid #cdd8cf;padding-bottom:6px}.fs-print-checklist{margin-top:10px}.fs-print-signatures{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-top:28px}.fs-print-signatures>div{font-weight:bold}.fs-print-signatures>div>div{height:28px;border-bottom:1px solid #7f8c83;margin-top:12px}.fs-print-signatures small{display:block;font-weight:normal;margin-top:5px}.fs-print-page footer{margin-top:20px;padding-top:8px;border-top:1px solid #cdd8cf;color:#647168;font-size:8px}';w.document.open();w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>'+fsEsc(s.title)+'</title><style>'+css+'</style></head><body>'+fsDocument(s)+'</body></html>');w.document.close();w.onload=()=>w.print();};

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

window.payrollAccounts = [];
window.loadInstitutionPayrollAccounts = async function(){
  const select=document.getElementById("payroll-source-account"), feedback=document.getElementById("payroll-account-feedback");
  if(!select||!db)return;
  try{
    const {data,error}=await db.from("bank_accounts").select("id,account_number,branch_id,currency_code,status,balance").eq("status","active").eq("currency_code","UGX").order("account_number");
    if(error)throw error;
    window.payrollAccounts=data||[];
    select.innerHTML='<option value="">Choose institution account…</option>'+window.payrollAccounts.map(a=>'<option value="'+a.id+'">'+a.account_number+' · available UGX '+Number(a.balance||0).toLocaleString("en-UG")+'</option>').join("");
    if(feedback)feedback.textContent=window.payrollAccounts.length+" active UGX accounts available to authorized branch access. Choose the institution funding account.";
  }catch(err){if(feedback)feedback.textContent="Could not load accounts: "+(err?.message||"Unexpected error");}
};
window.getInstitutionPayrollDraft = function(){
  const source=document.getElementById("payroll-source-account")?.value||"";
  const reference=document.getElementById("payroll-reference")?.value.trim()||"";
  const date=document.getElementById("payroll-date")?.value||"";
  const raw=document.getElementById("payroll-rows")?.value||"";
  const accounts=window.payrollAccounts||[];
  const lines=raw.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const items=[];
  for(let i=0;i<lines.length;i++){
    const parts=lines[i].split("|").map(x=>x.trim());
    if(parts.length<3||!parts[0]||!parts[1]||!parts[2])throw new Error("Line "+(i+1)+": use account number | employee name | gross salary | employee number (optional).");
    const account=accounts.find(a=>a.account_number===parts[0]);
    if(!account)throw new Error("Line "+(i+1)+": account number "+parts[0]+" was not found among active UGX accounts available to you.");
    const amount=Number(parts[2].replace(/,/g,""));
    if(!Number.isFinite(amount)||amount<=1000)throw new Error("Line "+(i+1)+": gross salary must be a number greater than UGX 1,000.");
    items.push({account_id:account.id,employee_name:parts[1],gross_salary:Math.round(amount*100)/100,employee_reference:parts[3]||null});
  }
  if(!source)throw new Error("Select the institution funding account.");
  if(reference.length<4)throw new Error("Enter a payroll reference with at least 4 characters.");
  if(!date)throw new Error("Select the payroll payment date.");
  if(!items.length)throw new Error("Enter at least one employee salary row.");
  const duplicate=items.find((x,i)=>items.findIndex(y=>y.account_id===x.account_id)!==i);
  if(duplicate)throw new Error("Duplicate employee account: "+duplicate.employee_name+". Each account can appear only once per payroll.");
  const gross=items.reduce((s,x)=>s+x.gross_salary,0), commission=items.length*1000;
  return {source,reference,date,items,gross,commission,net:gross-commission};
};
window.previewInstitutionPayroll = function(){
  const preview=document.getElementById("payroll-preview"),feedback=document.getElementById("payroll-feedback");
  try{
    const d=window.getInstitutionPayrollDraft();
    preview.innerHTML='<h3>Payroll preview — not yet paid</h3><div class="performance-summary-grid"><div class="metric-card"><span>Employees</span><strong>'+d.items.length.toLocaleString("en-UG")+'</strong></div><div class="metric-card"><span>Gross payroll</span><strong>UGX '+d.gross.toLocaleString("en-UG")+'</strong></div><div class="metric-card"><span>Bank commission</span><strong>UGX '+d.commission.toLocaleString("en-UG")+'</strong></div><div class="metric-card"><span>Employee net total</span><strong>UGX '+d.net.toLocaleString("en-UG")+'</strong></div></div><p>Reference: '+d.reference+' · Date: '+d.date+'</p><p class="muted">Preview only. Balances will change only after you confirm and the database accepts the full batch.</p>';
    if(feedback)feedback.textContent="Check the totals and employee list, then confirm to post the batch.";
  }catch(err){if(preview)preview.textContent="Cannot preview: "+(err?.message||"Invalid payroll");if(feedback)feedback.textContent=err?.message||"Invalid payroll";}
};
window.processInstitutionPayroll = async function(){
  const feedback=document.getElementById("payroll-feedback"), buttons=document.querySelectorAll('#main-content button[onclick="processInstitutionPayroll()"]');
  try{
    if(!db)throw new Error("Database connection is not ready.");
    const d=window.getInstitutionPayrollDraft();
    if(!window.confirm("POST payroll "+d.reference+"?\nEmployees: "+d.items.length+"\nGross debit: UGX "+d.gross.toLocaleString("en-UG")+"\nCommission income: UGX "+d.commission.toLocaleString("en-UG")+"\nEmployee accounts credited: UGX "+d.net.toLocaleString("en-UG")+"\n\nThis action changes account balances and cannot be undone from this screen."))return;
    buttons.forEach(b=>{b.disabled=true;b.textContent="Posting payroll…";});
    if(feedback)feedback.textContent="Submitting the complete payroll for atomic posting…";
    const source=window.payrollAccounts.find(a=>a.id===d.source);
    if(!source)throw new Error("Please reload the account list and select the institution account again.");
    const {data,error}=await db.rpc("process_institution_payroll",{p_branch_id:source.branch_id,p_institution_account_id:d.source,p_payroll_reference:d.reference,p_payroll_date:d.date,p_items:d.items});
    if(error)throw error;
    const result=data||{};
    window.lastInstitutionPayrollResult=result;
    const evidenceBatch=document.getElementById("payroll-evidence-batch");if(evidenceBatch)evidenceBatch.value=result.batch_id||"";
    const summary="ZIVAMUNTUYO FINANCIAL SERVICES LTD\nINSTITUTIONAL PAYROLL RECEIPT\nReference: "+result.payroll_reference+"\nDate: "+result.payroll_date+"\nBatch: "+result.batch_id+"\nEmployees paid: "+result.employee_count+"\nGross payroll: UGX "+Number(result.gross_total).toLocaleString("en-UG")+"\nCommission (UGX 1,000 each): UGX "+Number(result.commission_total).toLocaleString("en-UG")+"\nTotal credited to employee accounts: UGX "+Number(result.net_total).toLocaleString("en-UG")+"\nStatus: POSTED\nGeneral ledger journal: "+result.journal_id;
    const receipt=document.getElementById("payroll-receipt");if(receipt){receipt.textContent=summary;receipt.dataset.summary=summary;}
    const preview=document.getElementById("payroll-preview");if(preview)preview.textContent=summary;
    if(feedback)feedback.textContent="Payroll successfully posted. Employee accounts have been credited and commission income recorded. Print the payroll summary for the institution.";
    const rows=document.getElementById("payroll-rows");if(rows)rows.value="";
    await window.loadInstitutionPayrollAccounts();
  }catch(err){if(feedback)feedback.textContent="Payroll was not confirmed: "+(err?.message||"Unexpected error");}
  finally{buttons.forEach(b=>{b.disabled=false;b.textContent="Confirm & pay salaries";});}
};
window.printInstitutionPayrollReceipt = function(){
  const receipt=document.getElementById("payroll-receipt"), summary=receipt?.dataset.summary||"";
  if(!summary){alert("Post a payroll first. No receipt is available to print.");return;}
  const win=window.open("","_blank","width=800,height=700");
  if(!win){alert("Allow pop-ups to print the payroll receipt.");return;}
  win.document.write("<!doctype html><html><head><title>Institutional Payroll Receipt</title><style>body{font:14px Arial,sans-serif;padding:24px;color:#111}pre{white-space:pre-wrap;font:14px monospace;line-height:1.6}.stamp{border:2px solid #16764a;padding:8px;display:inline-block;font-weight:bold}</style></head><body><div class='stamp'>POSTED · UGX</div><pre>"+summary.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")+"</pre><p>Keep this receipt with the institution payroll records.</p><script>window.onload=function(){window.print();};<\/script></body></html>");
  win.document.close();
};

window.printAccountOpeningReceipt = function(){
  const r=window.lastAccountOpeningReceipt;
  if(!r||!r.receipt_number||r.collection_status!=="received"||!(Number(r.amount)>0)){
    alert("No server-confirmed account-opening payment receipt is available. Do not print a paid receipt without a recorded collection.");
    return;
  }
  const money=value=>"UGX "+Number(value||0).toLocaleString("en-UG",{minimumFractionDigits:0,maximumFractionDigits:2});
  const total=Number(r.amount),shares=Number(r.share_amount||0),reserve=Number(r.security_reserve||0),costs=Number(r.bundled_opening_costs||0);
  const allocated=shares+reserve+costs;
  const body="ZIVAMUNTUYO FINANCIAL SERVICES LTD\nACCOUNT OPENING PACKAGE RECEIPT\nReceipt No: "+r.receipt_number+"\nAccount No: "+r.account_number+"\nDate: "+r.date+"\n\nTOTAL RECEIVED: "+money(total)+"\n\nSERVER-RECORDED ALLOCATION\nShare capital: "+money(shares)+" ("+Number(r.shares_issued||0)+" share(s))\nRestricted security reserve: "+money(reserve)+"\nBundled opening costs: "+money(costs)+"\n\nTOTAL ALLOCATED: "+money(allocated)+"\nAllocation difference: "+money(total-allocated)+"\n\nReceipt generated from the server-confirmed collection record. Keep it with the teller's daily reconciliation.";
  const win=window.open("","_blank","width=700,height=650");
  if(!win){alert("Allow pop-ups to print the receipt.");return;}
  win.document.write("<!doctype html><html><head><title>Account Opening Receipt</title><style>body{font:14px Arial,sans-serif;padding:24px;color:#111}pre{white-space:pre-wrap;font:14px monospace;line-height:1.6}.stamp{border:2px solid #16764a;padding:8px;display:inline-block;font-weight:bold}</style></head><body><div class='stamp'>PAID · "+money(total)+"</div><pre>"+body.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")+"</pre><script>window.onload=function(){window.print();};<\/script></body></html>");
  win.document.close();
};


window.printDormantReactivationReceipt = function(){
 const r=window.lastDormantReceipt;
 if(!r){alert("Reactivate an account first to print its receipt.");return;}
 const body="ZIVAMUNTUYO FINANCIAL SERVICES LTD\nDORMANT ACCOUNT REACTIVATION RECEIPT\nDate: "+r.date+"\nAccount: "+r.account_number+"\nReceipt/reference: "+r.receipt_reference+"\nTransaction reference: "+r.transaction_reference+"\nPayment method: "+(r.payment_method==="cash"?"Cash paid to teller":"Deducted from account balance")+"\n\nREACTIVATION FEE RECEIVED: UGX "+Number(r.fee_amount).toLocaleString("en-UG")+"\n\nAccounting: fee credited to bank income.\nStatus: PAID · ACCOUNT REACTIVATED\nKeep this receipt for your records.";
 const w=window.open("","_blank","width=600,height=600");if(!w){alert("Allow pop-ups to print the receipt.");return;}
 w.document.write("<!doctype html><html><head><title>Dormant Account Reactivation Receipt</title><style>body{font:13px monospace;padding:18px;color:#111}pre{white-space:pre-wrap;line-height:1.55}.stamp{border:2px solid #16764a;padding:7px;display:inline-block;font-weight:bold}</style></head><body><div class='stamp'>PAID · UGX 22,000</div><pre>"+body.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")+"</pre><script>window.onload=function(){window.print();};<\/script></body></html>");w.document.close();
};

window.loadDormantBranchOptions = async function(){
  if(!db)return;
  const select=document.getElementById("dormant-branch"); if(!select)return;
  const {data,error}=await db.from("branches").select("id,branch_name,branch_code").eq("is_active",true).order("branch_name");
  if(error){select.innerHTML='<option value="">Branch list unavailable</option>';return;}
  select.innerHTML='<option value="">All authorized branches</option>'+(data||[]).map(b=>'<option value="'+esc(b.id)+'">'+esc(b.branch_name)+' ('+esc(b.branch_code)+')</option>').join("");
};
window.loadDormantAccountList = async function(){
  const el=document.getElementById("dormant-account-list"); if(!el)return;
  if(!db){el.innerHTML='<p class="muted">Database connection is unavailable.</p>';return;}
  el.innerHTML='<p class="muted">Loading dormant accounts…</p>';
  const branch=document.getElementById("dormant-branch")?.value||"";
  let q=db.from("bank_accounts").select("id,account_number,branch_id,balance,currency_code,status,opened_at,created_at").eq("status","dormant").order("account_number").limit(500);
  if(branch)q=q.eq("branch_id",branch);
  const {data,error}=await q;
  if(error){el.innerHTML='<p class="muted">Dormant account list could not be loaded. Check branch permissions and account visibility. '+esc(error.message)+'</p>';return;}
  if(!data||!data.length){el.innerHTML='<p class="muted">No dormant accounts in the selected scope. Run the dormancy review to identify accounts reaching 18 months without a posted transaction.</p>';return;}
  el.innerHTML=data.map(a=>'<article class="loan-application-card dormant-account-card"><div class="loan-card-top"><div><strong>Account '+esc(a.account_number||"Number unavailable")+'</strong><p>Balance: UGX '+Number(a.balance||0).toLocaleString("en-UG")+' · Last opened: '+esc((a.opened_at||a.created_at||"").slice(0,10))+'</p><p class="muted">Account ID: '+esc(a.id)+'</p></div><span class="loan-status">Dormant</span></div><div class="form-grid"><label>Payment method<select id="dormant-method-'+esc(a.id)+'"><option value="cash">Cash paid to teller</option><option value="account_balance">Deduct from account balance</option></select></label><label>Receipt / payment reference<input id="dormant-receipt-'+esc(a.id)+'" minlength="4" maxlength="100" placeholder="Enter unique receipt ref" required></label></div><p class="muted">Reactivation fee: <strong>UGX 22,000</strong> · posted to bank income.</p><button type="button" class="primary" onclick="reactivateDormantAccount(\''+esc(a.id)+'\')">Collect fee &amp; reactivate</button></article>').join("");
};
window.refreshDormantAccountReview = async function(){
  const feedback=document.getElementById("dormant-review-feedback");
  const branch=document.getElementById("dormant-branch")?.value||null;
  try{
    if(!db)throw new Error("Database connection is not ready.");
    if(!window.confirm("Run the 18-month dormancy review? Eligible active accounts will be marked dormant. No reactivation fees will be charged by this review."))return;
    if(feedback)feedback.textContent="Checking posted transaction history…";
    const {data,error}=await db.rpc("refresh_dormant_accounts",{p_branch_id:branch});
    if(error)throw error;
    if(feedback)feedback.textContent=Number(data?.accounts_marked_dormant||0)+" account(s) marked dormant. The 18-month rule was applied; no fees were collected.";
    await window.loadDormantAccountList();
  }catch(err){if(feedback)feedback.textContent="Dormancy review failed: "+(err?.message||"Unexpected error");}
};
window.reactivateDormantAccount = async function(accountId){
  const feedback=document.getElementById("dormant-review-feedback");
  const method=document.getElementById("dormant-method-"+accountId)?.value||"cash";
  const receipt=document.getElementById("dormant-receipt-"+accountId)?.value?.trim()||"";
  if(receipt.length<4){alert("Enter a unique receipt/reference of at least 4 characters.");return;}
  if(!window.confirm("Confirm UGX 22,000 dormant-account reactivation fee?\nPayment method: "+(method==="cash"?"Cash paid to teller":"Deduct from account balance")+"\nThe fee will be posted to bank income and the account will be reactivated."))return;
  try{
    const {data,error}=await db.rpc("reactivate_dormant_account",{p_account_id:accountId,p_payment_method:method,p_receipt_reference:receipt});
    if(error)throw error;
    window.lastDormantReceipt={account_number:data?.account_number||"",fee_amount:22000,payment_method:method,receipt_reference:data?.receipt_reference||receipt,transaction_reference:data?.transaction_reference||"",date:new Date().toLocaleString("en-UG")}; if(feedback)feedback.innerHTML="Account "+esc(data?.account_number||"")+" reactivated. UGX 22,000 fee posted to bank income. Receipt reference: "+esc(data?.receipt_reference||receipt)+". <button type=\"button\" class=\"secondary\" onclick=\"printDormantReactivationReceipt()\">Print receipt</button>";
    await window.loadDormantAccountList();
  }catch(err){if(feedback)feedback.textContent="Reactivation failed: "+(err?.message||"Unexpected error");}
};

let appNavigationInitialized = false;
let authenticatedUiVisible = false;
let pendingBranchOpen = null;
let activeBranchContext = null;
let bankWideLoginRequested = false;

function showLoginScreen(message) {
  authenticatedUiVisible = false;
  const login = document.getElementById("login-screen");
  const nav = document.querySelector(".nav-bar");
  const main = document.getElementById("main-content");
  const footer = document.querySelector(".footer");
  const signOut = document.getElementById("sign-out-button");
  if (login) login.hidden = false;
  if (nav) nav.hidden = true;
  if (main) main.hidden = true;
  if (footer) footer.hidden = true;
  if (signOut) signOut.hidden = true;
  const user = document.getElementById("signed-in-user");
  if (user) user.textContent = "Signed out";
  const feedback = document.getElementById("login-feedback");
  if (feedback && message) feedback.textContent = message;
  const branchDirectory = document.getElementById("branch-entry-directory");
  const loginCard = document.getElementById("staff-login-card");
  const showLogin = Boolean(pendingBranchOpen || bankWideLoginRequested);
  if (branchDirectory) branchDirectory.hidden = showLogin;
  if (loginCard) loginCard.hidden = !showLogin;
  const branchFeedback = document.getElementById("branch-entry-feedback");
  if (branchFeedback && message && !showLogin) branchFeedback.textContent = message;
}

function showAuthenticatedWorkspace() {
  const login = document.getElementById("login-screen");
  const nav = document.querySelector(".nav-bar");
  const main = document.getElementById("main-content");
  const footer = document.querySelector(".footer");
  const signOut = document.getElementById("sign-out-button");
  if (login) login.hidden = true;
  if (nav) nav.hidden = false;
  if (main) main.hidden = false;
  if (footer) footer.hidden = false;
  if (signOut) signOut.hidden = false;
  if (authenticatedUiVisible) return;
  authenticatedUiVisible = true;
  if (!appNavigationInitialized) {
    document.querySelectorAll('.nav').forEach(btn => {
      btn.addEventListener('click', (e) => window.switchPage(e.currentTarget.dataset.page));
    });
    appNavigationInitialized = true;
  }
  loadCurrentEmployeeGreeting();
  window.switchPage("Dashboard");
  if (activeBranchContext) {
    const existingBanner = document.getElementById("branch-context-banner");
    if (existingBanner) existingBanner.remove();
    const banner = document.createElement("div");
    banner.id = "branch-context-banner";
    banner.className = "branch-context-banner";
    banner.style.cssText = "padding:10px 16px;margin:0 0 12px;border:1px solid var(--line);border-radius:12px;background:var(--surface,#fff);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap";
    const label = document.createElement("div");
    label.textContent = "BRANCH WORKSPACE · " + activeBranchContext.name;
    label.style.fontWeight = "700";
    const exit = document.createElement("button");
    exit.type = "button"; exit.className = "secondary"; exit.textContent = "Return to branch directory";
    exit.addEventListener("click", () => { activeBranchContext = null; banner.remove(); window.switchPage("Branches"); });
    banner.append(label, exit);
    const navBar = document.querySelector(".nav-bar");
    if (navBar && navBar.parentNode) navBar.parentNode.insertBefore(banner, navBar);
  }
  setTimeout(setWelcomeMessage,100);
}


window.loadApprovalLimitSettings = async function() {
  const panel=document.getElementById("approval-limit-admin-panel");
  if(!panel || !db) return;
  try {
    const roleResult=await db.rpc("current_employee_role_code");
    if(roleResult.error || !["system_admin","general_manager"].includes(roleResult.data)) { panel.hidden=true; return; }
    panel.hidden=false;
    const results=await Promise.all([
      db.from("branches").select("id,branch_name").eq("is_active",true).order("branch_name"),
      db.from("role_approval_limits").select("role_code,action_type,currency_code,branch_id,max_amount,is_unlimited,is_active,updated_at").order("role_code").order("action_type")
    ]);
    if(results[0].error) throw results[0].error;
    if(results[1].error) throw results[1].error;
    const branches=results[0].data||[], rows=results[1].data||[];
    const branchSelect=document.getElementById("approval-limit-branch");
    if(branchSelect) {
      const selected=branchSelect.value;
      branchSelect.innerHTML='<option value="">All branches (default)</option>'+branches.map(b=>'<option value="'+esc(b.id)+'">'+esc(b.branch_name)+'</option>').join("");
      if(selected) branchSelect.value=selected;
    }
    const table=document.getElementById("approval-limit-table");
    if(table) table.innerHTML=rows.length?'<div class="table-wrap"><table><thead><tr><th>Role</th><th>Action</th><th>Scope</th><th>Limit</th><th>Status</th></tr></thead><tbody>'+rows.map(x=>{
      const branch=branches.find(b=>b.id===x.branch_id);
      const amount=x.is_unlimited?"Unlimited":("UGX "+Number(x.max_amount||0).toLocaleString("en-UG"));
      return '<tr><td>'+esc(x.role_code)+'</td><td>'+esc(x.action_type.replace(/_/g," "))+'</td><td>'+esc(branch?branch.branch_name:"All branches")+'</td><td>'+esc(amount)+'</td><td>'+(x.is_active?"Active":"Inactive")+'</td></tr>';
    }).join("")+'</tbody></table></div>':'<p class="muted">No approval limits are configured.</p>';
  } catch(error) {
    const feedback=document.getElementById("approval-limit-feedback");
    if(feedback) feedback.textContent="Approval policy could not be loaded: "+(error?.message||"Unexpected error");
  }
};

window.saveApprovalLimitSettings = async function(event) {
  event.preventDefault();
  const feedback=document.getElementById("approval-limit-feedback");
  const button=event.currentTarget.querySelector('button[type="submit"]');
  const unlimited=Boolean(document.getElementById("approval-limit-unlimited")?.checked);
  const amountText=document.getElementById("approval-limit-amount")?.value||"";
  const amount=unlimited?null:Number(amountText);
  if(!unlimited && (!amountText || !Number.isFinite(amount) || amount<0)) { if(feedback)feedback.textContent="Enter a valid maximum amount or select unlimited authority."; return; }
  try {
    if(!db) throw new Error("Database connection is unavailable.");
    if(button){button.disabled=true;button.textContent="Saving policy…";}
    const {error}=await db.rpc("set_role_approval_limit",{
      p_role_code:document.getElementById("approval-limit-role").value,
      p_action_type:document.getElementById("approval-limit-action").value,
      p_currency_code:document.getElementById("approval-limit-currency").value,
      p_branch_id:document.getElementById("approval-limit-branch").value||null,
      p_max_amount:amount,
      p_is_unlimited:unlimited,
      p_reason:document.getElementById("approval-limit-reason").value.trim()
    });
    if(error) throw error;
    if(feedback) feedback.textContent="Approval policy saved and audited.";
    document.getElementById("approval-limit-reason").value="";
    await window.loadApprovalLimitSettings();
  } catch(error) {
    if(feedback) feedback.textContent="Policy was not saved: "+(error?.message||"Unexpected error");
  } finally {
    if(button){button.disabled=false;button.textContent="Save approval policy";}
  }
};

window.openBranchWorkspace = function(branchId, branchName) {
  if (!branchId || !branchName) return;
  pendingBranchOpen = { id: branchId, name: branchName };
  bankWideLoginRequested = false;
  activeBranchContext = null;
  showLoginScreen("Sign in with your staff email and password to open " + branchName + ".");
  const email = document.getElementById("login-email");
  if (email) email.focus();
};

window.openBankWideStaffLogin = function() {
  pendingBranchOpen = null;
  bankWideLoginRequested = true;
  showLoginScreen("Bank-wide sign-in is for staff whose role permits central administration.");
  const email = document.getElementById("login-email");
  if (email) email.focus();
};

window.returnToBranchDirectory = function() {
  pendingBranchOpen = null;
  bankWideLoginRequested = false;
  showLoginScreen("");
};

window.loadPublicBranchDirectory = async function() {
  const list = document.getElementById("branch-entry-list");
  const feedback = document.getElementById("branch-entry-feedback");
  if (!list) return;
  try {
    if (!db) throw new Error("Secure database connection is unavailable.");
    const { data, error } = await db.from("branch_directory_public")
      .select("id,branch_code,branch_name,is_head_office")
      .order("is_head_office", { ascending: false })
      .order("branch_name", { ascending: true });
    if (error) throw error;
    list.replaceChildren();
    if (!data || !data.length) {
      list.textContent = "No active branches are published. Contact the system administrator.";
      return;
    }
    data.forEach(branch => {
      const row = document.createElement("div");
      row.className = "list-item branch-entry-row";
      const info = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = branch.branch_name + " (" + branch.branch_code + ")";
      const type = document.createElement("div");
      type.className = "muted";
      type.textContent = branch.is_head_office ? "Main Branch · Head Office" : "Branch office";
      info.append(name, type);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "primary";
      button.textContent = "Open";
      button.addEventListener("click", () => window.openBranchWorkspace(branch.id, branch.branch_name));
      row.append(info, button);
      list.append(row);
    });
    if (feedback) feedback.textContent = "";
  } catch (error) {
    list.textContent = "Branch directory could not be loaded. Check your connection or contact the system administrator.";
    if (feedback) feedback.textContent = error?.message || "Could not load branch directory.";
  }
};

async function handleStaffLogin(event) {
  event.preventDefault();
  const form = document.getElementById("login-form");
  const feedback = document.getElementById("login-feedback");
  const button = document.getElementById("login-submit");
  if (!db) { if (feedback) feedback.textContent = "Secure database connection is unavailable. Contact the system administrator."; return; }
  const email = document.getElementById("login-email")?.value?.trim() || "";
  const password = document.getElementById("login-password")?.value || "";
  if (!email || !password) { if (feedback) feedback.textContent = "Enter both your staff email and password."; return; }
  if (button) { button.disabled = true; button.textContent = "Signing in…"; }
  if (feedback) feedback.textContent = "Verifying your staff account…";
  try {
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data?.session) throw new Error("Sign-in was not completed. Please try again.");
    if (pendingBranchOpen) {
      const requestedBranch = pendingBranchOpen;
      const { data: allowed, error: accessError } = await db.rpc("current_employee_can_transact_in_branch", { target_branch_id: requestedBranch.id });
      if (accessError) throw accessError;
      if (allowed !== true) {
        await db.auth.signOut();
        throw new Error("Your staff account is not authorized to open " + requestedBranch.name + ". Contact the system administrator if you need access.");
      }
      activeBranchContext = requestedBranch;
      pendingBranchOpen = null;
      showAuthenticatedWorkspace();
    }
    if (feedback) feedback.textContent = "";
  } catch (error) {
    if (feedback) feedback.textContent = "Sign-in failed. Check your email and password, or contact your bank administrator. " + (error?.message || "");
  } finally {
    if (button) { button.disabled = false; button.textContent = "Sign in securely"; }
  }
}

async function handleStaffSignOut() {
  if (!db) return;
  pendingBranchOpen = null;
  activeBranchContext = null;
  bankWideLoginRequested = false;
  document.getElementById("branch-context-banner")?.remove();
  const button = document.getElementById("sign-out-button");
  if (button) button.disabled = true;
  try {
    const { error } = await db.auth.signOut();
    if (error) throw error;
    showLoginScreen("You have signed out.");
  } catch (error) {
    alert("Sign-out failed. Please retry: " + (error?.message || "Unexpected error"));
  } finally {
    if (button) button.disabled = false;
  }
}

function initApp() {
  initAppearanceControls();
  const loginForm = document.getElementById("login-form");
  if (loginForm) loginForm.addEventListener("submit", handleStaffLogin);
  document.getElementById("bank-wide-login-button")?.addEventListener("click", window.openBankWideStaffLogin);
  document.getElementById("back-to-branch-directory")?.addEventListener("click", window.returnToBranchDirectory);
  const signOutButton = document.getElementById("sign-out-button");
  if (signOutButton) signOutButton.addEventListener("click", handleStaffSignOut);
  if (!db) { showLoginScreen("Secure database connection is unavailable. Contact the system administrator."); return; }
  showLoginScreen("");
  window.loadPublicBranchDirectory();
  db.auth.getSession().then(({ data, error }) => {
    if (error) showLoginScreen("Could not verify the saved session. Please sign in again.");
    else if (data?.session) showAuthenticatedWorkspace();
    else showLoginScreen("");
  }).catch(() => showLoginScreen("Could not verify the saved session. Please sign in again."));
  db.auth.onAuthStateChange((event, session) => {
    if (session && !pendingBranchOpen) showAuthenticatedWorkspace();
    else if (event === "SIGNED_OUT") showLoginScreen("You have signed out.");
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}


window.attachInstitutionPayrollEvidence = async function(){
 const feedback=document.getElementById("payroll-evidence-feedback");
 const batchId=document.getElementById("payroll-evidence-batch")?.value?.trim()||"";
 const listFile=document.getElementById("payroll-evidence-list")?.files?.[0];
 const slipFile=document.getElementById("payroll-evidence-slip")?.files?.[0];
 const confirmed=document.getElementById("payroll-signers-confirmed")?.checked;
 try{
  if(!db)throw new Error("Database connection is not ready.");
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(batchId))throw new Error("Post a payroll first or enter a valid payroll batch ID.");
  if(!listFile||!slipFile)throw new Error("Choose both the signed payroll list and signed withdrawal slip scans.");
  const allowed=["application/pdf","image/jpeg","image/png"];
  for(const file of [listFile,slipFile]){if(!allowed.includes(file.type))throw new Error("Only PDF, JPG and PNG scans are allowed.");if(file.size>15*1024*1024)throw new Error("Each scan must be 15 MB or smaller.");}
  if(!confirmed)throw new Error("Confirm that the listed leaders signed the physical documents.");
  const signers=[];
  for(let i=1;i<=3;i++){
   const name=document.getElementById("payroll-signer-"+i+"-name")?.value?.trim()||"";
   const role=document.getElementById("payroll-signer-"+i+"-role")?.value?.trim()||"";
   if(i<=2&&(!name||!role))throw new Error("Enter names and positions for at least two signers.");
   if(name||role){if(!name||!role)throw new Error("Complete both the name and position for each optional signer.");signers.push({name,role,signed:true});}
  }
  if(signers.length<2||signers.length>3)throw new Error("Provide two or three signers.");
  const ext=f=>f.name.toLowerCase().endsWith(".pdf")?"pdf":f.name.toLowerCase().endsWith(".png")?"png":f.name.toLowerCase().endsWith(".jpeg")?"jpeg":"jpg";
  const listPath="institution-payroll/"+batchId+"/payroll-list."+ext(listFile);
  const slipPath="institution-payroll/"+batchId+"/withdrawal-slip."+ext(slipFile);
  if(feedback)feedback.textContent="Uploading private payroll scans…";
  const bucket=db.storage.from("institution-payroll-evidence");
  const up1=await bucket.upload(listPath,listFile,{upsert:true,contentType:listFile.type});if(up1.error)throw up1.error;
  const up2=await bucket.upload(slipPath,slipFile,{upsert:true,contentType:slipFile.type});if(up2.error)throw up2.error;
  const {data,error}=await db.rpc("attach_institution_payroll_evidence",{p_batch_id:batchId,p_payroll_list_object_path:listPath,p_withdrawal_slip_object_path:slipPath,p_signers:signers});
  if(error)throw error;
  if(feedback)feedback.textContent="Both signed scans are archived privately with payroll batch "+batchId+". Signers recorded: "+(data?.signer_count||signers.length)+". Access is restricted by branch permissions.";
 }catch(err){if(feedback)feedback.textContent="Evidence was not fully archived: "+(err?.message||"Unexpected error")+". If one scan uploaded, retrying is safe; the same object paths are reused."}
};


// Excel-style customer and account registers. Data comes only from the signed-in user's authorized database queries.
window.customerRegisterRows = window.customerRegisterRows || [];
window.accountRegisterRows = window.accountRegisterRows || [];
window.accountRegisterCustomers = window.accountRegisterCustomers || [];
window.accountRegisterBranches = window.accountRegisterBranches || [];

window.registerCsvCell = function(value) {
  let textValue = value === null || value === undefined ? "" : String(value);
  // Prevent spreadsheet formula execution when exporting user-controlled values.
  if (/^[\\s]*[=+@-]/.test(textValue)) textValue = "'" + textValue;
  return '"' + textValue.replace(/"/g, '""') + '"';
};
window.downloadRegisterCsv = function(filename, headers, rows) {
  const csv = [headers, ...rows].map(row => row.map(window.registerCsvCell).join(",")).join("\\r\\n");
  const blob = new Blob(["\\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = filename; link.style.display = "none";
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
window.customerRegisterView = function() {
  const q=(document.getElementById("customer-register-search")?.value||"").trim().toLowerCase();
  const status=(document.getElementById("customer-register-status")?.value||"").toLowerCase();
  return (window.customerRegisterRows||[]).filter(c=>{
    const active=c.is_active===false||String(c.status||"").toLowerCase()==="inactive"?"inactive":"active";
    const fields=[c.full_name,c.customer_number,c.nin_or_passport,c.phone_number,c.email,c.address,c.status].join(" ").toLowerCase();
    return (!q||fields.includes(q))&&(!status||active===status);
  });
};
window.filterCustomerRegister = function() {
  const target=document.getElementById("cust-list");if(!target)return;
  const rows=window.customerRegisterView();
  const count=document.getElementById("customer-register-count");
  if(count)count.textContent=rows.length+" of "+(window.customerRegisterRows||[]).length+" member record(s)";
  if(!rows.length){target.innerHTML='<p class="muted">No member records match the current search or filter.</p>';return;}
  target.innerHTML='<table class="data-table register-data-table"><thead><tr><th>Member / legal name</th><th>CIF number</th><th>NIN / Passport</th><th>Phone</th><th>Email</th><th>Address</th><th>Status</th><th>Registered</th></tr></thead><tbody>'+rows.map(c=>{
    const status=c.is_active===false||String(c.status||"").toLowerCase()==="inactive"?"Inactive":esc(c.status||"Active / registered");
    return '<tr><td>'+esc(c.full_name||"—")+'</td><td>'+esc(c.customer_number||"—")+'</td><td>'+esc(c.nin_or_passport||"—")+'</td><td>'+esc(c.phone_number||"—")+'</td><td>'+esc(c.email||"—")+'</td><td>'+esc(c.address||"—")+'</td><td><span class="badge-role">'+status+'</span></td><td>'+esc(c.created_at?new Date(c.created_at).toLocaleDateString():"—")+'</td></tr>';
  }).join("")+'</tbody></table>';
};
window.exportCustomerRegister = function() {
  const rows=window.customerRegisterView();
  if(!rows.length){alert("There are no member rows to export.");return;}
  if(!window.confirm("Export "+rows.length+" member record(s), including confidential identification and contact information, to a CSV file that opens in Excel? Store it securely."))return;
  window.downloadRegisterCsv("zivamuntuyo-members-"+new Date().toISOString().slice(0,10)+".csv",["Member name","CIF number","NIN or passport","Phone","Email","Address","Status","Registered"],rows.map(c=>[c.full_name,c.customer_number,c.nin_or_passport,c.phone_number,c.email,c.address,c.status||(c.is_active===false?"Inactive":"Active / registered"),c.created_at]));
};
window.accountRegisterView = function() {
  const q=(document.getElementById("account-register-search")?.value||"").trim().toLowerCase();
  const status=(document.getElementById("account-register-status")?.value||"").toLowerCase();
  const customers=window.accountRegisterCustomers||[],branches=window.accountRegisterBranches||[];
  return (window.accountRegisterRows||[]).map(a=>{
    const customer=customers.find(c=>String(c.id)===String(a.customer_id||a.customer_uuid))||null;
    const branch=branches.find(b=>String(b.id)===String(a.branch_id))||null;
    return {...a,_member:customer?.full_name||a.customer_name||a.full_name||"Not linked in register",_cif:customer?.customer_number||a.customer_number||"",_phone:customer?.phone_number||a.phone_number||"",_email:customer?.email||a.email||"",_address:customer?.address||a.address||"",_branch:branch?.branch_name||a.branch_name||a.branch_id||"Not assigned"};
  }).filter(a=>{
    const st=String(a.account_status||a.status||"unknown").toLowerCase();
    const search=[a.account_number,a._member,a._cif,a._phone,a._email,a._address,a._branch,a.account_type,a.product_type,a.currency_code,a.account_status].join(" ").toLowerCase();
    return (!q||search.includes(q))&&(!status||st===status||((status==="active")&&st==="open"));
  });
};
window.filterAccountRegister = function() {
  const target=document.getElementById("acc-list");if(!target)return;
  const rows=window.accountRegisterView();
  const count=document.getElementById("account-register-count");
  if(count)count.textContent=rows.length+" of "+(window.accountRegisterRows||[]).length+" account record(s)";
  if(!rows.length){target.innerHTML='<p class="muted">No accounts match this search/filter, or no accounts are visible under your permissions.</p>';return;}
  const fmt=v=>v===null||v===undefined||v===""?"Unavailable":Number.isFinite(Number(v))?Number(v).toLocaleString("en-UG",{minimumFractionDigits:2,maximumFractionDigits:2}):"Unavailable";
  target.innerHTML='<table class="data-table register-data-table"><thead><tr><th>Account number</th><th>Member</th><th>CIF</th><th>Phone</th><th>Address</th><th>Branch</th><th>Product</th><th>Currency</th><th>Stored balance</th><th>Posted-ledger balance</th><th>Reconciliation difference</th><th>Status</th></tr></thead><tbody>'+rows.map(a=>{
    const stored=Number(a.stored_balance),ledger=a.ledger_balance===null||a.ledger_balance===undefined?null:Number(a.ledger_balance);
    const diff=(!a.ledger_configured||ledger===null||!Number.isFinite(ledger)||!Number.isFinite(stored))?"Not configured":fmt(stored-ledger);
    return '<tr><td>'+esc(a.account_number||"Unavailable")+'</td><td>'+esc(a._member)+'</td><td>'+esc(a._cif||"—")+'</td><td>'+esc(a._phone||"—")+'</td><td>'+esc(a._address||"—")+'</td><td>'+esc(a._branch)+'</td><td>'+esc(a.product_type||a.account_type||a.account_type_name||"—")+'</td><td>'+esc(a.currency_code||"UGX")+'</td><td>'+fmt(a.stored_balance)+'</td><td>'+fmt(a.ledger_balance)+'</td><td>'+diff+'</td><td><span class="badge-role">'+esc(a.account_status||a.status||"unknown")+'</span></td></tr>';
  }).join("")+'</tbody></table>';
};
window.exportAccountRegister = function() {
  const rows=window.accountRegisterView();
  if(!rows.length){alert("There are no account rows to export.");return;}
  if(!window.confirm("Export "+rows.length+" account record(s), including customer contact/address details and balances, to an Excel-compatible CSV? Store it securely."))return;
  const fmt=v=>v===null||v===undefined?"":v;
  window.downloadRegisterCsv("zivamuntuyo-accounts-"+new Date().toISOString().slice(0,10)+".csv",["Account number","Member name","CIF number","Phone","Email","Address","Branch","Product","Currency","Stored balance","Posted-ledger balance","Account status","Account UUID","Branch UUID"],rows.map(a=>[a.account_number,a._member,a._cif,a._phone,a._email,a._address,a._branch,a.product_type||a.account_type||a.account_type_name,a.currency_code,fmt(a.stored_balance),fmt(a.ledger_balance),a.account_status||a.status,a.account_id,a.branch_id]));
};
