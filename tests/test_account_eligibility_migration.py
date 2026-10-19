"""No-dependency static checks for the draft account-eligibility migration.

Run from the repository root:
    python -m unittest discover -s tests -p 'test_*.py' -v

These checks inspect source text only. They do NOT parse or execute SQL and do
not replace PostgreSQL integration tests in a non-production environment.
"""
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "supabase" / "migrations" / "20261019043000_account_eligibility_guards.sql"


class AccountEligibilityMigrationStaticTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sql = MIGRATION.read_text(encoding="utf-8")

    def test_all_security_definer_functions_pin_empty_search_path(self):
        chunks = self.sql.split("CREATE OR REPLACE FUNCTION public.")
        functions = [chunk for chunk in chunks[1:] if "SECURITY DEFINER" in chunk.split("$function$;", 1)[0]]
        self.assertGreaterEqual(len(functions), 4)
        for function in functions:
            header_and_body = function.split("$function$;", 1)[0]
            self.assertIn("SET search_path = ''", header_and_body)

    def test_individual_account_creation_is_serialized_in_both_entry_points(self):
        self.assertGreaterEqual(self.sql.count("pg_catalog.pg_advisory_xact_lock"), 2)
        self.assertIn("upper(existing_type.type_code) = 'IND'", self.sql)
        self.assertIn("upper(old_type.type_code)='IND'", self.sql)
        self.assertIn("This customer already has an individual account", self.sql)

    def test_joint_account_approval_requires_two_distinct_holders(self):
        self.assertIn("IF v_type_code = 'JNT' THEN", self.sql)
        self.assertIn("count(DISTINCT ah.customer_id)", self.sql)
        self.assertIn("coalesce(v_holder_count,0) < 2", self.sql)
        self.assertIn("A joint account requires at least two distinct holders", self.sql)

    def test_new_joint_holder_path_is_pending_joint_only_and_checks_active_customer(self):
        self.assertIn("Holders can only be added before account approval", self.sql)
        self.assertIn("Additional holders can only be added to a joint account", self.sql)
        self.assertIn("Additional holder must be an active customer", self.sql)
        self.assertIn("This customer is already a holder on the account", self.sql)
        self.assertIn("REVOKE ALL ON FUNCTION public.add_pending_joint_account_holder(uuid,uuid) FROM PUBLIC, anon", self.sql)

    def test_both_account_opening_paths_require_active_customer(self):
        self.assertIn("Customer must be active before an account can be opened", self.sql)
        self.assertIn("Customer must be active and accessible before an account can be opened", self.sql)

    def test_currency_must_be_configured_and_active_in_both_entry_points(self):
        self.assertGreaterEqual(self.sql.count("FROM public.currencies c"), 2)
        self.assertGreaterEqual(self.sql.count("c.is_active=true"), 2)
        self.assertGreaterEqual(self.sql.count("Unsupported or inactive currency"), 2)
        self.assertNotIn("'UGX','USD','KES','TZS','RWF','BIF','CDF'", self.sql)

    def test_account_creation_checks_auth_employee_role_and_branch_scope(self):
        self.assertGreaterEqual(self.sql.count("Authentication required"), 4)
        self.assertGreaterEqual(self.sql.count("Active employee profile required"), 4)
        self.assertIn("current_employee_can_transact_in_branch(p_branch_id)", self.sql)
        self.assertIn("Customer is outside your authorized branch scope", self.sql)

    def test_audit_events_are_written_for_key_account_actions(self):
        self.assertIn("'account_request_created'", self.sql)
        self.assertIn("'account_request_approved'", self.sql)
        self.assertIn("'joint_account_holder_added'", self.sql)
        self.assertGreaterEqual(self.sql.count("INSERT INTO public.audit_events"), 4)


if __name__ == "__main__":
    unittest.main()
