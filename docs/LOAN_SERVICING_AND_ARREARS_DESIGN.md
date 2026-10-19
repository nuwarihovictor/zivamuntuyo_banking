# Loan servicing and arrears management — release design

## Current verified position
The app has a loan application form, supporting-document upload, product rate selection, shareholding guidance, application listing and independent review/approval design. The existing UI explicitly warns that approving an application does not itself disburse funds or post a loan ledger. A full servicing ledger with authoritative instalment schedules, repayment posting, arrears ageing, collections and loan accounting has not been verified as implemented.

A browser-side repayment schedule preview has now been added to the Loans page. It supports three illustrative monthly calculation methods:
- Reducing balance with equal instalments.
- Reducing balance with equal principal.
- Flat interest on original principal.

It shows dated principal/interest instalments, balance after each instalment, estimated total interest, total payments and the grace-period end date. It is a planning preview only and does not create a loan, save a schedule, collect a payment or post accounting entries.

## Loan lifecycle to implement
1. Application received: unique application number, borrower/CIF, branch, product, amount, purpose, tenure, income/expense affordability, existing debt exposure, savings/shares if relevant, guarantors/collateral and private documents.
2. KYC and credit checks: identity and member eligibility, duplicate exposure checks, credit reference checks where lawful/available, sanctions/AML procedures where applicable, guarantor consent and collateral ownership/valuation.
3. Appraisal: affordability/debt-service assessment, policy limits, risk grade, exceptions and written officer recommendation.
4. Independent approval: configurable approval levels/committee, maker-checker separation, conflicts-of-interest rules, decision reasons and immutable audit trail. An applicant must not approve their own loan.
5. Offer and acceptance: approved amount, product/rate method, fees, instalment frequency, grace periods, first due date, holiday handling, maturity, late charges, prepayment terms and signed acceptance.
6. Disbursement: authorized release only after conditions precedent; disbursement transaction references and double-entry ledger posting; idempotency protection and receipt/advice.
7. Schedule: store a fixed snapshot of each instalment with due date, principal due, interest due, fees due, amount paid, outstanding amount, status and version. A change must create an audited reschedule version, not silently overwrite paid history.
8. Repayment: record payment channel, value date, amount, teller/reference, receipt number and idempotency key. Allocate by configurable policy to the oldest due instalment/components first (policy must be approved); support partial payment, exact settlement, overpayment handling and reversals with authorization.
9. Daily servicing: calculate due and overdue amounts, accrued interest where permitted, grace-period expiry, days past due (DPD), next due date, maturity alerts and collection queues. Run as a trusted server/database job using the institution's timezone and a controlled business date, not only when someone opens the browser.
10. Collections and restructuring: reminders, call/visit notes, promises-to-pay, guarantor follow-up, collateral actions, hardship/extension requests, rescheduling and write-off approval. Never silently erase arrears or charge unapproved penalties.
11. Closure: payoff quotation, final receipt, zero-balance check, release of collateral/guarantees and closure certificate.
12. Reporting: portfolio outstanding, due today/next 7/30 days, overdue buckets (1–7, 8–30, 31–60, 61–90, 90+ configurable), PAR30/PAR90, collection rates, disbursements, recoveries, rescheduled loans, write-offs, officer/branch/product analysis, maturity list, ageing and audit exports.

## Due-date notifications and overdue visual identification

The servicing module must provide a prominent due-date alert system, not just a schedule calculator.

- **Upcoming:** configurable reminders before an instalment is due (recommended defaults: 7 days, 3 days and 1 day; product/management settings can change them).
- **Due today:** clearly identify instalments due on the current institution business date.
- **Grace period:** show the grace-period end date separately from the contractual due date, and state clearly whether a payment is overdue or only within grace.
- **Overdue:** once the contractual due date and any configured grace rules have passed, show days past due (DPD), unpaid amount and oldest overdue instalment.
- **Escalation:** configurable follow-up stages, such as first reminder, call required, supervisor review and formal recovery queue. Staff must be able to record contact attempts and promises-to-pay.
- **Channels:** in-app dashboard and notification centre first; optional browser/desktop notifications and email/SMS/WhatsApp only when the institution configures and authorizes a supported provider. Delivery failure must be logged and retried safely. Do not claim an SMS or message was sent unless the provider confirms it.
- **Roles and branches:** notify only authorized staff for the relevant branch/portfolio, with escalation to approved supervisors. Do not expose full identity or loan details on lock-screen notifications.
- **Reliability:** generate alerts from saved authoritative repayment schedules in a trusted scheduled server/database job using the institution timezone/business date. Prevent duplicate alerts with an idempotency key; log creation, delivery attempts, acknowledgement and resolution. Alerts must not depend on a staff member keeping a browser tab open.
- **Visual legend:** use both a text label and a distinct icon/color so meaning remains clear for color-blind users and printed reports:
  - 🟢 **Upcoming** — not yet due.
  - 🔵 **Due today** — due on the business date.
  - 🟠 **Grace period** — due date passed, but configured grace has not expired.
  - 🔴 **Overdue** — unpaid after the applicable due/grace rule; display exact DPD and amount.
  - ⚫ **Closed/settled** — no outstanding scheduled amount.
  - 🟣 **Rescheduled** — schedule changed through an approved, audited process.
