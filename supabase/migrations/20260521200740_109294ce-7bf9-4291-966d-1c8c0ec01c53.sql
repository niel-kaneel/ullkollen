
-- Enable pgvector
create extension if not exists vector;

-- expert_recordings
create table public.expert_recordings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  audio_path text not null,
  klassare_namn text,
  inspelning_datum date,
  wool_class text,
  breed text,
  transcript_full text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.expert_recordings enable row level security;

create policy "admins manage expert_recordings"
on public.expert_recordings for all to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create policy "authenticated read expert_recordings"
on public.expert_recordings for select to authenticated
using (true);

-- expert_observations (chunks)
create table public.expert_observations (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.expert_recordings(id) on delete cascade,
  chunk_text text not null,
  embedding vector(1536),
  fiber_characteristics text[] default '{}'::text[],
  wool_class text,
  breed text,
  created_at timestamptz not null default now()
);

alter table public.expert_observations enable row level security;

create policy "admins manage expert_observations"
on public.expert_observations for all to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create policy "authenticated read expert_observations"
on public.expert_observations for select to authenticated
using (true);

create index expert_observations_embedding_idx
  on public.expert_observations using hnsw (embedding vector_cosine_ops);

create index expert_observations_wool_class_idx
  on public.expert_observations (wool_class);

-- user_tactile_descriptions (learning loop)
create table public.user_tactile_descriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  classification_id uuid,
  user_description text not null,
  image_predicted_class text,
  comparison_result jsonb,
  retrieved_recording_ids uuid[] default '{}'::uuid[],
  led_to_correction boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.user_tactile_descriptions enable row level security;

create policy "users manage own tactile descriptions"
on public.user_tactile_descriptions for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "admins read all tactile descriptions"
on public.user_tactile_descriptions for select to authenticated
using (public.has_role(auth.uid(), 'admin'));

-- Matching function
create or replace function public.match_expert_observations(
  query_embedding vector(1536),
  match_count int default 5,
  wool_class_filter text default null
)
returns table (
  id uuid,
  recording_id uuid,
  chunk_text text,
  wool_class text,
  breed text,
  fiber_characteristics text[],
  similarity float
)
language sql stable
security definer
set search_path = public
as $$
  select
    o.id,
    o.recording_id,
    o.chunk_text,
    o.wool_class,
    o.breed,
    o.fiber_characteristics,
    1 - (o.embedding <=> query_embedding) as similarity
  from public.expert_observations o
  where (wool_class_filter is null or o.wool_class = wool_class_filter)
    and o.embedding is not null
  order by o.embedding <=> query_embedding
  limit match_count;
$$;

-- updated_at trigger reuse
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger expert_recordings_updated_at
before update on public.expert_recordings
for each row execute function public.tg_set_updated_at();

-- Storage bucket (private)
insert into storage.buckets (id, name, public)
values ('expert-audio', 'expert-audio', false)
on conflict (id) do nothing;

create policy "admins read expert-audio"
on storage.objects for select to authenticated
using (bucket_id = 'expert-audio' and public.has_role(auth.uid(), 'admin'));

create policy "admins write expert-audio"
on storage.objects for insert to authenticated
with check (bucket_id = 'expert-audio' and public.has_role(auth.uid(), 'admin'));

create policy "admins update expert-audio"
on storage.objects for update to authenticated
using (bucket_id = 'expert-audio' and public.has_role(auth.uid(), 'admin'));

create policy "admins delete expert-audio"
on storage.objects for delete to authenticated
using (bucket_id = 'expert-audio' and public.has_role(auth.uid(), 'admin'));
