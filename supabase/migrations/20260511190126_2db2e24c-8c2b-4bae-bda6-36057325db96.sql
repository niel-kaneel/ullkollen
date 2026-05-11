CREATE OR REPLACE FUNCTION public.recent_confirmed_for_user(_user_id uuid, _limit integer DEFAULT 15)
 RETURNS TABLE(wool_class text, wool_class_name_sv text, breed text, breed_code text, age_category text, mode text, reasoning_sv text, was_corrected boolean, photo_urls text[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;