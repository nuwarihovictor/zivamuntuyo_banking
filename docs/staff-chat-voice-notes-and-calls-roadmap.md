# Staff chat voice notes and calls roadmap

Project: Zivamuntuyo Financial Services Ltd.

## Recommendation

Build voice notes first, then live voice calls, then optional video calls. Voice notes are a smaller and easier-to-test extension of the existing staff chat. Live calls require real-time signalling, network traversal and call lifecycle handling, so they are a larger project.

This document is a roadmap only. It does not mean recording, uploading, or live calling is implemented.

## Phase 1 — Voice notes

### Staff experience
- Add a Record voice note control beside the text message box.
- Ask the browser for microphone permission only after the user chooses to record.
- Show a clear recording state, elapsed time, Stop, Play preview, Discard and Send controls.
- Let the sender preview the recording before sending.
- Display sent notes with sender, timestamp, duration and a Play/Pause control.
- Never autoplay audio.
- Start with a configurable short duration cap (proposed default: 120 seconds) and a file-size cap to limit bandwidth and storage.
- Show clear errors when microphone permission is denied, recording is unsupported, upload fails, or the connection is lost.
- Test supported Chrome and Edge versions on Windows 10 and Windows 11.

### Secure storage and authorization
- Store audio in a **private** Supabase Storage bucket, not a public bucket.
- Create a metadata record with a random ID, sender identity derived from the authenticated session, channel/branch ID, storage path, MIME type, byte size, duration, and creation timestamp.
- Authorize uploads, listing, and playback server-side. Reuse the staff chat's active-employee and branch-access rules; do not trust a branch ID supplied by the browser.
- Issue short-lived playback URLs only after verifying the requesting employee can access that channel.
- Enforce MIME type, maximum size and duration; reject executable or unexpected file types.
- Use generated object paths, never put private audio URLs or secrets into public logs.
- Define retention and deletion rules before production rollout. Keep audit metadata for administrative review without retaining audio indefinitely by default.
- Do not record calls or voice notes without a clear user action and visible recording indication. Do not send audio to transcription services unless that is separately approved.

### Acceptance tests
- A staff member can record, preview, discard, send and play a note.
- Unauthorized staff cannot list or play notes in a branch they cannot access.
- Upload failure does not create a misleading sent state.
- Invalid file types, oversize files, and over-duration notes are rejected.
- Audio is not accessible from a public URL without authorization.
- Keyboard use, screen-reader labels, microphone-denied state, and narrow-screen layout are tested.

## Phase 2 — Live voice calls

Use a maintained WebRTC implementation or a managed real-time calling provider rather than building a complete call stack from scratch.

Required elements:
- Authenticated call invitations and accept/decline/busy/end states.
- Signalling to exchange connection setup data and ICE candidates.
- STUN/TURN infrastructure; TURN relay is commonly required when peers cannot connect directly.
- Microphone permission, mute/unmute, connection/reconnection state, call timeout, missed-call status and cleanup on hang-up.
- Branch/employee authorization, abuse controls, rate limits and operational monitoring.
- Tests across separate branches, different internet providers, restrictive networks, Windows 10/11, and supported browsers.
- Clear privacy notice; no recording by default.

Live calls may require a paid provider or managed TURN service, depending on call volume and reliability requirements.

## Phase 3 — Optional video calls

Add camera permission, camera on/off, audio-only fallback, bandwidth adaptation and further privacy testing only after voice calls are reliable.

## Rollout gate

Do not advertise voice notes or calling as available until implementation, database/storage policies, browser tests, security tests, and production configuration are complete. This roadmap is not a deployed feature.
