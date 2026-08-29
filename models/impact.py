import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class ImpactRecord(Base):
    __tablename__ = "impact_records"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    meals_count = Column(Integer, default=0)
    kg_diverted = Column(Float, default=0.0)
    co2_offset_kg = Column(Float, default=0.0)
    period_date = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="impact_records")