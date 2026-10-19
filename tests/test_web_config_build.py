"""Environment isolation tests for generated browser configuration."""
from __future__ import annotations

import base64
import json
import os
import re
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "build_web_config.js"
PRODUCTION_URL = "https://hwghiezvghdqxnhcnpwk.supabase.co"


def run_build(overrides: dict[str, str]):
    env = os.environ.copy()
    for key in ("SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY", "VERCEL_ENV"):
        env.pop(key, None)
    env.update(overrides)
    with tempfile.TemporaryDirectory() as temp:
        result = subprocess.run(
            ["node", str(SCRIPT)], cwd=temp, env=env,
            capture_output=True, text=True, check=False
        )
        output_dir = Path(temp) / "public"
        output_path = output_dir / "app-config.js"
        content = output_path.read_text(encoding="utf-8") if output_path.exists() else None
        public_files = sorted(item.name for item in output_dir.iterdir()) if output_dir.is_dir() else []
        return result, content, public_files


class WebConfigBuildTests(unittest.TestCase):
    def test_missing_environment_is_fail_closed_with_empty_config(self):
        result, content, public_files = run_build({"VERCEL_ENV": "preview"})
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIsNotNone(content)
        config_match = re.search(r"Object\.freeze\((\{.*\})\)", content)
        self.assertIsNotNone(config_match, content)
        config = json.loads(config_match.group(1))
        self.assertEqual(config, {"supabaseUrl": "", "supabaseAnonKey": ""})

    def test_build_outputs_a_complete_static_site_directory_without_repository_sources(self):
        result, content, public_files = run_build({
            "VERCEL_ENV": "preview",
            "SUPABASE_URL": "https://staging-example.supabase.co",
            "SUPABASE_PUBLISHABLE_KEY": "sb_publishable_example"
        })
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIsNotNone(content)
        self.assertEqual(set(public_files), {"index.html", "app.js", "styles.css", "logo.svg", "app-config.js"})
        self.assertNotIn("README.md", public_files)
        self.assertNotIn("scripts", public_files)
        self.assertNotIn("tests", public_files)

    def test_preview_refuses_production_database_url(self):
        result, content = run_build({
            "VERCEL_ENV": "preview",
            "SUPABASE_URL": PRODUCTION_URL,
            "SUPABASE_PUBLISHABLE_KEY": "sb_publishable_example"
        })
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Preview/local builds may not connect to the production Supabase project", result.stderr)
        self.assertIsNone(content)

    def test_preview_accepts_separate_staging_project_with_public_key(self):
        result, content = run_build({
            "VERCEL_ENV": "preview",
            "SUPABASE_URL": "https://staging-example.supabase.co",
            "SUPABASE_PUBLISHABLE_KEY": "sb_publishable_example"
        })
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("staging-example.supabase.co", content)
        self.assertIn("sb_publishable_example", content)

    def test_privileged_jwt_key_is_rejected(self):
        payload = base64.urlsafe_b64encode(json.dumps({"role": "service_role"}).encode()).decode().rstrip("=")
        token = "eyJhbGciOiJub25lIn0." + payload + ".signature"
        result, content = run_build({
            "VERCEL_ENV": "production",
            "SUPABASE_URL": PRODUCTION_URL,
            "SUPABASE_ANON_KEY": token
        })
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("privileged service key is forbidden", result.stderr)
        self.assertIsNone(content)

    def test_secret_key_prefix_is_rejected(self):
        result, content = run_build({
            "VERCEL_ENV": "production",
            "SUPABASE_URL": PRODUCTION_URL,
            "SUPABASE_PUBLISHABLE_KEY": "sb_secret_do_not_use"
        })
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("secret key is forbidden", result.stderr)
        self.assertIsNone(content)


if __name__ == "__main__":
    unittest.main()
