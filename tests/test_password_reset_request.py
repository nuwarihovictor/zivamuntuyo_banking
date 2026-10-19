from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class PasswordResetRequestTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = (ROOT / "app.js").read_text(encoding="utf-8")
        cls.html = (ROOT / "index.html").read_text(encoding="utf-8")

    def test_login_offers_password_reset_without_admin_secret(self):
        self.assertIn('id="password-reset-button"', self.html)
        self.assertIn('id="login-email"', self.html)
        self.assertIn('db.auth.resetPasswordForEmail(email', self.app)
        self.assertIn('window.location.origin + window.location.pathname', self.app)

    def test_reset_validates_email_and_uses_generic_response(self):
        start = self.app.index("async function handlePasswordReset()")
        end = self.app.index("async function handleStaffSignOut()", start)
        handler = self.app[start:end]
        self.assertIn(r"/^[^\s@]+@[^\s@]+\.[^\s@]+$/", handler)
        self.assertIn("If this address belongs to a staff account", handler)
        self.assertNotIn("service_role", handler)
        self.assertNotIn("admin.updateUserById", handler)

    def test_reset_button_is_bound_during_initialization(self):
        self.assertIn('document.getElementById("password-reset-button")?.addEventListener("click", handlePasswordReset)', self.app)


if __name__ == "__main__":
    unittest.main()
