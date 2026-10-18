# Fingerprint attendance integration foundation

## Status and scope

This document defines the safe, device-neutral foundation for a future fingerprint attendance connector. No fingerprint device has been selected, so this is **not a working fingerprint integration** and no hardware family is certified as compatible. The browser must not pretend to scan a fingerprint or create official attendance records until a tested adapter is installed.

## Supported operating systems

The intended Windows desktop support target is Windows 10 and Windows 11. Actual support depends on the exact terminal/reader model, firmware, vendor SDK license, driver signing, architecture (x64/ARM64 if applicable), and the vendor's published OS support. Test on clean Windows 10 and Windows 11 machines before announcing compatibility.

## Integration options

1. **Network attendance terminal:** Prefer the vendor's documented push/API protocol where the exact model and firmware support it. Restrict the terminal to a protected device network and a narrowly scoped server endpoint.
2. **USB reader:** Use a signed, locally installed Windows connector backed by the vendor's supported SDK. A web page cannot safely or generically communicate with every USB fingerprint reader.
3. **Manual fallback:** If organizational policy permits, a supervisor may record a clearly labelled manual attendance correction. It must never be represented as a biometric scan.

## Proposed normalized event contract

The vendor adapter should normalize a verified device event to this logical shape before it can be considered for ingestion:

- `event_id`: stable device/vendor event ID or a deterministic deduplication key
- `device_id`: server-registered device UUID (never a user-supplied employee identity)
- `device_user_key`: vendor enrollment identifier, mapped server-side to an active employee
- `event_type`: clock-in or clock-out only when supported and unambiguous
- `occurred_at`: device event timestamp with an explicit timezone/offset
- `received_at`: server receipt timestamp
- `source`: approved vendor adapter identifier and version
- `raw_payload_hash`: optional integrity/debug hash; avoid retaining biometric content

This is a design contract, not an enabled API endpoint or existing database schema. Do not send fingerprint images, biometric templates, passwords, or SDK secrets in event payloads.

## Required security controls before enabling ingestion

- Register devices administratively and bind each device to an allowed branch.
- Authenticate devices using vendor-supported credentials or per-device credentials stored server-side; rotate credentials and never ship secrets in browser JavaScript.
- Reject unknown devices, disabled devices, inactive employees, unknown enrollment IDs, invalid timestamps, and unauthorized branch mappings.
- Deduplicate events with a unique database constraint and preserve the original source event for audit.
- Prevent a duplicate clock-in/out from silently creating a second attendance entry.
- Separate raw device events from approved attendance records; log corrections and approvals.
- Use authenticated server-side ingestion or a signed Windows connector. Never expose an unauthenticated LAN listener.
- Prefer on-device/vendor-managed biometric templates. Avoid central storage of raw fingerprints; complete privacy, consent, retention, and legal review before any biometric data is handled.
- Fail closed when the device is offline or event authenticity cannot be verified; provide a clearly marked manual fallback if policy permits.

## Device selection checklist

Before implementing a vendor adapter, collect:
- Manufacturer and exact model number
- Firmware version
- USB, Ethernet, Wi-Fi, or cloud connection method
- Vendor SDK/API name and version, documentation, license, and sample event export
- Driver availability and support status for Windows 10 and Windows 11
- Whether the device exports attendance events or only performs biometric matching
- Whether it stores templates locally or requires a server
- Vendor's deduplication/event ID behavior and offline buffering behavior

## Acceptance tests

- Exact device and firmware identified; vendor-supported integration path confirmed.
- Successful and rejected employee mappings tested.
- Duplicate, out-of-order, offline-buffered, and clock-drift events tested.
- Disabled device and inactive employee events rejected.
- Cross-branch events rejected unless explicitly authorized.
- Connector service restart/recovery tested.
- Windows 10 and Windows 11 clean-install tests passed with the intended driver/SDK.
- Security and privacy review completed; audit and retention policies approved.
- Pilot results reviewed before enabling production attendance writes.

## Current project state

The web app currently provides attendance policy and read-only timesheet surfaces. This document does not activate fingerprint scanning, add a device connection, or write official attendance events. The next implementation step depends on selecting a real device and validating its vendor documentation.
