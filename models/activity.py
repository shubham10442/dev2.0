import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, JSON
from app.core.database import Base

class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    type = Column(String(50), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(String(500), nullable=False)
    meta = Column(JSON, default=dict)
    timestamp = Column(DateTime, default=datetime.utcnow)

class OTPVerification(Base):
    __tablename__ = "otp_verifications"

    email = Column(String(255), primary_key=True)
    otp_code = Column(String(10), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    attempts = Column(String(10), default="0")