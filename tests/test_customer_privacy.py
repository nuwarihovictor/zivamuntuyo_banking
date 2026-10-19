"""Static regressions for customer directory privacy and honest error states."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app.js"


class CustomerDirectoryPrivacyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = APP.read_text(encoding="utf-8")

    def test_customer_directory_has_retryable_loading_and_error_states(self):
        self.assertIn("window.loadCustomerDirectory = async function()", self.app)
        self.assertIn('if (!db)', self.app)
        self.assertIn('Database connection unavailable. Customer records were not loaded.', self.app)
        self.assertIn('onclick="window.loadCustomerDirectory()"', self.app)
        self.assertIn('Customer records could not be loaded. Check your connection and permissions, then retry.', self.app)
        self.assertIn('Loading customer records…', self.app)

    def test_sensitive_table_queries_do_not_use_wildcard_selects(self):
        sensitive_tables = (
            "customers", "bank_accounts", "audit_events", "staff_messages",
            "staff_chat_messages", "staff_attendance_events", "loan_applications",
        )
        for table in sensitive_tables:
            pattern = r""".from(["']""" + re.escape(table) + r"""["']).select(["']*["'])"""
            with self.subTest(table=table):
                self.assertIsNone(re.search(pattern, self.app), f"Wildcard select found for {table}")

    def test_customer_directory_uses_an_explicit_minimal_field_list(self):
        self.assertIn('db.from("customers").select("id,full_name,customer_number,phone_number,created_at")', self.app)
        self.assertNotIn('db.from("customers").select("*").order("created_at", { ascending: false })', self.app)

    def test_customer_directory_does_not_render_national_id_or_passport_number(self):
        self.assertIn('Identification: held in restricted customer record', self.app)
        self.assertNotIn('NIN: ${esc(cust.nin_or_passport)}', self.app)

    def test_failed_directory_request_is_not_reported_as_an_empty_directory(self):
        self.assertIn('Customer records could not be loaded because the request failed.', self.app)
        self.assertNotIn('if (listEl) listEl.innerHTML = `<p class="muted">No customer records found yet.</p>`;', self.app)


if __name__ == "__main__":
    unittest.main()
