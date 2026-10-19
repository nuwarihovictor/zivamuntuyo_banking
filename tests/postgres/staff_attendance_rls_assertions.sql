\set ON_ERROR_STOP on
-- Disposable fixture test: active employee can create/read own manual punches;
-- inactive employee cannot read or create punches, and staff cannot spoof device ingestion.
GRANT SELECT ON public.employee_profiles TO authenticated;
INSERT INTO public.employee_profiles(user_id,is_active)
VALUES ('40000000-0000-0000-0000-000000000015',true),
       ('40000000-0000-0000-0000-000000000016',false)
ON CONFLICT (user_id) DO UPDATE SET is_active=EXCLUDED.is_active;

SET ROLE authenticated;
SELECT set_config('test.user_id','40000000-0000-0000-0000-000000000015',false);
INSERT INTO public.staff_attendance_events(employee_user_id,event_type,event_source,idempotency_key)
VALUES ('40000000-0000-0000-0000-000000000015','clock_in','manual','fixture-clockin-00015');
DO $active_can_read_own$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.staff_attendance_events
                 WHERE idempotency_key='fixture-clockin-00015') THEN
    RAISE EXCEPTION 'FAIL: active employee cannot read own attendance';
  END IF;
END
$active_can_read_own$;

DO $cannot_double_clock_in$
BEGIN
  BEGIN
    INSERT INTO public.staff_attendance_events(employee_user_id,event_type,event_source,idempotency_key)
    VALUES ('40000000-0000-0000-0000-000000000015','clock_in','manual','fixture-double-clockin');
    RAISE EXCEPTION 'FAIL: repeated clock-in was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END
$cannot_double_clock_in$;

INSERT INTO public.staff_attendance_events(employee_user_id,event_type,event_source,idempotency_key)
VALUES ('40000000-0000-0000-0000-000000000015','clock_out','manual','fixture-clockout-00015');

DO $cannot_clock_out_twice$
BEGIN
  BEGIN
    INSERT INTO public.staff_attendance_events(employee_user_id,event_type,event_source,idempotency_key)
    VALUES ('40000000-0000-0000-0000-000000000015','clock_out','manual','fixture-double-clockout');
    RAISE EXCEPTION 'FAIL: repeated clock-out was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END
$cannot_clock_out_twice$;

DO $cannot_spoof_device$
BEGIN
  BEGIN
    INSERT INTO public.staff_attendance_events(employee_user_id,event_type,event_source,device_identifier,idempotency_key)
    VALUES ('40000000-0000-0000-0000-000000000015','clock_out','device','UNTRUSTED-USB','fixture-spoof-device');
    RAISE EXCEPTION 'FAIL: browser staff spoofed trusted device event';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$cannot_spoof_device$;

SELECT set_config('test.user_id','40000000-0000-0000-0000-000000000016',false);
DO $inactive_cannot_read$
BEGIN
  IF EXISTS (SELECT 1 FROM public.staff_attendance_events
             WHERE idempotency_key='fixture-clockin-00015') THEN
    RAISE EXCEPTION 'FAIL: inactive employee read another employee attendance';
  END IF;
END
$inactive_cannot_read$;
DO $inactive_cannot_insert$
BEGIN
  BEGIN
    INSERT INTO public.staff_attendance_events(employee_user_id,event_type,event_source,idempotency_key)
    VALUES ('40000000-0000-0000-0000-000000000016','clock_in','manual','fixture-inactive-00016');
    RAISE EXCEPTION 'FAIL: inactive employee inserted attendance';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$inactive_cannot_insert$;
RESET ROLE;
