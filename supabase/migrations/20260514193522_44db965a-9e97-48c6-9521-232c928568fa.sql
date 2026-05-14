CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_grant_admin ON auth.users;
DROP TRIGGER IF EXISTS validate_classification_mode_trg ON public.classifications;

DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT tgname, c.relname
    FROM pg_trigger tg
    JOIN pg_class c ON c.oid = tg.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = tg.tgfoid
    WHERE n.nspname = 'public' AND p.proname = 'set_updated_at' AND NOT tg.tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t.tgname, t.relname);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
begin
  insert into public.profiles (id, email, full_name, first_name, last_name, phone, address)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data->>'full_name',
             nullif(trim(coalesce(new.raw_user_meta_data->>'first_name','') || ' ' || coalesce(new.raw_user_meta_data->>'last_name','')), '')),
    nullif(new.raw_user_meta_data->>'first_name',''),
    nullif(new.raw_user_meta_data->>'last_name',''),
    nullif(new.raw_user_meta_data->>'phone',''),
    nullif(new.raw_user_meta_data->>'address','')
  )
  on conflict (id) do nothing;
  return new;
end; $fn$;

CREATE OR REPLACE FUNCTION private.grant_admin_if_match()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
begin
  if new.email = 'niel@kaneel.se' then
    insert into public.user_roles (user_id, role) values (new.id, 'admin') on conflict do nothing;
  end if;
  return new;
end; $fn$;

CREATE OR REPLACE FUNCTION private.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
begin new.updated_at = now(); return new; end; $fn$;

CREATE OR REPLACE FUNCTION private.validate_classification_mode()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
BEGIN
  IF NEW.mode IS NOT NULL AND NEW.mode NOT IN ('on_sheep', 'sheared') THEN
    RAISE EXCEPTION 'invalid mode: %', NEW.mode;
  END IF;
  RETURN NEW;
END; $fn$;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$fn$;

