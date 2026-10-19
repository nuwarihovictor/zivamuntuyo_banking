from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class StaffChatReceiptAttendanceRegressionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = (ROOT / "app.js").read_text(encoding="utf-8")
        cls.styles = (ROOT / "styles.css").read_text(encoding="utf-8")
        cls.chat_migration = (
            ROOT / "supabase/migrations/20261019080000_staff_chat_active_employee_rls.sql"
        ).read_text(encoding="utf-8")
        cls.vercel_config = (ROOT / "vercel.json").read_text(encoding="utf-8")
        cls.attendance_migration = (
            ROOT / "supabase/migrations/20261019090000_staff_attendance_event_rls.sql"
        ).read_text(encoding="utf-8")
        cls.cash_migration = (
            ROOT / "supabase/migrations/20261019070000_require_active_employee_for_cash_rpcs.sql"
        ).read_text(encoding="utf-8")

    def test_html_escape_covers_quotes_for_attribute_values(self):
        self.assertIn('.replace(/"/g, "&quot;")', self.app)
        self.assertIn("replace(/'/g, \"&#39;\")", self.app)

    def test_staff_chat_uses_authenticated_supabase_user(self):
        self.assertIn("db.auth.getUser()", self.app)
        self.assertIn('db.from("staff_chat_messages")', self.app)
        self.assertIn("sender_user_id:userData.user.id", self.app)
        self.assertIn("window.sendStaffMessage", self.app)

    def test_staff_chat_has_active_employee_rls_and_no_mutation_policy(self):
        self.assertIn("ALTER TABLE public.staff_chat_messages ENABLE ROW LEVEL SECURITY", self.chat_migration)
        self.assertIn("ep.is_active = true", self.chat_migration)
        self.assertIn("public.staff_messages", self.chat_migration)  # explicitly preserves existing private messages
        self.assertNotIn("ALTER TABLE public.staff_messages", self.chat_migration)
        self.assertNotIn("DROP POLICY IF EXISTS staff_messages_read_participants", self.chat_migration)
        self.assertIn("sender_user_id = (SELECT auth.uid())", self.chat_migration)
        self.assertNotIn("FOR UPDATE", self.chat_migration.upper())
        self.assertNotIn("FOR DELETE", self.chat_migration.upper())

    def test_receipts_are_only_offered_for_posted_cash_transactions(self):
        self.assertIn('const isPosted=status==="posted"', self.app)
        self.assertIn('const isCashType=type==="deposit"||type==="withdrawal"', self.app)
        self.assertIn('data-receipt-status="posted"', self.app)
        self.assertIn('type!=="withdrawal"', self.app)
        self.assertIn("AMOUNT PAID OUT", self.app)
        self.assertIn("window.printTransactionReceipt", self.app)

    def test_branch_management_uses_authorized_admin_rpcs(self):
        self.assertIn("window.loadBranchManagement", self.app)
        self.assertIn('db.rpc("current_employee_role_code")', self.app)
        self.assertIn('roleResult.data==="system_admin"', self.app)
        self.assertIn(".branch-admin-controls[hidden] { display: none !important; }", self.styles)
        self.assertIn('db.rpc("admin_create_branch"', self.app)
        self.assertIn('db.rpc("admin_update_branch"', self.app)
        self.assertIn('db.rpc("admin_set_branch_active"', self.app)
        self.assertIn("Branch creation could not be confirmed", self.app)
        self.assertIn("Branch update could not be confirmed", self.app)
        self.assertIn("Branch status change could not be confirmed", self.app)

    def test_manual_attendance_is_not_misrepresented_as_biometric(self):
        self.assertIn("no fingerprint device is connected yet", self.app)
        self.assertIn("not fingerprint-verified", self.app)
        self.assertIn("window.recordStaffAttendancePunch", self.app)

    def test_cash_rpcs_keep_active_employee_and_separation_of_duties_guards(self):
        self.assertIn("Active employee profile required", self.cash_migration)
        self.assertIn("current_employee_can_transact_in_branch", self.cash_migration)
        self.assertIn("Transaction must be approved and pending posting", self.cash_migration)
        self.assertIn("v_j.created_by=auth.uid() OR v_j.approved_by=auth.uid()", self.cash_migration)
        self.assertIn("Ledger entries already exist for this request; duplicate posting is blocked", self.cash_migration)
        self.assertIn("Insufficient available balance", self.cash_migration)
        self.assertIn("same currency and branch", self.cash_migration)
        # The function pins an empty search_path, so use the pg_catalog UUID generator.
        self.assertIn("pg_catalog.gen_random_uuid()", self.cash_migration)
        self.assertNotIn("gen_random_bytes(3)", self.cash_migration)
        self.assertIn("REVOKE ALL ON FUNCTION public.post_approved_cash_transaction", self.cash_migration)
        self.assertIn("TO authenticated, service_role", self.cash_migration)

    def test_deployment_has_baseline_browser_security_headers(self):
        self.assertIn("X-Content-Type-Options", self.vercel_config)
        self.assertIn("nosniff", self.vercel_config)
        self.assertIn("X-Frame-Options", self.vercel_config)
        self.assertIn("DENY", self.vercel_config)
        self.assertIn("strict-origin-when-cross-origin", self.vercel_config)

    def test_attendance_ui_and_database_transition_guards(self):
        self.assertIn("window.recordStaffAttendancePunch", self.app)
        self.assertIn('db.from("staff_attendance_events")', self.app)
        self.assertIn("employee_user_id = (SELECT auth.uid())", self.attendance_migration)
        self.assertIn("event_source = 'manual'", self.attendance_migration)
        self.assertIn("enforce_staff_attendance_transition", self.attendance_migration)
        self.assertIn("Employee is already clocked in", self.attendance_migration)
        self.assertIn("REVOKE ALL ON TABLE public.staff_attendance_events FROM PUBLIC, anon, authenticated", self.attendance_migration)
        self.assertNotIn("service_role", (ROOT / "app.js").read_text(encoding="utf-8").lower())


    def test_receipt_html_escapes_every_database_derived_display_value(self):
        start = self.app.index('window.printTransactionReceipt = function')
        end = self.app.index('document.addEventListener("click",function(event){', start)
        receipt = self.app[start:end]
        self.assertIn('const safe=value=>String(value).replace(/[&<>"\']', receipt)
        self.assertIn('${safe(reference)}', receipt)
        self.assertIn('${safe(transactionDate||"Not provided")}', receipt)
        self.assertIn('${safe(branch||"Not provided")}', receipt)
        self.assertIn('${safe(account||"Not provided")}', receipt)
        self.assertIn('${safe(money)}', receipt)

    def test_receipt_rejects_invalid_type_and_nonpositive_or_nonfinite_amount(self):
        start = self.app.index('window.printTransactionReceipt = function')
        end = self.app.index('document.addEventListener("click",function(event){', start)
        receipt = self.app[start:end]
        self.assertIn('receiptStatus!=="posted"', receipt)
        self.assertIn('(type!=="deposit"&&type!=="withdrawal")', receipt)
        self.assertIn('!Number.isFinite(amount)||amount<=0', receipt)
        self.assertIn('if(!printWindow)', receipt)

    def test_cash_approval_lists_handle_missing_backend_and_independent_list_errors(self):
        start = self.app.index("window.loadCashApprovals = async function()")
        end = self.app.index("window.approveCashRequest = async function", start)
        loader = self.app[start:end]
        self.assertIn('if (!db)', loader)
        self.assertIn('const safeRpc = async (name)', loader)
        self.assertIn('Promise.all([', loader)
        self.assertIn('if (pending.error)', loader)
        self.assertIn('if (ready.error)', loader)
        self.assertIn('One or more cash approval lists could not be refreshed.', loader)

    def test_approval_and_post_buttons_prevent_double_submit_and_recover_on_errors(self):
        approve_start = self.app.index("window.approveCashRequest = async function")
        post_start = self.app.index("window.postApprovedCashRequest = async function", approve_start)
        listener_start = self.app.index('document.addEventListener("click", function(event) {', post_start)
        approve = self.app[approve_start:post_start]
        post = self.app[post_start:listener_start]
        self.assertIn('if (button) button.disabled = true', approve)
        self.assertIn('finally {', approve)
        self.assertIn('if (button) button.disabled = false', approve)
        self.assertIn('if (button) button.disabled = true', post)
        self.assertIn('uuidPattern.test(cashLedgerId)', post)
        self.assertIn('finally {', post)
        self.assertIn('Refresh the approvals list and reconcile the transaction before retrying.', post)
        self.assertIn('window.approveCashRequest(approveButton.getAttribute("data-approve-journal"), approveButton)', self.app)
        self.assertIn('window.postApprovedCashRequest(postButton.getAttribute("data-post-journal"), postButton)', self.app)

    def test_successful_post_prints_receipt_for_deposits_and_withdrawals(self):
        start = self.app.index("window.postApprovedCashRequest = async function")
        end = self.app.index('document.addEventListener("click", function(event) {', start)
        posting = self.app[start:end]
        self.assertIn('["deposit","withdrawal"].includes(String(receiptDataButton.dataset.receiptType||"").toLowerCase())', posting)
        self.assertIn('window.printTransactionReceipt(receiptDataButton)', posting)

    def test_receipt_reprints_are_labelled_and_counted_in_current_transaction_list(self):
        start = self.app.index('window.printTransactionReceipt = function')
        end = self.app.index('document.addEventListener("click",function(event){', start)
        receipt = self.app[start:end]
        self.assertIn('const previousPrintCount=Number(button.dataset.receiptPrintCount||"0")', receipt)
        self.assertIn('REPRINT COPY — NOT A NEW TRANSACTION', receipt)
        self.assertIn('button.dataset.receiptPrintCount=String(previousPrintCount+1)', receipt)
        self.assertIn('${safe(copyLabel)}', receipt)

    def test_chat_rechecks_session_and_handles_send_failures_without_sticking_button(self):
        start = self.app.index('window.sendStaffMessage = async function')
        end = self.app.index('window.printTransactionReceipt = function', start)
        sender = self.app[start:end]
        self.assertIn('await db.auth.getUser()', sender)
        self.assertIn('if(submit)submit.disabled=true', sender)
        self.assertIn('finally{if(submit)submit.disabled=false;}', sender)
        self.assertIn('if(error) throw error;', sender)
        self.assertIn('Message was not sent:', sender)

    def test_chat_message_body_is_escaped_before_inserting_into_page(self):
        start = self.app.index('window.loadStaffChat = async function')
        end = self.app.index('window.sendStaffMessage = async function', start)
        loader = self.app[start:end]
        self.assertIn("esc(m.message_body)", loader)
        self.assertIn("message_body", loader)
        self.assertNotIn("'+m.message_body+'", loader)
        self.assertIn('.order("created_at",{ascending:false}).limit(100)', loader)


    def test_branch_admin_rpc_failures_are_reported_and_submit_controls_recover(self):
        create_start = self.app.index("window.createBranch = async function")
        update_start = self.app.index("window.updateBranch = async function", create_start)
        active_start = self.app.index("window.setBranchActive = async function", update_start)
        switch_start = self.app.index("window.switchPage = function", active_start)
        create_fn = self.app[create_start:update_start]
        update_fn = self.app[update_start:active_start]
        active_fn = self.app[active_start:switch_start]
        self.assertIn("try {", create_fn)
        self.assertIn("catch(error)", create_fn)
        self.assertIn("finally", create_fn)
        self.assertIn("if(submit)submit.disabled=false", create_fn)
        self.assertIn("try {", update_fn)
        self.assertIn("catch(error)", update_fn)
        self.assertIn("if(submit)submit.disabled=false", update_fn)
        self.assertIn("catch(error)", active_fn)
        self.assertIn("could not be confirmed", create_fn)
        self.assertIn("could not be confirmed", update_fn)
        self.assertIn("could not be confirmed", active_fn)
        self.assertIn("setBranchActive('${esc(b.id)}',${!b.is_active},this)", self.app)
        self.assertIn("if(button)button.disabled=true", active_fn)
        self.assertIn("if(button)button.disabled=false", active_fn)


if __name__ == "__main__":
    unittest.main()
