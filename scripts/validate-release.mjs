import { readFileSync, existsSync } from "node:fs";
import assert from "node:assert/strict";

const requiredFiles = ["index.html", "styles.css", "app.js"];
for (const file of requiredFiles) {
  assert.ok(existsSync(file), `Required application file is missing: ${file}`);
  assert.ok(readFileSync(file, "utf8").trim().length > 0, `Required application file is empty: ${file}`);
}

const html = readFileSync("index.html", "utf8");
const app = readFileSync("app.js", "utf8");
const css = readFileSync("styles.css", "utf8");

assert.match(html, /ZIVAMUNTUYO FINANCIAL SERVICES LTD/i, "Institution branding must be present");
assert.match(html, /id=["']login-form["']/, "Secure staff login form must be present");
assert.match(html, /id=["']sign-out-button["']/, "Sign-out control must be present");
assert.match(html, /src=["']app\.js["']/, "HTML must load the application JavaScript");
assert.match(html, /href=["']styles\.css["']/, "HTML must load the application stylesheet");
assert.match(app, /createClient\s*\(/, "Application must initialize the Supabase client");
assert.match(app, /switchPage/, "Application page-navigation entry point must exist");
assert.match(css, /@media\s*\(/, "Responsive layout breakpoints must be present");

const navButtons = [...html.matchAll(/class=["'][^"']*\bnav\b[^"']*["'][^>]*data-page=["']([^"']+)["']/g)];
assert.ok(navButtons.length >= 10, `Expected at least 10 navigation modules; found ${navButtons.length}`);

const localAssets = [
  ...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)
].map(match => match[1]).filter(value => !/^(?:https?:|data:|#|\/\/)/i.test(value));
for (const asset of localAssets) {
  if (/\.(?:js|css|svg|png|jpe?g|webp|ico)$/i.test(asset)) {
    assert.ok(existsSync(asset), `HTML references a missing local asset: ${asset}`);
  }
}

assert.doesNotMatch(app, /sb_secret_[A-Za-z0-9_-]{20,}/, "A Supabase secret key must never be embedded in browser code");
assert.doesNotMatch(app, /service_role\s*[:=]\s*["'][^"']{20,}["']/i, "A service-role credential must never be embedded in browser code");
assert.doesNotMatch(app, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, "Private keys must never be embedded in browser code");

assert.match(app, /window\.toggleJointHolderFields/, "Joint account ownership selector must expose the holder workflow");
assert.match(app, /add_joint_account_holder_to_pending_request/, "Joint account holder registration must call a trusted RPC");
assert.match(app, /send_vic_line_direct_message/, "VIC LINE direct messages must use the trusted private-message RPC");
assert.match(app, /list_vic_line_direct_messages/, "VIC LINE must load private conversation history through the trusted RPC");

assert.match(app, /window\.loadLoanDueDashboard/, "Loans page must include the database-backed due-date dashboard");
assert.match(app, /list_loan_due_alert_dashboard/, "Loan due-date dashboard must query the trusted servicing RPC");
assert.ok(existsSync("supabase/sql/loan_servicing_dashboard_and_alerts_draft.sql"), "Loan servicing dashboard and alert generation draft must exist");
const loanSql = readFileSync("supabase/sql/loan_servicing_dashboard_and_alerts_draft.sql", "utf8");
assert.match(loanSql, /CREATE OR REPLACE FUNCTION public\.list_loan_due_alert_dashboard/, "Loan dashboard SQL RPC must exist");
assert.match(loanSql, /ON CONFLICT \(idempotency_key\) DO NOTHING/, "Loan alert generation must be idempotent");
assert.match(loanSql, /GRANT EXECUTE ON FUNCTION public\.generate_loan_due_alerts\(date\) TO service_role/, "Automated alert generation must be restricted to the trusted service role");
assert.ok(existsSync("supabase/tests/financial_integrity_diagnostics.sql"), "Read-only financial integrity diagnostics must be present");
const diagnostics = readFileSync("supabase/tests/financial_integrity_diagnostics.sql", "utf8");
assert.match(diagnostics, /posted_journal_unbalanced/, "Financial diagnostics must check posted journal balance");
assert.match(diagnostics, /stored_account_balance_differs_from_ledger/, "Financial diagnostics must compare stored and ledger balances");
assert.match(app, /window\.clockInMyAttendance/, "Attendance page must expose manual web clock-in");
assert.match(app, /window\.clockOutMyAttendance/, "Attendance page must expose manual web clock-out");
assert.ok(existsSync("supabase/sql/staff_attendance_clock_rpc_draft.sql"), "Secure manual attendance RPC draft must be present");
const attendanceSql = readFileSync("supabase/sql/staff_attendance_clock_rpc_draft.sql", "utf8");
assert.match(attendanceSql, /clock_in_method,\s*status/, "Manual attendance records must record method and status");
assert.match(attendanceSql, /REVOKE ALL ON FUNCTION public\.clock_in_my_attendance/, "Attendance RPCs must revoke default public execution");



const receiptStart = app.indexOf("window.printAccountOpeningReceipt = function(){");
const receiptEnd = app.indexOf("window.printDormantReactivationReceipt", receiptStart);
assert.ok(receiptStart >= 0 && receiptEnd > receiptStart, "Account-opening receipt printer must exist");
const receiptCode = app.slice(receiptStart, receiptEnd);
assert.match(receiptCode, /r\.receipt_number/, "Account-opening receipt must use the server-returned receipt number");
assert.match(receiptCode, /r\.collection_status!==\"received\"/, "Account-opening receipt must reject missing server-confirmed collection status");
assert.doesNotMatch(receiptCode, /TOTAL RECEIVED: UGX 30,000/, "Receipt must not hard-code the paid amount");
assert.ok(existsSync("supabase/sql/joint_account_holders_and_approval_guard.sql"), "Joint account database safeguards must be checked into the repository");
const jointSql = readFileSync("supabase/sql/joint_account_holders_and_approval_guard.sql", "utf8");
assert.match(jointSql, /distinct_holder_count|v_joint_holder_count/, "Joint account approval must verify distinct holders");
assert.match(jointSql, /REVOKE ALL ON FUNCTION public\.add_joint_account_holder_to_pending_request/, "Joint-holder RPC must revoke default public execution");
assert.match(jointSql, /GRANT EXECUTE ON FUNCTION public\.add_joint_account_holder_to_pending_request.*authenticated/, "Joint-holder RPC must be explicitly granted to authenticated staff");
const directSql = readFileSync("supabase/sql/vic_line_private_messages.sql", "utf8");
assert.match(directSql, /CREATE OR REPLACE FUNCTION public\.send_vic_line_direct_message/, "Private messaging SQL must include a trusted send RPC");
assert.match(directSql, /CREATE OR REPLACE FUNCTION public\.mark_vic_line_direct_message_read/, "Private messaging SQL must include read receipts");


console.log(`Release static guard passed: ${requiredFiles.length} core files, ${navButtons.length} navigation modules, local asset references and basic secret-exposure checks.`);
console.log("Reminder: static checks do not verify Supabase RLS/RPC behavior, ledger integrity, hardware, or deployment.");
