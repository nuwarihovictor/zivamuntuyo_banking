# Fingerprint attendance connector — database contract draft

**Status: repository draft only. No live database changes were made for this connector. No fingerprint device has been tested.**

## What is implemented in the draft

- Device registry with vendor, exact model/firmware, branch, integration mode, active switch and last-seen time.
- Mapping from a device-specific user identifier to an active employee account; device-supplied names are not trusted.
- Deduplicated event log keyed by device and vendor event ID, with event timestamp, receive timestamp, payload digest, processing status and attendance record reference.
- Trusted RPC restricted to the Supabase `service_role` for ingestion from a separately authenticated server-side connector.
- The RPC checks device activation, employee activity, branch authorization, timestamp bounds, event type, duplicate events, existing daily records and unmatched clock-outs.
- Device events write the existing `staff_attendance` table with `clock_in_method/clock_out_method='fingerprint'`; no raw fingerprint image/template is stored.
- The RPC preserves the first clock-in and records duplicate/ambiguous events for review instead of silently overwriting a day's attendance.

## Required rollout order

1. Confirm exact device manufacturer, model, firmware, communication protocol and vendor SDK license.
2. Review `supabase/sql/attendance_device_connector_schema_draft.sql` with the existing attendance policies and the institution's privacy/retention rules.
3. Apply it to a **non-production** Supabase project; run security advisors and test that only `service_role` can call the ingest RPC.
4. Implement a server-side vendor adapter. Device credentials and service-role secrets must never be embedded in `app.js` or sent to the browser.
5. Enroll the device, create an explicit device-user-to-employee mapping, and keep the device disabled until all checks pass.
6. Test duplicate delivery, offline replay, event clock drift, disabled device, unmapped user, terminated staff, cross-branch access, duplicate clock-in, unmatched clock-out, and network outage.
7. Pilot on the exact Windows 10/11 hardware and firmware before production enablement.

## Security constraints

- Do not accept a browser request as proof of a fingerprint scan.
- Do not trust employee names supplied by a terminal; map its device user ID server-side.
- Do not store biometric templates or images in the attendance event log.
- The SQL function is a privileged boundary. The caller must be a trusted server process with a server-side secret; never grant the RPC to `anon` or `authenticated`.
- This schema is additive but still requires staging validation, RLS/advisor review and a tested rollback before a production migration.

## Current blocker

A device family selector in the web app is not a hardware integration. The user must provide the exact device model (or select a device family and accept model-specific verification) before an adapter can be completed honestly.
