from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from auth.database import Base, engine, SessionLocal
from auth.routes import router as auth_router
from auth.models import User, VehicleLocation
from datetime import datetime

import json
import ssl
import urllib.parse
import urllib.request
import math
from pathlib import Path

import joblib
import pandas as pd

Base.metadata.create_all(bind=engine)
# =========================================================
# APP
# =========================================================

app = FastAPI(
    title="AI-RouteX Backend",
    version="2.0.0"
)
Base.metadata.create_all(bind=engine)
app.include_router(auth_router)
# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "https://ai-routex.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# AI MODEL
# =========================================================

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "models"

MODEL_FILE = MODEL_DIR / "ai_routex_risk_model.pkl"
THRESHOLD_FILE = MODEL_DIR / "risk_threshold.pkl"
FEATURES_FILE = MODEL_DIR / "model_features.pkl"


try:
    risk_model = joblib.load(MODEL_FILE)
    risk_threshold = float(joblib.load(THRESHOLD_FILE))
    model_features = list(joblib.load(FEATURES_FILE))

    MODEL_STATUS = "loaded"

except Exception as e:
    risk_model = None
    risk_threshold = 0.4
    model_features = []

    MODEL_STATUS = f"failed: {str(e)}"


# =========================================================
# REQUEST MODEL
# =========================================================

class RouteRequest(BaseModel):
    start_lat: float
    start_lon: float
    end_lat: float
    end_lon: float
class VehicleLocationRequest(BaseModel):
    vehicle_id: str
    shipment_id: str
    latitude: float
    longitude: float
    speed_kmh: float | None = None
    heading: float | None = None
    timestamp: str

@app.post("/api/v1/vehicle/location")
def update_vehicle_location(payload: VehicleLocationRequest):
    db = SessionLocal()

    try:
        location = VehicleLocation(
            vehicle_id=payload.vehicle_id,
            shipment_id=payload.shipment_id,
            latitude=payload.latitude,
            longitude=payload.longitude,
            speed_kmh=payload.speed_kmh,
            heading=payload.heading,
            timestamp=datetime.fromisoformat(
                payload.timestamp.replace("Z", "+00:00")
            ).replace(tzinfo=None),
        )

        db.add(location)
        db.commit()
        db.refresh(location)

        return {
            "status": "success",
            "message": "Vehicle location saved",
            "vehicle_id": payload.vehicle_id,
            "shipment_id": payload.shipment_id,
            "latitude": payload.latitude,
            "longitude": payload.longitude,
            "speed_kmh": payload.speed_kmh,
            "heading": payload.heading,
            "timestamp": payload.timestamp,
        }

    finally:
        db.close()
    
@app.get("/api/v1/vehicle/location/latest")
def get_latest_vehicle_location():
    db = SessionLocal()

    try:
        location = (
            db.query(VehicleLocation)
            .order_by(VehicleLocation.id.desc())
            .first()
        )

        if not location:
            return {
                "status": "not_found",
                "message": "No vehicle location available",
            }

        return {
            "status": "success",
            "vehicle_id": location.vehicle_id,
            "shipment_id": location.shipment_id,
            "latitude": location.latitude,
            "longitude": location.longitude,
            "speed_kmh": location.speed_kmh,
            "heading": location.heading,
            "timestamp": location.timestamp.isoformat(),
        }

    finally:
        db.close()
        
# =========================================================
# ROOT
# =========================================================

@app.get("/")
def root():
    return {
        "status": "success",
        "message": "AI-RouteX Backend is running",
        "service": "AI Route Intelligence API",
        "ai_model": MODEL_STATUS
    }


# =========================================================
# HEALTH CHECK
# =========================================================

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "backend": "online",
        "ai_model": MODEL_STATUS
    }


# =========================================================
# GEOGRAPHIC HELPERS
# =========================================================

