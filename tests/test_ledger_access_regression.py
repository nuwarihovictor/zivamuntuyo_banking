"""Regression checks that browser code uses approved ledger RPCs only."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app.js"
MIGRATION = ROOT / "supabase" / "migrations" / "20261019050000_harden_public_branch_directory_and_ledger_grants.sql"


class LedgerAccessRegressionTests(unittest.TestCase):
    def test_browser_does_not_query_rls_no_policy_tables_directly(self):
        app = APP.read_text(encoding="utf-8")
        # Read-only security advisor identified these exposed tables with RLS
        # enabled and no policies. The UI must use reviewed RPCs, not direct
        # browser table queries, until each table's intended access is reviewed.
        tables = (
            "application_feature_settings", "attendance_policies", "audit_events",
            "bank_settings", "branch_management_settings", "country_administrators",
            "employee_security_settings", "exchange_rates", "general_ledger_accounts",
            "ledger_accounts", "ledger_entries", "ledger_journal_entries",
            "ledger_journals", "loan_applications", "loans", "receipt_registry",
            "sql_test", "transaction_approval_rules", "transaction_approvals",
            "transaction_limits", "transactions", "transfer_requests",
        )
        for table in tables:
            with self.subTest(table=table):
                self.assertNotIn(f'from("{table}")', app)
                self.assertNotIn(f"from('{table}')", app)

    def test_privilege_migration_revokes_direct_browser_access(self):
        sql = MIGRATION.read_text(encoding="utf-8")
        self.assertIn("REVOKE ALL PRIVILEGES ON TABLE public.general_ledger_accounts", sql)
        self.assertIn("FROM PUBLIC, anon, authenticated", sql)
        self.assertIn("REVOKE ALL PRIVILEGES ON TABLE public.ledger_journal_entries", sql)


if __name__ == "__main__":
    unittest.main()
