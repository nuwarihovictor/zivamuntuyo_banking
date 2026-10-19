-- VIC LINE private direct-message helpers.
-- Draft only: review against the connected project's current schema before applying.
-- The existing staff_messages table already supports sender/recipient, sent_at and read_at.
-- These helpers intentionally do not create or alter that table.

CREATE OR REPLACE FUNCTION public.list_vic_line_staff_directory()
RETURNS TABLE (
  user_id uuid,
  full_name text,
  employee_number text,
  home_branch_id uuid,
  branch_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.employee_profiles ep
    WHERE ep.user_id = v_user_id AND ep.is_active = true
  ) THEN
    RAISE EXCEPTION 'Active employee profile required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT ep.user_id, ep.full_name::text, ep.employee_number::text,
         ep.home_branch_id, b.branch_name::text
  FROM public.employee_profiles ep
  LEFT JOIN public.branches b ON b.id = ep.home_branch_id
  WHERE ep.is_active = true AND ep.user_id <> v_user_id
  ORDER BY ep.full_name
  LIMIT 500;
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_vic_line_direct_messages(
  p_recipient_user_id uuid,
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  message_id uuid,
  sender_user_id uuid,
  sender_name text,
  recipient_user_id uuid,
  recipient_name text,
  branch_id uuid,
  message_text text,
  sent_at timestamptz,
  read_at timestamptz,
  direction text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.employee_profiles ep
    WHERE ep.user_id = v_user_id AND ep.is_active = true
  ) THEN
    RAISE EXCEPTION 'Active employee profile required' USING ERRCODE = '42501';
  END IF;
  IF p_recipient_user_id IS NULL OR p_recipient_user_id = v_user_id OR NOT EXISTS (
    SELECT 1 FROM public.employee_profiles ep
    WHERE ep.user_id = p_recipient_user_id AND ep.is_active = true
  ) THEN
    RAISE EXCEPTION 'Choose an active staff member' USING ERRCODE = '22023';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 200 THEN
    RAISE EXCEPTION 'Message limit must be between 1 and 200' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT m.id, m.sender_user_id, s.full_name::text,
         m.recipient_user_id, r.full_name::text, m.branch_id,
         m.message_text, m.sent_at, m.read_at,
         CASE WHEN m.sender_user_id = v_user_id THEN 'sent' ELSE 'received' END
  FROM public.staff_messages m
  JOIN public.employee_profiles s ON s.user_id = m.sender_user_id
  JOIN public.employee_profiles r ON r.user_id = m.recipient_user_id
  WHERE (m.sender_user_id = v_user_id AND m.recipient_user_id = p_recipient_user_id)
     OR (m.sender_user_id = p_recipient_user_id AND m.recipient_user_id = v_user_id)
  ORDER BY m.sent_at DESC
  LIMIT p_limit;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_vic_line_staff_directory() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_vic_line_direct_messages(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_vic_line_staff_directory() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_vic_line_direct_messages(uuid, integer) TO authenticated;


-- Send a private one-to-one message. Direct messages are not branch-channel posts.
CREATE OR REPLACE FUNCTION public.send_vic_line_direct_message(
  p_recipient_user_id uuid,
  p_message_text text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_sender uuid := auth.uid();
  v_message_id uuid;
  v_message text := btrim(coalesce(p_message_text, ''));
BEGIN
  IF v_sender IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.employee_profiles ep
    WHERE ep.user_id = v_sender AND ep.is_active = true
      AND ep.employment_status NOT IN ('suspended','terminated','inactive')
  ) THEN
    RAISE EXCEPTION 'Active employee profile required' USING ERRCODE = '42501';
  END IF;
  IF p_recipient_user_id IS NULL OR p_recipient_user_id = v_sender OR NOT EXISTS (
    SELECT 1 FROM public.employee_profiles ep
    WHERE ep.user_id = p_recipient_user_id AND ep.is_active = true
      AND ep.employment_status NOT IN ('suspended','terminated','inactive')
  ) THEN
    RAISE EXCEPTION 'Choose another active staff member' USING ERRCODE = '22023';
  END IF;
  IF length(v_message) < 1 OR length(v_message) > 4000 THEN
    RAISE EXCEPTION 'Message must contain between 1 and 4000 characters' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.staff_messages(sender_user_id, recipient_user_id, branch_id, message_text)
  VALUES (v_sender, p_recipient_user_id, NULL, v_message)
  RETURNING id INTO v_message_id;
  RETURN v_message_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_vic_line_direct_message_read(p_message_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.employee_profiles ep
    WHERE ep.user_id = v_user_id AND ep.is_active = true
  ) THEN RAISE EXCEPTION 'Active employee profile required' USING ERRCODE = '42501'; END IF;
  UPDATE public.staff_messages
  SET read_at = coalesce(read_at, now())
  WHERE id = p_message_id AND recipient_user_id = v_user_id;
  RETURN FOUND;
END;
$function$;

REVOKE ALL ON FUNCTION public.send_vic_line_direct_message(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_vic_line_direct_message_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_vic_line_direct_message(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_vic_line_direct_message_read(uuid) TO authenticated;
