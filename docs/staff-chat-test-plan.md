# Staff chat verification checklist

Run these checks in a non-production environment before enabling the feature for staff.

## Database migration
- [ ] Apply `supabase/sql/secure_staff_chat.sql` to the intended Supabase project.
- [ ] Confirm `public.staff_messages` exists and Row Level Security is enabled.
- [ ] Confirm `anon` and `authenticated` have no direct table privileges.
- [ ] Confirm only authenticated users can execute `list_staff_messages` and `send_staff_message`.
- [ ] Confirm both RPCs reject sessions without an active employee profile.
- [ ] Confirm branch-specific read and send attempts are rejected when the user lacks access to that branch.

## Functional checks
- [ ] Sign in as an active employee and open Team Chat.
- [ ] Confirm bank-wide messages load only in the bank-wide channel.
- [ ] Send a normal message and verify it persists after refresh.
- [ ] Try whitespace-only and over-1,000-character messages; both should be rejected.
- [ ] Confirm a user cannot spoof the sender name or sender user ID; the database derives sender identity from the authenticated session.
- [ ] Confirm messages render as text, not executable HTML.
- [ ] Confirm branch-specific messages are isolated to their selected branch.
- [ ] Confirm an inactive employee and an unauthenticated visitor cannot read or send messages.
- [ ] Confirm the page presents a clear error if the migration is not installed.

## Browser and device checks
- [ ] Test current Chrome and Edge on Windows 10 and Windows 11.
- [ ] Test narrow/mobile layout and keyboard-only navigation.
- [ ] Confirm Refresh messages works after another staff member sends a message.
- [ ] Confirm chat does not claim real-time updates; automatic live delivery is not implemented in this first version.

## Operational safety
- [ ] Do not post customer account numbers, PINs, passwords, private keys, or other secrets in chat.
- [ ] Agree retention, moderation, and incident-response rules before broad rollout.
- [ ] Apply the migration and enable the UI only after review; do not expose the UI in production while the RPCs are absent.
