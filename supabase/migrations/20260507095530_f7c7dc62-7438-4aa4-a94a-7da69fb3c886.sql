
-- Support messages table
CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users insert own support messages"
  ON public.support_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "users read own support messages"
  ON public.support_messages FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "admins manage all support messages"
  ON public.support_messages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_support_messages_created_at ON public.support_messages (created_at DESC);
CREATE INDEX idx_support_messages_user_id ON public.support_messages (user_id);

-- Aggregated breed → wool_class stats (used as a prior in the AI prompt)
CREATE OR REPLACE FUNCTION public.breed_class_stats()
RETURNS TABLE(breed_code text, wool_class text, n bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT breed_code, wool_class, count(*)::bigint AS n
  FROM public.classifications
  WHERE breed_code IS NOT NULL
    AND wool_class IS NOT NULL
    AND status = 'completed'
  GROUP BY breed_code, wool_class
  ORDER BY breed_code, n DESC
$$;

-- Per-user admin overview (sheep + classifications) — admin-only
CREATE OR REPLACE FUNCTION public.admin_user_detail(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT jsonb_build_object(
    'profile', (SELECT to_jsonb(p.*) FROM public.profiles p WHERE p.id = _user_id),
    'sheep', COALESCE((SELECT jsonb_agg(to_jsonb(s.*) ORDER BY s.created_at DESC) FROM public.sheep s WHERE s.owner_id = _user_id), '[]'::jsonb),
    'classifications', COALESCE((SELECT jsonb_agg(to_jsonb(c.*) ORDER BY c.created_at DESC) FROM public.classifications c WHERE c.user_id = _user_id), '[]'::jsonb),
    'support_messages', COALESCE((SELECT jsonb_agg(to_jsonb(m.*) ORDER BY m.created_at DESC) FROM public.support_messages m WHERE m.user_id = _user_id), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END; $$;
