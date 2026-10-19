"""Regression tests for posted cash transaction receipt printing."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app.js"


class ReceiptPrintingRegressionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = APP.read_text(encoding="utf-8")

    def test_only_posted_deposits_and_withdrawals_offer_receipts(self):
        start = self.app.index('window.loadTransactionMonitor = async function()')
        end = self.app.index('window.loadStaffTimesheets = async function()', start)
        monitor = self.app[start:end]
        self.assertIn('const isPosted=status==="posted"', monitor)
        self.assertIn('const isCashType=type==="deposit"||type==="withdrawal"', monitor)
        self.assertIn('(isPosted&&isCashType)', monitor)
        self.assertIn('data-receipt-status="posted"', monitor)

    def test_receipt_handler_rejects_unposted_invalid_or_nonpositive_transactions(self):
        start = self.app.index('window.printTransactionReceipt = function(button, skipConfirmation)')
        end = self.app.index('document.addEventListener("click",function(event)', start)
        handler = self.app[start:end]
        self.assertIn('receiptStatus!=="posted"', handler)
        self.assertIn('(type!=="deposit"&&type!=="withdrawal")', handler)
        self.assertIn('!reference', handler)
        self.assertIn('!Number.isFinite(amount)', handler)
        self.assertIn('amount<=0', handler)
        self.assertIn('Receipt unavailable:', handler)

    def test_receipt_html_escapes_dynamic_fields_before_writing_popup(self):
        start = self.app.index('window.printTransactionReceipt = function(button, skipConfirmation)')
        end = self.app.index('document.addEventListener("click",function(event)', start)
        handler = self.app[start:end]
        self.assertIn('const safe=value=>String(value).replace(/[&<>"\']/', handler)
        self.assertIn('${safe(reference)}', handler)
        self.assertIn('${safe(branch||"Not provided")}', handler)
        self.assertIn('${safe(account||"Not provided")}', handler)
        self.assertIn('${safe(money)}', handler)

    def test_popup_blocking_does_not_mark_receipt_as_printed(self):
        start = self.app.index('window.printTransactionReceipt = function(button, skipConfirmation)')
        end = self.app.index('document.addEventListener("click",function(event)', start)
        handler = self.app[start:end]
        popup_error = handler.index('if(!printWindow)')
        print_count_update = handler.index('button.dataset.receiptPrintCount=String(previousPrintCount+1)')
        self.assertLess(popup_error, print_count_update)
        self.assertIn('Allow pop-ups for this site', handler)
        self.assertIn('window.print()', handler)

    def test_repeat_print_is_labeled_as_a_reprint_not_a_new_transaction(self):
        start = self.app.index('window.printTransactionReceipt = function(button, skipConfirmation)')
        end = self.app.index('document.addEventListener("click",function(event)', start)
        handler = self.app[start:end]
        self.assertIn('previousPrintCount>0?"REPRINT COPY — NOT A NEW TRANSACTION":"ORIGINAL RECEIPT"', handler)
        self.assertIn('previousPrintCount>0?"Reprint copy opened":"Receipt opened"', handler)


if __name__ == "__main__":
    unittest.main()
