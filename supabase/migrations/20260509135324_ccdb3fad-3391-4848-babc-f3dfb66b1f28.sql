ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS sheep_id uuid,
  ADD COLUMN IF NOT EXISTS expected_wool_class text,
  ADD COLUMN IF NOT EXISTS expected_wool_class_name_sv text,
  ADD COLUMN IF NOT EXISTS expected_wool_class_name_en text,
  ADD COLUMN IF NOT EXISTS expected_confidence text;

CREATE INDEX IF NOT EXISTS idx_bookings_preferred_date ON public.bookings(preferred_date);
CREATE INDEX IF NOT EXISTS idx_bookings_shearer_id ON public.bookings(shearer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_farmer_id ON public.bookings(farmer_id);