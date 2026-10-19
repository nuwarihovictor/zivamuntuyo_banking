# Staff fingerprint attendance — compatibility plan

## Goal
Support common fingerprint attendance terminals and USB readers on Windows 10 and Windows 11 through adapters, rather than assuming one browser integration works with every device.

## Device families to evaluate
- **ZKTeco terminals:** use a documented ADMS/push protocol or the vendor SDK where the exact model and firmware support it.
- **Suprema terminals:** use the supported BioStar API/SDK for the deployed version and compatible devices.
- **Hikvision access-control terminals:** use documented ISAPI/API or vendor SDK only when supported by the exact model and firmware.
- **SecuGen USB readers:** require the correct Windows driver and vendor SDK behind a local connector.
- **DigitalPersona/HID USB readers:** require the compatible driver and SDK/connector for the specific reader.
- **Other devices:** require a documented SDK/API, supported event export, or another vendor-approved integration.

These are candidate integration paths, not a statement that every model has been tested. Before declaring a model supported, verify its exact model number, firmware, communication protocol, SDK license, Windows 10/11 driver availability, and test it with the real hardware.

## Recommended architecture
1. **Device adapter:** one adapter per vendor/protocol; never let the browser directly trust a device-provided staff name.
2. **Windows connector for USB:** a locally installed, signed service communicates with the vendor SDK and exposes only authenticated, minimal events to the app. Bind to loopback, validate origins/tokens, and do not expose an unauthenticated LAN service.
3. **Terminal integration:** where supported, terminals send events to a protected server endpoint or are polled over a restricted LAN. Do not expose device passwords or private keys in browser JavaScript.
4. **Identity mapping:** map the device's enrolled user ID to an active employee record. Do not use a fingerprint template as the employee ID.
5. **Event integrity:** record device ID, event timestamp, received timestamp, event type, and deduplication key. Handle offline buffering and time drift.
6. **Security and privacy:** avoid storing raw fingerprint images. Prefer vendor-managed templates on the device; if templates must be handled, obtain appropriate consent and legal review, encrypt them, restrict access, and define retention/deletion rules.
7. **Audit and access:** authenticate administrators, apply database row-level security, log configuration changes, and restrict attendance corrections to authorized roles.
8. **Fallback:** provide a clearly marked manual attendance workflow with supervisor approval if policy allows; never label a manual entry as a fingerprint scan.

## Rollout stages
- **Stage 1:** choose a target device family and verify the vendor's current SDK/API and licensing.
- **Stage 2:** build and sign the Windows connector or terminal webhook adapter.
- **Stage 3:** create attendance/device tables with row-level security and audit fields.
- **Stage 4:** test enrolment mapping, duplicate events, lost network, device clock drift, restart recovery, and unauthorized requests.
- **Stage 5:** pilot on Windows 10 and Windows 11 with real hardware before production use.

## Current state
The web app contains a device-family selector and integration guidance only. No fingerprint scan, device connection, biometric storage, or official attendance write is enabled yet.

See [fingerprint attendance integration foundation](fingerprint-attendance-integration-foundation.md) for the proposed normalized event contract, device-selection checklist, security controls, and acceptance tests. Since USB has been selected as the connection style, see the [Windows USB connector blueprint](windows-usb-fingerprint-connector-blueprint.md) for the proposed Windows service architecture. Both documents are design only; neither certifies hardware nor enables fingerprint ingestion.
