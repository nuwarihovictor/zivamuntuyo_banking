# Staff fingerprint attendance — compatibility plan

## Goal
Support common, affordable fingerprint attendance terminals and USB readers on Windows 10 and Windows 11 through adapters, rather than assuming one browser integration works with every device. Prefer device protocols and export methods that do not require a paid cloud gateway or subscription.

## Recommended low-cost compatibility strategy

Use a **vendor-neutral adapter layer** with three connection methods, in this order:

1. **Network terminal with documented push/ADMS/HTTP support (preferred where available).** The terminal sends attendance events to a protected endpoint or a local connector. This can work without a proprietary USB SDK, but only on models and firmware that actually support the protocol. First test with the exact model and firmware.
2. **USB/export import (broad fallback).** If the terminal can export attendance logs to CSV/TXT/Excel by USB, allow an authorised staff member to import that file. Validate column names, employee mapping, timestamps, event types, duplicate rows, and time zone before any events are accepted. Show an import preview and report rejected rows; never silently mark imported records as live fingerprint scans.
3. **Direct USB fingerprint reader (optional adapter).** Support only when the exact reader has a compatible Windows 10/11 driver and vendor SDK that can be used without an unaffordable licence. A generic USB fingerprint sensor is not automatically compatible with a browser or web app. Do not implement raw sensor support based only on its USB connector.

Each method must feed the same normalized attendance-event interface so that the attendance pages and audit rules do not depend on one brand. Do not purchase a gateway, SDK, machine, or subscription for this work; build and test with free vendor documentation/tools and synthetic fixtures only.

## Device families to evaluate
- **ZKTeco terminals:** investigate documented ADMS/push protocol or the vendor SDK where the exact model and firmware support it; confirm whether the specific device can export logs over USB.
- **Suprema terminals:** use the supported BioStar API/SDK for the deployed version and compatible devices only if licensing and costs meet the zero-cost requirement.
- **Hikvision access-control terminals:** use documented ISAPI/API or vendor SDK only when supported by the exact model and firmware.
- **SecuGen USB readers:** require the correct Windows driver and vendor SDK behind a local connector; verify licensing before selecting.
- **DigitalPersona/HID USB readers:** require the compatible driver and SDK/connector for the specific reader; verify availability and licensing.
- **Other devices:** support a documented SDK/API, supported event export, or another vendor-approved integration. If none exists, label the device unsupported rather than claiming generic compatibility.

These are candidate integration paths, not a statement that every model has been tested. Before declaring a model supported, verify its exact model number, firmware, communication protocol, SDK licence, Windows 10/11 driver availability, and test it with real hardware.

## Recommended architecture
1. **Device adapter:** one adapter per vendor/protocol/export format; normalize records to a documented schema. Never trust a device-provided staff name as identity.
2. **Windows connector for USB/network-local integrations:** if required, a locally installed, signed service communicates with the vendor SDK or device protocol and exposes only authenticated, minimal events to the app. Bind to loopback by default, validate origins/tokens, and do not expose an unauthenticated LAN service.
3. **Terminal integration:** where supported, terminals send events to a protected server endpoint or are polled over a restricted LAN. Do not expose device passwords, signing keys, or service-role credentials in browser JavaScript or a Windows client.
4. **Identity mapping:** map the device's enrolled user ID to an active employee record. Do not use a fingerprint template as the employee ID.
5. **Event integrity:** record device ID, device event ID where available, event timestamp, received timestamp, event type, source method, and deduplication key. Handle offline buffering, repeated imports, and clock drift.
6. **Import safety:** treat CSV/TXT files as untrusted input; reject malformed timestamps, unknown employees, invalid event types, impossible transitions, and duplicates. Keep an import batch summary and audit the user who imported it.
7. **Security and privacy:** avoid storing raw fingerprint images. Prefer vendor-managed templates on the device; if templates must be handled, obtain appropriate consent and legal review, encrypt them, restrict access, and define retention/deletion rules.
8. **Audit and access:** authenticate administrators, apply database row-level security, log configuration changes, and restrict attendance corrections to authorized roles.
9. **Fallback:** provide a clearly marked manual attendance workflow with supervisor approval if policy allows; never label a manual entry or file import as a live fingerprint scan. Store a source label such as `device_push`, `device_file_import`, or `manual`.

## Rollout stages
- **Stage 1:** shortlist affordable terminals with Ethernet/TCP-IP and USB log export; request the model datasheet and confirm that protocol/export access does not require a paid gateway or subscription.
- **Stage 2:** implement and test the normalized event schema and safe CSV/TXT import first, using synthetic files.
- **Stage 3:** implement a free/documented network protocol adapter or signed Windows connector for one confirmed device family.
- **Stage 4:** create/verify attendance/device tables with row-level security, audit fields, deduplication, and employee mapping.
- **Stage 5:** test enrolment mapping, duplicate events/imports, malformed files, lost network, offline buffering, device clock drift, restart recovery, and unauthorized requests.
- **Stage 6:** pilot on Windows 10 and Windows 11 with real hardware before production use.

## Current state
The web app contains a device-family selector and integration guidance only. No fingerprint scan, device connection, biometric storage, or official biometric attendance ingestion is enabled yet. Manual attendance events remain labelled as manual.

## Attendance event storage and manual punches (draft)
Migration `20261019090000_staff_attendance_event_rls.sql` adds append-only clock events, active-employee/self-only RLS, idempotency keys, and a database trigger enforcing alternating clock-in/clock-out events. The browser UI supports manual punches and displays the employee's latest events. Manual punches are not biometric proof and must not be described as fingerprint verified.

Trusted biometric ingestion is intentionally not enabled. It requires a confirmed device model, supported protocol/export method, server-side device authentication, staff/device mapping, retry-safe ingestion, and field testing. Do not place a Supabase service-role key in the Windows connector UI or browser code; device authentication should terminate in a secured server endpoint.

## Acceptance checklist for any proposed device
- [ ] Exact make, model, firmware and serial/interface options documented.
- [ ] Ethernet/TCP-IP push/poll protocol or USB export confirmed from the manual.
- [ ] USB export columns, timestamp format, time zone, and employee ID format documented.
- [ ] Windows 10 and Windows 11 driver/SDK compatibility checked, if relevant.
- [ ] No paid gateway, subscription, paid SDK, or cloud account is required for the selected method.
- [ ] Synthetic test covers duplicate punches, unknown employee IDs, malformed input, and offline recovery.
- [ ] Real-device test is completed and recorded before the device is advertised as supported.
