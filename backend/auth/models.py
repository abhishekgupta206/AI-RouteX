from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

class VehicleLocation(Base):
    __tablename__ = "vehicle_locations"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    vehicle_id: Mapped[str] = mapped_column(
        String(100),
        index=True,
        nullable=False,
    )

    shipment_id: Mapped[str] = mapped_column(
        String(100),
        index=True,
        nullable=False,
    )

    latitude: Mapped[float] = mapped_column(
        nullable=False,
    )

    longitude: Mapped[float] = mapped_column(
        nullable=False,
    )

    speed_kmh: Mapped[float | None] = mapped_column(
        nullable=True,
    )

    heading: Mapped[float | None] = mapped_column(
        nullable=True,
    )

    timestamp: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )