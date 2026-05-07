
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS production_place_number text;

ALTER TABLE public.sheep
  RENAME COLUMN tag_id TO ear_tag_id;

CREATE INDEX IF NOT EXISTS sheep_ear_tag_idx
  ON public.sheep (owner_id, ear_tag_id);

ALTER TABLE public.sheep
  ADD CONSTRAINT unique_ear_tag_per_owner UNIQUE (owner_id, ear_tag_id);
