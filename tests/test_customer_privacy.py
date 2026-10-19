"""Static privacy regressions for customer directory data minimization."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app.js"


class CustomerDirectoryPrivacyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = APP.read_text(encoding="utf-8")

    def test_customer_directory_uses_an_explicit_minimal_field_list(self):
        self.assertIn('db.from("customers").select("id,full_name,customer_number,phone_number,created_at")', self.app)
        self.assertNotIn('db.from("customers").select("*").order("created_at", { ascending: false })', self.app)

    def test_customer_query_errors_are_not_reported_as_an_empty_directory(self):
        self.assertIn("Customer records could not be loaded. Check your connection or access permissions.", self.app)
        self.assertIn("if (error) {", self.app)
        self.assertIn("if (!data || data.length === 0) {", self.app)

    def test_customer_directory_does_not_render_national_id_or_passport_number(self):
        self.assertIn('Identification: held in restricted customer record', self.app)
        self.assertNotIn('NIN: ${esc(cust.nin_or_passport)}', self.app)


if __name__ == "__main__":
    unittest.main()
