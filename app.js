} else if (page === "Accounts") {
  c.innerHTML = panel(
    "ACCOUNT OPENING REQUEST",
    "Submit a new account application",
    "Choose an approved customer, account type, and home branch to generate an account request.",
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
    "Real-time list of bank accounts and approval statuses.",
    `<div id="acc-list"><p class="muted">Loading accounts...</p></div>
     <br><button class="secondary" id="btn-refresh-acc">Refresh Accounts</button>`
  );

  // Populate dropdowns matching your exact table columns
  async function loadDropdowns() {
    try {
      const [custRes, typeRes, branchRes] = await Promise.all([
        db.from("customers").select("id, customer_number"),
        db.from("account_types").select("id, type_code, type_name").eq("is_active", true),
        db.from("branches").select("id, branch_code, branch_name").eq("is_active", true)
      ]);

      // Customers Dropdown
      const custSelect = $("sel-cust");
      if (custRes.data && custRes.data.length > 0) {
        custSelect.innerHTML = custRes.data.map(c => 
          `<option value="${c.id}">${esc(c.customer_number || c.id)}</option>`
        ).join("");
      } else {
        custSelect.innerHTML = `<option value="">No registered customers found</option>`;
      }

      // Account Types Dropdown
      const typeSelect = $("sel-acctype");
      if (typeRes.data && typeRes.data.length > 0) {
        typeSelect.innerHTML = typeRes.data.map(t => 
          `<option value="${t.id}">${esc(t.type_name)} (${esc(t.type_code)})</option>`
        ).join("");
      } else {
        typeSelect.innerHTML = `<option value="">No active account types found</option>`;
      }

      // Branches Dropdown
      const branchSelect = $("sel-branch");
      if (branchRes.data && branchRes.data.length > 0) {
        branchSelect.innerHTML = branchRes.data.map(b => 
          `<option value="${b.id}">${esc(b.branch_name)} (${esc(b.branch_code)})</option>`
        ).join("");
      } else {
        branchSelect.innerHTML = `<option value="">No active branches found</option>`;
      }
    } catch (err) {
      if ($("acc-msg")) $("acc-msg").textContent = "Error loading dropdown options: " + err.message;
    }
  }

  // Load Accounts from bank_accounts
  async function loadAccounts() {
    try {
      const { data, error } = await db
        .from("bank_accounts")
        .select("id, account_number, status, currency_code, created_at");
      
      const listEl = $("acc-list");
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
      if ($("acc-list")) $("acc-list").innerHTML = `<p class="error">Could not load accounts: ${esc(err.message)}</p>`;
    }
  }

  loadDropdowns();
  loadAccounts();

  $("btn-refresh-acc").onclick = loadAccounts;

  // Handle Request Submission
  $("acc-form").onsubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const msgEl = $("acc-msg");
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
