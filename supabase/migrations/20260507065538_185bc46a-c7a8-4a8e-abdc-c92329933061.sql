ALTER TABLE public.classifications ADD COLUMN IF NOT EXISTS breed_code text;
ALTER TABLE public.sheep ADD COLUMN IF NOT EXISTS breed_code text;
CREATE INDEX IF NOT EXISTS idx_classifications_breed_code ON public.classifications(breed_code);
CREATE INDEX IF NOT EXISTS idx_sheep_breed_code ON public.sheep(breed_code);