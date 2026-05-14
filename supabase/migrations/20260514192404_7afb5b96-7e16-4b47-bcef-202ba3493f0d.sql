
-- 1. Backfill any legacy values to canonical vocab
UPDATE public.wool_lots SET status = 'at_station' WHERE status IN ('received', 'ready_for_pickup', 'picked_up');
UPDATE public.deliveries SET method = 'dropoff_station' WHERE method = 'drop_off';
UPDATE public.pickup_requests SET priority = 'high' WHERE priority NOT IN ('normal','high','urgent');

-- 2. Check constraints
ALTER TABLE public.wool_lots
  DROP CONSTRAINT IF EXISTS wool_lots_status_check,
  ADD CONSTRAINT wool_lots_status_check
  CHECK (status IN ('registered','in_transit','at_station','at_holma','classified','paid','cancelled'));

ALTER TABLE public.deliveries
  DROP CONSTRAINT IF EXISTS deliveries_method_check,
  ADD CONSTRAINT deliveries_method_check
  CHECK (method IN ('dropoff_station','with_shearer','pickup'));

ALTER TABLE public.deliveries
  DROP CONSTRAINT IF EXISTS deliveries_status_check,
  ADD CONSTRAINT deliveries_status_check
  CHECK (status IN ('pending','scheduled','in_transit','completed','cancelled'));

ALTER TABLE public.pickup_requests
  DROP CONSTRAINT IF EXISTS pickup_requests_priority_check,
  ADD CONSTRAINT pickup_requests_priority_check
  CHECK (priority IN ('normal','high','urgent'));

ALTER TABLE public.pickup_requests
  DROP CONSTRAINT IF EXISTS pickup_requests_status_check,
  ADD CONSTRAINT pickup_requests_status_check
  CHECK (status IN ('pending','scheduled','completed','cancelled'));

-- 3. Atomic stock bump RPC
CREATE OR REPLACE FUNCTION public.bump_station_stock(_station_id uuid, _delta_kg numeric)
RETURNS public.collection_stations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.collection_stations;
BEGIN
  UPDATE public.collection_stations
  SET current_stock_kg = GREATEST(0, current_stock_kg + _delta_kg::int)
  WHERE id = _station_id
    AND (manager_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  RETURNING * INTO result;
  IF result.id IS NULL THEN
    RAISE EXCEPTION 'station not found or not authorized';
  END IF;
  RETURN result;
END;
$$;

-- 4. Admin can update profiles (e.g. admin renames a user)
DROP POLICY IF EXISTS "admins update all profiles" ON public.profiles;
CREATE POLICY "admins update all profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins read all profiles" ON public.profiles;
CREATE POLICY "admins read all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5. Drop dead bookings columns
ALTER TABLE public.bookings
  DROP COLUMN IF EXISTS expected_confidence,
  DROP COLUMN IF EXISTS expected_wool_class,
  DROP COLUMN IF EXISTS expected_wool_class_name_en,
  DROP COLUMN IF EXISTS expected_wool_class_name_sv;

-- 6. Fix function search_path warnings (recreate with explicit set search_path)
ALTER FUNCTION public.set_updated_at() SET search_path = public;
