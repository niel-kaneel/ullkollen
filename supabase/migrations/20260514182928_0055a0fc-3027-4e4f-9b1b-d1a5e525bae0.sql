
ALTER TABLE public.shearers
  ADD COLUMN IF NOT EXISTS collects_wool boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wool_capacity_kg integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mileage_rate_with_trailer_sek numeric NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS mileage_rate_without_trailer_sek numeric NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS has_trailer boolean NOT NULL DEFAULT false;
