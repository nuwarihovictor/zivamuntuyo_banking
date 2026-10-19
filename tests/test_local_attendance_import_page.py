"""Safety and regression checks for the offline attendance-import test page."""
from __future__ import annotations

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "tools" / "local-attendance-import-test.html"
GUIDE = ROOT / "docs" / "LOCAL_ATTENDANCE_IMPORT_TEST.md"


class LocalAttendanceImportPageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")
        cls.guide = GUIDE.read_text(encoding="utf-8")

    def test_page_is_explicitly_test_only_and_not_official_attendance(self):
        self.assertIn("TEST TOOL ONLY", self.html)
        self.assertIn("NOT CONNECTED TO THE BANKING DATABASE", self.html)
        self.assertIn("not proof that a fingerprint was scanned", self.html)
        self.assertIn("TEST ONLY", self.html)

    def test_page_has_no_remote_scripts_or_database_endpoints(self):
        self.assertNotRegex(self.html, r"<script\b[^>]*\bsrc\s*=")
        self.assertNotRegex(self.html, r"https?://")
        self.assertNotIn("createClient(", self.html)
        self.assertNotIn("fetch(", self.html)
        self.assertNotIn("XMLHttpRequest", self.html)
        self.assertNotIn("WebSocket(", self.html)

    def test_validator_requires_expected_columns_and_known_employee_mapping(self):
        for column in ("employee_id", "timestamp", "event_type", "device_id", "event_id"):
            self.assertIn('"' + column + '"', self.html)
        self.assertIn('else if(!known.has(employee))errors.push("unknown employee ID")', self.html)

    def test_validator_rejects_timezone_ambiguity_invalid_events_and_duplicates(self):
        self.assertIn("invalid timestamp/timezone", self.html)
        self.assertIn("![" + '"clock_in","clock_out"' + "].includes(event)", self.html)
        self.assertIn("duplicate event ID", self.html)
        self.assertIn("duplicate event row", self.html)
        self.assertIn("column count mismatch", self.html)

    def test_results_are_rendered_as_text_not_interpreted_html(self):
        self.assertIn("td.textContent=value", self.html)
        self.assertNotIn("innerHTML=values", self.html)

    def test_sample_contains_both_valid_and_deliberately_invalid_rows(self):
        self.assertIn("Load synthetic sample", self.html)
        self.assertIn("EMP999", self.html)
        self.assertIn("2026-10-19T08:05:00", self.html)
        self.assertIn("TEST-EVENT-001", self.html)

    def test_documentation_clearly_limits_scope_to_format_validation(self):
        self.assertIn("format test only", self.guide)
        self.assertIn("does not connect to the attendance tables", self.guide)
        self.assertIn("No purchases, paid SDKs, subscriptions", self.guide)


if __name__ == "__main__":
    unittest.main()
