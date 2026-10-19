"""Static checks for the audited KYC review workflow."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app.js"
MIGRATION = ROOT / "supabase/migrations/20261019100000_customer_kyc_review_rpc.sql"
PREFLIGHT = ROOT / "scripts/release_preflight.py"


class CustomerKycReviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = APP.read_text(encoding="utf-8")
        cls.sql = MIGRATION.read_text(encoding="utf-8")
        cls.preflight = PREFLIGHT.read_text(encoding="utf-8")

    def test_review_ui_calls_audited_rpc_and_requires_reason(self):
        self.assertIn("window.reviewCustomerKyc = async function(customerId, decision)", self.app)
        self.assertIn('db.rpc("review_customer_kyc"', self.app)
        self.assertIn("reason.length < 8 || reason.length > 500", self.app)
        self.assertIn("current_employee_role_code", self.app)
        self.assertIn('["system_admin", "bank_admin", "branch_manager"].includes(role)', self.app)

    def test_rpc_checks_active_role_branch_and_pending_state(self):
        self.assertIn("SECURITY DEFINER", self.sql)
        self.assertIn("SET search_path = ''", self.sql)
        self.assertIn("Active employee profile required", self.sql)
        self.assertIn("Customer KYC review permission required", self.sql)
        self.assertIn("public.current_employee_can_transact_in_branch(v_branch_id)", self.sql)
        self.assertIn("Only pending_review customers can receive a KYC decision", self.sql)

    def test_rpc_writes_audit_and_revokes_anonymous_customer_table_access(self):
        self.assertIn("'customer_kyc_approved'", self.sql)
        self.assertIn("'customer_kyc_rejected'", self.sql)
        self.assertIn("INSERT INTO public.audit_events", self.sql)
        self.assertIn("REVOKE ALL ON TABLE public.customers FROM anon", self.sql)
        self.assertIn("REVOKE ALL ON FUNCTION public.review_customer_kyc(uuid, text, text) FROM PUBLIC, anon", self.sql)

    def test_preflight_executes_new_migration_and_postgres_assertions(self):
        self.assertIn("20261019100000_customer_kyc_review_rpc.sql", self.preflight)
        self.assertIn("tests/postgres/customer_kyc_review_assertions.sql", self.preflight)


if __name__ == "__main__":
    unittest.main()
