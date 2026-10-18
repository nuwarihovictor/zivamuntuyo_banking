# Transaction receipt printing checklist

## Supported receipt types
- [ ] Only records with status `posted` display a receipt button.
- [ ] Posted deposits display a deposit receipt.
- [ ] Posted withdrawals display a withdrawal receipt.
- [ ] Pending, failed, reversed, and other transaction types do not expose this receipt action.

## Receipt accuracy and safety
- [ ] Confirm reference, transaction date, branch, account number, amount, and currency against the posted transaction.
- [ ] Confirm deposit wording says "AMOUNT RECEIVED".
- [ ] Confirm withdrawal wording says "AMOUNT PAID OUT".
- [ ] Confirm invalid references, non-positive amounts, and unsupported types are rejected.
- [ ] Confirm receipt values are HTML-escaped before being written to the print window.
- [ ] Confirm pop-up blocking produces a clear message instead of reporting a successful print.

## Printer and browser checks
- [ ] Test an 80 mm thermal receipt printer and adjust printer margins if needed.
- [ ] Test the browser print dialog with a standard Windows printer.
- [ ] Test current Chrome and Edge on Windows 10 and Windows 11.
- [ ] Test long references and account numbers for wrapping.
- [ ] Confirm printed paper matches the on-screen preview and does not cut off the footer.

## Release notes
This change adds client-side receipt formatting for existing posted transaction records. It does not create or post a financial transaction, and it must not be treated as proof of settlement independently of the underlying ledger record.