def route_midpoint(
    start_lat,
    start_lon,
    end_lat,
    end_lon
):
    """
    Approximate geographic midpoint of a route.
    """

    return (
        (start_lat + end_lat) / 2.0,
        (start_lon + end_lon) / 2.0
    )


def coordinate_environment(
    lat,
    lon,
    route_length_km
):
    """
    Generate route-specific environmental inputs.

    IMPORTANT:
    These are prototype spatial environmental estimates,
    not live IMD observations.

    The values vary with route coordinates so that the
    trained model receives different environmental inputs
    for different routes.
    """

    # -----------------------------------------------------
    # Spatial variation
    # -----------------------------------------------------

    lat_component = abs(math.sin(math.radians(lat * 7.0)))
    lon_component = abs(math.cos(math.radians(lon * 9.0)))

    spatial_factor = (
        0.55 * lat_component +
        0.45 * lon_component
    )

    # -----------------------------------------------------
    # Route-specific rainfall estimates
    # -----------------------------------------------------

    rainfall_24h = (
        25.0 +
        spatial_factor * 70.0 +
        (route_length_km % 15.0)
    )

    rainfall_72h = (
        rainfall_24h * 1.8 +
        spatial_factor * 35.0
    )

    rainfall_7day = (
        rainfall_72h * 2.1 +
        spatial_factor * 80.0
    )

    # -----------------------------------------------------
    # Rainfall risk
    # -----------------------------------------------------

    rainfall_risk = min(
        100.0,
        rainfall_24h / 100.0 * 100.0
    )

    rainfall_72h_risk = min(
        100.0,
        rainfall_72h / 250.0 * 100.0
    )

    rainfall_7day_risk = min(
        100.0,
        rainfall_7day / 500.0 * 100.0
    )

    # -----------------------------------------------------
    # Flood risk
    # -----------------------------------------------------

    flood_risk = min(
        100.0,
        (
            rainfall_72h * 0.22 +
            rainfall_7day * 0.08 +
            spatial_factor * 20.0
        )
    )

    # -----------------------------------------------------
    # Landslide risk
    # -----------------------------------------------------

    landslide_risk = min(
        100.0,
        (
            rainfall_7day * 0.10 +
            rainfall_72h * 0.12 +
            spatial_factor * 30.0
        )
    )

    # -----------------------------------------------------
    # Distance from rainfall event
    # -----------------------------------------------------

    rain_distance_m = max(
        100.0,
        2500.0 - spatial_factor * 1800.0
    )

    # -----------------------------------------------------
    # Combined prototype risk
    # -----------------------------------------------------

    combined_risk = (
        rainfall_risk * 0.30 +
        rainfall_72h_risk * 0.20 +
        rainfall_7day_risk * 0.15 +
        flood_risk * 0.20 +
        landslide_risk * 0.15
    )

    return {
        "rainfall": round(rainfall_24h, 2),
        "rainfall_24h": round(rainfall_24h, 2),
        "rainfall_72h": round(rainfall_72h, 2),
        "rainfall_7day": round(rainfall_7day, 2),
        "rain_distance_m": round(rain_distance_m, 2),
        "rainfall_risk": round(rainfall_risk, 2),
        "rainfall_72h_risk": round(rainfall_72h_risk, 2),
        "rainfall_7day_risk": round(rainfall_7day_risk, 2),
        "flood_risk": round(flood_risk, 2),
        "landslide_risk": round(landslide_risk, 2),
        "risk_score": round(combined_risk, 2),
    }


# =========================================================
# AI MODEL PREDICTION
# =========================================================