- **Dashboard views:** due today, due in 7/30 days, overdue by DPD bucket, overdue amount, assigned collection officer, next action and alert history. Provide filters for branch, product, officer and date.
- **Important:** status must be computed from the stored schedule, actual posted/allocated repayments and approved grace policy—not manually chosen emoji or a browser-only preview. A payment or authorized reschedule must update the status based on authoritative records.

## 

## Required screens
- Loan product configuration and calculator.
- Application pipeline and document checklist.
- Appraisal and affordability worksheet.
- Approval queue and decision history.
- Offer/contract print and acceptance checklist.
- Disbursement queue and disbursement advice.
- Loan account statement and full repayment schedule.
- Repayment capture, allocation preview, receipt and reversal workflow.
- Due-date calendar and dashboard: upcoming, due today, overdue and maturity.
- Arrears work queue with DPD, arrears amount, next action, owner and contact history.
- Guarantor and collateral register with valuation, expiry, legal status and release workflow.
- Reschedule/refinance/settlement request workflow.
- Write-off and recovery register.
- Portfolio and regulatory/accounting reports with filters by branch, product, currency, officer and period.

## Product terms that must be configurable
- Rate basis: flat or reducing balance; fixed or variable; annual/monthly basis and day-count convention.
- Repayment frequency: monthly, fortnightly, weekly, daily or approved custom schedule.
- Tenor, first due date, maturity date, instalment count, balloon/bullet options and grace periods.
- Calendar rules: weekend/public-holiday movement, business timezone, end-of-month behavior and leap years.
- Fees, taxes, insurance, disbursement deductions, late fees/penalty interest, caps and waivers. No penalty or fee should be assumed by code; each must be legally/policy approved.
- Allocation waterfall for payments, partial payments, prepayments, overpayments, accrued interest and fees.
- Arrears status/DPD thresholds, non-performing classification and accounting treatment, according to the applicable regulator and institution policy.
- Rescheduling, capitalization, refinancing, early settlement, rollover and write-off permissions.
- Approval limits by role, branch, amount, product and borrower exposure.

## Accounting and safety gates
- Every disbursement and repayment must post balanced double-entry journals through trusted database procedures.
- Loan balances and portfolio reports must derive from posted ledger/schedule events, not editable browser fields.
- Enforce branch/role authorization, RLS, maker-checker, audit logging, unique transaction references and idempotency.
- Reversals must be new linked compensating entries, never deletion/editing of posted transactions.
- Use database constraints and transaction locks to prevent double disbursement, duplicate repayment allocation and race conditions.
- Preserve historical terms and schedule versions for audit.
- Protect IDs, credit reports, bank statements, collateral documents and guarantor data in private storage with least-privilege access.

## Acceptance tests before production
- Verify all three preview methods against independently calculated test cases, including zero interest, one month, 360 months, month-end dates, leap year and final rounding.
- Compare the browser preview with an authoritative server/database schedule and confirm matching outputs.
- Test due today, grace period end, one day overdue, partial payment, multiple overdue instalments, overpayment, prepayment, payment reversal and reschedule.
- Verify no interest/penalty double-counting; validate approved allocation waterfall and any regulatory non-performing rules.
- Test branch restrictions, role restrictions, maker-checker, failed/duplicate requests, concurrent payment attempts and audit history.
- Reconcile schedule totals to posted ledger and bank/cash receipts; obtain accountant/credit manager sign-off.
- Test timezone/business-date rollover and reminders; test notification delivery failure and retry.
- Confirm applicable Uganda legal and regulatory requirements with qualified compliance counsel/regulator. The Microfinance Deposit-Taking Institutions Act applies to licensed MDIs, and Registered Societies Regulations apply to their defined scope; do not assume the same requirements apply to every SACCO or institution.

## Regulatory note
References consulted include Oracle FLEXCUBE loan servicing documentation for repayment schedules, grace periods, overdue statuses, prepayments and allocation; Uganda's Microfinance Deposit-Taking Institutions Act and Microfinance Deposit-Taking Institutions (Registered Societies) Regulations; and a published SACCO credit policy as an example of arrears follow-up procedures. These are design references, not legal advice or a substitute for checking the institution's exact licence and applicable current rules.
