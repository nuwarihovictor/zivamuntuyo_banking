const SUPABASE_URL="https://hwghiezvghdqxnhcnpwk.supabase.co";
const SUPABASE_ANON_KEY="sb_publishable_uRGcpKo1-033QnltdseN7A_Kl2LFRBa";
const db=window.supabase?.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);

const pages=["Overview","Customers","Accounts","Transactions","Loans","Accounting","Reports","Staff Attendance","Staff Messages","Settings"];
let user=null,profile=null;
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>\"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

if($("year"))$("year").textContent=new Date().getFullYear();
if($("nav"))$("nav").innerHTML=pages.map((p,i)=>`<button class="nav ${i===0?"active":""}" data-page="${p}">${["◈","♙","▣","⇄","▤","▦","▥","◷","✉","⚙"][i]} &nbsp;${p}</button>`).join("");

function notify(t){const el=$("toast");if(!el)return;el.textContent=t;el.style.display="block";setTimeout(()=>el.style.display="none",3000)}
function panel(tag,title,desc,body){return `<section class="panel">${tag?`<span class="category-tag">${tag}</span>`:""}<h2>${title}</h2>${desc?`<p class="panel-desc">${desc}</p>`:""}${body}</section>`}

async function loadProfile(){
  try {
    const {data}=await db.from("employee_profiles").select("full_name,home_branch_id,is_active").eq("user_id",user.id).maybeSingle();
    profile=data;
  } catch(e){}
}

function workspace(){
  $("login")?.classList.add("hidden");
  $("workspace")?.classList.remove("hidden");
  $("signout")?.classList.remove("hidden");
}

