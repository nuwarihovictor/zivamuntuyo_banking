// ZIVAMUNTUYO FINANCIAL SERVICES LTD
// Secure staff login and customer-management module.
// Never place a Supabase service_role or secret key in browser code.

const SUPABASE_URL = "https://hwghiezvghdqxnhcnpwk.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_uRGcpKo1-033QnltdseN7A_Kl2LFRBa";

const ready =
  SUPABASE_URL.startsWith("https://") &&
  SUPABASE_ANON_KEY.length > 20;

const db = ready
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const $ = id => document.getElementById(id);

let currentUser = null;
let currentProfile = null;
let currentPage = "Overview";

const escapeHTML = value =>
  String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);

function message(text, good = false) {
  const el = $("message");
  if (!el) return;

  el.textContent = text;
  el.style.color = good ? "#216543" : "#a13c30";
}

function setPageMessage(text, good = false) {
  const el = $("module-message");
  if (!el) return;

  el.textContent = text;
  el.style.color = good ? "#216543" : "#a13c30";
}

function showDashboard() {
  $("login").classList.add("hidden");
  $("dashboard").classList.remove("hidden");
  $("signout").classList.remove("hidden");
}

async function loadProfile(user) {
  const { data, error } = await db
    .from("employee_profiles")
    .select(
      "full_name,employee_number,is_active,role_id,home_branch_id,staff_roles(role_code,role_name),branches:home_branch_id(branch_name)"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(
      "Your staff profile could not be verified. Ask the administrator to check the profile relationships and database permissions."
    );
  }

  if (!data || !data.is_active) {
    throw new Error("Your staff profile is missing or inactive.");
  }

  currentUser = user;
  currentProfile = data;

  showDashboard();

  $("welcome").textContent =
    "Welcome, " + (data.full_name || "Staff member");

  $("role").textContent =
    data.staff_roles?.role_name ||
    data.staff_roles?.role_code ||
    "Authenticated staff";

  $("branch").textContent =
    data.branches?.branch_name || "Assigned branch";

  renderModule(currentPage);
}

function canApproveCustomers() {
  const role = currentProfile?.staff_roles?.role_code;
  return role === "system_admin" ||
         role === "bank_admin" ||
         role === "branch_manager";
}

function renderModule(page) {
  currentPage = page;

  const area = $("module-area");
  if (!area) return;

  $("title").textContent = page;

  if (page === "Overview") {
    $("dashboard-content").classList.remove("hidden");
    area.classList.add("hidden");
    return;
  }

  $("dashboard-content").classList.add("hidden");
  area.classList.remove("hidden");

  if (page === "Customers") {
    renderCustomers();
    return;
  }

  area.innerHTML = `
    <div class="card">
      <small class="eyebrow">MODULE NOT ENABLED</small>
      <h2>${escapeHTML(page)}</h2>
      <p class="muted">
        This module has not yet been connected to the database.
        Financial operations remain disabled.
      </p>
    </div>`;
}

