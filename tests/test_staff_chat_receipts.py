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

    def test_staff_chat_uses_authenticated_supabase_user(self):
        self.assertIn("db.auth.getUser()", self.app)
        self.assertIn('db.from("staff_messages")', self.app)
        self.assertIn("sender_user_id:userData.user.id", self.app)
        self.assertIn("window.sendStaffMessage", self.app)

    def test_staff_chat_has_active_employee_rls_and_no_mutation_policy(self):
        self.assertIn("ALTER TABLE public.staff_messages ENABLE ROW LEVEL SECURITY", self.chat_migration)
        self.assertIn("ep.is_active = true", self.chat_migration)
        self.assertIn("sender_user_id = (SELECT auth.uid())", self.chat_migration)
        self.assertNotIn("FOR UPDATE", self.chat_migration.upper())
        self.assertNotIn("FOR DELETE", self.chat_migration.upper())

    def test_receipts_are_only_offered_for_posted_cash_transactions(self):
        self.assertIn('const isPosted=status==="posted"', self.app)
        self.assertIn('const isCashType=type==="deposit"||type==="withdrawal"', self.app)
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
        self.assertIn("Branch was not created:", self.app)
        self.assertIn("Branch changes were not saved:", self.app)

    def test_manual_attendance_is_not_misrepresented_as_biometric(self):
        self.assertIn("no fingerprint device is connected yet", self.app)
        self.assertIn("not fingerprint-verified", self.app)
        self.assertIn("window.recordStaffAttendancePunch", self.app)

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


if __name__ == "__main__":
    unittest.main()