def predict_ai_risk(
    road_lat,
    road_lon,
    route_length_km
):

    if risk_model is None:
        raise RuntimeError(
            "AI risk model could not be loaded."
        )

    # -----------------------------------------------------
    # Route-specific environmental inputs
    # -----------------------------------------------------

    environment = coordinate_environment(
        road_lat,
        road_lon,
        route_length_km
    )

    # -----------------------------------------------------
    # Complete model input
    # -----------------------------------------------------

    prediction_input = {
        "road_lat": road_lat,
        "road_lon": road_lon,
        "road_length_km": route_length_km,

        "rainfall": environment["rainfall"],
        "rainfall_24h": environment["rainfall_24h"],
        "rainfall_72h": environment["rainfall_72h"],
        "rainfall_7day": environment["rainfall_7day"],

        "rain_distance_m": environment["rain_distance_m"],

        "rainfall_risk": environment["rainfall_risk"],
        "rainfall_72h_risk": environment["rainfall_72h_risk"],
        "rainfall_7day_risk": environment["rainfall_7day_risk"],

        "flood_risk": environment["flood_risk"],
        "landslide_risk": environment["landslide_risk"],

        "risk_score": environment["risk_score"]
    }

    # -----------------------------------------------------
    # Exact feature order used during training
    # -----------------------------------------------------

    missing_features = [
        feature
        for feature in model_features
        if feature not in prediction_input
    ]

    if missing_features:
        raise RuntimeError(
            f"Missing model features: {missing_features}"
        )

    input_df = pd.DataFrame(
        [[prediction_input[feature] for feature in model_features]],
        columns=model_features
    )

    # -----------------------------------------------------
    # ML probability
    # -----------------------------------------------------

    probability = float(
        risk_model.predict_proba(input_df)[0][1]
    )

    # -----------------------------------------------------
    # Convert probability to 0-100
    # -----------------------------------------------------

    risk_score = round(
        probability * 100.0,
        2
    )

    # -----------------------------------------------------
    # Threshold
    # -----------------------------------------------------

    high_risk = int(
        probability >= risk_threshold
    )

    if risk_score >= 70:
        risk_level = "HIGH"

    elif risk_score >= 40:
        risk_level = "MEDIUM"

    else:
        risk_level = "LOW"

    # -----------------------------------------------------
    # Explanation
    # -----------------------------------------------------

    if risk_level == "HIGH":

        risk_reason = (
            "AI model indicates elevated disruption risk "
            "for this route under the estimated environmental "
            "conditions."
        )

    elif risk_level == "MEDIUM":

        risk_reason = (
            "AI model indicates moderate disruption risk "
            "for this route under the estimated environmental "
            "conditions."
        )

    else:

        risk_reason = (
            "AI model indicates relatively lower disruption "
            "risk for this route under the estimated "
            "environmental conditions."
        )

    return {
        "score": risk_score,
        "probability": round(probability, 4),
        "level": risk_level,
        "high_risk": high_risk,
        "threshold": risk_threshold,
        "reason": risk_reason,
        "model": "AI-RouteX Random Forest",
        "data_mode": "prototype spatial environmental estimates",
        "environment": environment
    }


# =========================================================
# ROUTE API
# =========================================================

