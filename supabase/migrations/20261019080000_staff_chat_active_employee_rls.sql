-- Separate team-wide staff chat. This deliberately uses its own table and does not modify the existing private sender/recipient table public.staff_messages.
CREATE TABLE IF NOT EXISTS public.staff_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id uuid NOT NULL REFERENCES public.employee_profiles(user_id) ON DELETE RESTRICT,
  message_body text NOT NULL CHECK (char_length(btrim(message_body)) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_chat_messages FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.staff_chat_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.staff_chat_messages TO authenticated;
GRANT ALL ON TABLE public.staff_chat_messages TO service_role;

DROP POLICY IF EXISTS staff_chat_messages_active_employee_read ON public.staff_chat_messages;
CREATE POLICY staff_chat_messages_active_employee_read
  ON public.staff_chat_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employee_profiles ep
      WHERE ep.user_id = (SELECT auth.uid()) AND ep.is_active = true
    )
  );

DROP POLICY IF EXISTS staff_chat_messages_active_employee_insert ON public.staff_chat_messages;
CREATE POLICY staff_chat_messages_active_employee_insert
  ON public.staff_chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.employee_profiles ep
      WHERE ep.user_id = (SELECT auth.uid()) AND ep.is_active = true
    )
  );

-- No UPDATE or DELETE policy is intentionally created: sent messages are append-only
-- for browser staff accounts. A future moderation workflow must be separately reviewed.
