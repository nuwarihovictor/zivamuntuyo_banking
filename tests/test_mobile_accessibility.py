"""Mobile accessibility checks for the banking application shell."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"


class MobileAccessibilityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = HTML.read_text(encoding="utf-8")

    def test_viewport_allows_users_to_zoom(self):
        self.assertIn('<meta name="viewport" content="width=device-width, initial-scale=1.0" />', self.html)
        self.assertNotIn("user-scalable=no", self.html)
        self.assertNotIn("maximum-scale=1.0", self.html)


if __name__ == "__main__":
    unittest.main()
