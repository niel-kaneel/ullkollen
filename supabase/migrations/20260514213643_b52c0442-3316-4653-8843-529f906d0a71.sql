CREATE POLICY "admins read all sheep" ON public.sheep FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'));
CREATE POLICY "admins read all classifications" ON public.classifications FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'));
CREATE POLICY "admins read all wool_lots" ON public.wool_lots FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'));
CREATE POLICY "admins read all pickup_requests" ON public.pickup_requests FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'));
CREATE POLICY "admins read all deliveries" ON public.deliveries FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'));
CREATE POLICY "admins read all bookings" ON public.bookings FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'));
CREATE POLICY "admins read all shearers" ON public.shearers FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'));
CREATE POLICY "admins update shearers" ON public.shearers FOR UPDATE TO authenticated USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE POLICY "admins read all support" ON public.support_messages FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'));
CREATE POLICY "admins update support" ON public.support_messages FOR UPDATE TO authenticated USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE POLICY "admins read all user_roles" ON public.user_roles FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'));
CREATE POLICY "admins read all revenue_shares" ON public.revenue_shares FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'));
CREATE POLICY "admins read all collection_stations" ON public.collection_stations FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'));
CREATE POLICY "admins update collection_stations" ON public.collection_stations FOR UPDATE TO authenticated USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION private.admin_dashboard()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'authorized', private.has_role(auth.uid(),'admin'),
    'totals', jsonb_build_object(
      'users', (SELECT count(*) FROM auth.users),
      'sheep', (SELECT count(*) FROM public.sheep),
      'classifications', (SELECT count(*) FROM public.classifications),
      'lots', (SELECT count(*) FROM public.wool_lots),
      'lots_kg', COALESCE((SELECT sum(COALESCE(actual_kg, estimated_kg, 0)) FROM public.wool_lots), 0),
      'deliveries', (SELECT count(*) FROM public.deliveries),
      'bookings', (SELECT count(*) FROM public.bookings),
      'stations', (SELECT count(*) FROM public.collection_stations WHERE approved = true AND active = true),
      'shearers', (SELECT count(*) FROM public.shearers WHERE approved = true AND active = true),
      'station_stock_kg', COALESCE((SELECT sum(current_stock_kg) FROM public.collection_stations WHERE approved=true), 0),
      'station_capacity_kg', COALESCE((SELECT sum(capacity_kg) FROM public.collection_stations WHERE approved=true), 0)
    ),
    'pending', jsonb_build_object(
      'stations', (SELECT count(*) FROM public.collection_stations WHERE approved = false),
      'shearers', (SELECT count(*) FROM public.shearers WHERE approved = false),
      'support', (SELECT count(*) FROM public.support_messages WHERE status = 'open'),
      'pickups', (SELECT count(*) FROM public.pickup_requests WHERE status = 'pending'),
      'bookings', (SELECT count(*) FROM public.bookings WHERE status = 'pending')
    ),
    'growth', jsonb_build_object(
      'signups_7d', (SELECT count(*) FROM auth.users WHERE created_at > now() - interval '7 days'),
      'signups_30d', (SELECT count(*) FROM auth.users WHERE created_at > now() - interval '30 days'),
      'classifications_7d', (SELECT count(*) FROM public.classifications WHERE created_at > now() - interval '7 days'),
      'classifications_30d', (SELECT count(*) FROM public.classifications WHERE created_at > now() - interval '30 days'),
      'lots_7d', (SELECT count(*) FROM public.wool_lots WHERE created_at > now() - interval '7 days'),
      'lots_30d', (SELECT count(*) FROM public.wool_lots WHERE created_at > now() - interval '30 days'),
      'deliveries_7d', (SELECT count(*) FROM public.deliveries WHERE created_at > now() - interval '7 days')
    ),
    'lots_by_status', (
      SELECT COALESCE(jsonb_object_agg(status, n), '{}'::jsonb)
      FROM (SELECT status, count(*) AS n FROM public.wool_lots GROUP BY status) x
    ),
    'deliveries_by_status', (
      SELECT COALESCE(jsonb_object_agg(status, n), '{}'::jsonb)
      FROM (SELECT status, count(*) AS n FROM public.deliveries GROUP BY status) x
    ),
    'bookings_by_status', (
      SELECT COALESCE(jsonb_object_agg(status, n), '{}'::jsonb)
      FROM (SELECT status, count(*) AS n FROM public.bookings GROUP BY status) x
    ),
    'top_farms', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
        SELECT p.id, COALESCE(p.farm_name, p.full_name, '—') AS name,
               (SELECT count(*) FROM public.sheep s WHERE s.owner_id = p.id) AS sheep_count,
               (SELECT count(*) FROM public.classifications c WHERE c.user_id = p.id) AS classifications_count
        FROM public.profiles p
        ORDER BY sheep_count DESC NULLS LAST
        LIMIT 10
      ) t
    ),
    'top_shearers', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
        SELECT s.id, s.display_name,
               (SELECT count(*) FROM public.bookings b WHERE b.shearer_id = s.id) AS bookings_count,
               (SELECT count(*) FROM public.deliveries d WHERE d.shearer_id = s.id) AS deliveries_count
        FROM public.shearers s
        WHERE s.approved = true
        ORDER BY bookings_count DESC NULLS LAST
        LIMIT 10
      ) t
    ),
    'activity', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
        SELECT * FROM (
          (SELECT 'classification'::text AS kind, c.id::text AS ref, c.created_at AS ts,
                  COALESCE(c.wool_class_name_sv, c.wool_class) AS title, c.user_id AS actor_id
           FROM public.classifications c ORDER BY c.created_at DESC LIMIT 30)
          UNION ALL
          (SELECT 'wool_lot'::text, l.id::text, l.created_at, l.status, l.owner_id
           FROM public.wool_lots l ORDER BY l.created_at DESC LIMIT 30)
          UNION ALL
          (SELECT 'delivery'::text, d.id::text, d.created_at, d.status, NULL::uuid
           FROM public.deliveries d ORDER BY d.created_at DESC LIMIT 30)
          UNION ALL
          (SELECT 'booking'::text, b.id::text, b.created_at, b.status, b.farmer_id
           FROM public.bookings b ORDER BY b.created_at DESC LIMIT 30)
        ) u
        ORDER BY ts DESC
        LIMIT 50
      ) t
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.admin_dashboard()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT private.admin_dashboard() $$;

REVOKE EXECUTE ON FUNCTION public.admin_dashboard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_dashboard() TO authenticated, service_role;