# Loan schedule and repayment schema design (draft only)

Do not apply this file as SQL. It describes the entities and constraints to implement only after inspecting the actual Supabase schema and accounting procedures.

## Suggested entities
- loan_accounts: id, application_id, customer_id, branch_id, product_id, currency, approved_principal, disbursed_principal, disbursement_date, first_due_date, maturity_date, interest_method, rate_basis, annual_rate, day_count_convention, frequency, status, schedule_version, approved_by, created_at.
- loan_schedule_versions: id, loan_account_id, version_no, effective_date, reason, created_by, approved_by, approved_at, supersedes_version_id.
- loan_installments: id, loan_account_id, schedule_version_id, installment_no, due_date, principal_due, interest_due, fee_due, penalty_due, principal_paid, interest_paid, fee_paid, penalty_paid, status, paid_at.
- loan_repayments: id, loan_account_id, branch_id, receipt_no, external_reference, idempotency_key, value_date, received_at, amount, currency, channel, recorded_by, approved_by, status, reversed_repayment_id.
- loan_repayment_allocations: id, repayment_id, installment_id, component, amount, created_at.
- loan_collection_actions: id, loan_account_id, action_date, action_type, outcome, promise_amount, promise_date, next_action_date, assigned_to, notes, created_by.
- loan_collateral and loan_guarantors: linked to application/loan, with verification, consent, valuation, expiry and release fields.
- loan_audit_events: append-only record of status, term, approval, disbursement, payment, reversal, schedule and write-off changes.

## Database requirements
- All monetary values use fixed-precision NUMERIC, never floating point for authoritative accounting.
- Unique constraints for loan reference, schedule version per loan, installment number per version, receipt/idempotency key per institution scope, and journal source reference.
- Every disbursement/repayment/fee/penalty/write-off uses a trusted transaction that posts balanced journals and writes audit events.
- Prevent negative allocation and allocation greater than received amount; lock affected loan/schedule rows during allocation.
- Reversals are compensating records; original posted records remain immutable.
- Authorize role and branch inside every RPC; enable RLS on exposed tables and private storage; do not expose service-role keys in browser.
- Derive days past due and arrears as of a supplied business date from outstanding contractual instalments. Avoid a stored counter that becomes stale.
- Define whether interest accrues daily, monthly or by schedule and what happens during non-performing status only after policy/compliance approval.
- Do not create duplicate parallel loan tables if an equivalent schema already exists. Inspect the actual schema and extend it safely.
