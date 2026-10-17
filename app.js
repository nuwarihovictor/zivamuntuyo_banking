"use strict";

/*
 * ZIVAMUNTUYO FINANCIAL SERVICES LTD
 * Banking Management System
 *
 * This version provides:
 * - Supabase authentication
 * - Staff profile verification
 * - Staff role and branch display
 * - Working sidebar navigation
 * - Dashboard and placeholder screens
 * - Session restoration
 * - Sign-out
 *
 * IMPORTANT:
 * Banking transactions remain disabled until the required
 * database tables, RLS policies, accounting controls,
 * and secure backend functions are implemented and tested.
 *
 * Never put a Supabase service_role key or other secret
 * in this browser-side file.
 */

// ======================================================
// 1. SUPABASE CONFIGURATION
// ======================================================

const SUPABASE_URL =
  "https://hwghiezvghdqxnhcnpwk.supabase.co";

const SUPABASE_ANON_KEY =
  "sb_publishable_uRGcpKo1-033QnltdseN7A_Kl2LFRBa";

const $ = (id) => document.getElementById(id);

const ready =
  typeof window.supabase !== "undefined" &&
  SUPABASE_URL.startsWith("https://") &&
  SUPABASE_ANON_KEY.length > 20 &&
  !SUPABASE_URL.includes("PASTE_") &&
  !SUPABASE_ANON_KEY.includes("PASTE_");

const db = ready
  ? window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    )
  : null;


// ======================================================
// 2. APPLICATION STATE
// ======================================================

let currentUser = null;
let currentProfile = null;
let currentPage = "Overview";
let authRequestInProgress = false;


// ======================================================
// 3. SAFE MESSAGE DISPLAY
// ======================================================

function message(text, good = false) {
  const element = $("message");

  if (!element) return;

  element.textContent = text || "";

  element.style.color = good
    ? "#216543"
    : "#a13c30";
}


// ======================================================
// 4. APPLICATION INITIALIZATION
// ======================================================

function initializeInterface() {
  if (!ready) {
    const setup = $("setup");

    if (setup) {
      setup.classList.remove("hidden");
    }
  } else {
    const setup = $("setup");

    if (setup) {
      setup.classList.add("hidden");
    }
  }

  const dashboard = $("dashboard");
  const login = $("login");
  const signout = $("signout");
  const placeholder = $("placeholder");

  if (dashboard) dashboard.classList.add("hidden");
  if (login) login.classList.remove("hidden");
  if (signout) signout.classList.add("hidden");
  if (placeholder) placeholder.classList.add("hidden");

  initializeNavigation();
  initializeAuthentication();
}


// ======================================================
// 5. STAFF PROFILE VERIFICATION
// ======================================================

async function loadProfile(user) {
  if (!db || !user || !user.id) {
    throw new Error(
      "Unable to verify the signed-in staff member."
    );
  }

  const { data, error } = await db
    .from("employee_profiles")
    .select(
      [
        "full_name",
        "employee_number",
        "is_active",
        "staff_roles(role_code,role_name)",
        "branches:home_branch_id(branch_name)"
      ].join(",")
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error(
      "Staff profile verification failed:",
      error
    );

    throw new Error(
      "Your account was authenticated, but your staff profile could not be verified. Please contact the administrator."
    );
  }

  if (!data || data.is_active !== true) {
    throw new Error(
      "Your staff profile is missing or inactive. Access has not been granted."
    );
  }

  currentUser = user;
  currentProfile = data;

  showDashboard(data);
}


// ======================================================
// 6. DISPLAY DASHBOARD
// ======================================================

function showDashboard(profile) {
  const login = $("login");
  const dashboard = $("dashboard");
  const signout = $("signout");

  if (login) login.classList.add("hidden");
  if (dashboard) dashboard.classList.remove("hidden");
  if (signout) signout.classList.remove("hidden");

  const welcome = $("welcome");
  const role = $("role");
  const branch = $("branch");

  if (welcome) {
    welcome.textContent =
      "Welcome, " +
      (profile.full_name || "Staff member");
  }

  if (role) {
    role.textContent =
      profile.staff_roles?.role_name ||
      profile.staff_roles?.role_code ||
      "Authenticated staff";
  }

  if (branch) {
    branch.textContent =
      profile.branches?.branch_name ||
      "Assigned branch";
  }

  showPage("Overview");
}


