-- Add scanning mode + mode-specific metadata to classifications
ALTER TABLE public.classifications
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'on_sheep',
  ADD COLUMN IF NOT EXISTS body_area text,
  ADD COLUMN IF NOT EXISTS fleece_id text,
  ADD COLUMN IF NOT EXISTS shearing_date date;

-- Constrain mode to known values via validation trigger (avoid CHECK)
CREATE OR REPLACE FUNCTION public.validate_classification_mode()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.mode IS NOT NULL AND NEW.mode NOT IN ('on_sheep', 'sheared') THEN
    RAISE EXCEPTION 'invalid mode: %', NEW.mode;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS classifications_mode_validate ON public.classifications;
CREATE TRIGGER classifications_mode_validate
BEFORE INSERT OR UPDATE ON public.classifications
FOR EACH ROW EXECUTE FUNCTION public.validate_classification_mode();

CREATE INDEX IF NOT EXISTS idx_classifications_mode ON public.classifications(mode);