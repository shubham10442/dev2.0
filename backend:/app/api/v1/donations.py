from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional
import os, base64, uuid

from app.core.database import get_db
from app.models.donation import Donation
from app.models.claim import Claim
from app.models.user import User
from app.models.activity import ActivityLog
from app.schemas.donation import DonationCreate
from app.services.impact_calculator import calculate_haversine_distance, estimate_meals_from_title
from app.services.sse_broadcaster import sse_hub

router = APIRouter(tags=["Listings & Donations"])

def save_image_file(b64_str: str) -> Optional[str]:
    if not b64_str or b64_str.startswith("http") or b64_str.startswith("/uploads"):
        return b64_str
    try:
        header, encoded = b64_str.split(",", 1)
        ext = "jpg"
        if "png" in header: ext = "png"
        elif "webp" in header: ext = "webp"
        
        fname = f"ann-food-{uuid.uuid4().hex[:8]}.{ext}"
        os.makedirs("uploads", exist_ok=True)
        fpath = os.path.join("uploads", fname)
        with open(fpath, "wb") as fh:
            fh.write(base64.b64decode(encoded))
        return f"/uploads/{fname}"
    except Exception:
        return b64_str

@router.get("/listings")
def get_listings(
    q: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    sort: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Donation).order_by(Donation.created_at.desc())
    items = query.all()
    
    result = []
    for d in items:
        dist_km = calculate_haversine_distance(lat or 28.6139, lng or 77.2090, d.lat, d.lng) if (lat and lng) else 1.2
        if q:
            term = q.lower().strip()
            if term not in d.title.lower() and term not in d.donor_name.lower():
                continue
                
        result.append({
            "id": d.numeric_id,
            "title": d.title,
            "donor": d.donor_name,
            "donorEmail": d.donor_email,
            "dist": f"{dist_km} km",
            "distanceKm": dist_km,
            "lat": d.lat,
            "lng": d.lng,
            "gpsAddress": d.gps_address,
            "image": d.image_url,
            "icon": d.icon,
            "expires": d.expiry_string,
            "tag": d.tag,
            "tagColor": d.tag_color,
            "status": d.status,
            "claimed": d.claimed,
            "claimedBy": d.claimed_by_name,
            "extra": d.extra_info
        })
        
    if sort == "nearest":
        result.sort(key=lambda x: x["distanceKm"])
        
    return {"success": True, "count": len(result), "data": result}

@router.post("/listings")
async def create_listing(
    payload: DonationCreate,
    bg_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    numeric_id = int(datetime.utcnow().timestamp() * 1000)
    img_path = save_image_file(payload.image) if payload.image else None
    servings = payload.servings or estimate_meals_from_title(payload.title)
    
    new_d = Donation(
        numeric_id=numeric_id,
        title=payload.title,
        donor_name=payload.donor or "ANN Kitchen Donor",
        donor_email=payload.donorEmail or "chef.royalspice@gmail.com",
        servings=servings,
        lat=payload.lat or 28.6139,
        lng=payload.lng or 77.2090,
        gps_address=payload.gpsAddress or "ANN Verified Station",
        image_url=img_path,
        icon=payload.icon or "🍲",
        expires_at=datetime.utcnow() + timedelta(hours=3),
        expiry_string=payload.expires,
        tag="Just Listed",
        tag_color="emerald",
        status="Awaiting NGO Claim",
        claimed=False,
        extra_info="Ready for Pickup"
    )
    db.add(new_d)
    db.add(ActivityLog(
        type="LISTING_CREATED",
        title=f"{new_d.donor_name} listed surplus food",
        description=f"{new_d.title} ({servings} servings)"
    ))
    db.commit()
    db.refresh(new_d)
    
    # Broadcast realtime event
    await sse_hub.broadcast("listing:created", {"id": numeric_id, "title": new_d.title})
    
    return {"success": True, "message": "Surplus food broadcast to ANN network", "data": {"id": numeric_id}}

@router.post("/listings/{id}/claim")
async def claim_listing(id: int, payload: dict, db: Session = Depends(get_db)):
    d = db.query(Donation).filter(Donation.numeric_id == id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Donation not found")
    if d.claimed:
        raise HTTPException(status_code=400, detail="Food item is already claimed")
        
    ngo_name = payload.get("ngo", "Hope Shelter Network")
    d.claimed = True
    d.claimed_by_name = ngo_name
    d.claimed_at = datetime.utcnow()
    d.status = "Driver Dispatched"
    d.extra_info = "Driver Assigned • ETA ~15m"
    
    claim = Claim(
        donation_id=d.id,
        ngo_name=ngo_name,
        ngo_email="contact.hopeshelter@gmail.com",
        status="Driver Dispatched"
    )
    db.add(claim)
    db.commit()
    
    await sse_hub.broadcast("listing:claimed", {"id": id, "claimedBy": ngo_name})
    return {"success": True, "message": "Food successfully claimed for relief distribution"}

@router.post("/listings/{id}/complete")
async def complete_handover(id: int, db: Session = Depends(get_db)):
    d = db.query(Donation).filter(Donation.numeric_id == id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Donation not found")
        
    d.status = "Delivered & Distributed"
    d.extra_info = "Handover Complete • Distributed"
    d.completed_at = datetime.utcnow()
    
    donor_user = db.query(User).filter(User.email == d.donor_email).first()
    if donor_user and donor_user.profile:
        donor_user.profile.meals_diverted += d.servings
        donor_user.profile.carbon_offset_kg = round(donor_user.profile.meals_diverted * 0.574, 1)
        
    db.commit()
    await sse_hub.broadcast("listing:completed", {"id": id})
    return {"success": True, "message": "Handover and distribution verified"}

@router.delete("/listings/{id}")
async def delete_listing(id: int, db: Session = Depends(get_db)):
    d = db.query(Donation).filter(Donation.numeric_id == id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Donation not found")
    db.delete(d)
    db.commit()
    await sse_hub.broadcast("listing:deleted", {"id": id})
    return {"success": True, "message": "Listing cancelled successfully"}