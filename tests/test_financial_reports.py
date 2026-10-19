"""Regression tests for accounting report integrity and safe failure states."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app.js"


class FinancialReportRegressionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = APP.read_text(encoding="utf-8")

    def test_reports_use_server_trial_balance_rpc_and_validate_rows_before_rendering(self):
        start = self.app.index("window.loadFinancialReports = async function()")
        end = self.app.index("window.loadTrialBalance = async function()", start)
        reports = self.app[start:end]
        self.assertIn('db.rpc("list_trial_balance", { p_branch_id: branchId || null })', reports)
        self.assertIn("window.validateTrialBalanceRows(rows)", reports)
        self.assertLess(reports.index("window.validateTrialBalanceRows(rows)"), reports.index("summary.innerHTML"))
        self.assertIn("No report figures are being shown", reports)

    def test_report_totals_are_grouped_by_currency_not_added_across_currencies(self):
        start = self.app.index("window.loadFinancialReports = async function()")
        end = self.app.index("window.loadTrialBalance = async function()", start)
        reports = self.app[start:end]
        self.assertIn("const currencies = Object.create(null)", reports)
        self.assertIn("rows.forEach(row =>", reports)
        self.assertIn("const currency = String(row.currency_code).trim()", reports)
        self.assertIn("const currencyEntries = Object.entries(currencies)", reports)
        self.assertIn("Currency totals are not combined", reports)

    def test_unbalanced_debits_credits_and_balance_sheet_differences_are_explicitly_flagged(self):
        start = self.app.index("window.loadFinancialReports = async function()")
        end = self.app.index("window.loadTrialBalance = async function()", start)
        reports = self.app[start:end]
        self.assertIn("STOP: trial balance is out of balance.", reports)
        self.assertIn("Balance sheet difference:", reports)
        self.assertIn("Independent reconciliation is still required.", reports)

    def test_branch_filters_are_uuid_validated_and_rpc_errors_fail_closed(self):
        for function_name, next_name in (
            ("window.loadFinancialReports = async function()", "window.loadTrialBalance = async function()"),
            ("window.loadTrialBalance = async function()", "window.loadCustomerRegistrationOptions = async function()"),
        ):
            start = self.app.index(function_name)
            end = self.app.index(next_name, start + len(function_name))
            body = self.app[start:end]
            self.assertIn("Enter a valid branch UUID or leave the field blank.", body)
            self.assertIn("if (error)", body)
            self.assertIn("try {", body)

    def test_report_exports_are_disabled_until_successful_rows_are_available(self):
        start = self.app.index("window.loadFinancialReports = async function()")
        end = self.app.index("window.loadTrialBalance = async function()", start)
        reports = self.app[start:end]
        self.assertIn("if (exportButton) exportButton.disabled = true", reports)
        self.assertIn("if (statementsExportButton) statementsExportButton.disabled = true", reports)
        self.assertIn("if (exportButton) exportButton.disabled = rows.length === 0", reports)
        self.assertIn("if (statementsExportButton) statementsExportButton.disabled = statementRows.length === 0", reports)


if __name__ == "__main__":
    unittest.main()