@app.post("/api/v1/get-route")
def get_route(req: RouteRequest):

    # -----------------------------------------------------
    # INPUT COORDINATES
    # -----------------------------------------------------

    start_lon = req.start_lon
    start_lat = req.start_lat

    end_lon = req.end_lon
    end_lat = req.end_lat

    # -----------------------------------------------------
    # OSRM COORDINATES
    # -----------------------------------------------------

    coordinates = (
        f"{start_lon},{start_lat};"
        f"{end_lon},{end_lat}"
    )

    # -----------------------------------------------------
    # OSRM PARAMETERS
    # -----------------------------------------------------

    params = urllib.parse.urlencode({
        "alternatives": "3",
        "steps": "false",
        "overview": "full",
        "geometries": "geojson"
    })

    # -----------------------------------------------------
    # OSRM URL
    # -----------------------------------------------------

    url = (
        "https://router.project-osrm.org/"
        f"route/v1/driving/{coordinates}?{params}"
    )

    ssl_context = ssl._create_unverified_context()

    # =====================================================
    # CALL OSRM
    # =====================================================

    try:

        request = urllib.request.Request(
            url,
            headers={
                "User-Agent": "AI-RouteX/2.0"
            }
        )

        with urllib.request.urlopen(
            request,
            timeout=20,
            context=ssl_context
        ) as response:

            route_data = json.loads(
                response.read().decode("utf-8")
            )

    except Exception as e:

        return {
            "status": "error",
            "message": f"OSRM routing failed: {str(e)}"
        }

    # =====================================================
    # EXTRACT ROUTES
    # =====================================================

    routes = route_data.get("routes", [])

    if not routes:

        return {
            "status": "error",
            "message": "No road route found"
        }

    # =====================================================
    # NORMAL ROUTE
    # =====================================================

    normal = routes[0]

    normal_distance = normal["distance"] / 1000.0
    normal_duration = normal["duration"] / 60.0

    normal_geometry = [
        [lat, lon]
        for lon, lat in normal["geometry"]["coordinates"]
    ]

    # =====================================================
    # NORMAL ROUTE MIDPOINT
    # =====================================================

    normal_mid_lat, normal_mid_lon = route_midpoint(
        start_lat,
        start_lon,
        end_lat,
        end_lon
    )

    # =====================================================
    # NORMAL ROUTE AI RISK
    # =====================================================

    try:

        normal_ai_risk = predict_ai_risk(
            road_lat=normal_mid_lat,
            road_lon=normal_mid_lon,
            route_length_km=normal_distance
        )

    except Exception as e:

        return {
            "status": "error",
            "message": f"Normal route AI prediction failed: {str(e)}"
        }

    # =====================================================
    # ALTERNATE ROUTE
    # =====================================================

    alternate_ai_risk = None

    if len(routes) > 1:

        alternate = routes[1]

        safe_distance = alternate["distance"] / 1000.0
        safe_duration = alternate["duration"] / 60.0

        safe_geometry = [
            [lat, lon]
            for lon, lat
            in alternate["geometry"]["coordinates"]
        ]

        extra_distance = (
            safe_distance - normal_distance
        )

        extra_time = (
            safe_duration - normal_duration
        )

        route_source = "OSRM alternate route"

        # -------------------------------------------------
        # Alternate route midpoint
        # -------------------------------------------------

        if safe_geometry:

            middle_index = len(safe_geometry) // 2

            alternate_mid_lat = safe_geometry[middle_index][0]
            alternate_mid_lon = safe_geometry[middle_index][1]

        else:

            alternate_mid_lat = normal_mid_lat
            alternate_mid_lon = normal_mid_lon

        # -------------------------------------------------
        # Alternate route AI prediction
        # -------------------------------------------------

        try:

            alternate_ai_risk = predict_ai_risk(
                road_lat=alternate_mid_lat,
                road_lon=alternate_mid_lon,
                route_length_km=safe_distance
            )

        except Exception as e:

            return {
                "status": "error",
                "message": (
                    f"Alternate route AI prediction failed: {str(e)}"
                )
            }

    else:

        safe_distance = normal_distance
        safe_duration = normal_duration
        safe_geometry = normal_geometry

        extra_distance = 0.0
        extra_time = 0.0

        route_source = "OSRM normal route"
        
    # =====================================================
    # RISK COMPARISON
    # =====================================================

    risk_reduction_percent = None
    risk_difference = None
    safer_route = "normal"

    if alternate_ai_risk is not None:

        normal_score = float(normal_ai_risk["score"])
        alternate_score = float(alternate_ai_risk["score"])

        # Absolute risk difference
        risk_difference = round(
            normal_score - alternate_score,
            2
        )

        # Percentage risk reduction
        if normal_score > 0:
            risk_reduction_percent = round(
                ((normal_score - alternate_score) / normal_score) * 100,
                1
            )

        # Determine lower-risk route
        if alternate_score < normal_score:
            safer_route = "alternate"
        elif normal_score < alternate_score:
            safer_route = "normal"
        else:
            safer_route = "equal"
    # =====================================================
    # ROUTE RECOMMENDATION
    # =====================================================

    if alternate_ai_risk is not None:

        normal_score = normal_ai_risk["score"]
        alternate_score = alternate_ai_risk["score"]

        # Prefer alternate only when its risk is meaningfully lower.
        if alternate_score + 5 < normal_score:

            recommendation = (
                "AI recommends the alternate route because "
                "its predicted risk is lower."
            )

            recommended_route = "alternate"

        elif normal_score + 5 < alternate_score:

            recommendation = (
                "AI recommends the normal route because "
                "its predicted risk is lower."
            )

            recommended_route = "normal"

        else:

            recommendation = (
                "Both routes have comparable predicted risk. "
                "Prefer the shorter normal route."
            )

            recommended_route = "normal"

    else:

        if normal_ai_risk["level"] == "HIGH":

            recommendation = (
                "AI predicts HIGH risk, but no alternate "
                "OSRM route is currently available."
            )

        else:

            recommendation = (
                "Normal route is currently suitable based "
                "on the AI risk estimate."
            )

        recommended_route = "normal"

    # =====================================================
    # FINAL RESPONSE
    # =====================================================

    return {

        "status": "success",

        # -------------------------------------------------
        # NORMAL ROUTE AI RISK
        # -------------------------------------------------

        "risk": {
            "score": normal_ai_risk["score"],
            "probability": normal_ai_risk["probability"],
            "level": normal_ai_risk["level"],
            "high_risk": normal_ai_risk["high_risk"],
            "threshold": normal_ai_risk["threshold"],
            "reason": normal_ai_risk["reason"],
            "model": normal_ai_risk["model"],
            "data_mode": normal_ai_risk["data_mode"],
            "environment": normal_ai_risk["environment"]
        },

        # -------------------------------------------------
        # NORMAL ROUTE
        # -------------------------------------------------

        "normal_route": {

            "distance_km": round(
                normal_distance,
                2
            ),

            "duration_min": round(
                normal_duration,
                1
            ),

            "geometry": normal_geometry,

            "risk": normal_ai_risk
        },

        # -------------------------------------------------
        # ALTERNATE ROUTE
        # -------------------------------------------------

        "safe_route": {

            "distance_km": round(
                safe_distance,
                2
            ),

            "duration_min": round(
                safe_duration,
                1
            ),

            "extra_distance_km": round(
                max(extra_distance, 0),
                2
            ),

            "extra_time_min": round(
                max(extra_time, 0),
                1
            ),

            "geometry": safe_geometry,

            "source": route_source,

            "risk": alternate_ai_risk
        },

        # -------------------------------------------------
        # RECOMMENDATION
        # -------------------------------------------------

        "recommendation": recommendation,

        "recommended_route": recommended_route,

        # -------------------------------------------------
        # ROUTE COMPARISON
        # -------------------------------------------------

        "route_comparison": {

            "normal_risk": normal_ai_risk["score"],

            "alternate_risk": (
                alternate_ai_risk["score"]
                if alternate_ai_risk is not None
                else None
            ),

            "normal_risk_level": normal_ai_risk["level"],

            "alternate_risk_level": (
                alternate_ai_risk["level"]
                if alternate_ai_risk is not None
                else None
            ),

            "risk_difference": risk_difference,

            "risk_reduction_percent": risk_reduction_percent,

            "safer_route": safer_route
        },

        # -------------------------------------------------
        # ENGINE INFO
        # -------------------------------------------------

        "route_engine": {

            "road_network": "OpenStreetMap",

            "routing_engine": "OSRM",

            "ai_risk_engine": "AI-RouteX Random Forest",

            "ai_model_status": MODEL_STATUS
        }
    }