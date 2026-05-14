import { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icons (Vite asset paths)
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

export type StationPoint = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  current_stock_kg: number;
  capacity_kg: number;
  contact_phone: string | null;
};

export type OwnerPoint = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  total_kg: number;
  lot_count: number;
};

export type PickupPoint = {
  id: string;
  lat: number;
  lng: number;
  requested_kg: number;
  priority: string;
  station_name: string | null;
};

type Props = {
  stations: StationPoint[];
  owners: OwnerPoint[];
  pickups: PickupPoint[];
};

export function HolmaMap({ stations, owners, pickups }: Props) {
  // Holma, Höör (approx) as default center
  const defaultCenter: [number, number] = [55.93, 13.54];
  const bounds = useMemo(() => {
    const pts: [number, number][] = [
      ...stations.map((s) => [s.lat, s.lng] as [number, number]),
      ...owners.map((o) => [o.lat, o.lng] as [number, number]),
      ...pickups.map((p) => [p.lat, p.lng] as [number, number]),
    ];
    return pts.length >= 2 ? pts : null;
  }, [stations, owners, pickups]);
  const center = bounds && bounds.length === 1 ? bounds[0] : defaultCenter;

  return (
    <div className="h-[480px] rounded-2xl overflow-hidden border border-border shadow-card">
      <MapContainer center={center} zoom={7} bounds={bounds ?? undefined} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Stations as standard markers */}
        {stations.map((s) => {
          const pct = s.capacity_kg > 0 ? Math.round((s.current_stock_kg / s.capacity_kg) * 100) : 0;
          return (
            <Marker key={s.id} position={[s.lat, s.lng]}>
              <Popup>
                <div className="text-sm">
                  <div className="font-bold">🏭 {s.name}</div>
                  <div className="mt-1">
                    Lager: <b>{s.current_stock_kg} / {s.capacity_kg} kg</b> ({pct}%)
                  </div>
                  {s.contact_phone && <div>Tel: {s.contact_phone}</div>}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Sheep owners as green circles, sized by volume */}
        {owners.map((o) => (
          <CircleMarker
            key={o.id}
            center={[o.lat, o.lng]}
            radius={Math.max(6, Math.min(20, Math.sqrt(o.total_kg) * 1.5))}
            pathOptions={{ color: "#16a34a", fillColor: "#16a34a", fillOpacity: 0.5, weight: 2 }}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-bold">🐑 {o.label}</div>
                <div>{o.total_kg} kg ull, {o.lot_count} parti(er)</div>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* Pickup requests as orange/red circles */}
        {pickups.map((p) => (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={10}
            pathOptions={{
              color: p.priority === "urgent" ? "#dc2626" : "#f59e0b",
              fillColor: p.priority === "urgent" ? "#dc2626" : "#f59e0b",
              fillOpacity: 0.7,
              weight: 2,
            }}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-bold">🚚 Hämtning</div>
                <div>{p.requested_kg} kg</div>
                <div>Prioritet: {p.priority}</div>
                {p.station_name && <div>Station: {p.station_name}</div>}
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
