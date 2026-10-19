"""Regression checks for staff chat and manual attendance safety guards."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app.js"


class StaffOperationsRegressionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = APP.read_text(encoding="utf-8")

    def test_staff_chat_requires_authenticated_user_and_limits_message_length(self):
        start = self.app.index("window.sendStaffMessage = async function(event)")
        end = self.app.index("window.printTransactionReceipt = function(button, skipConfirmation)", start)
        sender = self.app[start:end]
        self.assertIn("const message=input.value.trim()", sender)
        self.assertIn("if(!message)", sender)
        self.assertIn("message.length>1000", sender)
        self.assertIn("await db.auth.getUser()", sender)
        self.assertIn('db.from("staff_chat_messages").insert', sender)
        self.assertIn("finally{if(submit)submit.disabled=false;}", sender)

    def test_staff_chat_renders_message_body_as_escaped_text(self):
        start = self.app.index("window.loadStaffChat = async function()")
        end = self.app.index("window.sendStaffMessage = async function(event)", start)
        loader = self.app[start:end]
        self.assertIn('db.from("staff_chat_messages")', loader)
        self.assertIn("esc(m.message_body)", loader)
        self.assertIn(".limit(100)", loader)

    def test_manual_attendance_transition_uses_current_employees_own_latest_event(self):
        start = self.app.index("window.recordStaffAttendancePunch = async function()")
        end = len(self.app)
        punch = self.app[start:end]
        self.assertIn("await db.auth.getUser()", punch)
        self.assertIn('.eq("employee_user_id",userData.user.id)', punch)
        self.assertIn('.order("occurred_at",{ascending:false})', punch)
        self.assertIn('event_source:"manual"', punch)
        self.assertIn("idempotency_key:key", punch)
        self.assertIn("if(latestError)throw latestError", punch)
        self.assertIn("if(error)throw error", punch)


    def test_attendance_history_query_is_scoped_to_authenticated_employee(self):
        start = self.app.index("window.loadStaffAttendance = async function()")
        end = self.app.index("\\n};", start)
        loader = self.app[start:end]
        self.assertIn("await db.auth.getUser()", loader)
        self.assertIn('.eq("employee_user_id",userData.user.id)', loader)
        self.assertIn('.limit(30)', loader)

    def test_manual_attendance_is_not_described_as_biometric_verification(self):
        start = self.app.index("window.recordStaffAttendancePunch = async function()")
        end = len(self.app)
        punch = self.app[start:end]
        self.assertIn('event_source:"manual"', punch)
        self.assertNotIn('event_source:"fingerprint"', punch)


if __name__ == "__main__":
    unittest.main()
