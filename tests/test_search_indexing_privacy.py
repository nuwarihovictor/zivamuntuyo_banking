"""Checks that the banking application shell discourages search indexing."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"


class SearchIndexingPrivacyTests(unittest.TestCase):
    def test_application_shell_has_noindex_directive(self):
        html = HTML.read_text(encoding="utf-8")
        self.assertIn('<meta name="robots" content="noindex, nofollow, noarchive">', html)


if __name__ == "__main__":
    unittest.main()
