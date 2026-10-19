"""Static regressions for customer directory privacy and honest error states."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app.js"


class CustomerDirectoryPrivacyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = APP.read_text(encoding="utf-8")

    def test_customer_directory_has_retryable_loading_and_error_states(self):
        self.assertIn("window.loadCustomerDirectory = async function()", self.app)
        self.assertIn("if (!db)", self.app)
        self.assertIn("Database connection unavailable. Customer records were not loaded.", self.app)
        self.assertIn('onclick="window.loadCustomerDirectory()"', self.app)
        self.assertIn("Customer records could not be loaded. Check your connection and permissions, then retry.", self.app)
        self.assertIn("Loading customer records…", self.app)

    def test_sensitive_table_queries_do_not_use_wildcard_selects(self):
        sensitive_tables = (
            "customers", "bank_accounts", "audit_events", "staff_messages",
            "staff_chat_messages", "staff_attendance_events", "loan_applications",
        )
        for table in sensitive_tables:
            with self.subTest(table=table):
                self.assertNotIn(f'db.from("{table}").select("*")', self.app)
                self.assertNotIn(f"db.from('{table}').select('*')", self.app)

    def test_customer_directory_uses_an_explicit_minimal_field_list(self):
        self.assertIn('db.from("customers")', self.app)
        self.assertIn('.select("id,full_name,customer_number,phone_number,status,created_at")', self.app)
        self.assertNotIn('db.from("customers").select("*").order("created_at", { ascending: false })', self.app)

    def test_customer_directory_shows_kyc_status_for_pending_records(self):
        self.assertIn('.select("id,full_name,customer_number,phone_number,status,created_at")', self.app)
        self.assertIn('esc(cust.status || "status unknown")', self.app)
        self.assertIn('"Customer Directory & KYC Status"', self.app)

    def test_registration_branch_options_match_database_insert_authorization(self):
        options = self.app.split("window.loadCustomerRegistrationOptions = async function()", 1)[1].split("window.handleCustomerSubmit", 1)[0]
        self.assertIn('db.rpc("is_active_system_admin")', options)
        self.assertIn('db.rpc("is_active_bank_admin")', options)
        self.assertIn('db.rpc("current_employee_has_branch_access", { target_branch_id: branch.id })', options)
        self.assertIn('db.rpc("is_active_branch_manager_for", { target_branch_id: branch.id })', options)
        self.assertIn("authorizedBranches.push(branch)", options)
        self.assertIn("Branch permissions could not be verified", options)

    def test_customer_directory_does_not_render_national_id_or_passport_number(self):
        self.assertIn("Identification: held in restricted customer record", self.app)
        self.assertNotIn("NIN: " + chr(36) + "{esc(cust.nin_or_passport)}", self.app)

    def test_failed_directory_request_is_not_reported_as_an_empty_directory(self):
        self.assertIn("Customer records could not be loaded. Check your connection and permissions, then retry.", self.app)
        handler = self.app.split("window.loadCustomerDirectory = async function()", 1)[1].split("function transactionModuleTabs", 1)[0]
        self.assertLess(handler.index("if (error) throw error;"), handler.index("No customer records found yet."))
        self.assertIn("catch (error)", handler)
        self.assertIn('onclick="window.loadCustomerDirectory()"', handler)


if __name__ == "__main__":
    unittest.main()
