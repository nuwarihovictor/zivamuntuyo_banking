# Local receipt-printer test (zero cost)

**Purpose:** test local Windows printing without any Supabase connection, cloud resource, purchase, subscription, or real customer data.

## Run it

1. Open `tools/local-receipt-printer-test.html` from the repository on a Windows 10 or Windows 11 computer. Download the file first if opening from GitHub does not run it locally.
2. Open the downloaded file in current Microsoft Edge or Google Chrome. It runs locally and does not connect to the banking database.
3. Select 58 mm thermal, 80 mm thermal, or A4 layout to match the paper.
4. Select the installed printer in the browser print dialog. Check print preview, paper size, margins, scaling, and orientation before printing.
5. Print one synthetic test page. Check clipping, text wrapping, reference/amount visibility, feed, and cut.
6. Repeat with both deposit and withdrawal labels. Record Windows version, browser/version, printer make/model, driver, connection type, paper width, and outcome in the Windows field checklist.
7. Keep the test page marked **TEST ONLY** separate from customer transaction records and discard it after testing if no longer needed.

## What this does and does not prove

- It tests the local browser-to-printer path and basic paper layout at no additional cost.
- It does not test authentication, transaction status, actual receipt values, backend audit events, idempotency, or reprint history.
- It is not a customer receipt and must not be used as proof of payment.
- The app's current cash receipt print counter is held in the page's button data and is not durable across reloads. Do not claim durable reprint audit until a reviewed server-side audit workflow is implemented and verified in isolated staging.
- Payroll, account-opening, and dormant-reactivation receipts use separate code paths and still need accounting-owner review and test cases before release acceptance.

## Zero-cost safety

Do not buy a printer, driver, domain, SDK, subscription, or paid testing service. Do not enable paid trials or create chargeable cloud resources. If the printer is unavailable, keep hardware acceptance marked pending. Never connect the local test page to production.
