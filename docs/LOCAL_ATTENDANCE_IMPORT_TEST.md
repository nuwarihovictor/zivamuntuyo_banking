# Local attendance CSV import test (zero cost)

**Purpose:** validate the format and basic quality of synthetic or exported attendance CSV records locally, without a database connection, cloud upload, paid service, or production write.

## Run it

1. Open `tools/local-attendance-import-test.html` from the repository and save/download the file to a Windows 10 or Windows 11 computer.
2. Open the local HTML file in a current Microsoft Edge or Google Chrome browser.
3. Choose a CSV export, or press **Load synthetic sample** to test with fake employee IDs and fake events.
4. Enter known synthetic employee IDs, one per line, and select **Validate locally**.
5. Confirm that unknown employee IDs, missing time zones, invalid event types, duplicate event IDs, malformed rows, and missing device IDs are rejected.
6. Record the exact device make/model, firmware, export method, column mapping, timestamp/time-zone convention, and Windows/browser version separately in the hardware acceptance checklist.

## Required CSV schema for this test

`employee_id,timestamp,event_type,device_id,event_id`

- `employee_id`: device enrolment ID mapped to an employee by an authorised administrator.
- `timestamp`: parseable timestamp with explicit UTC marker or offset, e.g. `2026-10-19T08:01:00+03:00`.
- `event_type`: `clock_in` or `clock_out`.
- `device_id`: stable device identifier.
- `event_id`: stable unique event identifier from the device/export, if available. If a vendor does not supply this, an adapter must create a deterministic deduplication key from documented source fields and be tested before production use.

Vendor CSV exports commonly use different column names. Do not guess mappings silently; document a per-device adapter and test it with synthetic fixtures before enabling import.

## Limits and safety

- This page is a **format test only**. It does not connect to the attendance tables, save records, verify a fingerprint, verify that a device is genuine, or determine whether an employee is currently active in the official database.
- “Valid format” is not the same as “valid attendance.” Server-side checks must still enforce active employee mapping, authorised device identity, event ordering, branch/role rules, idempotency, timestamps, and audit records.
- The known employee IDs entered here remain in the page's memory only. Use synthetic IDs; do not paste personal data or real staff records into a test.
- Do not use imported rows as proof of attendance or payroll evidence until a real device adapter has been reviewed and tested in isolated staging.
- No purchases, paid SDKs, subscriptions, or chargeable cloud resources are required for this test.
