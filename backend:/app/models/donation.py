import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, Float, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base

class Donation(Base):
    __tablename__ = "donations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    numeric_id = Column(Integer, unique=True, index=True, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(100), default="Cooked Meals")
    food_type = Column(String(50), default="veg")
    servings = Column(Integer, default=25)
    
    donor_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    donor_name = Column(String(255), nullable=False, default="ANN Kitchen Donor")
    donor_email = Column(String(255), nullable=False, default="chef.royalspice@gmail.com")
    
    lat = Column(Float, default=28.6139)
    lng = Column(Float, default=77.2090)
    gps_address = Column(Text, default="ANN Verified Station")
    
    image_url = Column(Text, nullable=True)
    icon = Column(String(20), default="🍲")
    
    expires_at = Column(DateTime, nullable=False)
    expiry_string = Column(String(50), default="2h 30m")
    
    tag = Column(String(50), default="Just Listed")
    tag_color = Column(String(30), default="emerald")
    status = Column(String(50), default="Awaiting NGO Claim")
    claimed = Column(Boolean, default=False)
    
    claimed_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    claimed_by_name = Column(String(255), nullable=True)
    claimed_by_email = Column(String(255), nullable=True)
    claimed_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    extra_info = Column(String(255), default="Ready for Pickup")
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    donor_rel = relationship("User", foreign_keys=[donor_id], back_populates="donations")
    claim_record = relationship("Claim", back_populates="donation", uselist=False, cascade="all, delete-orphan")