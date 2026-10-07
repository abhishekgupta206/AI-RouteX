\# AI-RouteX 🚚



\## AI-Based Smart Logistics \& Accessibility Intelligence Platform for the North Eastern Region



AI-RouteX is an AI-assisted logistics intelligence platform designed to support risk-aware route decisions in the North Eastern Region (NER), where heavy rainfall, flooding, landslides and road accessibility disruptions can affect the movement of essential goods.



\## Problem Statement



Logistics operations in the North Eastern Region face challenges due to rugged terrain, heavy rainfall, floods, landslides and disrupted road connectivity.



Conventional navigation systems primarily focus on shortest or fastest routes. Logistics operators also need to understand the potential risk associated with a route before making an operational decision.



\## Our Solution



AI-RouteX combines:



\- GIS-based route generation

\- AI-based route risk prediction

\- Environmental risk assessment

\- Normal vs alternate route comparison

\- GPS-based vehicle tracking

\- Logistics monitoring dashboard

\- Explainable route-risk insights



The system generates candidate routes and evaluates their predicted risk so that operators can make informed logistics decisions.



\## Core AI Workflow



Source → Destination

&#x20;       ↓

Route Generation

&#x20;       ↓

Normal + Alternate Routes

&#x20;       ↓

Feature Extraction for Each Route

&#x20;       ↓

AI Risk Prediction

&#x20;       ↓

Risk Comparison

&#x20;       ↓

AI Route Recommendation



Each candidate route is evaluated independently rather than assuming that an alternate route is automatically safe.



\## Key Features



\### 1. AI Route Risk Prediction

Predicts an operational route-risk score using route and environmental features.



\### 2. Normal vs Alternate Route Comparison

The system evaluates both the normal and alternate route independently and compares:



\- Distance

\- AI risk score

\- Risk level

\- Risk reduction

\- Distance trade-off



\### 3. Explainable Risk Analysis

Provides route-risk factors such as:



\- Rainfall risk

\- Flood exposure

\- Landslide risk

\- Overall route-risk score



\### 4. GPS Vehicle Tracking

Tracks vehicle location using GPS coordinates and sends location information to the backend for logistics monitoring.



\### 5. GIS Dashboard

Provides a centralized interface for route visualization, risk information and logistics monitoring.



\## Technology Stack



\### Frontend

\- React

\- Vite

\- JavaScript

\- HTML5

\- CSS3

\- Leaflet / GIS



\### Backend

\- Python

\- FastAPI

\- SQLAlchemy

\- SQLite / database layer

\- REST APIs



\### AI / Machine Learning

\- Python

\- scikit-learn

\- Pandas

\- Joblib



\### Routing

\- OSRM



\## Project Structure



```text

AI-RouteX/

│

├── backend/

│   ├── main.py

│   └── auth/

│

├── frontend/

│   ├── src/

│   ├── public/

│   ├── package.json

│   └── vite.config.js

│

├── models/

│   ├── ai\_routex\_risk\_model.pkl

│   ├── model\_features.pkl

│   └── risk\_threshold.pkl

│

├── docs/

│

├── .gitignore

└── README.md

