"""Regression tests for branch-login session cleanup.

These are source-contract tests: they guard the order of the browser login flow.
They do not replace an authenticated staging test against Supabase.
"""
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
APP_JS = (ROOT / "app.js").read_text(encoding="utf-8")


class BranchLoginCleanupTests(unittest.TestCase):
    def test_branch_authorization_precedes_branch_workspace_activation(self):
        start = APP_JS.index("async function handleStaffLogin(event)")
        end = APP_JS.index("async function handleStaffSignOut()", start)
        handler = APP_JS[start:end]

        authorization_check = handler.index(
            'db.rpc("current_employee_can_transact_in_branch"'
        )
        denial_check = handler.index("if (allowed !== true)", authorization_check)
        activate_context = handler.index("activeBranchContext = requestedBranch")
        self.assertLess(authorization_check, denial_check)
        self.assertLess(denial_check, activate_context)

    def test_failed_branch_login_attempt_clears_any_existing_session(self):
        start = APP_JS.index("async function handleStaffLogin(event)")
        end = APP_JS.index("async function handleStaffSignOut()", start)
        handler = APP_JS[start:end]
        catch_start = handler.index("} catch (error) {")
        catch_end = handler.index("} finally {", catch_start)
        catch_block = handler[catch_start:catch_end]

        self.assertIn("if (pendingBranchOpen)", catch_block)
        self.assertIn("activeBranchContext = null", catch_block)
        self.assertIn("db.auth.getSession()", catch_block)
        self.assertIn("await db.auth.signOut()", catch_block)
        self.assertLess(
            catch_block.index("await db.auth.signOut()"),
            catch_block.index('feedback.textContent = "Sign-in failed.')
        )

    def test_denied_branch_access_signs_out_before_reporting_denial(self):
        start = APP_JS.index("async function handleStaffLogin(event)")
        end = APP_JS.index("async function handleStaffSignOut()", start)
        handler = APP_JS[start:end]
        denied = handler.index("if (allowed !== true)")
        sign_out = handler.index("await db.auth.signOut()", denied)
        raise_error = handler.index("throw new Error(\"Your staff account is not authorized", sign_out)
        self.assertLess(denied, sign_out)
        self.assertLess(sign_out, raise_error)


if __name__ == "__main__":
    unittest.main()
