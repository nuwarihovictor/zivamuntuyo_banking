"""Regression tests for customer registration schema and accounting report integrity."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app.js"


class CustomerRegistrationSchemaAlignmentTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = APP.read_text(encoding="utf-8")

    def test_registration_uses_current_customer_schema_columns(self):
        handler = self.app.split("window.handleCustomerSubmit = async function(e)", 1)[1].split("window.searchAccountOpeningCustomers", 1)[0]
        for field in ("customer_number", "customer_type", "full_name", "identification_type",
                      "identification_number", "phone_number", "email", "physical_address",
                      "branch_id", "created_by", "status"):
            self.assertIn(field + ":", handler)
        self.assertNotIn("nin_or_passport:", handler)
        self.assertNotIn('address: formData.get("address")', handler)

    def test_registration_records_authenticated_creator_and_pending_review_status(self):
        handler = self.app.split("window.handleCustomerSubmit = async function(e)", 1)[1].split("window.searchAccountOpeningCustomers", 1)[0]
        self.assertIn('formData.get("branch_id")', handler)
        self.assertIn("db.auth.getUser()", handler)
        self.assertIn("created_by: authData.user.id", handler)
        self.assertIn('status: "pending_review"', handler)
        self.assertNotIn('status: "active"', handler)

    def test_customer_reference_uses_crypto_randomness_not_small_math_random_pool(self):
        handler = self.app.split("window.handleCustomerSubmit = async function(e)", 1)[1].split("window.searchAccountOpeningCustomers", 1)[0]
        self.assertIn("cryptoApi.getRandomValues(randomBytes)", handler)
        self.assertIn('const customerNumber = "CUST-"', handler)
        self.assertNotIn("Math.random()", handler)

    def test_form_captures_customer_type_identification_and_branch(self):
        page = self.app.split('else if (pageName === "Customers")', 1)[1].split('else if (pageName === "Accounts")', 1)[0]
        for field in ('name="customer_type"', 'name="identification_type"', 'name="identification_number"',
                      'name="physical_address"', 'name="branch_id"', 'id="customer-branch-id"'):
            self.assertIn(field, page)
        self.assertIn("window.loadCustomerRegistrationOptions()", page)


class FinancialReportIntegrityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = APP.read_text(encoding="utf-8")

    def test_both_report_views_validate_currency_and_numeric_values(self):
        validator = self.app.split("window.validateTrialBalanceRows = function(rows)", 1)[1].split("window.loadFinancialReports", 1)[0]
        self.assertIn('["debit_total", "credit_total", "net_balance"]', validator)
        self.assertIn("Number.isFinite(Number(row[field]))", validator)
        self.assertIn('String(row.currency_code || "").trim()', validator)
        self.assertGreaterEqual(self.app.count("window.validateTrialBalanceRows(rows)"), 2)

    def test_financial_report_warns_when_currency_totals_do_not_balance(self):
        report = self.app.split("window.loadFinancialReports = async function()", 1)[1].split("window.loadTrialBalance = async function()", 1)[0]
        self.assertIn('role="alert"', report)
        self.assertIn("trial balance is out of balance", report)
        self.assertIn("Do not treat this report as reconciled", report)

    def test_report_rpc_rejections_fail_closed_and_disable_export(self):
        report = self.app.split("window.loadFinancialReports = async function()", 1)[1].split("window.loadTrialBalance = async function()", 1)[0]
        self.assertIn("catch (error)", report)
        self.assertIn("window._financialReportRows = []", report)
        self.assertIn("exportButton.disabled = true", report)



class CashTransactionIntegritySourceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.migration = (ROOT / "supabase/migrations/20261019070000_require_active_employee_for_cash_rpcs.sql").read_text(encoding="utf-8")
        cls.assertions = (ROOT / "tests/postgres/draft_migration_assertions.sql").read_text(encoding="utf-8")

    def test_cash_request_and_approval_are_audited_and_reapproval_is_blocked(self):
        self.assertIn("'cash_transaction_requested'", self.migration)
        self.assertIn("'cash_transaction_approved'", self.migration)
        self.assertIn("approved_by IS NULL AND approved_at IS NULL", self.migration)
        self.assertIn("Only unapproved pending cash transaction requests can be approved", self.migration)
        self.assertIn("FAIL: a second approval overwrote the first approver", self.assertions)
        self.assertIn("FAIL: duplicate approval created extra approval audit event", self.assertions)

    def test_cash_posting_requires_active_employee_and_separate_approver(self):
        post = self.migration.split("CREATE OR REPLACE FUNCTION public.post_approved_cash_transaction", 1)[1]
        self.assertIn("Active employee profile required", post)
        self.assertIn("v_j.created_by=auth.uid() OR v_j.approved_by=auth.uid()", post)
        self.assertIn("Ledger entries already exist for this request; duplicate posting is blocked", post)
        self.assertIn("'cash_transaction_posted'", post)
        self.assertIn("INSERT INTO public.audit_events", post)


if __name__ == "__main__":
    unittest.main()