function renderCustomers() {
  const area = $("module-area");

  area.innerHTML = `
    <div class="card">
      <small class="eyebrow">CUSTOMER MANAGEMENT</small>
      <h2>Register a customer</h2>
      <p class="muted">
        New customers are submitted for review. Registration does not
        open an account or authorize financial transactions.
      </p>

      <form id="customer-form">
        <label>
          Customer number *
          <input name="customer_number" required maxlength="50"
                 placeholder="Enter a unique customer number">
        </label>

        <label>
          Customer type *
          <select name="customer_type" required>
            <option value="individual">Individual</option>
            <option value="business">Business</option>
            <option value="organization">Organization / Group / Institution</option>
          </select>
        </label>

        <label>
          Full name / responsible person's name *
          <input name="full_name" required maxlength="150">
        </label>

        <label>
          Organization name
          <input name="organization_name" maxlength="200">
        </label>

        <label>
          Date of birth (individual customers)
          <input name="date_of_birth" type="date">
        </label>

        <label>
          Phone number
          <input name="phone_number" type="tel" maxlength="40">
        </label>

        <label>
          Email
          <input name="email" type="email" maxlength="254">
        </label>

        <label>
          Identification type
          <input name="identification_type" maxlength="60"
                 placeholder="For example, National ID">
        </label>

        <label>
          Identification number
          <input name="identification_number" maxlength="100">
        </label>

        <label>
          Residential address
          <textarea name="residential_address" rows="2"
                    maxlength="500"></textarea>
        </label>

        <label>
          Physical / organization address
          <textarea name="physical_address" rows="2"
                    maxlength="500"></textarea>
        </label>

        <button type="submit" class="primary-button">
          Submit for review
        </button>
      </form>

      <p id="module-message" aria-live="polite"></p>
    </div>

    <div class="card" style="margin-top:18px">
      <small class="eyebrow">CUSTOMER DIRECTORY</small>
      <h2>Search customers</h2>

      <form id="customer-search-form">
        <label>
          Search by customer number, name, phone, or organization
          <input id="customer-search" maxlength="150"
                 placeholder="Enter a search term">
        </label>
        <button type="submit" class="primary-button">Search</button>
        <button type="button" id="customer-show-all"
                class="secondary">Show recent customers</button>
      </form>

      <div id="customer-results" aria-live="polite"></div>
    </div>`;

  $("customer-form").addEventListener("submit", submitCustomer);
  $("customer-search-form").addEventListener("submit", searchCustomers);
  $("customer-show-all").addEventListener("click", () => searchCustomers(null));
}

async function submitCustomer(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const values = new FormData(form);

  const customerNumber = String(values.get("customer_number") || "").trim();
  const fullName = String(values.get("full_name") || "").trim();
  const customerType = String(values.get("customer_type") || "").trim();

  if (!customerNumber || !fullName) {
    return setPageMessage("Enter the customer number and full name.");
  }

  if (!["individual", "business", "organization"].includes(customerType)) {
    return setPageMessage("Choose a valid customer type.");
  }

  if (customerType !== "individual" &&
      !String(values.get("organization_name") || "").trim()) {
    return setPageMessage("Enter the organization name for this customer.");
  }

  const record = {
    customer_number: customerNumber,
    customer_type: customerType,
    full_name: fullName,
    organization_name:
      String(values.get("organization_name") || "").trim() || null,
    date_of_birth: values.get("date_of_birth") || null,
    phone_number: String(values.get("phone_number") || "").trim() || null,
    email: String(values.get("email") || "").trim() || null,
    identification_type:
      String(values.get("identification_type") || "").trim() || null,
    identification_number:
      String(values.get("identification_number") || "").trim() || null,
    residential_address:
      String(values.get("residential_address") || "").trim() || null,
    physical_address:
      String(values.get("physical_address") || "").trim() || null,
    status: "pending_review",
    created_by: currentUser.id
  };

  // Do not silently assign a branch: it must be authorized by the database.
  // The existing schema allows branch_id to be null, but your SELECT policy
  // will not expose a null-branch record to ordinary branch-scoped employees.

  button.disabled = true;
  button.textContent = "Submitting...";

  try {
    const { data, error } = await db
      .from("customers")
      .insert(record)
      .select("id,customer_number,status")
      .single();

    if (error) throw error;

    setPageMessage(
      `Customer ${data.customer_number} was submitted successfully. Status: ${data.status}.`,
      true
    );

    form.reset();
    await searchCustomers(null);
  } catch (error) {
    console.error("Customer registration error:", error);

    if (error.code === "23505") {
      setPageMessage("That customer number already exists. Use a unique number.");
    } else if (error.code === "42501" || error.code === "PGRST301") {
      setPageMessage(
        "The database denied this operation. Check your role, branch assignment, and RLS policies."
      );
    } else {
      setPageMessage(
        error.message || "Customer registration failed. Check the database configuration."
      );
    }
  } finally {
    button.disabled = false;
    button.textContent = "Submit for review";
  }
}

