import { MapContainer, TileLayer, Popup, Polyline, CircleMarker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

export type RoutePoint = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  kind: "start" | "pickup" | "station";
  order?: number;
};

export function RouteMap({ points, polyline }: { points: RoutePoint[]; polyline: [number, number][] }) {
  const center: [number, number] = points[0] ? [points[0].lat, points[0].lng] : [55.93, 13.54];
  const bounds = points.length >= 2 ? (points.map((p) => [p.lat, p.lng] as [number, number])) : undefined;

  const colorFor = (k: RoutePoint["kind"]) =>
    k === "start" ? "#16a34a" : k === "station" ? "#2563eb" : "#f59e0b";

  return (
    <div className="h-[420px] rounded-2xl overflow-hidden border border-border shadow-card">
      <MapContainer center={center} zoom={8} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {polyline.length > 1 && (
          <Polyline positions={polyline} pathOptions={{ color: "#0f766e", weight: 4, opacity: 0.8, dashArray: "6 6" }} />
        )}
        {points.map((p) => (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={p.kind === "pickup" ? 12 : 14}
            pathOptions={{ color: colorFor(p.kind), fillColor: colorFor(p.kind), fillOpacity: 0.85, weight: 2 }}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-bold">
                  {p.order != null ? `${p.order}. ` : ""}{p.label}
                </div>
                <div className="text-xs">{p.kind}</div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
