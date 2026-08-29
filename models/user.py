import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, Float, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=True)
    name = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="donor")  # donor, ngo, admin
    photo_url = Column(Text, nullable=True)
    phone = Column(String(50), nullable=True, default="+91 98765 43210")
    address = Column(Text, nullable=True, default="Central Zone Station")
    verified = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    profile = relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    donations = relationship("Donation", back_populates="donor_rel", foreign_keys="Donation.donor_id")
    claims = relationship("Claim", back_populates="ngo_rel")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    preferences = relationship("NotificationPreference", back_populates="user", uselist=False, cascade="all, delete-orphan")
    user_badges = relationship("UserBadge", back_populates="user", cascade="all, delete-orphan")
    impact_records = relationship("ImpactRecord", back_populates="user", cascade="all, delete-orphan")

class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    
    kitchen_type = Column(String(255), nullable=True, default="Banquets & Commercial Kitchen")
    shelter_type = Column(String(255), nullable=True, default="Community Relief & Orphanage Care")
    license_id = Column(String(100), nullable=True, default="FSSAI-10019022008432")
    reg_id = Column(String(100), nullable=True, default="NGO-DARPAN/DL/2019/0248819")
    section_80g_status = Column(String(100), nullable=True, default="Active & Verified")
    operating_hours = Column(String(100), nullable=True, default="10:00 AM - 11:30 PM")
    capacity = Column(String(100), nullable=True, default="350 Meals / Day")
    fleet = Column(String(100), nullable=True, default="4 Delivery Vans, 2 Electric Bikes")
    
    meals_diverted = Column(Integer, default=620)
    meals_served = Column(Integer, default=1850)
    carbon_offset_kg = Column(Float, default=355.8)
    
    lat = Column(Float, default=28.6139)
    lng = Column(Float, default=77.2090)
    gps_address = Column(Text, default="42 Heritage Blvd, Central Sector")

    user = relationship("User", back_populates="profile")