"""Static source-contract tests for customer receipt safety.

These tests do not simulate a browser, printer, or live database. They guard
important receipt preconditions until isolated end-to-end testing is available.
"""
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
APP = (ROOT / "app.js").read_text(encoding="utf-8")


class ReceiptPrintSafetyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        start = APP.index("window.printTransactionReceipt = function(button, skipConfirmation)")
        end = APP.index('document.addEventListener("click",function(event)', start)
        cls.receipt_function = APP[start:end]

    def test_receipt_requires_posted_cash_transaction_and_valid_amount(self):
        code = self.receipt_function
        self.assertIn('receiptStatus!=="posted"', code)
        self.assertIn('(type!=="deposit"&&type!=="withdrawal")', code)
        self.assertIn('!reference', code)
        self.assertIn('!Number.isFinite(amount)||amount<=0', code)

    def test_manual_receipt_print_requires_confirmation(self):
        self.assertIn('if(!skipConfirmation && !confirm(', self.receipt_function)

    def test_popup_block_does_not_increment_print_count(self):
        code = self.receipt_function
        popup_failure = code.index('if(!printWindow)')
        increment = code.index('button.dataset.receiptPrintCount=String(previousPrintCount+1)')
        self.assertLess(popup_failure, increment)
        self.assertIn('return;', code[popup_failure:increment])

    def test_receipt_fields_are_escaped_before_html_insertion(self):
        code = self.receipt_function
        self.assertIn('const safe=value=>String(value).replace(', code)
        # Optional display fallbacks are intentionally applied before escaping.
        for expression in (
            'safe(reference)',
            'safe(transactionDate||"Not provided")',
            'safe(branch||"Not provided")',
            'safe(account||"Not provided")',
            'safe(money)',
        ):
            with self.subTest(expression=expression):
                self.assertIn(expression, code)

    def test_reprint_is_labelled_as_copy_not_new_transaction(self):
        self.assertIn('REPRINT COPY — NOT A NEW TRANSACTION', self.receipt_function)
        self.assertIn('ORIGINAL RECEIPT', self.receipt_function)

    def test_posting_rpc_succeeds_before_receipt_is_marked_posted_or_printed(self):
        start = APP.index("window.postApprovedCashRequest = async function")
        end = APP.index('document.addEventListener("click", function(event)', start)
        code = APP[start:end]
        rpc = code.index('db.rpc("post_approved_cash_transaction"')
        mark_posted = code.index('receiptDataButton.dataset.receiptStatus = "posted"')
        print_receipt = code.index('window.printTransactionReceipt(receiptDataButton)')
        self.assertLess(rpc, mark_posted)
        self.assertLess(mark_posted, print_receipt)


if __name__ == "__main__":
    unittest.main()
