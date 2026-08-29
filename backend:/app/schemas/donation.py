from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class DonationCreate(BaseModel):
    title: str
    expires: str
    donor: Optional[str] = "ANN Royal Spice"
    donorEmail: Optional[str] = "chef.royalspice@gmail.com"
    lat: Optional[float] = 28.6139
    lng: Optional[float] = 77.2090
    gpsAddress: Optional[str] = "ANN Verified Station"
    image: Optional[str] = None
    icon: Optional[str] = "🍲"
    servings: Optional[int] = None

class DonationResponse(BaseModel):
    id: int
    uuid: str
    title: str
    donor: str
    donorEmail: str
    dist: str
    lat: float
    lng: float
    gpsAddress: str
    image: Optional[str] = None
    icon: str
    expires: str
    expiresAt: datetime
    tag: str
    tagColor: str
    status: str
    claimed: bool
    claimedBy: Optional[str] = None
    extra: Optional[str] = None