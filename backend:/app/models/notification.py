import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(String(500), nullable=False)
    type = Column(String(50), default="donation_alert")
    is_read = Column(Boolean, default=False)
    data_meta = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notifications")

class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    new_pickups = Column(Boolean, default=True)
    claims = Column(Boolean, default=True)
    matches = Column(Boolean, default=True)
    reminders = Column(Boolean, default=True)
    expiring_soon = Column(Boolean, default=True)
    impact_milestones = Column(Boolean, default=True)
    badges = Column(Boolean, default=True)
    emergency_alerts = Column(Boolean, default=True)

    user = relationship("User", back_populates="preferences")