CREATE OR REPLACE FUNCTION private.breed_class_stats()
RETURNS TABLE(breed_code text, wool_class text, n bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT breed_code, wool_class, count(*)::bigint AS n
  FROM public.classifications
  WHERE breed_code IS NOT NULL AND wool_class IS NOT NULL AND status = 'completed'
  GROUP BY breed_code, wool_class
  ORDER BY breed_code, n DESC
$fn$;

CREATE OR REPLACE FUNCTION private.admin_user_detail(_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE result jsonb;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT jsonb_build_object(
    'profile', (SELECT to_jsonb(p.*) FROM public.profiles p WHERE p.id = _user_id),
    'sheep', COALESCE((SELECT jsonb_agg(to_jsonb(s.*) ORDER BY s.created_at DESC) FROM public.sheep s WHERE s.owner_id = _user_id), '[]'::jsonb),
    'classifications', COALESCE((SELECT jsonb_agg(to_jsonb(c.*) ORDER BY c.created_at DESC) FROM public.classifications c WHERE c.user_id = _user_id), '[]'::jsonb),
    'support_messages', COALESCE((SELECT jsonb_agg(to_jsonb(m.*) ORDER BY m.created_at DESC) FROM public.support_messages m WHERE m.user_id = _user_id), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END; $fn$;

CREATE OR REPLACE FUNCTION private.admin_list_users()
RETURNS TABLE(id uuid, email text, created_at timestamptz, full_name text, first_name text, last_name text, farm_name text, phone text, address text, is_admin boolean, classifications_count bigint, sheep_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  select u.id, u.email::text, u.created_at,
    p.full_name, p.first_name, p.last_name, p.farm_name, p.phone, p.address,
    exists(select 1 from public.user_roles r where r.user_id = u.id and r.role = 'admin'),
    (select count(*) from public.classifications c where c.user_id = u.id),
    (select count(*) from public.sheep s where s.owner_id = u.id)
  from auth.users u
  left join public.profiles p on p.id = u.id
  where private.has_role(auth.uid(),'admin')
  order by u.created_at desc
$fn$;

CREATE OR REPLACE FUNCTION private.nearest_shearers(user_lat double precision, user_lng double precision, max_km integer DEFAULT 9999, max_results integer DEFAULT 200)
RETURNS TABLE(id uuid, display_name text, phone text, email text, website text, languages text[], breed_specialties text[], service_areas text[], hourly_rate_sek integer, certified_by_farklipparforbundet boolean, listed_by_faravelsforbundet boolean, self_managed boolean, notes text, distance_km double precision)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  select id, display_name, phone, email, website, languages, breed_specialties, service_areas, hourly_rate_sek, certified_by_farklipparforbundet, listed_by_faravelsforbundet, self_managed, notes, distance_km
  from (
    select s.id, s.display_name, s.phone, s.email, s.website, s.languages, s.breed_specialties, s.service_areas, s.hourly_rate_sek,
      coalesce(s.certified_by_farklipparforbundet,false) as certified_by_farklipparforbundet,
      coalesce(s.listed_by_faravelsforbundet,false) as listed_by_faravelsforbundet,
      coalesce(s.self_managed,false) as self_managed, s.notes,
      (6371 * acos(cos(radians(user_lat)) * cos(radians(s.home_lat)) *
        cos(radians(s.home_lng) - radians(user_lng)) +
        sin(radians(user_lat)) * sin(radians(s.home_lat))))::double precision as distance_km
    from public.shearers s
    where s.approved = true and s.active = true and s.home_lat is not null and s.home_lng is not null
  ) q
  where distance_km <= max_km
  order by distance_km asc
  limit max_results
$fn$;

CREATE OR REPLACE FUNCTION private.recent_confirmed_for_user(_user_id uuid, _limit integer DEFAULT 15)
RETURNS TABLE(wool_class text, wool_class_name_sv text, breed text, breed_code text, age_category text, mode text, reasoning_sv text, was_corrected boolean, photo_urls text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT wool_class, wool_class_name_sv, breed, breed_code, age_category, mode, reasoning_sv,
         (wool_class IS DISTINCT FROM original_wool_class), photo_urls
  FROM public.classifications
  WHERE user_id = _user_id AND user_confirmed = true
    AND wool_class IS NOT NULL AND status = 'completed'
  ORDER BY confirmed_at DESC NULLS LAST, created_at DESC
  LIMIT _limit
$fn$;

CREATE OR REPLACE FUNCTION private.user_ai_accuracy(_user_id uuid)
RETURNS TABLE(total bigint, correct bigint, corrected bigint, accuracy numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT count(*)::bigint,
    count(*) FILTER (WHERE wool_class IS NOT DISTINCT FROM original_wool_class)::bigint,
    count(*) FILTER (WHERE wool_class IS DISTINCT FROM original_wool_class)::bigint,
    CASE WHEN count(*) = 0 THEN 0
      ELSE round(100.0 * count(*) FILTER (WHERE wool_class IS NOT DISTINCT FROM original_wool_class) / count(*), 1) END
  FROM public.classifications
  WHERE user_id = _user_id AND user_confirmed = true AND original_wool_class IS NOT NULL
$fn$;

CREATE OR REPLACE FUNCTION private.bump_station_stock(_station_id uuid, _delta_kg numeric)
RETURNS public.collection_stations LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE result public.collection_stations;
BEGIN
  UPDATE public.collection_stations
  SET current_stock_kg = GREATEST(0, current_stock_kg + _delta_kg::int)
  WHERE id = _station_id
    AND (manager_user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'))
  RETURNING * INTO result;
  IF result.id IS NULL THEN
    RAISE EXCEPTION 'station not found or not authorized';
  END IF;
  RETURN result;
END; $fn$;

DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.grant_admin_if_match() CASCADE;
DROP FUNCTION IF EXISTS public.set_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.validate_classification_mode() CASCADE;
DROP FUNCTION IF EXISTS public.breed_class_stats() CASCADE;
DROP FUNCTION IF EXISTS public.admin_user_detail(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.admin_list_users() CASCADE;
DROP FUNCTION IF EXISTS public.nearest_shearers(double precision, double precision, integer, integer) CASCADE;
DROP FUNCTION IF EXISTS public.recent_confirmed_for_user(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS public.user_ai_accuracy(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.bump_station_stock(uuid, numeric) CASCADE;
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role) CASCADE;

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $fn$
  SELECT private.has_role(_user_id, _role)
$fn$;

CREATE FUNCTION public.breed_class_stats()
RETURNS TABLE(breed_code text, wool_class text, n bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $fn$
  SELECT * FROM private.breed_class_stats()
$fn$;

CREATE FUNCTION public.admin_user_detail(_user_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $fn$
  SELECT private.admin_user_detail(_user_id)
$fn$;

CREATE FUNCTION public.admin_list_users()
RETURNS TABLE(id uuid, email text, created_at timestamptz, full_name text, first_name text, last_name text, farm_name text, phone text, address text, is_admin boolean, classifications_count bigint, sheep_count bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $fn$
  SELECT * FROM private.admin_list_users()
$fn$;

CREATE FUNCTION public.nearest_shearers(user_lat double precision, user_lng double precision, max_km integer DEFAULT 9999, max_results integer DEFAULT 200)
RETURNS TABLE(id uuid, display_name text, phone text, email text, website text, languages text[], breed_specialties text[], service_areas text[], hourly_rate_sek integer, certified_by_farklipparforbundet boolean, listed_by_faravelsforbundet boolean, self_managed boolean, notes text, distance_km double precision)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $fn$
  SELECT * FROM private.nearest_shearers(user_lat, user_lng, max_km, max_results)
$fn$;

CREATE FUNCTION public.recent_confirmed_for_user(_user_id uuid, _limit integer DEFAULT 15)
RETURNS TABLE(wool_class text, wool_class_name_sv text, breed text, breed_code text, age_category text, mode text, reasoning_sv text, was_corrected boolean, photo_urls text[])
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $fn$
  SELECT * FROM private.recent_confirmed_for_user(_user_id, _limit)
$fn$;

CREATE FUNCTION public.user_ai_accuracy(_user_id uuid)
RETURNS TABLE(total bigint, correct bigint, corrected bigint, accuracy numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $fn$
  SELECT * FROM private.user_ai_accuracy(_user_id)
$fn$;

CREATE FUNCTION public.bump_station_stock(_station_id uuid, _delta_kg numeric)
RETURNS public.collection_stations
LANGUAGE sql SECURITY INVOKER SET search_path = public AS $fn$
  SELECT * FROM private.bump_station_stock(_station_id, _delta_kg)
$fn$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION private.handle_new_user();

CREATE TRIGGER on_auth_user_created_grant_admin
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION private.grant_admin_if_match();

CREATE TRIGGER validate_classification_mode_trg
BEFORE INSERT OR UPDATE ON public.classifications
FOR EACH ROW EXECUTE FUNCTION private.validate_classification_mode();

DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND a.attname = 'updated_at' AND c.relkind = 'r'
  LOOP
    EXECUTE format('CREATE TRIGGER set_updated_at_trg BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.set_updated_at()', t.relname);
  END LOOP;
END $$;

DO $$
DECLARE fn record;
BEGIN
  FOR fn IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('has_role','breed_class_stats','admin_user_detail','admin_list_users',
                        'nearest_shearers','recent_confirmed_for_user','user_ai_accuracy','bump_station_stock')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon', fn.proname, fn.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role', fn.proname, fn.args);
  END LOOP;
END $$;