// ======================================================
// 7. NAVIGATION
// ======================================================

function initializeNavigation() {
  /*
   * IMPORTANT FIX:
   * The existing HTML uses <nav> rather than
   * an element with class="nav".
   *
   * Therefore, use "nav button".
   */

  const buttons = document.querySelectorAll(
    "nav button[data-page]"
  );

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      if (!currentUser || !currentProfile) {
        message(
          "Please sign in with an authorized staff account."
        );

        return;
      }

      const page = button.dataset.page;

      if (!page) return;

      showPage(page);
    });
  });
}


// ======================================================
// 8. DISPLAY SELECTED PAGE
// ======================================================

function showPage(page) {
  const allowedPages = [
    "Overview",
    "Customers",
    "Accounts",
    "Transactions",
    "Loans",
    "Accounting",
    "Reports"
  ];

  if (!allowedPages.includes(page)) {
    console.warn("Unknown page requested:", page);
    return;
  }

  currentPage = page;

  // Update navigation highlighting.

  document
    .querySelectorAll("nav button[data-page]")
    .forEach((button) => {
      const selected =
        button.dataset.page === page;

      button.classList.toggle(
        "active",
        selected
      );

      button.setAttribute(
        "aria-current",
        selected ? "page" : "false"
      );
    });

  // Update page heading.

  const title = $("title");

  if (title) {
    title.textContent = page;
  }

  const dashboard = $("dashboard");
  const placeholder = $("placeholder");
  const placeholderTitle = $("placeholder-title");

  if (page === "Overview") {
    if (dashboard) {
      dashboard.classList.remove("hidden");
    }

    if (placeholder) {
      placeholder.classList.add("hidden");
    }

    return;
  }

  // Banking modules are placeholders for now.
  // No financial transactions are executed here.

  if (dashboard) {
    dashboard.classList.add("hidden");
  }

  if (placeholder) {
    placeholder.classList.remove("hidden");
  }

  if (placeholderTitle) {
    placeholderTitle.textContent =
      page + " module";
  }
}


// ======================================================
// 9. SIGN IN
// ======================================================

function initializeAuthentication() {
  const signin = $("signin");

  if (signin) {
    signin.addEventListener(
      "click",
      signIn
    );
  }

  const password = $("password");

  if (password) {
    password.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        signIn();
      }
    });
  }

  const email = $("email");

  if (email) {
    email.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        const passwordField = $("password");

        if (passwordField) {
          passwordField.focus();
        }
      }
    });
  }

  const signout = $("signout");

  if (signout) {
    signout.addEventListener(
      "click",
      signOut
    );
  }
}


async function signIn() {
  if (authRequestInProgress) return;

  if (!db) {
    message(
      "Supabase configuration is incomplete. Check the project URL and public key."
    );

    return;
  }

  const email = $("email")?.value.trim() || "";
  const password = $("password")?.value || "";
  const signin = $("signin");

  if (!email || !password) {
    message(
      "Enter your work email and password."
    );

    return;
  }

  authRequestInProgress = true;

  if (signin) {
    signin.disabled = true;
    signin.textContent = "Signing in...";
  }

  message("");

  try {
    const { data, error } =
      await db.auth.signInWithPassword({
        email,
        password
      });

    if (error) {
      throw error;
    }

    if (!data.user) {
      throw new Error(
        "Authentication did not return a user account."
      );
    }

    await loadProfile(data.user);

    message(
      "Signed in successfully.",
      true
    );

  } catch (error) {
    console.error("Sign-in error:", error);

    currentUser = null;
    currentProfile = null;

    if (db) {
      await db.auth.signOut();
    }

    const dashboard = $("dashboard");
    const login = $("login");
    const signout = $("signout");

    if (dashboard) {
      dashboard.classList.add("hidden");
    }

    if (login) {
      login.classList.remove("hidden");
    }

    if (signout) {
      signout.classList.add("hidden");
    }

    message(
      error.message ||
      "Sign-in failed. Please try again."
    );

  } finally {
    authRequestInProgress = false;

    if (signin) {
      signin.disabled = false;
      signin.textContent =
        "Sign in securely →";
    }
  }
}


