"""Static checks for security headers applied by Vercel."""
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "vercel.json"


class VercelSecurityHeaderTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.config = json.loads(CONFIG.read_text(encoding="utf-8"))
        cls.headers = {
            item["key"].lower(): item["value"]
            for rule in cls.config.get("headers", [])
            for item in rule.get("headers", [])
        }

    def test_transport_security_header_enforces_https_for_one_year(self):
        self.assertEqual(self.headers.get("strict-transport-security"), "max-age=31536000")

    def test_existing_browser_security_headers_remain_enabled(self):
        self.assertEqual(self.headers.get("x-content-type-options"), "nosniff")
        self.assertEqual(self.headers.get("x-frame-options"), "DENY")
        self.assertEqual(self.headers.get("referrer-policy"), "strict-origin-when-cross-origin")
        self.assertIn("permissions-policy", self.headers)


if __name__ == "__main__":
    unittest.main()
