import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base

class Claim(Base):
    __tablename__ = "claims"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    donation_id = Column(String(36), ForeignKey("donations.id", ondelete="CASCADE"), unique=True, nullable=False)
    ngo_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    ngo_name = Column(String(255), nullable=False)
    ngo_email = Column(String(255), nullable=False)
    status = Column(String(50), default="Driver Dispatched")
    claim_time = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    delivery_notes = Column(Text, nullable=True)

    donation = relationship("Donation", back_populates="claim_record")
    ngo_rel = relationship("User", back_populates="claims")