async function go(page){
  if($("title"))$("title").textContent=page;
  document.querySelectorAll(".nav").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  const c=$("content");if(!c)return;
  
  if(page==="Overview"){
    c.innerHTML=`
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px;">
        <div>
          <h2 style="font-size:24px; font-weight:800;">Welcome, ${esc(profile?.full_name||"NSHEMEREIRWE HERBERT")}</h2>
          <p class="panel-desc">Your staff workspace</p>
        </div>
        <div style="display:flex; gap:8px;">
          <span class="badge-role">System Administrator</span>
          <button class="secondary" onclick="$('signout').click()">Sign out</button>
        </div>
      </div>

      <div class="grid-2">
        <div class="metric-card"><span class="category-tag">ACCESSIBLE BRANCHES</span><div class="metric-val">4</div><div class="metric-sub">Accessible branches</div></div>
        <div class="metric-card"><span class="category-tag">ACTIVE ACCOUNTS</span><div class="metric-val">0</div><div class="metric-sub">Active accounts</div></div>
        <div class="metric-card"><span class="category-tag">PENDING REQUESTS</span><div class="metric-val">0</div><div class="metric-sub">Pending cash requests</div></div>
        <div class="metric-card"><span class="category-tag">NET POSTED FLOW</span><div class="metric-val">0</div><div class="metric-sub">Net posted deposits minus withdrawals (reporting total)</div></div>
      </div>

      ${panel("GETTING STARTED", "System setup checklist", "", `
        <div class="list-item"><span>✓ Cloud database project created</span></div>
        <div class="list-item"><span>✓ Staff profile saved and verified in SQL</span></div>
        <div class="list-item"><span style="color:#9e7a44;">⟳ Security policies and permissions need review</span></div>
        <div class="list-item"><span style="color:#9e7a44;">⟳ Double-entry ledger and approvals not enabled</span></div>
      `)}

      ${panel("BRANCH NETWORK", "Operating locations", "", `
        <div class="list-item"><strong>Butare</strong> <span class="muted">Main Branch · Head Office</span></div>
        <div class="list-item"><strong>Rubirizi</strong> <span class="muted">Uganda</span></div>
        <div class="list-item"><strong>Buhweju</strong> <span class="muted">Uganda</span></div>
        <div class="list-item"><strong>Ntungamo</strong> <span class="muted">Uganda</span></div>
      `)}

      <div class="notice-box">
        <strong>Live banking is not enabled.</strong> This initial shell only provides sign-in and staff-profile verification. Customer accounts, balances and transactions remain disabled until permissions, ledger controls and recovery tests are completed.
      </div>
    `;

  } else if(page==="Customers"){
    c.innerHTML=`
      ${panel("CUSTOMER MANAGEMENT", "Register a customer", "New customers are submitted for review. Registration does not open an account or authorize financial transactions.", `
        <form id="cust-form">
          <label>Customer number * <input name="cust_num" placeholder="Enter a unique customer number" required></label>
          <label>Customer type * <select name="type"><option>Individual</option><option>Corporate / Group</option></select></label>
          <label>Full name / responsible person's name * <input name="full_name" required></label>
          <label>Organization name <input name="org_name"></label>
          <label>Date of birth (individual customers) <select name="dob"><option value="">Select date of birth</option></select></label>
          <label>Phone number <input name="phone" type="tel"></label>
          <label>Email <input name="email" type="email"></label>
          <label>Identification type <input name="id_type" placeholder="For example, National ID"></label>
          <label>Identification number <input name="id_num"></label>
          <label>Residential address <input name="res_addr"></label>
          <label>Physical / organization address <input name="org_addr"></label>
          <button class="primary" type="submit">Submit for review</button>
        </form>
      `)}

      ${panel("CUSTOMER DIRECTORY", "Search customers", "", `
        <p class="panel-desc">Search by customer number, name, phone, or organization</p>
        <form id="search-cust" style="flex-direction:row; gap:8px;">
          <input placeholder="Enter a search term" style="flex:1;">
          <button class="primary" type="button" style="min-width:90px;">Search</button>
          <button class="secondary" type="button">Show recent customers</button>
        </form>
      `)}
    `;

  } else if(page==="Accounts"){
    c.innerHTML=`
      ${panel("ACCOUNT OPENING", "Submit an account-opening request", "Choose an approved customer and the appropriate account details. This creates a request for controlled processing; it does not authorize transactions or guarantee activation.", `
        <form id="acc-form">
          <label>Customer * <select name="cust"><option>Customer list unavailable</option></select></label>
          <label>Account type * <select name="type"><option>Account types unavailable</option></select></label>
          <label>Branch * <select name="branch"><option>Branch list unavailable</option></select></label>
          <label>Currency * <select name="curr"><option>Currency list unavailable</option></select></label>
          <button class="primary" type="submit">Submit account request</button>
          <p class="muted">Could not load account-opening options. Check table permissions, active records, and branch access.</p>
        </form>
      `)}

      ${panel("CUSTOMER ACCOUNTS", "Accessible accounts", "Balances are read from the secure database function and only for branches your staff account can access.", `
        <p class="muted" style="margin-bottom:12px;">No accounts are visible to your current branch permissions.</p>
        <button class="secondary">Refresh accounts</button>
      `)}
    `;

  } else if(page==="Transactions"){
    c.innerHTML=`
      ${panel("CASH TRANSACTION WORKFLOW", "Request a deposit or withdrawal", "Requests go through approval. Submitting a request does not move money or post ledger entries.", `
        <form id="txn-form">
          <label>Customer account * <select name="account"><option>No active accessible accounts</option></select></label>
          <label>Transaction type * <select name="type"><option>Deposit</option><option>Withdrawal</option></select></label>
          <label>Amount * <input name="amount" type="number" required></label>
          <label>Description <input name="desc" placeholder="Reason or reference"></label>
          <button class="primary" type="submit">Submit for approval</button>
          <p class="muted">No active accounts are currently available to your role and branch.</p>
        </form>
      `)}

      ${panel("APPROVAL QUEUE", "Pending cash requests", "A request cannot be approved by its requester. Approval is not the same as ledger posting.", `
        <p class="muted" style="margin-bottom:12px;">Could not load the approval queue. Verify your role and branch permissions.</p>
        <button class="secondary">Refresh queue</button>
      `)}
    `;

  } else {
    c.innerHTML=panel("SYSTEM", page, "", `<p class="muted">Workspace section available.</p>`);
  }
}

if($("nav"))$("nav").onclick=e=>{const b=e.target.closest("[data-page]");if(b)go(b.dataset.page)};

if($("login-form"))$("login-form").onsubmit=async e=>{
  e.preventDefault();
  if(!db){$("login-message").textContent="Supabase client uninitialized.";return;}
  const {data,error}=await db.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});
  if(error){$("login-message").textContent=error.message;return;}
  user=data.user;
  await loadProfile();
  workspace();
  go("Overview");
};

if($("signout"))$("signout").onclick=async()=>{
  await db?.auth.signOut();
  user=null;profile=null;
  $("login")?.classList.remove("hidden");
  $("workspace")?.classList.add("hidden");
  $("signout")?.classList.add("hidden");
};

(async()=>{
  if(!db)return;
  const {data}=await db.auth.getSession();
  if(data?.session){
    user=data.session.user;
    await loadProfile();
    workspace();
    go("Overview");
  }
})();
   
