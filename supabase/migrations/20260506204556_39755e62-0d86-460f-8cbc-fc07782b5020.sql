
-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'farmer',
  full_name text, farm_name text, phone text, email text, address text,
  home_lat double precision, home_lng double precision,
  language text default 'sv',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "users read own profile" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "users update own profile" on public.profiles for update to authenticated using (auth.uid() = id);
create policy "users insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name',''))
  on conflict (id) do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ROLES
create type public.app_role as enum ('admin','user');
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  created_at timestamptz default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "users read own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);
create policy "admins manage roles" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

insert into public.user_roles (user_id, role)
select id, 'admin'::app_role from auth.users where email = 'niel@kaneel.se'
on conflict do nothing;

create or replace function public.grant_admin_if_match()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email = 'niel@kaneel.se' then
    insert into public.user_roles (user_id, role) values (new.id, 'admin') on conflict do nothing;
  end if;
  return new;
end; $$;
create trigger on_auth_user_created_admin after insert on auth.users
  for each row execute function public.grant_admin_if_match();

-- SHEEP
create table public.sheep (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade not null,
  name text, tag_id text, breed text, age_category text,
  created_at timestamptz not null default now()
);
alter table public.sheep enable row level security;
create policy "owners crud sheep" on public.sheep for all to authenticated
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "admins read all sheep" on public.sheep for select to authenticated
  using (public.has_role(auth.uid(),'admin'));

-- CLASSIFICATIONS
create table public.classifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  sheep_id uuid references public.sheep(id) on delete set null,
  status text not null default 'processing',
  breed text, age_category text, months_since_last_shear int,
  photo_urls text[] default '{}',
  wool_class text, wool_class_name_sv text, wool_class_name_en text,
  confidence text, shear_recommendation text, weeks_until_optimal int,
  recommendation_text_sv text, recommendation_text_en text, reasoning_sv text,
  needs_retake boolean, retake_reason_sv text,
  raw_ai_response jsonb, completed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.classifications enable row level security;
create policy "users crud own classifications" on public.classifications for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "admins read all classifications" on public.classifications for select to authenticated
  using (public.has_role(auth.uid(),'admin'));
create policy "admins delete any classification" on public.classifications for delete to authenticated
  using (public.has_role(auth.uid(),'admin'));

-- SHEARERS
create table public.shearers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  display_name text not null,
  phone text, email text,
  languages text[] default '{}',
  breed_specialties text[] default '{}',
  hourly_rate_sek int,
  home_lat double precision, home_lng double precision,
  approved boolean default false, active boolean default true,
  created_at timestamptz not null default now()
);
alter table public.shearers enable row level security;
create policy "anyone read approved shearers" on public.shearers for select to authenticated
  using (approved = true and active = true);
create policy "self manage shearer profile" on public.shearers for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "admins manage all shearers" on public.shearers for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create or replace function public.nearest_shearers(
  user_lat double precision, user_lng double precision,
  max_km int default 500, max_results int default 30
)
returns table (
  id uuid, display_name text, phone text, email text,
  languages text[], breed_specialties text[], hourly_rate_sek int,
  distance_km double precision
)
language sql stable security definer set search_path = public as $$
  select id, display_name, phone, email, languages, breed_specialties, hourly_rate_sek, distance_km
  from (
    select s.id, s.display_name, s.phone, s.email, s.languages, s.breed_specialties, s.hourly_rate_sek,
      (6371 * acos(
        cos(radians(user_lat)) * cos(radians(s.home_lat)) *
        cos(radians(s.home_lng) - radians(user_lng)) +
        sin(radians(user_lat)) * sin(radians(s.home_lat))
      ))::double precision as distance_km
    from public.shearers s
    where s.approved = true and s.active = true and s.home_lat is not null and s.home_lng is not null
  ) q
  where distance_km <= max_km
  order by distance_km asc
  limit max_results
$$;
grant execute on function public.nearest_shearers(double precision,double precision,int,int) to authenticated;

-- ADMIN LIST USERS
create or replace function public.admin_list_users()
returns table (
  id uuid, email text, created_at timestamptz,
  full_name text, farm_name text, is_admin boolean,
  classifications_count bigint, sheep_count bigint
)
language sql stable security definer set search_path = public as $$
  select u.id, u.email::text, u.created_at, p.full_name, p.farm_name,
    exists(select 1 from public.user_roles r where r.user_id = u.id and r.role = 'admin'),
    (select count(*) from public.classifications c where c.user_id = u.id),
    (select count(*) from public.sheep s where s.owner_id = u.id)
  from auth.users u
  left join public.profiles p on p.id = u.id
  where public.has_role(auth.uid(),'admin')
  order by u.created_at desc
$$;
grant execute on function public.admin_list_users() to authenticated;

-- STORAGE
insert into storage.buckets (id, name, public) values ('sheep-photos','sheep-photos', false)
on conflict (id) do nothing;

create policy "users upload own sheep photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'sheep-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users read own sheep photos" on storage.objects for select to authenticated
  using (bucket_id = 'sheep-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users update own sheep photos" on storage.objects for update to authenticated
  using (bucket_id = 'sheep-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users delete own sheep photos" on storage.objects for delete to authenticated
  using (bucket_id = 'sheep-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "admins read all sheep photos" on storage.objects for select to authenticated
  using (bucket_id = 'sheep-photos' and public.has_role(auth.uid(),'admin'));
