"""Tests for release-preflight safety guards."""
import unittest

from scripts.release_preflight import validate_disposable_target


class DisposableTargetGuardTests(unittest.TestCase):
    def test_accepts_only_explicit_loopback_test_database(self):
        safe, _ = validate_disposable_target({
            "ZIVAMUNTUYO_DISPOSABLE_DB": "1",
            "PGHOST": "localhost",
            "PGDATABASE": "banking_test",
        })
        self.assertTrue(safe)

    def test_refuses_without_explicit_disposable_opt_in(self):
        safe, reason = validate_disposable_target({
            "PGHOST": "localhost",
            "PGDATABASE": "banking_test",
        })
        self.assertFalse(safe)
        self.assertIn("explicitly disposable", reason)

    def test_refuses_remote_host_even_with_opt_in(self):
        safe, reason = validate_disposable_target({
            "ZIVAMUNTUYO_DISPOSABLE_DB": "1",
            "PGHOST": "remote.example",
            "PGDATABASE": "banking_test",
        })
        self.assertFalse(safe)
        self.assertIn("loopback", reason)

    def test_refuses_non_test_database_name(self):
        safe, reason = validate_disposable_target({
            "ZIVAMUNTUYO_DISPOSABLE_DB": "1",
            "PGHOST": "localhost",
            "PGDATABASE": "production",
        })
        self.assertFalse(safe)
        self.assertIn("banking_test", reason)


if __name__ == "__main__":
    unittest.main()
