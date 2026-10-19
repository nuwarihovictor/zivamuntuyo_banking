from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "tools" / "local-receipt-printer-test.html"


class LocalReceiptPrinterPageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")

    def test_page_is_obviously_test_only(self):
        self.assertIn("TEST ONLY", self.html)
        self.assertIn("NOT VALID", self.html)
        self.assertIn("NOT A FINANCIAL DOCUMENT", self.html)
        self.assertIn("synthetic", self.html.lower())

    def test_supports_common_paper_layouts(self):
        self.assertIn('value="58"', self.html)
        self.assertIn('value="80"', self.html)
        self.assertIn('value="a4"', self.html)

    def test_has_deposit_and_withdrawal_samples(self):
        self.assertIn('value="DEPOSIT"', self.html)
        self.assertIn('value="WITHDRAWAL"', self.html)

    def test_has_no_database_or_remote_network_dependency(self):
        forbidden = (
            r"https?://",
            r"supabase",
            r"fetch\s*\(",
            r"XMLHttpRequest",
            r"WebSocket",
        )
        for pattern in forbidden:
            self.assertIsNone(
                re.search(pattern, self.html, re.IGNORECASE),
                f"local printer test page must not use remote/database dependency: {pattern}",
            )

    def test_print_action_uses_browser_print_dialog(self):
        self.assertIn("window.print()", self.html)
        self.assertIn("getElementById(\"print\")", self.html)


if __name__ == "__main__":
    unittest.main()
