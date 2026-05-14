-- Public wrappers must run as SECURITY DEFINER so they can reach the private schema.
-- Without this, authenticated users get nothing back (no USAGE on schema private).

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(id uuid, email text, created_at timestamptz, full_name text, first_name text, last_name text, farm_name text, phone text, address text, is_admin boolean, classifications_count bigint, sheep_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT * FROM private.admin_list_users() $$;

CREATE OR REPLACE FUNCTION public.admin_user_detail(_user_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT private.admin_user_detail(_user_id) $$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT private.has_role(_user_id, _role) $$;

CREATE OR REPLACE FUNCTION public.breed_class_stats()
RETURNS TABLE(breed_code text, wool_class text, n bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT * FROM private.breed_class_stats() $$;

CREATE OR REPLACE FUNCTION public.bump_station_stock(_station_id uuid, _delta_kg numeric)
RETURNS public.collection_stations
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ SELECT * FROM private.bump_station_stock(_station_id, _delta_kg) $$;

CREATE OR REPLACE FUNCTION public.nearest_shearers(user_lat double precision, user_lng double precision, max_km integer DEFAULT 9999, max_results integer DEFAULT 200)
RETURNS TABLE(id uuid, display_name text, phone text, email text, website text, languages text[], breed_specialties text[], service_areas text[], hourly_rate_sek integer, certified_by_farklipparforbundet boolean, listed_by_faravelsforbundet boolean, self_managed boolean, notes text, distance_km double precision)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT * FROM private.nearest_shearers(user_lat, user_lng, max_km, max_results) $$;

CREATE OR REPLACE FUNCTION public.recent_confirmed_for_user(_user_id uuid, _limit integer DEFAULT 15)
RETURNS TABLE(wool_class text, wool_class_name_sv text, breed text, breed_code text, age_category text, mode text, reasoning_sv text, was_corrected boolean, photo_urls text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT * FROM private.recent_confirmed_for_user(_user_id, _limit) $$;

CREATE OR REPLACE FUNCTION public.user_ai_accuracy(_user_id uuid)
RETURNS TABLE(total bigint, correct bigint, corrected bigint, accuracy numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT * FROM private.user_ai_accuracy(_user_id) $$;

REVOKE EXECUTE ON FUNCTION public.admin_list_users(), public.admin_user_detail(uuid), public.breed_class_stats(), public.bump_station_stock(uuid, numeric), public.nearest_shearers(double precision, double precision, integer, integer), public.recent_confirmed_for_user(uuid, integer), public.user_ai_accuracy(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users(), public.admin_user_detail(uuid), public.breed_class_stats(), public.bump_station_stock(uuid, numeric), public.nearest_shearers(double precision, double precision, integer, integer), public.recent_confirmed_for_user(uuid, integer), public.user_ai_accuracy(uuid) TO authenticated, service_role;