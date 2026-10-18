// Development starter only. Never put service_role or secret keys in browser code.
const SUPABASE_URL="https://hwghiezvghdqxnhcnpwk.supabase.co";
const SUPABASE_ANON_KEY="sb_publishable_uRGcpKo1-033QnltdseN7A_Kl2LFRBa";
const db=window.supabase?.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
const pages=["Overview","Customers","Accounts","Transactions","Loans","Accounting","Reports","Staff Attendance","Staff Messages","Settings"];
let user=null,profile=null;
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>\"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
$("year").textContent=new Date().getFullYear();
$("nav").innerHTML=pages.map((p,i)=>`<button class="nav ${i===0?"active":""}" data-page="${p}">${["◈","♙","▣","⇄","▤","▦","▥","◷","✉","⚙"][i]} &nbsp;${p}</button>`).join("");
function notify(t){$("toast").textContent=t;$("toast").style.display="block";setTimeout(()=>$("toast").style.display="none",3000)}
function panel(title,body){return `<section class="panel"><h2>${title}</h2>${body}</section>`}
function metric(label,value){return `<div class="metric"><small>${label}</small><strong>${value}</strong></div>`}
async function loadProfile(){const {data}=await db.from("employee_profiles").select("full_name,home_branch_id,is_active").eq("user_id",user.id).maybeSingle();profile=data}
function workspace(){ $("login").classList.add("hidden");$("workspace").classList.remove("hidden");$("signout").classList.remove("hidden");$("status").textContent="Authenticated"; }
async function rows(table,cols="*"){const {data,error}=await db.from(table).select(cols).limit(50);if(error)throw error;return data||[]}
async function go(page){
 $("title").textContent=page;document.querySelectorAll(".nav").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
 const c=$("content");c.innerHTML=panel(page,"<p class='muted'>Loading workspace…</p>");
 try{
 if(page==="Overview"){
 let nc="—",na="—";try{nc=(await rows("customers","id")).length}catch{}try{na=(await rows("bank_accounts","id")).length}catch{}
 c.innerHTML=`<div class="metrics">${metric("Customers loaded",nc)}${metric("Accounts loaded",na)}${metric("Signed-in staff",esc(profile?.full_name||user?.email))}${metric("Environment","Development")}</div><div class="grid" style="margin-top:16px">${panel("Work areas",pages.slice(1).map(p=>`<div class="row"><button class="secondary" data-go="${p}">Open ${p}</button></div>`).join(""))}${panel("Safety checklist","<p>Verify balanced debit/credit posting, approval controls, branch permissions, idempotency, audit records and backups before live use.</p>")}</div>`;
 
 }else if(page==="Customers"){
 const data=await rows("customers","id,full_name,phone,email,status");
 c.innerHTML=`<div class="grid">
 ${panel("Customer records",data.length?`<div class="scroll"><table><tr><th>Name</th><th>Phone</th><th>Email</th><th>Status</th></tr>${data.map(x=>`<tr><td>${esc(x.full_name||"—")}</td><td>${esc(x.phone||"—")}</td><td>${esc(x.email||"—")}</td><td>${esc(x.status||"—")}</td></tr>`).join("")}</table></div>`:"<p>No records visible, or no customers yet.</p>")}
 ${panel("Register New Customer",`<form id="add-customer"><label>Full Name<input name="full_name" required></label><label>Phone<input name="phone" required></label><label>Email<input name="email" type="email"></label><label>KYC Status<select name="status"><option value="pending">Pending Review</option><option value="verified">Verified</option></select></label><button class="primary">Save Customer</button><p id="custmsg" class="error"></p></form>`)}
 </div>`;
 $("add-customer").onsubmit=async e=>{
   e.preventDefault();
   const f=new FormData(e.target);
   const {error}=await db.from("customers").insert([{
     full_name: f.get("full_name"),
     phone: f.get("phone"),
     email: f.get("email"),
     status: f.get("status"),
     branch_id: profile?.home_branch_id || null
   }]);
   if(error){$("custmsg").textContent=error.message;}else{notify("Customer registered successfully.");go("Customers");}
 };

 }else if(page==="Accounts"){
 const data=await rows("bank_accounts","id,account_number,status,currency_code");
 c.innerHTML=`<div class="grid">
 ${panel("Active Bank Accounts",data.length?`<div class="scroll"><table><tr><th>Account Number</th><th>Currency</th><th>Status</th></tr>${data.map(x=>`<tr><td>${esc(x.account_number||x.id)}</td><td>${esc(x.currency_code||"UGX")}</td><td>${esc(x.status||"—")}</td></tr>`).join("")}</table></div>`:"<p>No accounts visible, or no accounts yet.</p>")}
 ${panel("Open Account Request",`<form id="open-acc"><label>Customer UUID<input name="customer_id" required></label><label>Account Type UUID<input name="account_type_id" required></label><label>Currency Code<input name="currency_code" value="UGX" required></label><button class="primary">Submit Request</button><p id="accmsg" class="error"></p></form>`)}
 </div>`;
 $("open-acc").onsubmit=async e=>{
   e.preventDefault();
   const f=new FormData(e.target);
   const {error}=await db.rpc("open_account_request",{
     p_customer_id: f.get("customer_id"),
     p_account_type_id: f.get("account_type_id"),
     p_branch_id: profile?.home_branch_id || null,
     p_currency_code: f.get("currency_code")
   });
   if(error){$("accmsg").textContent=error.message;}else{notify("Account opening request submitted.");go("Accounts");}
 };

 }else if(page==="Transactions"){
 c.innerHTML=`<div class="grid">${panel("Cash transaction request",`<form id="txn"><label>Account UUID<input name="account" required></label><label>Type<select name="type"><option value="deposit">Deposit</option><option value="withdrawal">Withdrawal</option></select></label><label>Amount<input name="amount" type="number" min=".01" step=".01" required></label><label>Description<input name="description" required></label><button class="primary">Submit for approval</button><p id="txnmsg" class="error"></p></form>`)}${panel("Xprinter receipt preview",`<label>Reference<input id="ref" placeholder="Verified reference"></label><label>Customer<input id="cust"></label><label>Amount<input id="amt" placeholder="UGX"></label><button id="print" class="secondary no-print">Preview / print</button><p class="muted">Opens the normal browser print dialog. A preview is not proof of a posted transaction.</p>`)}</div>`;
 $("txn").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const {error}=await db.rpc("create_cash_transaction_request",{p_account_id:f.get("account"),p_transaction_type:f.get("type"),p_amount:Number(f.get("amount")),p_description:f.get("description")});$("txnmsg").textContent=error?error.message:"Request submitted for review.";if(!error)notify("Request submitted.");};
 $("print").onclick=()=>{const w=window.open("","_blank","width=380,height=600");w.document.write(`<body style="font:14px monospace;max-width:280px"><center><b>ZIVAMUNTUYO FINANCIAL SERVICES LTD</b><p>RECEIPT PREVIEW — VERIFY FIRST</p></center><hr>Reference: ${esc($("ref").value)}<p>Customer: ${esc($("cust").value)}</p>Amount: ${esc($("amt").value)}<p>${new Date().toLocaleString()}</p><hr><center>Not proof of a posted transaction</center><script>window.print()<\/script></body>`);w.document.close();};
 
 }else if(page==="Loans"){
 let loanData = [];
 try { loanData = await rows("loans", "id,amount,status,term_months,interest_rate"); } catch {}
 c.innerHTML=`<div class="grid">
 ${panel("Loan Portfolio", loanData.length ? `<div class="scroll"><table><tr><th>Loan ID</th><th>Amount</th><th>Term (Months)</th><th>Interest Rate</th><th>Status</th></tr>${loanData.map(x=>`<tr><td>${esc(x.id)}</td><td>${esc(x.amount)}</td><td>${esc(x.term_months)}</td><td>${esc(x.interest_rate)}%</td><td>${esc(x.status)}</td></tr>`).join("")}</table></div>` : "<p>No active loans found in portfolio or table pending.</p>")}
 ${panel("New Loan Application", `<form id="loan-form"><label>Customer UUID<input name="customer_id" required></label><label>Principal Amount (UGX)<input name="amount" type="number" step="0.01" required></label><label>Term (Months)<input name="term_months" type="number" required></label><label>Interest Rate (% Annual)<input name="interest_rate" type="number" step="0.01" required></label><button class="primary">Submit Loan Application</button><p id="loanmsg" class="error"></p></form>`)}
 </div>`;

 $("loan-form").onsubmit=async e=>{
   e.preventDefault();
   const f=new FormData(e.target);
   const {error}=await db.from("loans").insert([{
     customer_id: f.get("customer_id"),
     amount: Number(f.get("amount")),
     term_months: Number(f.get("term_months")),
     interest_rate: Number(f.get("interest_rate")),
     status: "pending",
     branch_id: profile?.home_branch_id || null
   }]);
   if(error){$("loanmsg").textContent=error.message;}else{notify("Loan application submitted successfully.");go("Loans");}
 };

 }else if(page==="Accounting"){
 const chartData = await rows("ledger_accounts","id,account_code,name,account_type,normal_balance");
 const journalData = await rows("ledger_journals","id,narration,status,currency_code,created_at");
 c.innerHTML=`<div class="grid">
 ${panel("Chart of Accounts", chartData.length ? `<div class="scroll"><table><tr><th>Code</th><th>Name</th><th>Type</th><th>Normal Balance</th></tr>${chartData.map(x=>`<tr><td>${esc(x.account_code)}</td><td>${esc(x.name)}</td><td>${esc(x.account_type)}</td><td>${esc(x.normal_balance)}</td></tr>`).join("")}</table></div>` : "<p>No ledger accounts found. Verify table schema.</p>")}
 ${panel("Recent Journals", journalData.length ? `<div class="scroll"><table><tr><th>Narration</th><th>Currency</th><th>Status</th><th>Date</th></tr>${journalData.map(x=>`<tr><td>${esc(x.narration)}</td><td>${esc(x.currency_code)}</td><td>${esc(x.status)}</td><td>${esc(x.created_at)}</td></tr>`).join("")}</table></div>` : "<p>No journal entries posted yet.</p>")}
 </div>`;

 }else if(page==="Reports"){
 let custCount=0, accCount=0, journalCount=0;
 try{ custCount = (await rows("customers","id")).length; }catch{}
 try{ accCount = (await rows("bank_accounts","id")).length; }catch{}
 try{ journalCount = (await rows("ledger_journals","id")).length; }catch{}

 c.innerHTML=`<div class="grid">
 ${panel("Operational Summary", `<div class="metrics" style="grid-template-columns:1fr 1fr; margin-bottom:12px;">${metric("Total Customers", custCount)}${metric("Active Accounts", accCount)}</div>${metric("Total Journal Entries", journalCount)}<br><button class="secondary" onclick="window.print()">Print Operational Summary</button>`)}
 ${panel("Compliance & Verification Notice", `<p class="muted">All reports are generated directly from authoritative ledger and customer tables. Verify branch permissions and trial balance totals prior to audit sign-off.</p>`)}
 </div>`;

 }else if(page==="Staff Attendance"){
 const attData = await rows("staff_attendance","id,clock_in,clock_out,method,status");
 c.innerHTML=`<div class="grid">
 ${panel("Clock Actions & Biometric Setup",`<div class="actions"><button id="in" class="primary">Clock In</button><button id="out" class="secondary">Clock Out</button></div><p id="attmsg" class="error"></p><hr><p class="muted"><b>Fingerprint Integration Note:</b> Browsers cannot universally read raw USB scanner hardware directly. Connect via a local Windows helper service, vendor SDK, or terminal API.</p>`)}
 ${panel("Recent Attendance Logs", attData.length ? `<div class="scroll"><table><tr><th>Clock In</th><th>Clock Out</th><th>Method</th><th>Status</th></tr>${attData.map(x=>`<tr><td>${esc(x.clock_in||"—")}</td><td>${esc(x.clock_out||"—")}</td><td>${esc(x.method||"manual")}</td><td>${esc(x.status||"—")}</td></tr>`).join("")}</table></div>` : "<p>No attendance logs recorded yet.</p>")}
 </div>`;
 $("in").onclick=()=>clock("in");
 $("out").onclick=()=>clock("out");

 }else if(page==="Staff Messages"){c.innerHTML=`<div class="grid">${panel("Send message",`<form id="msg"><label>Recipient user UUID<input name="to" required></label><label>Message<textarea name="text" required maxlength="4000"></textarea></label><button class="primary">Send</button><p id="msgres" class="error"></p></form>`)}${panel("Inbox",`<button id="inbox" class="secondary">Load recent messages</button><div id="msgs"></div>`)}</div>`;
 $("msg").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const {error}=await db.rpc("send_staff_message",{p_recipient_user_id:f.get("to"),p_message_text:f.get("text"),p_branch_id:profile?.home_branch_id||null});$("msgres").textContent=error?error.message:"Message sent.";};
 $("inbox").onclick=async()=>{const {data,error}=await db.rpc("list_my_staff_messages",{p_limit:50});$("msgs").innerHTML=error?esc(error.message):(data||[]).map(m=>`<div class="row"><b>${esc(m.sender_name||m.sender_user_id||"Staff")}</b><p>${esc(m.message_text||"")}</p><small>${esc(m.created_at||"")}</small></div>`).join("")||"No messages returned.";};
 }else if(page==="Settings"){c.innerHTML=panel("Environment","<p>Supabase URL: "+esc(SUPABASE_URL)+"</p><p>Public client initialized: "+!!db+"</p><p>Never put secret/service_role keys in this file. Verify redirect URLs, RLS and role/branch permissions.</p>");
 }
 c.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>go(b.dataset.go));
 }catch(e){c.innerHTML=panel(page,`<p>Could not load data. Verify table names, columns and Row Level Security.</p><p class="error">${esc(e.message)}</p>`)}
}
async function clock(kind){const method="manual";const result=kind==="in"?await db.rpc("staff_clock_in",{p_branch_id:profile?.home_branch_id||null,p_method:method}):await db.rpc("staff_clock_out",{p_method:method,p_notes:""});$("attmsg").textContent=result.error?result.error.message:"Request accepted; verify the saved attendance event."; if(!result.error){ notify("Attendance recorded."); go("Staff Attendance"); }}
$("nav").onclick=e=>{const b=e.target.closest("[data-page]");if(b)go(b.dataset.page)};
$("login-form").onsubmit=async e=>{e.preventDefault();if(!db){$("login-message").textContent="Supabase library unavailable.";return}const {data,error}=await db.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});if(error){$("login-message").textContent=error.message;return}user=data.user;await loadProfile();workspace();go("Overview")};
$("signout").onclick=async()=>{await db?.auth.signOut();user=null;profile=null;$("login").classList.remove("hidden");$("workspace").classList.add("hidden");$("signout").classList.add("hidden");$("status").textContent="Signed out"};
(async()=>{if(!db){$("login-message").textContent="Supabase client could not initialize.";return}const {data}=await db.auth.getSession();if(data.session){user=data.session.user;await loadProfile();workspace();go("Overview")}})();
