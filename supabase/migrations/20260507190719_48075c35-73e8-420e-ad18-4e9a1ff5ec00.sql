
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null,
  shearer_id uuid not null references public.shearers(id) on delete cascade,
  preferred_date date,
  message text,
  sheep_count integer,
  contact_phone text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_bookings_farmer on public.bookings(farmer_id);
create index idx_bookings_shearer on public.bookings(shearer_id);

alter table public.bookings enable row level security;

create policy "farmers manage own bookings" on public.bookings for all to authenticated
using (auth.uid() = farmer_id) with check (auth.uid() = farmer_id);

create policy "shearers read bookings for them" on public.bookings for select to authenticated
using (exists (select 1 from public.shearers s where s.id = bookings.shearer_id and s.user_id = auth.uid()));

create policy "shearers update bookings for them" on public.bookings for update to authenticated
using (exists (select 1 from public.shearers s where s.id = bookings.shearer_id and s.user_id = auth.uid()))
with check (exists (select 1 from public.shearers s where s.id = bookings.shearer_id and s.user_id = auth.uid()));

create policy "admins manage all bookings" on public.bookings for all to authenticated
using (has_role(auth.uid(), 'admin')) with check (has_role(auth.uid(), 'admin'));

create trigger trg_bookings_updated_at before update on public.bookings
for each row execute function public.set_updated_at();
