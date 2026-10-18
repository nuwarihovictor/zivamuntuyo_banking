# Windows USB fingerprint connector — implementation blueprint

## Selected connection style

The organization has chosen **USB-connected fingerprint readers** as the intended connection style. The exact manufacturer and model remain unknown. This is an architecture blueprint, not an installable connector and not a claim that any reader is compatible.

## Recommended component layout

```text
USB fingerprint reader
        |
        v
Vendor-supported Windows driver + SDK
        |
        v
Signed local Windows connector service
  - verifies vendor SDK result
  - maps device enrollment ID
  - emits minimal attendance event
  - deduplicates/retries safely
        |
        v
Authenticated HTTPS ingestion API
        |
        v
Server-side device + employee + branch validation
        |
        v
Attendance event ledger -> authorized timesheet/report
```

The browser UI should configure or display connector status, not access vendor secrets or make biometric identity decisions itself.

## Windows service requirements

- Package as a signed installer/service for the supported Windows 10 and Windows 11 editions only after vendor driver/SDK testing.
- Use the vendor's official SDK and licensing; do not attempt a generic direct USB protocol.
- Run with the minimum Windows service account permissions needed to access the reader.
- Bind any local status/control endpoint to loopback only. Require authentication for privileged operations; validate request origin and use a per-install secret protected by Windows DPAPI. Never expose an unauthenticated listener on the LAN.
- Keep API credentials out of source control and browser JavaScript. Store secrets in an OS-protected store and support rotation/revocation.
- Send events over TLS to a server endpoint. The server must validate device registration, device enabled status, employee mapping, allowed branch, timestamp bounds, event type, and duplicate event ID.
- Use an outbox queue for network interruptions, with bounded retries and idempotency keys. Preserve the original device timestamp and server receipt timestamp.
- Provide a health/status view: connector installed, device detected, SDK ready, last event, last server sync, queue depth, and last error. Never display biometric templates.
- Do not log fingerprint images, templates, API tokens, or SDK secrets.
- If the reader performs only raw image capture and has no suitable supported SDK for identity matching, do not implement raw image collection as a fallback.

## Event and identity rules

The connector may report a vendor-verified enrollment key and event metadata. The server maps that key to an active employee. It must not trust a name or employee ID submitted by the browser, and it must not create new employee profiles automatically.

An event should include a stable event/idempotency key, registered device ID, mapped enrollment key (or opaque mapping key), event type, occurrence timestamp with timezone, connector version, and source. The server sets receipt time and records the audit trail. Unknown users and devices are rejected and surfaced for an authorized administrator to review.

## Installation and deployment boundaries

- The website deployment and Windows connector installation are separate.
- A web app hosted on Vercel cannot by itself install Windows drivers or a local Windows service.
- A device-specific connector cannot be compiled or verified until the exact reader model and its supported SDK/API are known.
- The attendance ingestion endpoint and database event schema must be reviewed and implemented server-side before the connector can submit official attendance events.
- No database migration or attendance-write endpoint is enabled by this blueprint.



## Provisional hardware shortlist (not yet purchased or tested)

For initial vendor discussions, evaluate a **SecuGen Hamster Pro 20 (HU20 family)** or **Hamster Pro 10 (HU10)** USB reader first. SecuGen's official SDK and driver pages list these reader families and state Windows 10/11 support. This is a paper-based shortlist only: it does not guarantee local availability, price, SDK licensing terms, performance in this application, or compatibility of a particular unit/firmware. Confirm exact SKU, genuine supplier, SDK distribution rights, current drivers, and return policy before purchase.

Official vendor references:
- SDK and supported reader list: https://secugen.com/products/sdk/
- Windows drivers and supported OS list: https://secugen.com/drivers/

Do not purchase a generic reader advertised only as "USB fingerprint scanner" unless the seller provides the exact model and an official SDK/API with Windows 10 and Windows 11 support. A reader intended only for Windows Hello login may not expose the enrollment/matching API this attendance application requires.


## Device details needed to proceed

Ask the supplier for a photo of the device label or its exact manufacturer/model number, and if available the firmware version and SDK/API documentation. Also confirm whether the reader is a USB biometric reader for PC software or a standalone USB attendance terminal. These products use different integration paths.

## Required test matrix

1. Clean Windows 10 installation: official driver install, SDK initialization, scan/match, service restart, uninstall.
2. Clean Windows 11 installation: repeat all tests and check driver signing/security warnings.
3. Incorrect/unknown employee mapping is rejected.
4. Disabled reader and inactive employee are rejected.
5. Replayed duplicate event does not create duplicate attendance.
6. Network outage queues events and safely replays them after recovery.
7. Device clock drift, out-of-order events, rapid repeated scans and service crash/restart are handled.
8. Unauthenticated local requests and cross-branch events are rejected.
9. Logs contain no biometric templates or secrets.
10. Supervisor-approved manual fallback remains explicitly labelled as manual, never fingerprint verified.

## Current state

USB is the intended connection style, but the hardware model is not selected. No USB scan, Windows service, fingerprint matching, or official attendance event ingestion is active. Do not mark this connector as compatible until tests pass with the real hardware on both Windows 10 and Windows 11.
