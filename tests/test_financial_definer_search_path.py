"""Regression checks for the financial activity SECURITY DEFINER search path."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "supabase" / "migrations" / "20261019060000_pin_financial_definer_search_paths.sql"
ASSERTIONS = ROOT / "tests" / "postgres" / "draft_migration_assertions.sql"


class FinancialDefinerSearchPathTests(unittest.TestCase):
    def test_financial_activity_function_uses_empty_search_path(self):
        sql = MIGRATION.read_text(encoding="utf-8")
        self.assertIn("ALTER FUNCTION public.record_financial_activity(uuid,text,numeric,text,text,uuid,uuid,date)", sql)
        self.assertIn("SET search_path = ''", sql)
        self.assertNotIn("'record_financial_activity',", sql)

    def test_postgres_assertion_checks_empty_search_path_setting(self):
        sql = ASSERTIONS.read_text(encoding="utf-8")
        self.assertIn('p.proconfig @> ARRAY[\'search_path=""\']', sql)


if __name__ == "__main__":
    unittest.main()
