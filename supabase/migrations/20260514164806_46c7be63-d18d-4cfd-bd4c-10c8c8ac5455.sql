-- 1. Extend role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'station_manager';

-- 2. collection_stations
CREATE TABLE public.collection_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  lat double precision,
  lng double precision,
  capacity_kg integer NOT NULL DEFAULT 0,
  current_stock_kg integer NOT NULL DEFAULT 0,
  manager_user_id uuid,
  contact_phone text,
  contact_email text,
  notes text,
  approved boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.collection_stations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone read approved stations"
  ON public.collection_stations FOR SELECT TO authenticated
  USING (approved = true AND active = true);

CREATE POLICY "manager read own station"
  ON public.collection_stations FOR SELECT TO authenticated
  USING (auth.uid() = manager_user_id);

CREATE POLICY "anyone apply to run station"
  ON public.collection_stations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = manager_user_id AND approved = false);

CREATE POLICY "manager update own station"
  ON public.collection_stations FOR UPDATE TO authenticated
  USING (auth.uid() = manager_user_id)
  WITH CHECK (auth.uid() = manager_user_id);

CREATE POLICY "admins manage all stations"
  ON public.collection_stations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_collection_stations_updated
  BEFORE UPDATE ON public.collection_stations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. wool_lots
CREATE TABLE public.wool_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  sheep_id uuid,
  classification_id uuid,
  estimated_kg numeric(10,2) NOT NULL,
  actual_kg numeric(10,2),
  breed_codes text[] DEFAULT '{}',
  notes text,
  status text NOT NULL DEFAULT 'registered',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wool_lots_status_chk CHECK (status IN ('draft','registered','in_transit','at_station','at_holma','classified','paid','cancelled'))
);
ALTER TABLE public.wool_lots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners crud own lots"
  ON public.wool_lots FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "admins read all lots"
  ON public.wool_lots FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins update all lots"
  ON public.wool_lots FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_wool_lots_updated
  BEFORE UPDATE ON public.wool_lots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_wool_lots_owner ON public.wool_lots(owner_id);
CREATE INDEX idx_wool_lots_status ON public.wool_lots(status);

-- 4. deliveries
CREATE TABLE public.deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wool_lot_id uuid NOT NULL REFERENCES public.wool_lots(id) ON DELETE CASCADE,
  method text NOT NULL,
  origin_station_id uuid REFERENCES public.collection_stations(id),
  destination_station_id uuid REFERENCES public.collection_stations(id),
  shearer_id uuid REFERENCES public.shearers(id),
  distance_km numeric(8,2),
  fuel_type text,
  mileage_sek numeric(10,2),
  status text NOT NULL DEFAULT 'pending',
  scheduled_for date,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deliveries_method_chk CHECK (method IN ('dropoff_station','with_shearer','pickup')),
  CONSTRAINT deliveries_fuel_chk CHECK (fuel_type IS NULL OR fuel_type IN ('fossil_free','fossil')),
  CONSTRAINT deliveries_status_chk CHECK (status IN ('pending','scheduled','in_transit','completed','cancelled'))
);
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage own lot deliveries"
  ON public.deliveries FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.wool_lots l WHERE l.id = wool_lot_id AND l.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.wool_lots l WHERE l.id = wool_lot_id AND l.owner_id = auth.uid()));

CREATE POLICY "shearers read assigned deliveries"
  ON public.deliveries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shearers s WHERE s.id = shearer_id AND s.user_id = auth.uid()));

CREATE POLICY "shearers update assigned deliveries"
  ON public.deliveries FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shearers s WHERE s.id = shearer_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shearers s WHERE s.id = shearer_id AND s.user_id = auth.uid()));

CREATE POLICY "station managers read incoming deliveries"
  ON public.deliveries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.collection_stations cs WHERE cs.id = destination_station_id AND cs.manager_user_id = auth.uid()));

CREATE POLICY "admins manage all deliveries"
  ON public.deliveries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_deliveries_updated
  BEFORE UPDATE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_deliveries_lot ON public.deliveries(wool_lot_id);
CREATE INDEX idx_deliveries_shearer ON public.deliveries(shearer_id);

-- 5. revenue_shares
CREATE TABLE public.revenue_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wool_lot_id uuid NOT NULL REFERENCES public.wool_lots(id) ON DELETE CASCADE,
  shearer_id uuid NOT NULL REFERENCES public.shearers(id),
  percent numeric(5,2) NOT NULL,
  amount_sek numeric(10,2),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT revenue_shares_percent_chk CHECK (percent >= 20 AND percent <= 100)
);
ALTER TABLE public.revenue_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage own lot shares"
  ON public.revenue_shares FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.wool_lots l WHERE l.id = wool_lot_id AND l.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.wool_lots l WHERE l.id = wool_lot_id AND l.owner_id = auth.uid()));

CREATE POLICY "shearers read own shares"
  ON public.revenue_shares FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shearers s WHERE s.id = shearer_id AND s.user_id = auth.uid()));

CREATE POLICY "admins manage all shares"
  ON public.revenue_shares FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_revenue_shares_updated
  BEFORE UPDATE ON public.revenue_shares
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. pickup_requests
CREATE TABLE public.pickup_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid REFERENCES public.collection_stations(id),
  owner_id uuid,
  requested_kg numeric(10,2) NOT NULL,
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'pending',
  notes text,
  scheduled_for date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pickup_priority_chk CHECK (priority IN ('normal','priority')),
  CONSTRAINT pickup_status_chk CHECK (status IN ('pending','scheduled','completed','cancelled')),
  CONSTRAINT pickup_origin_chk CHECK (station_id IS NOT NULL OR owner_id IS NOT NULL)
);
ALTER TABLE public.pickup_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage own pickup requests"
  ON public.pickup_requests FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "station managers manage station pickup requests"
  ON public.pickup_requests FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.collection_stations cs WHERE cs.id = station_id AND cs.manager_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.collection_stations cs WHERE cs.id = station_id AND cs.manager_user_id = auth.uid()));

CREATE POLICY "admins manage all pickup requests"
  ON public.pickup_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_pickup_requests_updated
  BEFORE UPDATE ON public.pickup_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();