
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, email, full_name, first_name, last_name, phone, address)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name',
             nullif(trim(coalesce(new.raw_user_meta_data->>'first_name','') || ' ' || coalesce(new.raw_user_meta_data->>'last_name','')), '')),
    nullif(new.raw_user_meta_data->>'first_name',''),
    nullif(new.raw_user_meta_data->>'last_name',''),
    nullif(new.raw_user_meta_data->>'phone',''),
    nullif(new.raw_user_meta_data->>'address','')
  )
  on conflict (id) do nothing;
  return new;
end; $function$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_created_grant_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_grant_admin
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.grant_admin_if_match();

DROP FUNCTION IF EXISTS public.admin_list_users();
CREATE FUNCTION public.admin_list_users()
RETURNS TABLE(
  id uuid, email text, created_at timestamp with time zone,
  full_name text, first_name text, last_name text,
  farm_name text, phone text, address text,
  is_admin boolean, classifications_count bigint, sheep_count bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select u.id, u.email::text, u.created_at,
    p.full_name, p.first_name, p.last_name,
    p.farm_name, p.phone, p.address,
    exists(select 1 from public.user_roles r where r.user_id = u.id and r.role = 'admin'),
    (select count(*) from public.classifications c where c.user_id = u.id),
    (select count(*) from public.sheep s where s.owner_id = u.id)
  from auth.users u
  left join public.profiles p on p.id = u.id
  where public.has_role(auth.uid(),'admin')
  order by u.created_at desc
$function$;
