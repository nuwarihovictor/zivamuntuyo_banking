# Staff voice notes test plan

Project: Zivamuntuyo Financial Services Ltd.  
Branch: `feature/secure-staff-chat`

## Current implementation scope
The branch now contains browser-side recording, local preview/discard, upload, metadata registration, signed playback URLs, and private-bucket/storage policy SQL. This remains unverified until the SQL is reviewed and applied to a test Supabase environment.

## Setup gate
- [ ] Review `supabase/sql/secure_staff_chat.sql` and apply it to a test project.
- [ ] Review `supabase/sql/staff_voice_notes.sql`; confirm storage bucket is private and all policies/functions compile.
- [ ] Confirm authenticated active staff can use `list_staff_voice_notes` and `register_staff_voice_note`.
- [ ] Confirm inactive staff and unauthenticated users are rejected.
- [ ] Confirm no service-role key is present in frontend files.

## Browser and recording
- [ ] Current Chrome on Windows 10: microphone permission, record, stop, preview, discard, send, playback.
- [ ] Current Edge on Windows 10: repeat recording tests.
- [ ] Current Chrome and Edge on Windows 11: repeat recording tests.
- [ ] Test mobile browser layout and microphone permission.
- [ ] Deny microphone permission and confirm a useful message appears.
- [ ] Test browser without MediaRecorder support.
- [ ] Confirm recording stops at 120 seconds.
- [ ] Confirm files larger than 3 MB are rejected and do not show as sent.
- [ ] Confirm changing channel after recording prevents sending into the wrong channel.
- [ ] Confirm no audio autoplays.

## Security and storage
- [ ] Confirm bucket is private; no public object URL can play a note.
- [ ] Confirm signed playback URLs are short-lived.
- [ ] Confirm a branch user cannot list or play another branch's notes without branch access.
- [ ] Confirm an active staff member can access bank-wide notes only while authenticated.
- [ ] Confirm storage upload paths must start with the signed-in user's ID.
- [ ] Confirm unsupported MIME types, invalid sizes, invalid durations and nonexistent objects are rejected.
- [ ] Confirm failed metadata registration removes the newly uploaded object where permitted.
- [ ] Review whether the production retention period and deletion process are approved before rollout.

## Known limitations and release gate
- Live voice calling is not implemented by this change.
- The database SQL is a repository artifact only; it has not been applied to Supabase.
- Do not merge or deploy until the SQL has been reviewed, applied to staging, and all security tests pass.
