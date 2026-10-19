"""Regression checks that browser code uses approved ledger RPCs only."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app.js"
MIGRATION = ROOT / "supabase" / "migrations" / "20261019050000_harden_public_branch_directory_and_ledger_grants.sql"


class LedgerAccessRegressionTests(unittest.TestCase):
    def test_browser_does_not_query_ledger_tables_directly(self):
        app = APP.read_text(encoding="utf-8")
        for table in ("general_ledger_accounts", "ledger_journal_entries"):
            self.assertNotIn(f'from("{table}")', app)
            self.assertNotIn(f"from('{table}')", app)

    def test_privilege_migration_revokes_direct_browser_access(self):
        sql = MIGRATION.read_text(encoding="utf-8")
        self.assertIn("REVOKE ALL ON TABLE public.general_ledger_accounts FROM anon, authenticated", sql)
        self.assertIn("REVOKE ALL ON TABLE public.ledger_journal_entries FROM anon, authenticated", sql)


if __name__ == "__main__":
    unittest.main()