async function searchCustomers(event) {
  if (event) event.preventDefault();

  const results = $("customer-results");
  if (!results) return;

  results.textContent = "Loading customer records...";

  try {
    let query = db
      .from("customers")
      .select(
        "id,customer_number,customer_type,full_name,organization_name,phone_number,email,status,created_at"
      )
      .order("created_at", { ascending: false })
      .limit(50);

    const term = String($("customer-search")?.value || "").trim();

    if (term) {
      const safeTerm = term.replace(/[,%()]/g, " ");
      query = query.or(
        `customer_number.ilike.%${safeTerm}%,full_name.ilike.%${safeTerm}%,organization_name.ilike.%${safeTerm}%,phone_number.ilike.%${safeTerm}%`
      );
    }

    const { data, error } = await query;
    if (error) throw error;

    if (!data?.length) {
      results.textContent = "No customer records were found for your access level.";
      return;
    }

    results.innerHTML = `
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;margin-top:15px">
          <thead>
            <tr>
              <th align="left">Customer number</th>
              <th align="left">Name</th>
              <th align="left">Type</th>
              <th align="left">Status</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(customer => `
              <tr>
                <td>${escapeHTML(customer.customer_number)}</td>
                <td>${escapeHTML(customer.full_name)}</td>
                <td>${escapeHTML(customer.customer_type)}</td>
                <td>${escapeHTML(customer.status)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      <p class="muted">Showing up to 50 records permitted by database policies.</p>`;
  } catch (error) {
    console.error("Customer search error:", error);
    results.textContent =
      "Unable to load customers. Check your branch permissions and database policies.";
  }
}

async function signIn() {
  if (!db) return message("Supabase configuration is incomplete.");

  const email = $("email").value.trim();
  const password = $("password").value;

  if (!email || !password) {
    return message("Enter your work email and password.");
  }

  const button = $("signin");
  button.disabled = true;
  button.textContent = "Signing in...";

  try {
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;

    await loadProfile(data.user);
    message("", true);
  } catch (error) {
    console.error("Sign-in error:", error);
    message(error.message || "Sign-in failed.");
    await db.auth.signOut();
  } finally {
    button.disabled = false;
    button.textContent = "Sign in securely →";
  }
}

async function signOut() {
  if (db) await db.auth.signOut();

  currentUser = null;
  currentProfile = null;

  $("dashboard").classList.add("hidden");
  $("module-area").classList.add("hidden");
  $("dashboard-content").classList.remove("hidden");
  $("login").classList.remove("hidden");
  $("signout").classList.add("hidden");
  $("password").value = "";

  message("Signed out.", true);
}

function installModuleArea() {
  const dashboard = $("dashboard");

  const content = document.createElement("div");
  content.id = "dashboard-content";

  while (dashboard.firstChild) {
    content.appendChild(dashboard.firstChild);
  }

  dashboard.appendChild(content);

  const area = document.createElement("section");
  area.id = "module-area";
  area.className = "hidden";
  dashboard.appendChild(area);
}

function start() {
  if (!db) {
    $("setup").classList.remove("hidden");
    return;
  }

  $("setup").classList.add("hidden");
  installModuleArea();

  $("signin").addEventListener("click", signIn);
  $("signout").addEventListener("click", signOut);

  document.querySelectorAll("nav button, .nav button").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll("nav button, .nav button")
        .forEach(item => item.classList.remove("active"));

      button.classList.add("active");
      renderModule(button.dataset.page || "Overview");
    });
  });

  db.auth.getSession().then(async ({ data, error }) => {
    if (error) {
      message("Unable to restore your session. Please sign in again.");
      return;
    }

    if (data.session) {
      try {
        await loadProfile(data.session.user);
      } catch (error) {
        message(error.message || "Staff verification failed.");
        await db.auth.signOut();
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", start);
