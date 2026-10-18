# VIC LINE platform 2026 — notifications, settings and inbox test plan

## Features in this draft
- Customizable notification tones: soft chime, bell, pop and double tone.
- Tone enable/disable and volume slider.
- Test-tone control. Browsers may require a user interaction before audio can play.
- Optional browser notifications after the user explicitly grants permission.
- Appearance choices: light, soft lavender and dark.
- Message density choices: comfortable and compact.
- Preferences stored locally in the current browser profile.
- Inbox lists bank-wide chat and every active branch channel; it is not limited to ten entries.
- While VIC LINE remains open, a 30-second poll checks the latest message/voice note in each listed bank-wide or branch conversation and can alert for new incoming messages.

## Manual acceptance checks
- [ ] Open Staff → VIC LINE platform 2026 and confirm the inbox and settings panel render.
- [ ] Verify bank-wide conversation and every active branch channel appear in the inbox; switch between them and confirm messages remain scoped to the selected channel.
- [ ] Confirm the inbox scrolls on mobile and can display 10 or more conversation entries when that many channels are available.
- [ ] Toggle notification sounds off/on; confirm the preference persists after leaving and reopening VIC LINE.
- [ ] Test each tone and adjust volume from 0 to 100.
- [ ] Enable browser notifications only after a permission prompt; test with the page in the background.
- [ ] Send a message from another authorized staff account to the bank-wide channel and to a branch channel; verify a tone/desktop alert on the next poll when enabled.
- [ ] Confirm the first poll establishes a baseline and does not play a burst of old notifications.
- [ ] Switch between light, soft lavender and dark appearance; confirm message text and controls remain readable.
- [ ] Switch between comfortable and compact density.
- [ ] Test with Chrome and Edge on Windows 10 and Windows 11, and Chrome on Android.
- [ ] Verify inactive staff and unauthorized branch users cannot read or send messages.
- [ ] Verify no notifications contain account credentials or sensitive financial details.

## Limitations and release gates
- Polling runs every 30 seconds while the banking app is open; this is not push delivery and does not guarantee alerts after the browser/app is closed.
- The inbox currently lists bank-wide and branch group conversations. One-to-one staff direct-message threads are a separate database feature and are not implied by this inbox.
- Settings are device/browser-local, not synced between devices.
- Database SQL remains a draft until reviewed and applied in a test Supabase environment.
- Do not deploy to production until database authorization and the manual checks above pass.
