
ALTER TABLE public.classifications
  ADD COLUMN IF NOT EXISTS original_wool_class text,
  ADD COLUMN IF NOT EXISTS user_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

-- Backfill existing rows: assume original = current
UPDATE public.classifications
  SET original_wool_class = wool_class
  WHERE original_wool_class IS NULL AND wool_class IS NOT NULL;

-- Accuracy stats for the calling user
CREATE OR REPLACE FUNCTION public.user_ai_accuracy(_user_id uuid)
RETURNS TABLE(total bigint, correct bigint, corrected bigint, accuracy numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    count(*)::bigint AS total,
    count(*) FILTER (WHERE wool_class IS NOT DISTINCT FROM original_wool_class)::bigint AS correct,
    count(*) FILTER (WHERE wool_class IS DISTINCT FROM original_wool_class)::bigint AS corrected,
    CASE WHEN count(*) = 0 THEN 0
         ELSE round(100.0 * count(*) FILTER (WHERE wool_class IS NOT DISTINCT FROM original_wool_class) / count(*), 1)
    END AS accuracy
  FROM public.classifications
  WHERE user_id = _user_id
    AND user_confirmed = true
    AND original_wool_class IS NOT NULL
$$;

-- Recent confirmed classifications for few-shot prompting
CREATE OR REPLACE FUNCTION public.recent_confirmed_for_user(_user_id uuid, _limit int DEFAULT 5)
RETURNS TABLE(
  wool_class text,
  wool_class_name_sv text,
  breed text,
  breed_code text,
  age_category text,
  mode text,
  reasoning_sv text,
  was_corrected boolean,
  photo_urls text[]
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT wool_class, wool_class_name_sv, breed, breed_code, age_category, mode, reasoning_sv,
         (wool_class IS DISTINCT FROM original_wool_class) AS was_corrected,
         photo_urls
  FROM public.classifications
  WHERE user_id = _user_id
    AND user_confirmed = true
    AND wool_class IS NOT NULL
    AND status = 'completed'
  ORDER BY confirmed_at DESC NULLS LAST, created_at DESC
  LIMIT _limit
$$;
