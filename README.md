# Zivamuntuyo Banking System – initial source package

This is an initial responsive interface and Supabase email/password authentication shell, not a production banking system. It does not process financial transactions or show real customer/account balances.

## Deploy
1. In Supabase Project Settings → API / API Keys, copy the Project URL and the public publishable key (or legacy anon key).
2. Replace `PASTE_YOUR_SUPABASE_PROJECT_URL_HERE` and `PASTE_YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY_HERE` in `app.js` with your actual credentials.
3. Never use a service_role or secret key in browser code.
4. Upload `index.html`, `styles.css`, `app.js`, and `README.md` to the private GitHub repository, then import that repository into Vercel.

The profile query expects foreign-key relationships from `employee_profiles.role_id` to `staff_roles.id` and `employee_profiles.home_branch_id` to `branches.id`. If Supabase cannot resolve these joins, adjust the query or implement a secure profile endpoint. Do not weaken RLS to work around errors.

Before live banking: review RLS and RPC access; implement and test double-entry ledger posting, approval rules, idempotency, branch/country permissions, audit trail, backups/restores, monitoring, and compliance/accounting controls. Keep live transactions disabled until these controls pass review.
