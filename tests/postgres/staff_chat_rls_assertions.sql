\set ON_ERROR_STOP on
-- Run after the disposable migration fixture, draft migrations, and core assertions.
-- Existing fixture users are reused; these checks exercise RLS as authenticated.
-- The minimal fixture does not otherwise expose the profile table to authenticated.
GRANT SELECT ON public.employee_profiles TO authenticated;
INSERT INTO public.employee_profiles(user_id,is_active)
VALUES ('40000000-0000-0000-0000-000000000005',true),
       ('40000000-0000-0000-0000-000000000007',true),
       ('40000000-0000-0000-0000-000000000006',false)
ON CONFLICT (user_id) DO UPDATE SET is_active=EXCLUDED.is_active;

SET ROLE authenticated;
SELECT set_config('test.user_id','40000000-0000-0000-0000-000000000005',false);
INSERT INTO public.staff_messages(sender_user_id,message_body)
VALUES ('40000000-0000-0000-0000-000000000005','Active staff chat RLS test');
DO $active_can_read$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.staff_messages WHERE message_body='Active staff chat RLS test') THEN
    RAISE EXCEPTION 'FAIL: active employee cannot read staff messages';
  END IF;
END
$active_can_read$;

DO $cannot_impersonate_sender$
BEGIN
  BEGIN
    INSERT INTO public.staff_messages(sender_user_id,message_body)
    VALUES ('40000000-0000-0000-0000-000000000007','Spoofed sender must be denied');
    RAISE EXCEPTION 'FAIL: active employee sent message as another employee';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$cannot_impersonate_sender$;

SELECT set_config('test.user_id','40000000-0000-0000-0000-000000000006',false);
DO $inactive_cannot_read$
BEGIN
  IF EXISTS (SELECT 1 FROM public.staff_messages WHERE message_body='Active staff chat RLS test') THEN
    RAISE EXCEPTION 'FAIL: inactive employee can read staff messages';
  END IF;
END
$inactive_cannot_read$;

DO $inactive_cannot_send$
BEGIN
  BEGIN
    INSERT INTO public.staff_messages(sender_user_id,message_body)
    VALUES ('40000000-0000-0000-0000-000000000006','This must be denied');
    RAISE EXCEPTION 'FAIL: inactive employee inserted staff message';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END
$inactive_cannot_send$;

RESET ROLE;
