# Staff live voice calling — implementation design

Project: Zivamuntuyo Financial Services Ltd.

## Status
Design and implementation planning only. The current application does not place or receive live calls. Voice notes are being implemented separately first.

## Recommended first release
- One-to-one audio calls between active staff, not open calls to every member of a branch channel.
- A staff directory picker that returns only employees the signed-in user is permitted to contact.
- Call invite, accept, decline, busy, missed, ended and reconnect states.
- WebRTC for media. Supabase Realtime or a managed calling provider can carry signalling, but signalling is not the audio stream.
- STUN for connection discovery and a TURN relay for networks where direct peer-to-peer connectivity fails.
- Microphone permission requested only after a user starts or accepts a call.
- Mute/unmute and hang-up controls; visible call state and a clear permission/network error.
- No call recording by default.

## Backend work required before the UI can be enabled
1. A call-session record with caller, recipient, expiry, state and audit timestamps.
2. Server-side RPCs to create, accept, decline, end and expire a call. Each operation must verify active staff status and recipient/channel authorization.
3. Private signalling channels with policies that admit only the two participants in that call. Do not use a predictable public broadcast channel.
4. Rate limits and short invitation expiry to reduce nuisance calls.
5. Deployment configuration for STUN/TURN. A TURN service is normally required for dependable connectivity across corporate networks and mobile providers.
6. Cleanup on sign-out, tab close, timeout, rejected permission, network loss and hang-up.
7. Tests across different branches, devices and internet providers.

## Why not enable a browser-only prototype?
A browser-only WebRTC demo may appear to work on one network but fail behind NAT, firewalls or restrictive mobile networks. It also does not provide secure call invitations or a reliable way to identify the recipient. Those are release blockers for a financial institution.

## Acceptance tests
- Only the intended recipient can accept or decline a call.
- Unrelated staff cannot subscribe to call signalling or read call-session data.
- Both users see consistent call status and a missed call when appropriate.
- Mute, hang-up, permission denial and connection loss clean up media tracks.
- No audio is recorded by default.
- Windows 10/11 Chrome and Edge are tested, including restrictive networks with TURN enabled.
