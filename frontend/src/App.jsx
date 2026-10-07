import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Box,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  Crosshair,
  Gauge,
  Globe2,
  LocateFixed,
  Map as MapIcon,
  Menu,
  Navigation,
  Package,
  Search,
  Settings,
  ShieldCheck,
  Truck,
  User,
  X,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import "leaflet/dist/leaflet.css";
import "./App.css";

/* =========================================================
   DEFAULT LOCATIONS
   ========================================================= */

const DEFAULT_START = {
  name: "Guwahati, Assam",
  lat: 26.1445,
  lon: 91.7362,
};

const DEFAULT_END = {
  name: "Guwahati, Assam",
  lat: 26.1158,
  lon: 91.7086,
};

/* =========================================================
   LEAFLET ICONS
   ========================================================= */

const createMarkerIcon = (color, glow) =>
  new L.DivIcon({
    className: "",
    html: `
      <div style="
        width:20px;
        height:20px;
        border-radius:50%;
        background:${color};
        border:4px solid #06111d;
        box-shadow:0 0 0 5px ${glow}, 0 0 18px ${color};
      "></div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

const startIcon = createMarkerIcon(
  "#00d9f5",
  "rgba(0,217,245,.22)"
);

const endIcon = createMarkerIcon(
  "#31df9a",
  "rgba(49,223,154,.22)"
);

/* =========================================================
   MAP HELPERS
   ========================================================= */

function FitMap({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!points || points.length === 0) return;

    try {
      const bounds = L.latLngBounds(points);

      map.fitBounds(bounds, {
        padding: [55, 55],
        maxZoom: 14,
      });
    } catch (error) {
      console.error("Map fit error:", error);
    }
  }, [map, points]);

  return null;
}

function MapClickHandler({ selectionMode, onSelect }) {
  useMapEvents({
    click: async (event) => {
      if (!selectionMode) return;

      const { lat, lng } = event.latlng;

      onSelect({
        lat,
        lon: lng,
        name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      });
    },
  });

  return null;
}

/* =========================================================
   GEOCODING
   ========================================================= */

async function searchLocation(query) {
  const cleanQuery = query.trim();

  if (cleanQuery.length < 2) {
    return [];
  }

  const url =
    "https://nominatim.openstreetmap.org/search" +
    `?format=jsonv2&limit=5&addressdetails=1` +
    `&q=${encodeURIComponent(cleanQuery)}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "en",
    },
  });

  if (!response.ok) {
    throw new Error("Location search failed");
  }

  return response.json();
}

async function reverseGeocode(lat, lon) {
  try {
    const url =
      "https://nominatim.openstreetmap.org/reverse" +
      `?format=jsonv2&lat=${lat}&lon=${lon}`;

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "en",
      },
    });

    if (!response.ok) {
      return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    }

    const result = await response.json();

    return (
      result?.display_name ||
      `${lat.toFixed(5)}, ${lon.toFixed(5)}`
    );
  } catch {
    return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  }
}

/* =========================================================
   REAL ROAD ROUTING (OSRM)
   ========================================================= */

async function fetchRealRoadRoutes(start, end) {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${start.lon},${start.lat};${end.lon},${end.lat}` +
    `?overview=full&geometries=geojson&alternatives=true&steps=false`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Routing service returned HTTP ${response.status}`);

  const result = await response.json();
  const routes = Array.isArray(result?.routes) ? result.routes : [];

  return routes.map((route) => ({
    points: (route?.geometry?.coordinates || []).map(([lon, lat]) => [lat, lon]),
    distance_km: Number(route?.distance || 0) / 1000,
    duration_min: Number(route?.duration || 0) / 60000,
  })).filter((route) => route.points.length > 1);
}

/* =========================================================
   DEMO ANALYTICS
   ========================================================= */

const deliveryData = [
  { day: "Mon", deliveries: 145 },
  { day: "Tue", deliveries: 172 },
  { day: "Wed", deliveries: 158 },
  { day: "Thu", deliveries: 205 },
  { day: "Fri", deliveries: 232 },
  { day: "Sat", deliveries: 218 },
  { day: "Sun", deliveries: 264 },
];

const efficiencyData = [
  { day: "Aug 31", value: 68 },
  { day: "Sep 1", value: 72 },
  { day: "Sep 2", value: 70 },
  { day: "Sep 3", value: 77 },
  { day: "Sep 4", value: 81 },
  { day: "Sep 5", value: 86 },
  { day: "Sep 6", value: 83 },
  { day: "Sep 7", value: 91 },
];

const stateData = [
  { state: "Arunachal", score: 78 },
  { state: "Assam", score: 82 },
  { state: "Manipur", score: 70 },
  { state: "Meghalaya", score: 76 },
  { state: "Mizoram", score: 68 },
  { state: "Nagaland", score: 71 },
  { state: "Tripura", score: 80 },
  { state: "Sikkim", score: 77 },
];

/* =========================================================
   APP
   ========================================================= */
