"""Static regression tests for financial report CSV export."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app.js"


class FinancialReportExportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = APP.read_text(encoding="utf-8")

    def test_csv_export_is_explicitly_disabled_until_report_rows_load(self):
        self.assertIn('id="reports-export-csv" onclick="window.exportFinancialReportsCsv()" disabled', self.app)
        self.assertIn('if (exportButton) exportButton.disabled = rows.length === 0;', self.app)
        self.assertIn('if (exportButton) exportButton.disabled = true;', self.app)

    def test_export_uses_authorized_trial_balance_rpc_results_not_direct_ledger_tables(self):
        handler = self.app.split("window.exportFinancialReportsCsv = function()", 1)[1].split("window.loadFinancialReports = async function()", 1)[0]
        self.assertIn("window._financialReportRows", handler)
        self.assertIn('["debit_total", "debit_total"]', handler)
        self.assertIn('["credit_total", "credit_total"]', handler)
        self.assertNotIn('db.from("general_ledger_accounts")', handler)
        self.assertNotIn('db.from("ledger_journal_entries")', handler)

    def test_csv_export_escapes_quotes_and_spreadsheet_formulas(self):
        handler = self.app.split("window.exportFinancialReportsCsv = function()", 1)[1].split("window.loadFinancialReports = async function()", 1)[0]
        self.assertIn('text.replace(/"/g, \'""\')', handler)
        self.assertIn('/^[-=+@\\t\\r]/.test(text)', handler)
        self.assertIn('type:"text/csv;charset=utf-8;"', handler)
        self.assertIn('new Blob(["\\uFEFF" + lines.join("\\r\\n") + "\\r\\n"]', handler)
        self.assertIn("URL.revokeObjectURL(url)", handler)

    def test_no_report_data_cannot_be_exported_as_a_valid_report(self):
        handler = self.app.split("window.exportFinancialReportsCsv = function()", 1)[1].split("window.loadFinancialReports = async function()", 1)[0]
        self.assertIn("No loaded trial-balance rows to export.", handler)
        self.assertIn('if (button) button.disabled = true;', handler)


if __name__ == "__main__":
    unittest.main()
