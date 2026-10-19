#!/usr/bin/env python3
"""Run the consolidated source and disposable-PostgreSQL release checks.

Database commands are intentionally blocked unless the caller explicitly marks
the target disposable and the connection is loopback + the expected test DB.
This script must never be used as a production migration runner.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = (
    "supabase/migrations/20261019043000_account_eligibility_guards.sql",
    "supabase/migrations/20261019050000_harden_public_branch_directory_and_ledger_grants.sql",
    "supabase/migrations/20261019060000_pin_financial_definer_search_paths.sql",
    "supabase/migrations/20261019070000_require_active_employee_for_cash_rpcs.sql",
    "supabase/migrations/20261019080000_staff_chat_active_employee_rls.sql",
    "supabase/migrations/20261019090000_staff_attendance_event_rls.sql",
    "supabase/migrations/20261019100000_customer_kyc_review_rpc.sql",
)
SQL_CHECKS = (
    "tests/postgres/draft_migration_assertions.sql",
    "tests/postgres/opening_package_wrapper_atomicity.sql",
    "tests/postgres/cash_transaction_request_security.sql",
    "tests/postgres/staff_chat_rls_assertions.sql",
    "tests/postgres/staff_attendance_rls_assertions.sql",
    "tests/postgres/customer_kyc_review_assertions.sql",
)
FIXTURE = "tests/postgres/draft_migration_fixture.sql"


def validate_disposable_target(env: dict[str, str]) -> tuple[bool, str]:
    """Return whether a DB target is safe for destructive fixture/migration tests."""
    if env.get("ZIVAMUNTUYO_DISPOSABLE_DB") != "1":
        return False, "Set ZIVAMUNTUYO_DISPOSABLE_DB=1 only for an explicitly disposable test database."
    host = (env.get("PGHOST") or "").strip().lower()
    if host not in {"localhost", "127.0.0.1", "::1"}:
        return False, "Refusing database tests: PGHOST must be loopback (localhost/127.0.0.1/::1)."
    hostaddr = (env.get("PGHOSTADDR") or "").strip()
    if hostaddr and hostaddr not in {"127.0.0.1", "::1"}:
        return False, "Refusing database tests: PGHOSTADDR must be loopback when supplied."
    if env.get("PGDATABASE") != "banking_test":
        return False, "Refusing database tests: PGDATABASE must be exactly 'banking_test'."
    return True, "Disposable PostgreSQL target accepted."


def run(command: list[str], *, env: dict[str, str] | None = None) -> None:
    print("\n+ " + " ".join(command), flush=True)
    subprocess.run(command, cwd=ROOT, env=env, check=True)


def main() -> int:
    static_only = "--static-only" in sys.argv[1:]
    for executable in ("node", "python"):
        if shutil.which(executable) is None:
            print(f"Required executable not found: {executable}", file=sys.stderr)
            return 2

    run(["node", "--check", "app.js"])
    run(["node", "--check", "scripts/build_web_config.js"])
    run(["node", "tests/test_financial_report_math.js"])
    run(["python", "-m", "unittest", "discover", "-s", "tests", "-p", "test_*.py", "-v"])

    try:
        from pglast import parse_sql
    except ImportError:
        print("Missing dependency 'pglast'. Install it with: python -m pip install pglast", file=sys.stderr)
        return 2

    for relative in MIGRATIONS:
        parse_sql((ROOT / relative).read_text(encoding="utf-8"))
        print(f"SQL syntax parsed: {relative}")

    if static_only:
        print("\nStatic preflight passed. Database migrations were not run.")
        return 0

    safe, reason = validate_disposable_target(dict(os.environ))
    print(reason)
    if not safe:
        print("No database commands were executed.", file=sys.stderr)
        return 3
    if shutil.which("psql") is None:
        print("Required executable not found: psql", file=sys.stderr)
        return 2

    psql = ["psql", "-v", "ON_ERROR_STOP=1", "-X"]
    run(psql + ["-f", FIXTURE])
    for relative in MIGRATIONS:
        run(psql + ["-f", relative])
    for relative in SQL_CHECKS:
        run(psql + ["-f", relative])

    print("\nCONSOLIDATED RELEASE PREFLIGHT PASSED.")
    print("This verifies disposable fixtures only; production-shaped staging and device acceptance remain separate release gates.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except subprocess.CalledProcessError as exc:
        print(f"Release preflight failed with exit code {exc.returncode}.", file=sys.stderr)
        raise SystemExit(exc.returncode)
