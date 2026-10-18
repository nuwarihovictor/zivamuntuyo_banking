-- Staff voice notes for Zivamuntuyo Financial Services Ltd.
-- Private audio storage; metadata and channel authorization are enforced by RPCs.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'staff-voice-notes',
  'staff-voice-notes',
  false,
  3145728,
  ARRAY['audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 3145728,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE TABLE IF NOT EXISTS public.staff_voice_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id uuid NOT NULL REFERENCES public.employee_profiles(user_id) ON DELETE RESTRICT,
  branch_id uuid NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  storage_path text NOT NULL UNIQUE,
  mime_type text NOT NULL CHECK (mime_type IN ('audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav')),
  byte_size bigint NOT NULL CHECK (byte_size BETWEEN 1 AND 3145728),
  duration_seconds integer NOT NULL CHECK (duration_seconds BETWEEN 1 AND 120),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_voice_notes_channel_created_idx
  ON public.staff_voice_notes (branch_id, created_at DESC);

ALTER TABLE public.staff_voice_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.staff_voice_notes FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "active staff can upload own voice notes" ON storage.objects;
CREATE POLICY "active staff can upload own voice notes"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'staff-voice-notes'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  AND EXISTS (
    SELECT 1 FROM public.employee_profiles ep
    WHERE ep.user_id = (SELECT auth.uid()) AND ep.is_active = true
  )
  AND CASE
    WHEN (storage.foldername(name))[2] = 'global' THEN true
    WHEN (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
      THEN public.current_employee_can_transact_in_branch(((storage.foldername(name))[2])::uuid)
    ELSE false
  END
);

DROP POLICY IF EXISTS "active staff can play authorized channel voice notes" ON storage.objects;
CREATE POLICY "active staff can play authorized channel voice notes"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'staff-voice-notes'
  AND EXISTS (
    SELECT 1 FROM public.employee_profiles ep
    WHERE ep.user_id = (SELECT auth.uid()) AND ep.is_active = true
  )
  AND CASE
    WHEN (storage.foldername(name))[2] = 'global' THEN true
    WHEN (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
      THEN public.current_employee_can_transact_in_branch(((storage.foldername(name))[2])::uuid)
    ELSE false
  END
);

CREATE OR REPLACE FUNCTION public.list_staff_voice_notes(
  p_branch_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  sender_user_id uuid,
  sender_name text,
  sender_employee_number text,
  branch_id uuid,
  storage_path text,
  mime_type text,
  byte_size bigint,
  duration_seconds integer,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.employee_profiles ep
    WHERE ep.user_id = auth.uid() AND ep.is_active = true
  ) THEN RAISE EXCEPTION 'Active employee access required'; END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 200 THEN
    RAISE EXCEPTION 'Voice note limit must be between 1 and 200';
  END IF;
  IF p_branch_id IS NOT NULL AND NOT public.current_employee_can_transact_in_branch(p_branch_id) THEN
    RAISE EXCEPTION 'Branch access denied';
  END IF;

  RETURN QUERY
  SELECT n.id, n.sender_user_id, ep.full_name::text, ep.employee_number::text,
         n.branch_id, n.storage_path, n.mime_type, n.byte_size, n.duration_seconds, n.created_at
  FROM public.staff_voice_notes n
  JOIN public.employee_profiles ep ON ep.user_id = n.sender_user_id
  WHERE n.branch_id IS NOT DISTINCT FROM p_branch_id
  ORDER BY n.created_at DESC
  LIMIT p_limit;
END;
$function$;

CREATE OR REPLACE FUNCTION public.register_staff_voice_note(
  p_branch_id uuid,
  p_storage_path text,
  p_mime_type text,
  p_byte_size bigint,
  p_duration_seconds integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE v_id uuid;
DECLARE v_channel text := COALESCE(p_branch_id::text, 'global');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.employee_profiles ep
    WHERE ep.user_id = auth.uid() AND ep.is_active = true
  ) THEN RAISE EXCEPTION 'Active employee access required'; END IF;
  IF p_branch_id IS NOT NULL AND NOT public.current_employee_can_transact_in_branch(p_branch_id) THEN
    RAISE EXCEPTION 'Branch access denied';
  END IF;
  IF p_storage_path IS NULL OR p_storage_path NOT LIKE auth.uid()::text || '/' || v_channel || '/%' THEN
    RAISE EXCEPTION 'Invalid voice note storage path';
  END IF;
  IF p_mime_type NOT IN ('audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav') THEN
    RAISE EXCEPTION 'Unsupported audio format';
  END IF;
  IF p_byte_size IS NULL OR p_byte_size < 1 OR p_byte_size > 3145728 THEN
    RAISE EXCEPTION 'Voice note must be no larger than 3 MB';
  END IF;
  IF p_duration_seconds IS NULL OR p_duration_seconds < 1 OR p_duration_seconds > 120 THEN
    RAISE EXCEPTION 'Voice note must be between 1 and 120 seconds';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM storage.objects o
    WHERE o.bucket_id = 'staff-voice-notes' AND o.name = p_storage_path
  ) THEN RAISE EXCEPTION 'Uploaded audio file was not found'; END IF;

  INSERT INTO public.staff_voice_notes(sender_user_id, branch_id, storage_path, mime_type, byte_size, duration_seconds)
  VALUES (auth.uid(), p_branch_id, p_storage_path, p_mime_type, p_byte_size, p_duration_seconds)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_staff_voice_notes(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.register_staff_voice_note(uuid, text, text, bigint, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_staff_voice_notes(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_staff_voice_note(uuid, text, text, bigint, integer) TO authenticated;