// ======================================================
// 10. SIGN OUT
// ======================================================

async function signOut() {
  if (!db) {
    resetApplication();
    return;
  }

  const signout = $("signout");

  if (signout) {
    signout.disabled = true;
  }

  try {
    const { error } = await db.auth.signOut();

    if (error) {
      throw error;
    }

    resetApplication();

    message(
      "Signed out successfully.",
      true
    );

  } catch (error) {
    console.error("Sign-out error:", error);

    message(
      "Sign-out could not be confirmed. Please check your connection and try again."
    );

  } finally {
    if (signout) {
      signout.disabled = false;
    }
  }
}


// ======================================================
// 11. RESET APPLICATION AFTER SIGN OUT
// ======================================================

function resetApplication() {
  currentUser = null;
  currentProfile = null;
  currentPage = "Overview";

  const dashboard = $("dashboard");
  const login = $("login");
  const signout = $("signout");
  const placeholder = $("placeholder");
  const password = $("password");
  const email = $("email");

  if (dashboard) {
    dashboard.classList.add("hidden");
  }

  if (placeholder) {
    placeholder.classList.add("hidden");
  }

  if (login) {
    login.classList.remove("hidden");
  }

  if (signout) {
    signout.classList.add("hidden");
  }

  if (password) {
    password.value = "";
  }

  if (email) {
    email.value = "";
  }

  const title = $("title");

  if (title) {
    title.textContent = "Overview";
  }

  document
    .querySelectorAll("nav button[data-page]")
    .forEach((button) => {
      const selected =
        button.dataset.page === "Overview";

      button.classList.toggle(
        "active",
        selected
      );
    });
}


// ======================================================
// 12. RESTORE EXISTING SESSION
// ======================================================

async function restoreSession() {
  if (!db) return;

  try {
    const { data, error } =
      await db.auth.getSession();

    if (error) {
      throw error;
    }

    const session = data?.session;

    if (!session?.user) {
      return;
    }

    await loadProfile(session.user);

    message(
      "Your existing session was restored.",
      true
    );

  } catch (error) {
    console.error(
      "Session restoration failed:",
      error
    );

    currentUser = null;
    currentProfile = null;

    const dashboard = $("dashboard");

    if (dashboard) {
      dashboard.classList.add("hidden");
    }

    const login = $("login");

    if (login) {
      login.classList.remove("hidden");
    }

    if (db) {
      await db.auth.signOut();
    }

    message(
      error.message ||
      "Your session could not be verified. Please sign in again."
    );
  }
}


// ======================================================
// 13. MONITOR AUTHENTICATION CHANGES
// ======================================================

if (ready && db) {
  db.auth.onAuthStateChange(
    (event, session) => {
      /*
       * Do not perform additional database queries
       * inside this callback. Profile loading is handled
       * separately to avoid authentication deadlocks.
       */

      if (event === "SIGNED_OUT" || !session) {
        currentUser = null;
        currentProfile = null;

        const dashboard = $("dashboard");
        const placeholder = $("placeholder");
        const login = $("login");
        const signout = $("signout");

        if (dashboard) {
          dashboard.classList.add("hidden");
        }

        if (placeholder) {
          placeholder.classList.add("hidden");
        }

        if (login) {
          login.classList.remove("hidden");
        }

        if (signout) {
          signout.classList.add("hidden");
        }
      }
    }
  );
}


// ======================================================
// 14. START APPLICATION
// ======================================================

initializeInterface();

restoreSession();

console.info(
  "Zivamuntuyo Banking System initialized."
);

console.info(
  "Financial operations remain disabled until the required security and accounting controls are implemented."
);
