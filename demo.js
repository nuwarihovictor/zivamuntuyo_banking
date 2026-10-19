/* Isolated demonstration only. Intentionally no Supabase/client/network calls. */
(function(){
  "use strict";
  const titles={dashboard:"Overview / Dashboard",customers:"Workspace / Customers",accounts:"Workspace / Accounts",transactions:"Workspace / Transaction simulator",receipts:"Workspace / Receipt printing",reports:"Workspace / Reports",staff:"Administration / Staff & branches",attendance:"Staff / Attendance demo",chat:"Staff / Chat demo"};
  const views=[...document.querySelectorAll(".view")];
  function go(page){views.forEach(v=>v.classList.toggle("hidden",v.id!==page+"-view"));document.querySelectorAll("[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===page));document.getElementById("top-title").textContent=titles[page]||"Demo";window.scrollTo({top:0,behavior:"smooth"});}
  document.querySelectorAll("[data-page]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.page)));
  document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.go)));
  let receipt=null;
  const money=n=>"UGX "+Number(n).toLocaleString("en-UG",{maximumFractionDigits:0});
  const safe=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  document.getElementById("tx-form").addEventListener("submit",e=>{
    e.preventDefault();
    const amount=Number(document.getElementById("tx-amount").value);
    if(!Number.isSafeInteger(amount)||amount<1){alert("Enter a valid whole-number demo amount.");return;}
    receipt={ref:"DEMO-"+Date.now().toString().slice(-8),type:document.getElementById("tx-type").value,customer:document.getElementById("tx-customer").value,account:document.getElementById("tx-account").value,amount,note:document.getElementById("tx-note").value.trim(),date:new Date().toLocaleString()};
    document.getElementById("receipt-empty").classList.add("hidden");
    const el=document.getElementById("receipt-view");el.classList.remove("hidden");
    el.innerHTML='<div class="receipt"><h2>ZIVAMUNTUYO FINANCIAL SERVICES LTD</h2><p style="text-align:center;font-weight:bold">DEMO RECEIPT — NOT A REAL TRANSACTION</p><hr><div class="rline"><span>Reference</span><strong>'+safe(receipt.ref)+'</strong></div><div class="rline"><span>Date</span><span>'+safe(receipt.date)+'</span></div><div class="rline"><span>Type</span><span>'+safe(receipt.type)+'</span></div><div class="rline"><span>Customer</span><span>'+safe(receipt.customer)+'</span></div><div class="rline"><span>Account</span><span>'+safe(receipt.account)+'</span></div><div class="rline"><span>Amount</span><strong>'+money(receipt.amount)+'</strong></div><div class="rline"><span>Narration</span><span>'+safe(receipt.note||"—")+'</span></div><p style="text-align:center;margin-top:24px;font-weight:bold">SIMULATION ONLY · NO MONEY MOVED</p><p style="text-align:center;font-size:12px">This receipt is for software demonstration and is not proof of payment.</p></div>';
    document.getElementById("print-btn").disabled=false;
    go("receipts");
  });
  document.getElementById("print-btn").addEventListener("click",()=>{if(receipt)window.print();});

  const punch=document.getElementById("punch-demo");
  if(punch)punch.addEventListener("click",()=>{
    const now=new Date();
    const time=now.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
    const row=document.createElement("tr");
    ["DEMO-S003","Taylor Test","Main (sample)",time,"Manual simulation"].forEach(value=>{const td=document.createElement("td");td.textContent=value;row.appendChild(td);});
    document.getElementById("attendance-rows").prepend(row);
    document.getElementById("punch-feedback").textContent="Clock-in simulated at "+time+". This was not biometric verification and is not persisted.";
    punch.disabled=true;punch.textContent="Clock-in simulated";
  });
  const chatForm=document.getElementById("chat-form");
  if(chatForm)chatForm.addEventListener("submit",e=>{
    e.preventDefault();const input=document.getElementById("chat-input");const value=input.value.trim();if(!value)return;
    const p=document.createElement("p"), strong=document.createElement("strong"), stamp=document.createElement("span"), br=document.createElement("br");
    strong.textContent="You (demo) ";stamp.className="muted";stamp.textContent="· "+new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});p.append(strong,stamp,br,document.createTextNode(value));
    const box=document.getElementById("chat-messages");box.appendChild(p);input.value="";
  });
\n  document.getElementById("export-demo").addEventListener("click",()=>{
    const rows=[["Reference","Customer","Type","Amount UGX","Status"],["DEMO-00041","Alex Sample","Deposit",250000,"SIMULATED"],["DEMO-00040","Jordan Example","Withdrawal",80000,"SIMULATED"],["DEMO-00039","Sam Test","Deposit",125000,"SIMULATED"]];
    const csv=rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(",")).join("\r\n");
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));a.download="zivamuntuyo-demo-report.csv";a.click();URL.revokeObjectURL(a.href);
  });
})();