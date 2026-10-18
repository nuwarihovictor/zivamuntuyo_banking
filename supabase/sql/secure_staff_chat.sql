-- Secure staff chat for Zivamuntuyo Financial Services Ltd.
-- Messages are read/written only through role-checked RPCs; raw biometric data is never involved.

CREATE TABLE IF NOT EXISTS public.staff_channel_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id uuid NOT NULL REFERENCES public.employee_profiles(user_id) ON DELETE RESTRICT,
  branch_id uuid NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  message_text text NOT NULL CHECK (char_length(btrim(message_text)) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_channel_messages_channel_created_idx
  ON public.staff_channel_messages (branch_id, created_at DESC);

ALTER TABLE public.staff_channel_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.staff_channel_messages FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.list_staff_channel_messages(
  p_branch_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  sender_user_id uuid,
  sender_name text,
  sender_employee_number text,
  branch_id uuid,
  branch_name text,
  message_text text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  SELECT public.current_employee_role_code() INTO v_role;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Active staff access required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.employee_profiles ep
    WHERE ep.user_id = auth.uid() AND ep.is_active = true
  ) THEN
    RAISE EXCEPTION 'Active employee profile required';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 200 THEN
    RAISE EXCEPTION 'Message limit must be between 1 and 200';
  END IF;
  IF p_branch_id IS NOT NULL AND NOT public.current_employee_can_transact_in_branch(p_branch_id) THEN
    RAISE EXCEPTION 'Branch access denied';
  END IF;

  RETURN QUERY
  SELECT m.id, m.sender_user_id, ep.full_name::text, ep.employee_number::text,
         m.branch_id, b.branch_name::text, m.message_text, m.created_at
  FROM public.staff_channel_messages m
  JOIN public.employee_profiles ep ON ep.user_id = m.sender_user_id
  LEFT JOIN public.branches b ON b.id = m.branch_id
  WHERE m.branch_id IS NOT DISTINCT FROM p_branch_id
  ORDER BY m.created_at DESC
  LIMIT p_limit;
END;
$function$;

CREATE OR REPLACE FUNCTION public.send_staff_channel_message(
  p_message text,
  p_branch_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_role text;
  v_message text := pg_catalog.btrim(p_message);
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  SELECT public.current_employee_role_code() INTO v_role;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Active staff access required';
  END IF;
  IF v_message IS NULL OR pg_catalog.char_length(v_message) < 1 OR pg_catalog.char_length(v_message) > 1000 THEN
    RAISE EXCEPTION 'Message must contain 1–1000 characters';
  END IF;
  IF p_branch_id IS NOT NULL AND NOT public.current_employee_can_transact_in_branch(p_branch_id) THEN
    RAISE EXCEPTION 'Branch access denied';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.employee_profiles ep
    WHERE ep.user_id = auth.uid() AND ep.is_active = true
  ) THEN
    RAISE EXCEPTION 'Active employee profile required';
  END IF;

  INSERT INTO public.staff_channel_messages(sender_user_id, branch_id, message_text)
  VALUES (auth.uid(), p_branch_id, v_message)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_staff_channel_messages(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.send_staff_channel_message(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_staff_channel_messages(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_staff_channel_message(text, uuid) TO authenticated;
