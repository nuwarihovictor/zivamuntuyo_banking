// Initial secure UI shell. Use only the Supabase project URL and PUBLIC publishable/anon key.
// NEVER place a service_role or secret key in this browser file.
const SUPABASE_URL = "https://hwghiezvghdqxnhcnpwk.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_uRGcpKo1-033QnltdseN7A_Kl2LFRBa";

const ready = SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("PASTE_") && !SUPABASE_ANON_KEY.includes("PASTE_") && SUPABASE_ANON_KEY.length > 20;
const db = ready ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const $ = id => document.getElementById(id);

if (ready) $("setup").classList.add("hidden");

function message(t, good=false) {
  $("message").textContent = t;
  $("message").style.color = good ? "#216543" : "#a13c30";
}

async function loadProfile(user) {
  const {data, error} = await db.from("employee_profiles").select("full_name,employee_number,is_active,staff_roles(role_code,role_name),branches:home_branch_id(branch_name)").eq("user_id", user.id).maybeSingle();
  
  if (error) throw new Error("Signed in, but staff profile could not be verified. Ask the administrator to check database relationship and read policies.");
  
  if (!data || !data.is_active) throw new Error("Staff profile is missing or inactive. Access has not been granted.");
  
  $("login").classList.add("hidden");
  $("dashboard").classList.remove("hidden");
  $("signout").classList.remove("hidden");
  $("welcome").textContent = "Welcome, " + (data.full_name || "Staff member");
  $("role").textContent = data.staff_roles?.role_name || data.staff_roles?.role_code || "Authenticated staff";
  $("branch").textContent = data.branches?.branch_name || "Assigned branch";
}

$("signin").addEventListener("click", async () => {
  if (!db) return message("Setup incomplete: add the Supabase project URL and public publishable/anon key in app.js, then redeploy.");
  
  const email = $("email").value.trim(), password = $("password").value;
  if (!email || !password) return message("Enter your work email and password.");
  
  $("signin").disabled = true;
  $("signin").textContent = "Signing in...";
  
  try {
    const {data, error} = await db.auth.signInWithPassword({email, password});
    if (error) throw error;
    await loadProfile(data.user);
    message("", true);
  } catch(e) {
    message(e.message || "Sign-in failed.");
    await db.auth.signOut();
  } catch(()) {}
  finally {
    $("signin").disabled = false;
    $("signin").textContent = "Sign in securely →";
  }
});

$("signout").addEventListener("click", async () => {
  if (db) await db.auth.signOut();
  $("dashboard").classList.add("hidden");
  $("login").classList.remove("hidden");
  $("signout").classList.add("hidden");
  $("password").value = "";
  message("Signed out.", true);
});

document.querySelectorAll(".nav button").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll(".nav button").forEach(x => x.classList.remove("active"));
  btn.classList.add("active");
  const page = btn.dataset.page;
  $("title").textContent = page;
  if (page === "Overview") {
    $("dashboard").classList.remove("hidden");
    $("placeholder").classList.add("hidden");
  } else {
    $("dashboard").classList.add("hidden");
    $("placeholder").classList.remove("hidden");
    $("placeholder-title").textContent = page + " module";
  }
}));

if (db) db.auth.getSession().then(async ({data}) => {
  if (data.session) {
    try {
      await loadProfile(data.session.user);
    } catch(e) {
      message(e.message);
      await db.auth.signOut();
    }
  }
});