function NavigationPanel({
  activeNav,
  start,
  end,
  normalRoute,
  safeRoute,
  data,
}) {
  const [vehicleTracking, setVehicleTracking] = useState(false);
  const [vehicleLocation, setVehicleLocation] = useState(null);
  const [vehicleError, setVehicleError] = useState("");

  useEffect(() => {
  if (!vehicleTracking) return;

  const fetchLatestVehicleLocation = async () => {
    try {
      const response = await fetch(
        "https://ai-routex-backend.onrender.com/api/v1/vehicle/location/latest"
      );

      if (!response.ok) return;

      const data = await response.json();

      if (data?.status === "success") {
        setVehicleLocation({
          latitude: data.latitude,
          longitude: data.longitude,
          speed: data.speed_kmh,
          heading: data.heading,
        });
      }
    } catch (error) {
      console.error("Latest vehicle location fetch failed:", error);
    }
  };

  fetchLatestVehicleLocation();

  const interval = setInterval(fetchLatestVehicleLocation, 5000);

  return () => clearInterval(interval);
}, [vehicleTracking]);

  const startVehicleTracking = () => {
    setVehicleError("");

    if (!navigator.geolocation) {
      setVehicleError("GPS is not supported by this browser.");
      return;
    }

    navigator.geolocation.watchPosition(
      (position) => {
        setVehicleLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          speed: position.coords.speed,
          heading: position.coords.heading,
        });

        setVehicleTracking(true);

        fetch("https://ai-routex-backend.onrender.com/api/v1/vehicle/location", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            vehicle_id: "TRUCK-102",
            shipment_id: "SHP-2026-001",
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            speed_kmh:
              position.coords.speed != null
                ? position.coords.speed * 3.6
                : null,
            heading: position.coords.heading,
            timestamp: new Date().toISOString(),
          }),
        }).catch((error) => {
          console.error("Vehicle GPS upload failed:", error);
        });
      },
      (error) => {
        setVehicleTracking(false);

        if (error.code === 1) {
          setVehicleError("Location permission denied.");
        } else if (error.code === 2) {
          setVehicleError("GPS location unavailable.");
        } else {
          setVehicleError("Unable to get vehicle location.");
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      }
    );
  };

  if (activeNav === "Overview") return null;

  const pageInfo = {
    "Live Map": {
      icon: <MapIcon size={24} />,
      title: "Live Map",
      text: "Live road network, route status and selected route visualization.",
    },
    Logistics: {
      icon: <Truck size={24} />,
      title: "Logistics Control",
      text: "Monitor deliveries, active routes and logistics movement.",
    },
    Accessibility: {
      icon: <LocateFixed size={24} />,
      title: "Regional Accessibility",
      text: "Monitor accessibility conditions across the North Eastern Region.",
    },
    Alerts: {
      icon: <Bell size={24} />,
      title: "Route Alerts",
      text: "AI-generated route risk and environmental disruption alerts.",
    },
    Analytics: {
      icon: <BarChart3 size={24} />,
      title: "Analytics",
      text: "Review delivery performance, route efficiency and regional accessibility.",
    },
    Settings: {
      icon: <Settings size={24} />,
      title: "System Settings",
      text: "Configure AI-RouteX system preferences and operational settings.",
    },
  };

  const page = pageInfo[activeNav];

  /* =========================
     LIVE MAP
  ========================= */

  if (activeNav === "Live Map") {
    return (
      <section className="navigation-page live-map-page">

        <div className="navigation-page-header">
          <div>
            <div className="navigation-page-title">
              <MapIcon size={24} />
              Live Map
            </div>

            <p>
              Live road network, route status and selected route visualization.
            </p>
          </div>

          <div className="live-status-badge">
            <span></span>
            LIVE
          </div>
        </div>

        <div
          className="navigation-map"
          style={{
            height: "620px",
            width: "100%",
            borderRadius: "18px",
            overflow: "hidden",
            border: "1px solid rgba(0,217,245,.18)",
            position: "relative",
          }}
        >
          <MapContainer
            center={[
              start?.lat || 26.13,
              start?.lon || 91.72,
            ]}
            zoom={11}
            scrollWheelZoom={true}
            style={{
              width: "100%",
              height: "100%",
            }}
          >
            <TileLayer
              attribution='&copy; OpenStreetMap contributors &copy; CARTO'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />

            {start && (
              <Marker
                position={[start.lat, start.lon]}
                icon={startIcon}
              >
                <Popup>
                  <strong>START</strong>
                  <br />
                  {start.name}
                </Popup>
              </Marker>
            )}

            {end && (
              <Marker
                position={[end.lat, end.lon]}
                icon={endIcon}
              >
                <Popup>
                  <strong>DESTINATION</strong>
                  <br />
                  {end.name}
                </Popup>
              </Marker>
            )}

            {/* LIVE VEHICLE */}
            {vehicleLocation && (
              <Marker
                position={[
                  vehicleLocation.latitude,
                  vehicleLocation.longitude,
                ]}
                icon={createMarkerIcon(
                  "#ffb020",
                  "rgba(255,176,32,.25)"
                )}
              >
                <Popup>
                  <strong>🚚 TRUCK-102</strong>
                  <br />
                  Parcel: SHP-2026-001
                  <br />
                  GPS: Connected
                  <br />
                  Latitude: {vehicleLocation.latitude.toFixed(6)}
                  <br />
                  Longitude: {vehicleLocation.longitude.toFixed(6)}
                  <br />
                  Speed:{" "}
                  {vehicleLocation.speed != null
                    ? `${vehicleLocation.speed.toFixed(1)} km/h`
                    : "—"}
                </Popup>
              </Marker>
            )}

            {normalRoute?.length > 1 && (
              <Polyline
                positions={normalRoute}
                pathOptions={{
                  color: "#168dff",
                  weight: 5,
                  opacity: 0.85,
                }}
              />
            )}

            {safeRoute?.length > 1 && (
              <Polyline
                positions={safeRoute}
                pathOptions={{
                  color: "#28d99a",
                  weight: 5,
                  opacity: 0.95,
                  dashArray: "9 7",
                }}
              />
            )}
          </MapContainer>

          <div
            style={{
              position: "absolute",
              top: "18px",
              left: "18px",
              zIndex: 1000,
              background: "rgba(5,18,29,.94)",
              border: "1px solid rgba(0,217,245,.2)",
              borderRadius: "12px",
              padding: "12px 16px",
              color: "#fff",
              display: "flex",
              gap: "18px",
              alignItems: "center",
              fontSize: "13px",
            }}
          >
            <span>
              <i
                style={{
                  display: "inline-block",
                  width: "22px",
                  height: "4px",
                  background: "#168dff",
                  marginRight: "7px",
                  borderRadius: "4px",
                }}
              />
              Normal Route
            </span>

            <span>
              <i
                style={{
                  display: "inline-block",
                  width: "22px",
                  height: "4px",
                  background: "#28d99a",
                  marginRight: "7px",
                  borderRadius: "4px",
                }}
              />
              Alternate Route
            </span>
          </div>

          <div
            style={{
              position: "absolute",
              bottom: "18px",
              left: "18px",
              right: "18px",
              zIndex: 1000,
              display: "flex",
              justifyContent: "space-between",
              gap: "15px",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                background: "rgba(5,18,29,.94)",
                border: "1px solid rgba(0,217,245,.18)",
                borderRadius: "12px",
                padding: "12px 16px",
                color: "#fff",
              }}
            >
              <small style={{ opacity: 0.55 }}>FROM</small>
              <br />
              <strong>
                {start?.name || "Not selected"}
              </strong>
            </div>

            <div
              style={{
                background: "rgba(5,18,29,.94)",
                border: "1px solid rgba(49,223,154,.18)",
                borderRadius: "12px",
                padding: "12px 16px",
                color: "#fff",
              }}
            >
              <small style={{ opacity: 0.55 }}>TO</small>
              <br />
              <strong>
                {end?.name || "Not selected"}
              </strong>
            </div>

            <div
              style={{
                background: "rgba(5,18,29,.94)",
                border: "1px solid rgba(255,80,100,.18)",
                borderRadius: "12px",
                padding: "12px 16px",
                color: "#fff",
              }}
            >
              <small style={{ opacity: 0.55 }}>ROUTE RISK</small>
              <br />
              <strong>
                {data?.risk?.score ?? "—"}
                {data?.risk?.score != null ? "/100" : ""}
              </strong>
            </div>
          </div>
        </div>

        <div className="navigation-page-status">
          <CheckCircle2 size={18} />
          OpenStreetMap connected • Route visualization active
        </div>
      </section>
    );
  }

  /* =========================
     OTHER PAGES
  ========================= */

  return (
    <section className="navigation-page">

      <div className="navigation-page-header">
        <div>
          <div className="navigation-page-title">
            {page.icon}
            {page.title}
          </div>

          <p>{page.text}</p>
        </div>

        <div className="live-status-badge">
          <span></span>
          OPERATIONAL
        </div>
      </div>

      <div className="navigation-page-grid">

        <div className="navigation-info-card">
          {activeNav === "Logistics" && (
            <>
              <Truck size={30} />

              <h3>Logistics Monitoring</h3>

              <p>
                Active delivery routes and logistics movement
                can be monitored from this control panel.
              </p>

              <strong>1,254 deliveries today</strong>

              <div
                style={{
                  marginTop: "24px",
                  padding: "20px",
                  border: "1px solid rgba(0, 212, 255, 0.25)",
                  borderRadius: "16px",
                  background: "rgba(0, 25, 40, 0.55)",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    letterSpacing: "1px",
                    opacity: 0.65,
                    marginBottom: "8px",
                  }}
                >
                  LIVE VEHICLE TRACKING
                </div>

                <div style={{ fontSize: "18px", fontWeight: 700 }}>
                  🚛 TRUCK-102
                </div>

                <div style={{ marginTop: "6px", opacity: 0.75 }}>
                  Parcel: SHP-2026-001
                </div>

                <div style={{ marginTop: "10px" }}>
                  Status:{" "}
                  <strong>
                    {vehicleTracking ? "🟢 GPS CONNECTED" : "⚪ NOT CONNECTED"}
                  </strong>
                </div>

                <button
                  type="button"
                  onClick={startVehicleTracking}
                  style={{
                    marginTop: "16px",
                    width: "100%",
                    padding: "12px",
                    border: "none",
                    borderRadius: "10px",
                    cursor: "pointer",
                    background: "#00cfff",
                    color: "#001018",
                    fontWeight: 700,
                  }}
                >
                  {vehicleTracking ? "GPS Tracking Active" : "Connect Vehicle GPS"}
                </button>

                {vehicleLocation && (
                  <div
                    style={{
                      marginTop: "14px",
                      fontSize: "13px",
                      lineHeight: 1.7,
                    }}
                  >
                    <div>
                      Latitude: {vehicleLocation.latitude.toFixed(6)}
                    </div>

                    <div>
                      Longitude: {vehicleLocation.longitude.toFixed(6)}
                    </div>

                    <div>
                      Speed:{" "}
                      {vehicleLocation.speed != null
                        ? `${(vehicleLocation.speed * 3.6).toFixed(1)} km/h`
                        : "—"}
                    </div>
                  </div>
                )}

                {vehicleError && (
                  <div
                    style={{
                      marginTop: "12px",
                      color: "#ff6b7a",
                      fontSize: "13px",
                    }}
                  >
                    {vehicleError}
                  </div>
                )}
              </div>

              <div
                style={{
                  marginTop: "24px",
                  padding: "20px",
                  border: "1px solid rgba(0, 212, 255, 0.25)",
                  borderRadius: "16px",
                  background: "rgba(0, 25, 40, 0.55)",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    letterSpacing: "1px",
                    opacity: 0.65,
                    marginBottom: "8px",
                  }}
                >
                  LIVE VEHICLE TRACKING
                </div>

                <div style={{ fontSize: "18px", fontWeight: 700 }}>
                  🚛 TRUCK-102
                </div>

                <div style={{ marginTop: "6px", opacity: 0.75 }}>
                  Parcel: SHP-2026-001
                </div>

                <div style={{ marginTop: "10px" }}>
                  Status:{" "}
                  <strong>
                    {vehicleTracking ? "🟢 GPS CONNECTED" : "⚪ NOT CONNECTED"}
                  </strong>
                </div>

                <button
                  type="button"
                  onClick={startVehicleTracking}
                  style={{
                    marginTop: "16px",
                    width: "100%",
                    padding: "12px",
                    border: "none",
                    borderRadius: "10px",
                    cursor: "pointer",
                    background: "#00cfff",
                    color: "#001018",
                    fontWeight: 700,
                  }}
                >
                  {vehicleTracking ? "GPS Tracking Active" : "Connect Vehicle GPS"}
                </button>

                {vehicleLocation && (
                  <div
                    style={{
                      marginTop: "14px",
                      fontSize: "13px",
                      lineHeight: 1.7,
                    }}
                  >
                    <div>
                      Latitude: {vehicleLocation.latitude.toFixed(6)}
                    </div>

                    <div>
                      Longitude: {vehicleLocation.longitude.toFixed(6)}
                    </div>

                    <div>
                      Speed:{" "}
                      {vehicleLocation.speed != null
                        ? `${(vehicleLocation.speed * 3.6).toFixed(1)} km/h`
                        : "—"}
                    </div>
                  </div>
                )}

                {vehicleError && (
                  <div
                    style={{
                      marginTop: "12px",
                      color: "#ff6b7a",
                      fontSize: "13px",
                    }}
                  >
                    {vehicleError}
                  </div>
                )}
              </div>
            </>
          )}

          {activeNav === "Accessibility" && (
            <>
              <LocateFixed size={30} />
              <h3>Regional Accessibility</h3>
              <p>
                Accessibility intelligence across the North
                Eastern Region.
              </p>
              <strong>76% regional accessibility score</strong>
            </>
          )}

          {activeNav === "Alerts" && (
            <>
              <Bell size={30} />
              <h3>Route Risk Alerts</h3>
              <p>
                Environmental and route-disruption signals
                requiring attention.
              </p>
              <strong>3 alerts require attention</strong>
            </>
          )}

          {activeNav === "Analytics" && (
            <>
              <BarChart3 size={30} />
              <h3>Analytics Dashboard</h3>
              <p>
                Delivery performance, route efficiency and
                regional accessibility analytics.
              </p>
              <strong>Route efficiency: 92%</strong>
            </>
          )}

          {activeNav === "Settings" && (
            <>
              <Settings size={30} />
              <h3>System Settings</h3>
              <p>
                AI-RouteX operational configuration and system
                preferences.
              </p>
              <strong>System operational</strong>
            </>
          )}
        </div>

      </div>

      <div className="navigation-page-status">
        <CheckCircle2 size={18} />
        {page.title} module is operational
      </div>

    </section>
  );
}
function App() {
  const [activeNav, setActiveNav] = useState("Overview");
  const [start, setStart] = useState(DEFAULT_START);
  const [end, setEnd] = useState(DEFAULT_END);

  const [startText, setStartText] = useState(DEFAULT_START.name);
  const [endText, setEndText] = useState(DEFAULT_END.name);

  const [activeSearch, setActiveSearch] = useState(null);
  const [suggestions, setSuggestions] = useState([]);

  const [selectionMode, setSelectionMode] = useState(null);

  const [data, setData] = useState(null);

  const [normalRoute, setNormalRoute] = useState([]);
  const [safeRoute, setSafeRoute] = useState([]);

  const [loading, setLoading] = useState(false);
  const hasAnalysis = Boolean(data);
  const [backendOnline, setBackendOnline] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState("");

  const [sidebarOpen, setSidebarOpen] = useState(true);

  const startVehicleTracking = () => {
  setVehicleError("");

  if (!navigator.geolocation) {
    setVehicleError("GPS is not supported by this browser.");
    return;
  }

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      setVehicleLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        speed: position.coords.speed,
        heading: position.coords.heading,
      });

      setVehicleTracking(true);
    },
    (error) => {
      setVehicleTracking(false);

      if (error.code === 1) {
        setVehicleError("Location permission denied.");
      } else if (error.code === 2) {
        setVehicleError("GPS location unavailable.");
      } else {
        setVehicleError("Unable to get vehicle location.");
      }
    },
    {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 10000,
    }
  );

  window.airoutexGpsWatchId = watchId;
};

  const [selectedRoute, setSelectedRoute] = useState(null);
  const [showRiskModal, setShowRiskModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupError, setSignupError] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("airoutex_user") || "null"); }
    catch { return null; }
  });
  const [topSearch, setTopSearch] = useState("");
  const [topSuggestions, setTopSuggestions] = useState([]);
  const [topSearchLoading, setTopSearchLoading] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, title: "Route analysis ready", text: "Run an analysis to receive AI route-risk insights.", time: "Now", unread: true },
    { id: 2, title: "Road accessibility", text: "Regional accessibility indicators are available on the dashboard.", time: "Today", unread: true },
    { id: 3, title: "AI engine online", text: "AI-RouteX backend is ready for route analysis.", time: "Today", unread: false },
  ]);

  const focusRouteOnMap = (route) => {
    setSelectedRoute(route);
    setTimeout(() => {
      document.querySelector(".map-dashboard-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  };

  useEffect(() => {
  const verifySession = async () => {
    try {
      const response = await fetch(
        "https://ai-routex-backend.onrender.com/api/v1/auth/me",
        {
          method: "GET",
          credentials: "include",
        }
      );

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      if (data?.user) {
        setUser(data.user);
        localStorage.setItem(
          "airoutex_user",
          JSON.stringify(data.user)
        );
      }
    } catch (error) {
      console.error("Session verification failed:", error);
    }
  };

  verifySession();
}, []);

const handleSignup = async (event) => {
  event.preventDefault();

  const name = signupName.trim();
  const email = signupEmail.trim();

  if (!name || !email || signupPassword.length < 4) {
    setSignupError(
      "Enter your name, a valid email, and a password of at least 4 characters."
    );
    return;
  }

  try {
    setSignupError("");

    const response = await fetch(
      "https://ai-routex-backend.onrender.com/api/v1/auth/signup",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          name,
          email,
          password: signupPassword,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.detail || "Account creation failed.");
    }

    setSignupName("");
    setSignupEmail("");
    setSignupPassword("");
    setSignupError("");
    setShowSignupModal(false);
    setShowLoginModal(true);
    setLoginEmail(email);
    setLoginPassword("");
    setLoginError("");
  } catch (error) {
    setSignupError(
      error.message || "Account creation failed. Please try again."
    );
  }
};
  const handleLogin = async (event) => {
  event.preventDefault();

  const email = loginEmail.trim();

  if (!email || loginPassword.length < 4) {
    setLoginError(
      "Enter a valid email and a password of at least 4 characters."
    );
    return;
  }

  try {
    setLoginError("");

    const response = await fetch("https://ai-routex-backend.onrender.com/api/v1/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        email,
        password: loginPassword,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.detail || "Login failed.");
    }

    const loggedUser = data.user;

    setUser(loggedUser);
    localStorage.setItem("airoutex_user", JSON.stringify(loggedUser));

    setShowLoginModal(false);
    setLoginPassword("");
    setLoginError("");
  } catch (error) {
    setLoginError(error.message || "Login failed. Please try again.");
  }
};

  const logout = () => {
    localStorage.removeItem("airoutex_user");
    setUser(null);
    setShowProfileMenu(false);
  };

  const markAllNotificationsRead = () => {
    setNotifications((items) => items.map((item) => ({ ...item, unread: false })));
  };

  const markNotificationRead = (id) => {
    setNotifications((items) => items.map((item) => item.id === id ? { ...item, unread: false } : item));
  };

  const selectTopSearchResult = (result) => {
    const location = { name: result.display_name, lat: Number(result.lat), lon: Number(result.lon) };
    setEnd(location);
    setEndText(location.name);
    setTopSearch(location.name);
    setTopSuggestions([]);
    setTimeout(() => document.querySelector(".location-panel")?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
  };

  const openRiskDetails = () => {
    setSelectedRoute("risk");
    setShowRiskModal(true);
  };

  useEffect(() => {
    if (topSearch.trim().length < 2) { setTopSuggestions([]); return; }
    const timer = setTimeout(async () => {
      try {
        setTopSearchLoading(true);
        setTopSuggestions(await searchLocation(topSearch));
      } catch { setTopSuggestions([]); }
      finally { setTopSearchLoading(false); }
    }, 450);
    return () => clearTimeout(timer);
  }, [topSearch]);

  /* =======================================================
     LOCATION SEARCH
     ======================================================= */

  useEffect(() => {
    if (!activeSearch) {
      setSuggestions([]);
      return;
    }

    const query =
      activeSearch === "start"
        ? startText
        : endText;

    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSearchLoading(true);

        const results = await searchLocation(query);

        setSuggestions(results);
      } catch (error) {
        console.error(error);
        setSuggestions([]);
      } finally {
        setSearchLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [startText, endText, activeSearch]);

  /* =======================================================
     SELECT SEARCH RESULT
     ======================================================= */

  const selectSearchResult = (result) => {
    const location = {
      name: result.display_name,
      lat: Number(result.lat),
      lon: Number(result.lon),
    };

    if (activeSearch === "start") {
      setStart(location);
      setStartText(location.name);
    }

    if (activeSearch === "end") {
      setEnd(location);
      setEndText(location.name);
    }

    setSuggestions([]);
    setActiveSearch(null);
  };

  /* =======================================================
     MAP LOCATION SELECT
     ======================================================= */

  const selectMapLocation = async (location) => {
    if (!selectionMode) return;

    let name = location.name;

    if (
      name ===
      `${location.lat.toFixed(5)}, ${location.lon.toFixed(5)}`
    ) {
      name = await reverseGeocode(
        location.lat,
        location.lon
      );
    }

    const selected = {
      ...location,
      name,
    };

    if (selectionMode === "start") {
      setStart(selected);
      setStartText(selected.name);
    }

    if (selectionMode === "end") {
      setEnd(selected);
      setEndText(selected.name);
    }

    setSelectionMode(null);
  };

  /* =======================================================
     SWAP
     ======================================================= */

  const swapLocations = () => {
    const oldStart = start;
    const oldStartText = startText;

    setStart(end);
    setStartText(endText);

    setEnd(oldStart);
    setEndText(oldStartText);

    setData(null);
    setNormalRoute([]);
    setSafeRoute([]);
  };

  /* =======================================================
     ROUTE ANALYSIS
     ======================================================= */

  const analyzeRoute = async () => {
    if (!start || !end) {
      setError("Please select both start and destination.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "https://ai-routex-backend.onrender.com/api/v1/get-route",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            start_lat: start.lat,
            start_lon: start.lon,
            end_lat: end.lat,
            end_lon: end.lon,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Backend returned HTTP ${response.status}`
        );
      }

      const result = await response.json();

      console.log("AI-RouteX RESPONSE:", result);

      if (result.status === "error") {
        throw new Error(
          result.message || "Route calculation failed."
        );
      }

      setData(result);

      // Always resolve the displayed routes against a real road-routing service.
      // This keeps the map lines on actual drivable road geometry.
      let realRoutes = [];
      try {
        realRoutes = await fetchRealRoadRoutes(start, end);
      } catch (routeError) {
        console.warn("OSRM route fetch failed; using backend geometry.", routeError);
      }

      /* -----------------------------------------------
         NORMAL ROUTE
      ------------------------------------------------ */

      let normalPoints = [];

      if (realRoutes[0]?.points?.length > 1) {
        normalPoints = realRoutes[0].points;
      } else if (result?.normal_route?.geometry && Array.isArray(result.normal_route.geometry)) {
        normalPoints = result.normal_route.geometry;
      } else if (result?.shortest_path && Array.isArray(result.shortest_path)) {
        normalPoints = result.shortest_path;
      }

      setNormalRoute(normalPoints);

      /* -----------------------------------------------
         SAFE ROUTE
      ------------------------------------------------ */

      let safePoints = [];

      // Prefer a genuine second OSRM alternative route.
      if (realRoutes[1]?.points?.length > 1) {
        safePoints = realRoutes[1].points;
      } else if (result?.safe_route?.geometry && Array.isArray(result.safe_route.geometry)) {
        safePoints = result.safe_route.geometry;
      } else if (result?.safe_path && Array.isArray(result.safe_path)) {
        safePoints = result.safe_path;
      }

      setSafeRoute(safePoints);
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Unable to connect to AI-RouteX backend."
      );
    } finally {
      setLoading(false);
    }
  };

  /* =======================================================
     FALLBACK MAP ROUTE
  ======================================================= */

  useEffect(() => {
    if (normalRoute.length > 0) return;

    const loadPreviewRoute = async () => {
      try {
        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${start.lon},${start.lat};${end.lon},${end.lat}` +
          `?overview=full&geometries=geojson`;

        const response = await fetch(url);

        if (!response.ok) return;

        const result = await response.json();

        const coordinates =
          result?.routes?.[0]?.geometry?.coordinates ||
          [];

        const points = coordinates.map(
          ([lon, lat]) => [lat, lon]
        );

        setNormalRoute(points);
      } catch (error) {
        console.error(
          "Preview route error:",
          error
        );
      }
    };

    loadPreviewRoute();
  }, [
    start.lat,
    start.lon,
    end.lat,
    end.lon,
    normalRoute.length,
  ]);

  /* =======================================================
     DATA VALUES
     ======================================================= */

  const riskScore =
    data?.risk?.score ??
    data?.risk_score ??
    null;

  const riskLevel =
    data?.risk?.level ??
    data?.risk_level ??
    "WAITING";

  const riskReason =
    data?.risk?.reason ??
    "Run route analysis to receive the latest AI risk assessment.";

  const normalDistance =
    data?.normal_route?.distance_km ??
    (data?.shortest_distance_m
      ? data.shortest_distance_m / 1000
      : null);

  const safeDistance =
    data?.safe_route?.distance_km ??
    (data?.safe_distance_m
      ? data.safe_distance_m / 1000
      : null);

  const extraDistance =
    data?.safe_route?.extra_distance_km ??
    (normalDistance !== null &&
    safeDistance !== null
      ? Math.max(safeDistance - normalDistance, 0)
      : null);

  const extraTime =
    data?.safe_route?.extra_time_min ?? null;

  const recommendation =
    data?.recommendation ??
    "Select locations and analyze the route to generate an AI recommendation.";

  const riskClass =
    riskLevel === "HIGH"
      ? "high"
      : riskLevel === "MEDIUM"
      ? "medium"
      : riskLevel === "LOW"
      ? "low"
      : "neutral";

  // Show alternate-route AI scoring only when the backend returns it.
  const safeRiskScore =
    data?.safe_route?.risk?.score ??
    data?.safe_route?.risk_score ??
    data?.alternate_risk_score ??
    null;

  const safeRiskLevel =
    data?.safe_route?.risk?.level ??
    data?.safe_route?.risk_level ??
    data?.alternate_risk_level ??
    null;

  const riskReduction =
    safeRiskScore != null
      ? Math.max(Number(riskScore) - Number(safeRiskScore), 0)
      : null;

  /* =======================================================
     MAP POINTS
     ======================================================= */

  const allMapPoints = [
    start
      ? [start.lat, start.lon]
      : null,
    end
      ? [end.lat, end.lon]
      : null,
    ...normalRoute,
    ...safeRoute,
  ].filter(Boolean);

  /* =======================================================
     UI
     ======================================================= */

  return (
    <div className={`app ${sidebarOpen ? "" : "sidebar-collapsed"}`}>

      {/* ===================================================
          SIDEBAR
      =================================================== */}

        <aside className={`sidebar ${sidebarOpen ? "" : "collapsed"}`}>
        <div className="sidebar-brand">
          <div className="brand-mark">
            <Navigation size={22} />
          </div>

          <div>
            <strong>AI-RouteX</strong>
            <span>Smart Logistics</span>
          </div>
        </div>

        <nav className="sidebar-nav">

          <button
            className={`nav-item ${activeNav === "Overview" ? "active" : ""}`}
            onClick={() => setActiveNav("Overview")}
          >
            <Gauge size={19} />
            <span>Overview</span>
          </button>

          <button
            className={`nav-item ${activeNav === "Live Map" ? "active" : ""}`}
            onClick={() => setActiveNav("Live Map")}
          >
            <MapIcon size={19} />
            <span>Live Map</span>
          </button>

          <button
            className={`nav-item ${activeNav === "Logistics" ? "active" : ""}`}
            onClick={() => setActiveNav("Logistics")}
          >
            <Truck size={19} />
            <span>Logistics</span>
          </button>

          <button
            className={`nav-item ${activeNav === "Accessibility" ? "active" : ""}`}
            onClick={() => setActiveNav("Accessibility")}
          >
            <LocateFixed size={19} />
            <span>Accessibility</span>
          </button>

          <button
            className={`nav-item ${activeNav === "Alerts" ? "active" : ""}`}
            onClick={() => setActiveNav("Alerts")}
          >
            <Bell size={19} />
            <span>Alerts</span>
            <b className="nav-badge">3</b>
          </button>

          <button
            className={`nav-item ${activeNav === "Analytics" ? "active" : ""}`}
            onClick={() => setActiveNav("Analytics")}
          >
            <BarChart3 size={19} />
            <span>Analytics</span>
          </button>

          <button
            className={`nav-item ${activeNav === "Settings" ? "active" : ""}`}
            onClick={() => setActiveNav("Settings")}
          >
            <Settings size={19} />
            <span>Settings</span>
          </button>

        </nav>

        <div className="sidebar-footer">
          <div className="footer-line"></div>

          <span>Smarter Routes</span>
          <strong>A More Inclusive<br />Northeast</strong>
        </div>
      </aside>

      {/* ===================================================
          MAIN AREA
      =================================================== */}

      <div className="main-shell">

        {/* TOP BAR */}

        <header className="topbar">

          <button
            className="mobile-menu-btn sidebar-toggle-btn"
            onClick={() => setSidebarOpen((prev) => !prev)}
            title={sidebarOpen ? "Hide Dashboard" : "Show Dashboard"}
          >
            <Menu size={21} />
          </button>

          <div className="topbar-title">
            <h1>Smart Logistics & Accessibility Intelligence</h1>
            <span>North Eastern Region</span>
          </div>

          <div className="topbar-actions">

            <div className="global-search-wrap">
              <div className="global-search">
                <Search size={17} />
                <input
                  value={topSearch}
                  onChange={(e) => setTopSearch(e.target.value)}
                  onFocus={() => topSearch.length >= 2 && setTopSearch(topSearch)}
                  placeholder="Search location, route, or delivery..."
                />
                {topSearchLoading && <span className="search-spinner" />}
              </div>
              {(topSuggestions.length > 0 || (topSearchLoading && topSearch.length >= 2)) && (
                <div className="global-search-results">
                  {topSearchLoading && <div className="global-search-loading">Searching locations...</div>}
                  {topSuggestions.map((result) => (
                    <button key={result.place_id} className="global-search-result" onMouseDown={() => selectTopSearchResult(result)}>
                      <MapIcon size={15} />
                      <span>{result.display_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="notification-wrap">
              <button className="icon-button" onClick={() => { setShowNotifications((v) => !v); setShowProfileMenu(false); }}>
                <Bell size={19} />
                {notifications.some((n) => n.unread) && <span className="notification-dot"></span>}
              </button>
              {showNotifications && (
                <div className="notification-panel">
                  <div className="notification-panel-header">
                    <div><strong>Notifications</strong><span>{notifications.filter((n) => n.unread).length} unread</span></div>
                    <button onClick={markAllNotificationsRead}>Mark all read</button>
                  </div>
                  <div className="notification-list">
                    {notifications.map((item) => (
                      <button key={item.id} className={`notification-item ${item.unread ? "unread" : ""}`} onClick={() => markNotificationRead(item.id)}>
                        <div className="notification-icon"><Bell size={15} /></div>
                        <div className="notification-copy"><strong>{item.title}</strong><span>{item.text}</span><small>{item.time}</small></div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="profile-wrap">
              <button className="profile profile-trigger" onClick={() => { setShowProfileMenu((v) => !v); setShowNotifications(false); }}>
                <div className="profile-avatar"><User size={19} /></div>
                <div>
                  <strong>{user?.name || "Guest"}</strong>
                  <span>{user?.email || "Click to login"}</span>
                </div>
                <ChevronDown size={15} />
              </button>
              {showProfileMenu && (
                <div className="profile-menu">
                  {user ? (
                    <>
                      <div className="profile-menu-user"><strong>{user.name}</strong><span>{user.email}</span></div>
                      <button onClick={logout}>Sign out</button>
                    </>
                  ) : (
                    <button onClick={() => { setShowLoginModal(true); setShowProfileMenu(false); }}>Login</button>
                  )}
                </div>
              )}
            </div>

          </div>

        </header>

        {/* CONTENT */}

        <main className="dashboard-container">

          {activeNav !== "Overview" ? (
            <NavigationPanel
              activeNav={activeNav}
              start={start}
              end={end}
              normalRoute={normalRoute}
              safeRoute={safeRoute}
              data={data}
            />
          ) : (
            <>
              {/* PAGE HEADER */}

          <div className="dashboard-heading">

            <div>
              <div className="eyebrow">
                <Globe2 size={14} />
                SMART INDIA HACKATHON 2026
              </div>

              <h2>
                North Eastern Region
              </h2>

              <p>
                AI-powered accessibility,
                route intelligence and
                environmental risk monitoring.
              </p>
            </div>

            <div className="system-status">
              <span className="system-dot"></span>
              AI Engine Online
            </div>

          </div>

          {/* =================================================
              LOCATION CONTROL
          ================================================= */}

          <section className="location-panel">

            <div className="location-heading">
              <div>
                <h3>
                  <Navigation size={17} />
                  Route Planning
                </h3>

                <span>
                  Search locations or choose directly from the map
                </span>
              </div>

              <button
                className="swap-button"
                onClick={swapLocations}
                title="Swap locations"
              >
                ⇄ Swap
              </button>
            </div>

            <div className="location-controls">

              {/* FROM */}

              <div className="location-field-wrapper">

                <div
                  className={`location-field ${
                    activeSearch === "start"
                      ? "focused"
                      : ""
                  }`}
                >
                  <div className="location-pin start-pin">
                    A
                  </div>

                  <div className="location-input-area">

                    <label>FROM</label>

                    <input
                      value={startText}
                      onFocus={() =>
                        setActiveSearch("start")
                      }
                      onChange={(e) => {
                        setStartText(e.target.value);
                        setActiveSearch("start");
                      }}
                      placeholder="Search starting location..."
                    />

                  </div>

                  <button
                    className="map-select-button"
                    onClick={() =>
                      setSelectionMode("start")
                    }
                    title="Choose start on map"
                  >
                    <Crosshair size={18} />
                  </button>
                </div>

                {activeSearch === "start" &&
                  (suggestions.length > 0 ||
                    searchLoading) && (
                    <div className="suggestions">

                      {searchLoading && (
                        <div className="suggestion-loading">
                          Searching locations...
                        </div>
                      )}

                      {suggestions.map(
                        (result, index) => (
                          <button
                            key={`${result.place_id}-${index}`}
                            className="suggestion-item"
                            onMouseDown={() =>
                              selectSearchResult(
                                result
                              )
                            }
                          >
                            <MapIcon size={16} />

                            <span>
                              {result.display_name}
                            </span>
                          </button>
                        )
                      )}

                    </div>
                  )}

              </div>

              {/* TO */}

              <div className="location-field-wrapper">

                <div
                  className={`location-field ${
                    activeSearch === "end"
                      ? "focused"
                      : ""
                  }`}
                >
                  <div className="location-pin end-pin">
                    B
                  </div>

                  <div className="location-input-area">

                    <label>TO</label>

                    <input
                      value={endText}
                      onFocus={() =>
                        setActiveSearch("end")
                      }
                      onChange={(e) => {
                        setEndText(e.target.value);
                        setActiveSearch("end");
                      }}
                      placeholder="Search destination..."
                    />

                  </div>

                  <button
                    className="map-select-button"
                    onClick={() =>
                      setSelectionMode("end")
                    }
                    title="Choose destination on map"
                  >
                    <Crosshair size={18} />
                  </button>
                </div>

                {activeSearch === "end" &&
                  (suggestions.length > 0 ||
                    searchLoading) && (
                    <div className="suggestions">

                      {searchLoading && (
                        <div className="suggestion-loading">
                          Searching locations...
                        </div>
                      )}

                      {suggestions.map(
                        (result, index) => (
                          <button
                            key={`${result.place_id}-${index}`}
                            className="suggestion-item"
                            onMouseDown={() =>
                              selectSearchResult(
                                result
                              )
                            }
                          >
                            <MapIcon size={16} />

                            <span>
                              {result.display_name}
                            </span>
                          </button>
                        )
                      )}

                    </div>
                  )}

              </div>

              <button
                className="analyze-button"
                onClick={analyzeRoute}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Activity size={18} />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Zap size={18} />
                    Analyze Route
                  </>
                )}
              </button>

            </div>

            {selectionMode && (
              <div className="map-selection-banner">
                <Crosshair size={16} />

                <span>
                  Click anywhere on the map to select{" "}
                  <strong>
                    {selectionMode === "start"
                      ? "START"
                      : "DESTINATION"}
                  </strong>
                </span>

                <button
                  onClick={() =>
                    setSelectionMode(null)
                  }
                >
                  <X size={15} />
                </button>
              </div>
            )}

          </section>

           {hasAnalysis && (
            <>


          {/* =================================================
              KPI ROW
          ================================================= */}

          <section className="kpi-grid">

            <div className="kpi-card">

              <div className="kpi-icon cyan">
                <Truck size={22} />
              </div>

              <div className="kpi-content">
                <span>Active Routes</span>
                <strong>28</strong>
                <small className="positive">
                  ↑ 12% <em>vs. last week</em>
                </small>
              </div>

            </div>

            <div className="kpi-card">

              <div className="kpi-icon blue">
                <Package size={22} />
              </div>

              <div className="kpi-content">
                <span>Deliveries Today</span>
                <strong>1,254</strong>
                <small className="positive">
                  ↑ 18% <em>vs. yesterday</em>
                </small>
              </div>

            </div>

            <div className="kpi-card">

              <div className="kpi-icon green">
                <LocateFixed size={22} />
              </div>

              <div className="kpi-content">
                <span>Accessibility Score</span>
                <strong>76%</strong>
                <small className="positive">
                  ↑ 6% <em>vs. last month</em>
                </small>
              </div>

            </div>

            <div className="kpi-card alert-card">

              <div className="kpi-icon red">
                <AlertTriangle size={22} />
              </div>

              <div className="kpi-content">
                <span>Route Risk</span>

                <strong>
                  {riskScore !== null
                    ? `${riskScore}`
                    : "—"}
                </strong>

                <small
                  className={
                    riskClass === "high"
                      ? "negative"
                      : "neutral-text"
                  }
                >
                  {riskLevel}
                  <em>
                    {data
                      ? " current analysis"
                      : " awaiting analysis"}
                  </em>
                </small>
              </div>

            </div>

          </section>

                      {/* =================================================
              FINAL ROUTE WORKSPACE
           ================================================= */}
           <section className="route-workspace">
             <div className="map-dashboard-card route-map-card">
               <div className="card-header map-card-header">
                 <div><div className="card-title"><MapIcon size={18} /> Live Map — North Eastern India</div><span>OpenStreetMap road network • AI route overlay</span></div>
                 <div className="live-badge"><span></span>LIVE</div>
               </div>
               <div className={`map-wrapper ${selectionMode ? "map-select-mode" : ""}`}>
                 <MapContainer center={[26.13,91.72]} zoom={11} scrollWheelZoom={true} style={{width:"100%",height:"100%"}}>
                   <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                   <MapClickHandler selectionMode={selectionMode} onSelect={selectMapLocation} />
                   {start && <Marker position={[start.lat,start.lon]} icon={startIcon}><Popup><strong>START</strong><br />{start.name}</Popup></Marker>}
                   {end && <Marker position={[end.lat,end.lon]} icon={endIcon}><Popup><strong>DESTINATION</strong><br />{end.name}</Popup></Marker>}
                   {normalRoute.length>1 && <Polyline positions={normalRoute} pathOptions={{color:"#168dff",weight:selectedRoute==="normal"?8:5,opacity:selectedRoute&&selectedRoute!=="normal" ? 0.22 : 0.92}} />}
                   {safeRoute.length>1 && <Polyline positions={safeRoute} pathOptions={{color:"#28d99a",weight:selectedRoute==="safe"?8:5,opacity:selectedRoute&&selectedRoute!=="safe" ? 0.22 : 0.95,dashArray:"9 7"}} />}
                   <FitMap points={allMapPoints.length>0?allMapPoints:[[26.13,91.72]]} />
                 </MapContainer>
                 <div className="map-overlay-top"><div className="map-legend"><span><i className="legend-line blue"></i>Normal Route</span><span><i className="legend-line green"></i>Safe Route</span><span><i className="legend-dot red"></i>Risk</span></div></div>
                 <div className="map-location-info"><div><span>FROM</span><strong>{start?.name||"Not selected"}</strong></div><div className="route-arrow">→</div><div><span>TO</span><strong>{end?.name||"Not selected"}</strong></div></div>
               </div>
             </div>

             <aside className="route-command-rail">
               <div className="rail-heading"><div><span>ROUTE DECISION</span><h3>Compare before dispatch</h3></div><span className="rail-live-dot">AI</span></div>
               <div className={`route-choice-card normal ${selectedRoute==="normal"?"selected-result":""}`} onClick={()=>focusRouteOnMap("normal")} role="button" tabIndex={0} onKeyDown={e=>e.key==="Enter"&&focusRouteOnMap("normal")}>
                 <div className="route-choice-top"><div><span>STANDARD ROUTE</span><h3><Navigation size={16}/> Normal Route</h3></div><strong>{normalDistance!=null?Number(normalDistance).toFixed(1):"—"}<small> km</small></strong></div>
                 <div className="route-choice-risk"><span>AI RISK</span><b className={`route-risk-value ${riskClass}`}>{data?riskScore:"—"}<small>/100</small></b><em>{data?riskLevel:"PENDING"}</em></div>
               </div>
               <div className={`route-choice-card safe ${selectedRoute==="safe"?"selected-result":""}`} onClick={()=>focusRouteOnMap("safe")} role="button" tabIndex={0} onKeyDown={e=>e.key==="Enter"&&focusRouteOnMap("safe")}>
                 <div className="route-choice-top"><div><span>AI / ALTERNATE ROUTE</span><h3><ShieldCheck size={16}/> Safe Route</h3></div><strong>{safeDistance!=null?Number(safeDistance).toFixed(1):"—"}<small> km</small></strong></div>
                 <div className="route-choice-risk"><span>AI RISK</span><b className={`route-risk-value ${safeRiskLevel==="HIGH"?"high":safeRiskLevel==="MEDIUM"?"medium":"low"}`}>{safeRiskScore!=null?Number(safeRiskScore).toFixed(0):"—"}<small>/100</small></b><em>{safeRiskLevel||"SCORE PENDING"}</em></div>
                 <div className="route-choice-foot">Extra distance: <strong>{extraDistance!=null?`${Number(extraDistance).toFixed(1)} km`:"—"}</strong></div>
               </div>
               <div className={`route-choice-card risk ${selectedRoute==="risk"?"selected-result":""}`} onClick={openRiskDetails} role="button" tabIndex={0} onKeyDown={e=>e.key==="Enter"&&openRiskDetails()}>
                 <div className="route-choice-top"><div><span>AI DECISION SIGNAL</span><h3><BrainCircuit size={16}/> Route Risk</h3></div><strong className={`risk-number ${riskClass}`}>{data?riskScore:"—"}</strong></div><p>{data?riskReason:"Run route analysis to generate the AI risk score."}</p>
               </div>
               <div className="mini-decision-banner"><span>RECOMMENDATION</span><strong>{data?recommendation:"Ready to analyze route"}</strong><small>Risk-aware routing decision</small></div>
             </aside>
           </section>

           <section className="route-analysis-grid">
             <div className="analysis-card why-risk-card"><div className="analysis-card-header"><div><span>AI EXPLANATION</span><h2>Why Is This Route Risky?</h2></div><div className={`analysis-score ${riskClass}`}>{data?riskScore:"—"}<small>/100</small></div></div>
               <div className="risk-factor-grid"><div><span>🌧️</span><div><strong>Rainfall Impact</strong><small>Heavy rainfall can reduce route accessibility.</small></div></div><div><span>🌊</span><div><strong>Flood Exposure</strong><small>Water accumulation may affect road connectivity.</small></div></div><div><span>⛰️</span><div><strong>Landslide Concern</strong><small>Mountain terrain increases disruption risk.</small></div></div><div><span>📍</span><div><strong>Route Risk Level</strong><small>Current AI assessment: <b>{data?riskLevel:"PENDING"}</b></small></div></div></div>
             </div>
             <div className="analysis-card safe-analysis-card"><div className="analysis-card-header"><div><span>ALTERNATE ROUTE ANALYSIS</span><h2>Safe Route Risk Comparison</h2></div><ShieldCheck size={24} className="safe-header-icon"/></div>
               <div className="comparison-row"><div><span>Normal Route</span><strong className={`comparison-risk ${riskClass}`}>{data?riskScore:"—"}</strong><small>{data?riskLevel:"PENDING"}</small></div><div className="comparison-arrow">→</div><div><span>Safe Route</span><strong className="comparison-risk safe">{safeRiskScore!=null?Number(safeRiskScore).toFixed(0):"—"}</strong><small>{safeRiskLevel||"AI SCORE PENDING"}</small></div></div>
               <div className="comparison-metrics"><div><span>Risk reduction</span><strong>{riskReduction!=null?`${riskReduction} pts`:"—"}</strong></div><div><span>Extra distance</span><strong>{extraDistance!=null?`${Number(extraDistance).toFixed(1)} km`:"—"}</strong></div><div><span>Extra time</span><strong>{extraTime!=null?`${Number(extraTime).toFixed(0)} min`:"—"}</strong></div></div>
               <div className="comparison-note">{safeRiskScore!=null?"Alternate route is evaluated using the same AI risk framework before recommendation.":"Safe-route geometry is available; alternate-route AI scoring will appear here when returned by the backend."}</div>
             </div>
           </section>

           <section className="ai-route-insights-card"><div className="ai-insights-heading"><div><span>AI ROUTE INTELLIGENCE</span><h2>AI Route Insights</h2><p>Decision-ready explanation for logistics operators.</p></div><div className="insight-status">● {backendOnline?"Backend connected":"Offline"}</div></div>
             <div className="insight-summary-grid"><div><span>Current assessment</span><strong>{data?`${riskLevel} • ${riskScore}/100`:"Awaiting analysis"}</strong></div><div><span>Route trade-off</span><strong>{extraDistance!=null?`+${Number(extraDistance).toFixed(1)} km`:"—"}</strong></div><div><span>AI recommendation</span><strong>{data?recommendation:"Run analysis"}</strong></div></div>
             <div className="insight-explanation"><div className="insight-explanation-icon"><BrainCircuit size={20}/></div><div><strong>{data?"Why this decision?":"Ready for route intelligence"}</strong><p>{data?riskReason:"Select a source and destination, then run route analysis to generate the route-risk assessment."}</p></div></div>
           </section>

{/* =================================================
              ANALYTICS
          ================================================= */}

          <section className="analytics-grid">

            {/* DELIVERY */}

            <div className="analytics-card">

              <div className="card-header">

                <div>
                  <div className="card-title">
                    <Package size={18} />
                    Delivery Performance
                  </div>

                  <span>
                    Last 7 Days
                  </span>
                </div>

                <strong className="chart-number">
                  1,254
                </strong>

              </div>

              <div className="chart-wrapper">

                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <BarChart
                    data={deliveryData}
                  >
                    <CartesianGrid
                      stroke="rgba(255,255,255,.06)"
                      vertical={false}
                    />

                    <XAxis
                      dataKey="day"
                      stroke="#607789"
                      fontSize={10}
                      axisLine={false}
                      tickLine={false}
                    />

                    <YAxis
                      stroke="#607789"
                      fontSize={10}
                      axisLine={false}
                      tickLine={false}
                    />

                    <Tooltip
                      contentStyle={{
                        background:
                          "#071522",
                        border:
                          "1px solid rgba(0,220,255,.25)",
                        borderRadius: 10,
                        color: "#fff",
                      }}
                    />

                    <Bar
                      dataKey="deliveries"
                      fill="#00bfe8"
                      radius={[
                        5,
                        5,
                        0,
                        0,
                      ]}
                    />
                  </BarChart>
                </ResponsiveContainer>

              </div>

            </div>

            {/* EFFICIENCY */}

            <div className="analytics-card">

              <div className="card-header">

                <div>
                  <div className="card-title">
                    <Activity size={18} />
                    Route Efficiency
                  </div>

                  <span>
                    This Month
                  </span>
                </div>

                <strong className="chart-number">
                  92%
                </strong>

              </div>

              <div className="chart-wrapper">

                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <AreaChart
                    data={efficiencyData}
                  >

                    <defs>
                      <linearGradient
                        id="efficiencyGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#00cfe8"
                          stopOpacity={0.35}
                        />

                        <stop
                          offset="100%"
                          stopColor="#00cfe8"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>

                    <CartesianGrid
                      stroke="rgba(255,255,255,.06)"
                      vertical={false}
                    />

                    <XAxis
                      dataKey="day"
                      stroke="#607789"
                      fontSize={9}
                      axisLine={false}
                      tickLine={false}
                    />

                    <YAxis
                      domain={[0, 100]}
                      stroke="#607789"
                      fontSize={9}
                      axisLine={false}
                      tickLine={false}
                    />

                    <Tooltip
                      contentStyle={{
                        background:
                          "#071522",
                        border:
                          "1px solid rgba(0,220,255,.25)",
                        borderRadius: 10,
                        color: "#fff",
                      }}
                    />

                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#00d8f4"
                      strokeWidth={2}
                      fill="url(#efficiencyGradient)"
                    />

                  </AreaChart>
                </ResponsiveContainer>

              </div>

            </div>

            {/* ACCESSIBILITY */}

            <div className="analytics-card">

              <div className="card-header">

                <div>
                  <div className="card-title">
                    <LocateFixed size={18} />
                    Regional Accessibility
                  </div>

                  <span>
                    By State
                  </span>
                </div>

              </div>

              <div className="state-list">

                {stateData.map((item) => (
                  <div
                    className="state-row"
                    key={item.state}
                  >

                    <span>
                      {item.state}
                    </span>

                    <div className="state-bar">
                      <i
                        style={{
                          width: `${item.score}%`,
                        }}
                      ></i>
                    </div>

                    <strong>
                      {item.score}%
                    </strong>

                  </div>
                ))}

              </div>

            </div>

            {/* SYSTEM STATUS */}

            <div className="analytics-card system-card">

              <div className="card-header">

                <div>
                  <div className="card-title">
                    <BrainCircuit size={18} />
                    AI System Status
                  </div>

                  <span>
                    Operational health
                  </span>
                </div>

              </div>

              <div className="system-ring">

                <div className="system-ring-inner">
                  <CheckCircle2 size={28} />
                  <strong>
                    Operational
                  </strong>
                  <span>
                    All systems running
                  </span>
                </div>

              </div>

              <div className="system-stats">

                <div>
                  <span>Data Sources</span>
                  <strong>
                    <i></i>
                    12/12
                  </strong>
                </div>

                <div>
                  <span>Uptime</span>
                  <strong>
                    99.8%
                  </strong>
                </div>

              </div>

            </div>

          </section>
            </>
          )}

          {/* =================================================
              ERROR
          ================================================= */}

          {error && (
            <div className="error-banner">

              <AlertTriangle size={19} />

              <div>
                <strong>
                  Route Analysis Error
                </strong>

                <p>{error}</p>

                <small>
                  Make sure FastAPI is running on
                  https://ai-routex-backend.onrender.com
                </small>
              </div>

              <button
                onClick={() =>
                  setError("")
                }
              >
                <X size={17} />
              </button>

            </div>
          )}

          {/* =================================================
              LOADING
          ================================================= */}

          {loading && (
            <div className="loading-banner">

              <div className="loading-spinner"></div>

              <div>
                <strong>
                  AI-RouteX is analyzing the route...
                </strong>

                <span>
                  Evaluating accessibility,
                  environmental risk and
                  route alternatives.
                </span>
              </div>

            </div>
          )}
            </>
          )}

          {showLoginModal && (
            <div className="modal-backdrop" onClick={() => setShowLoginModal(false)}>
              <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={() => setShowLoginModal(false)}><X size={18} /></button>
                <div className="modal-icon"><User size={22} /></div>
                <span className="modal-eyebrow">AI-ROUTEX USER ACCESS</span>
                <h3>Sign in</h3>
                <p>Login to save your operator session on this device.</p>
                <form className="login-form" onSubmit={handleLogin}>
                  <label>Email<input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="operator@example.com" autoComplete="email" /></label>
                  <label>Password<input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="Minimum 4 characters" autoComplete="current-password" /></label>
                  {loginError && <div className="login-error">{loginError}</div>}
                  <button className="modal-primary-btn" type="submit">Login</button>
                </form>
                <div className="auth-switch">
                  <span>Don't have an account?</span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowLoginModal(false);
                      setShowSignupModal(true);
                      setSignupError("");
                    }}
                  >
                    Create Account
                  </button>
                </div>
              </div>
            </div>
          )}

          {showSignupModal && (
            <div
              className="modal-backdrop"
              onClick={() => setShowSignupModal(false)}
            >
              <div
                className="modal-card"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="modal-close"
                  onClick={() => setShowSignupModal(false)}
                  aria-label="Close"
                >
                  <X size={18} />
                </button>

                <div className="modal-icon">
                  <User size={22} />
                </div>

                <span className="modal-eyebrow">AI-ROUTEX ACCOUNT</span>

                <h3>Create Account</h3>
                <p>Create your operator account to access AI-RouteX.</p>

                <form className="login-form" onSubmit={handleSignup}>
                  <label>
                    Name
                    <input
                      type="text"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      placeholder="Your name"
                    />
                  </label>

                  <label>
                    Email
                    <input
                      type="email"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      placeholder="operator@example.com"
                    />
                  </label>

                  <label>
                    Password
                    <input
                      type="password"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      placeholder="Create a password"
                    />
                  </label>

                  {signupError && (
                    <div className="login-error">{signupError}</div>
                  )}

                  <button
                    className="modal-primary-btn"
                    type="submit"
                  >
                    Create Account
                  </button>
                </form>

                <div className="auth-switch">
                  <span>Already have an account?</span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSignupModal(false);
                      setShowLoginModal(true);
                      setSignupError("");
                    }}
                  >
                    Sign in
                  </button>
                </div>
              </div>
            </div>
          )}

          {showRiskModal && (
            <div className="risk-modal-backdrop" onClick={() => setShowRiskModal(false)}>
              <div className="risk-modal" onClick={(e) => e.stopPropagation()}>
                <button className="risk-modal-close" onClick={() => setShowRiskModal(false)} aria-label="Close">
                  <X size={18} />
                </button>
                <div className="risk-modal-icon"><BrainCircuit size={24} /></div>
                <span className="risk-modal-eyebrow">AI ROUTE RISK ASSESSMENT</span>
                <h3>{riskScore !== null ? `${riskScore}/100` : "Risk unavailable"}</h3>
                <strong className={`risk-modal-level ${riskClass}`}>{data?.risk?.level || "UNKNOWN"}</strong>
                <p>{riskReason || "Run route analysis to generate AI risk information."}</p>
                <div className="risk-modal-grid">
                  <div><span>Normal Route</span><strong>{normalDistance !== null ? `${Number(normalDistance).toFixed(1)} km` : "—"}</strong></div>
                  <div><span>Alternate Route</span><strong>{safeDistance !== null ? `${Number(safeDistance).toFixed(1)} km` : "—"}</strong></div>
                </div>
                <div className="risk-modal-recommendation"><span>AI Recommendation</span><strong>{recommendation}</strong></div>
              </div>
            </div>
          )}

        </main>

      </div>
    </div>
  );
}

export default App;
